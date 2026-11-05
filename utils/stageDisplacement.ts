import * as T from 'three';
import {ImprovedNoise} from 'three/examples/jsm/math/ImprovedNoise.js';
import type {StageObject} from '../types';

/** CPU displacement is baked once per object edit, never once per camera frame.
 * UV seams may duplicate attributes, but share position nodes throughout
 * tessellation. This keeps the cut top, bevels and quarry sides watertight. */
export const STAGE_RELIEF_VERTEX_BUDGET=96000;
export const STAGE_RELIEF_TRIANGLE_BUDGET=156000;
const noise=new ImprovedNoise();
const clamp=(n:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,n));
const smooth=(lo:number,hi:number,n:number)=>{const t=clamp((n-lo)/(hi-lo),0,1);return t*t*(3-2*t);};
const seedFor=(id:string)=>{let s=2166136261;for(const c of id)s=Math.imul(s^c.charCodeAt(0),16777619);return (s>>>0)/4294967296*47+13;};

export function needsStageRelief(object:StageObject){
 return (object.material??'stone')==='stone' && object.shape!=='lattice' && object.surface!=='smooth' && reliefAmount(object)>0;
}

export function reliefAmount(object:StageObject){
 const explicit=(object as StageObject&{reliefDepth?:number}).reliefDepth;
 const depth=Number.isFinite(explicit)?explicit!:(object.shape==='rock'?.18:.09);
 return Math.min(clamp(depth,0,.35),Math.min(...object.size)*.22);
}

type Node={x:number;y:number;z:number;nx:number;ny:number;nz:number};
type Vertex={node:number;u:number;v:number};
type Face={a:number;b:number;c:number;material:number};
const edgeKey=(a:number,b:number)=>a<b?`${a}:${b}`:`${b}:${a}`;
const unit=(node:Node)=>{const length=Math.hypot(node.nx,node.ny,node.nz)||1;node.nx/=length;node.ny/=length;node.nz/=length;};

type ReliefTopology={
 /** Private CPU arrays, never attached directly to a BufferGeometry. */
 nodes:Float64Array;profile:Float64Array;vertexNodes:Uint32Array;uvs:Float32Array;indices:Uint32Array;nodeFaces:Uint32Array;
 groups:{start:number;count:number;materialIndex:number}[];
 support:number;spacing:number;passes:number;hasUV:boolean;version:number;
};
const CACHE_ENTRY_LIMIT=6,CACHE_VERTEX_LIMIT=320000;
const topologyCache=new Map<string,ReliefTopology>();
let cacheVertices=0,cacheBuilds=0,cacheHits=0,nextTopologyVersion=0;
export function stageReliefCacheStats(){return {entries:topologyCache.size,vertices:cacheVertices,builds:cacheBuilds,hits:cacheHits,maxEntries:CACHE_ENTRY_LIMIT,maxVertices:CACHE_VERTEX_LIMIT};}
export function clearStageReliefCache(){topologyCache.clear();cacheVertices=0;cacheBuilds=0;cacheHits=0;}

function topologyKey(geometry:T.BufferGeometry,object:StageObject){
 let a=2166136261,b=0x9e3779b9;
 const add=(v:number)=>{const n=Math.round(v*1e7);a=Math.imul(a^n,16777619);b=Math.imul(b^n,0x85ebca6b);};
 // Fresh geometries are generated for slider edits. Hash their actual source
 // data so equal inputs reuse topology without assuming UUID identity or
 // accidentally reusing a custom shape with different positions / UVs.
 for(const name of ['position','normal','uv']){
  const attribute=geometry.getAttribute(name);if(!attribute){add(-1);continue;}
  add(attribute.count);add(attribute.itemSize);
  for(let i=0;i<attribute.count;i++){add(attribute.getX(i));if(attribute.itemSize>1)add(attribute.getY(i));if(attribute.itemSize>2)add(attribute.getZ(i));}
 }
 if(geometry.index){add(geometry.index.count);for(let i=0;i<geometry.index.count;i++)add(geometry.index.getX(i));}else add(-2);
 for(const group of geometry.groups){add(group.start);add(group.count);add(group.materialIndex??0);}
 return `${object.id}|${object.shape??'box'}|${object.surface??''}|${object.size.join(',')}|${clamp(object.textureScale??1,.25,4)}|${a>>>0}:${b>>>0}`;
}

function rememberTopology(key:string,topology:ReliefTopology){
 topologyCache.set(key,topology);cacheVertices+=topology.vertexNodes.length;
 while(topologyCache.size>CACHE_ENTRY_LIMIT||cacheVertices>CACHE_VERTEX_LIMIT){
  const first=topologyCache.keys().next().value as string;const old=topologyCache.get(first)!;
  topologyCache.delete(first);cacheVertices-=old.vertexNodes.length;
 }
}

/** Vugs are an actual sculpted cavity, not a painted spot. Cell search is
 * restricted to nearby feature points; all coordinates are object-local. */
function pore(x:number,y:number,z:number,seed:number){
 const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);let closest=2;
 for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let c=-1;c<=1;c++){
  const gx=ix+a,gy=iy+b,gz=iz+c;
  const hash=Math.sin(gx*127.1+gy*311.7+gz*74.7+seed)*43758.5453;
  const fraction=hash-Math.floor(hash);
  // Sparse larger mineral voids avoid an evenly dimpled, rubber-like surface.
  if(fraction<.57)continue;
  const dx=x-gx-(.2+fraction*.6),dy=y-gy-(.2+((fraction*13)%1)*.6),dz=z-gz-(.2+((fraction*29)%1)*.6);
  closest=Math.min(closest,Math.hypot(dx,dy,dz));
 }
 return 1-smooth(.09,.33,closest);
}

function sampleRelief(node:Node,object:StageObject,seed:number){
 const density=clamp(object.textureScale??1,.25,4);
 const x=node.x*density,y=node.y*density,z=node.z*density;
 const n=(a:number,b:number,c:number)=>noise.noise(a+seed,b+seed*.37,c-seed*.61);
 const macro=n(x*1.35,y*1.15,z*1.35),grain=n(x*8.2,y*8.2,z*8.2),fine=n(x*19,y*19,z*19);
 const warp=n(x*.7,y*.5,z*.7);
 const surface=object.surface??(object.shape==='rock'?'mineral':'concrete');
 let relief:number;
 if(surface==='slate'){
  const layer=y*15+warp*.75+n(x*2,0,z*2)*.25;
  const ridge=smooth(.73,.95,.5+.5*Math.sin(layer*Math.PI*2));
  const split=1-smooth(.015,.085,Math.abs(n(x*1.7,y*.3,z*1.7)));
  relief=.27*macro+.22*Math.sin(layer*Math.PI*2)-.53*ridge-.28*split+.07*grain;
 }else if(surface==='travertine'){
  const layer=.5+.5*Math.sin(y*24+warp*2);
  const cavity=pore(x*5.7,y*10.5,z*5.7,seed);
  relief=.14*macro+.10*grain-.68*cavity-.18*smooth(.72,.96,layer);
 }else if(surface==='terrazzo'){
  // Ground terrazzo is dense and polished: aggregate outlines receive a
  // much shallower relief than porous quarried stone.
  const edge=1-smooth(.01,.10,Math.abs(n(x*6,y*6,z*6)));
  relief=.045*grain-.11*edge+.02*fine;
 }else if(surface==='concrete'){
  const cavity=pore(x*9.5,y*9.5,z*9.5,seed);
  relief=.20*macro+.15*grain+.06*fine-.45*cavity;
 }else{
  const split=1-smooth(.012,.095,Math.abs(n(x*1.9,y*2.3,z*1.9)+.2*n(x*5.2,y*4.7,z*5.2)));
  const strata=.5+.5*Math.sin(y*15+x*.8+z*.55+warp*2);
  const cavity=pore(x*4.5,y*5.5,z*4.5,seed);
  relief=.48*macro+.19*grain+.05*fine-.43*split-.24*cavity-.17*smooth(.78,.97,strata);
 }
 const top=smooth(.18,.88,node.ny);
 const q=Math.hypot(node.x/(object.size[0]/2),node.z/(object.size[2]/2));
 // The phone rests on a stable, gently cut central area. Exposed top edges
 // still contain concave mesostructure, but never protrude above h / 2.
 const support=smooth(.18,.47,q);
 const topRelief=-Math.abs(relief)*.72*support;
 return T.MathUtils.lerp(relief,topRelief,top);
}

/** Adds adaptive geometric displacement to existing stone shapes. Existing
 * caller geometry need not be densely subdivided. Returns a new geometry
 * when relief is active; the caller retains ownership of the input. */
export function subdivideAndDisplace(geometry:T.BufferGeometry,object:StageObject):T.BufferGeometry{
 if(!needsStageRelief(object))return geometry;
 if(!geometry.getAttribute('position')?.count)return geometry;
 const key=topologyKey(geometry,object);let topology=topologyCache.get(key);const cacheHit=!!topology;
 if(topology){topologyCache.delete(key);topologyCache.set(key,topology);cacheHits++;}
 else{topology=buildTopology(geometry,object);cacheBuilds++;rememberTopology(key,topology);}
 return bakeRelief(topology,geometry,object,cacheHit);
}

function buildTopology(geometry:T.BufferGeometry,object:StageObject):ReliefTopology{
 const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
 const nodes:Node[]=[],vertices:Vertex[]=[],nodeMap=new Map<string,number>(),vertexMap=new Map<string,number>();
 const tolerance=Math.max(1e-7,Math.max(...object.size)*1e-7);
 const vertex=(node:number,u:number,v:number)=>{
  const key=`${node}:${Math.round(u*1e7)}:${Math.round(v*1e7)}`;const known=vertexMap.get(key);if(known!==undefined)return known;
  const index=vertices.length;vertices.push({node,u,v});vertexMap.set(key,index);return index;
 };
 const sourceVertices:number[]=[];
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
  const key=`${Math.round(x/tolerance)}:${Math.round(y/tolerance)}:${Math.round(z/tolerance)}`;
  let id=nodeMap.get(key);
  if(id===undefined){id=nodes.length;nodes.push({x,y,z,nx:0,ny:0,nz:0});nodeMap.set(key,id);}
  if(normal){const node=nodes[id];node.nx+=normal.getX(i);node.ny+=normal.getY(i);node.nz+=normal.getZ(i);}
  sourceVertices.push(vertex(id,uv?uv.getX(i):0,uv?uv.getY(i):0));
 }
 const indices=geometry.index?.array??Array.from({length:position.count},(_,i)=>i);
 let faces:Face[]=[];
 for(let i=0;i+2<indices.length;i+=3){
  const a=sourceVertices[indices[i]],b=sourceVertices[indices[i+1]],c=sourceVertices[indices[i+2]];
  if(vertices[a].node===vertices[b].node||vertices[b].node===vertices[c].node||vertices[c].node===vertices[a].node)continue;
  const group=geometry.groups.find(g=>i>=g.start&&i<g.start+g.count);
  faces.push({a,b,c,material:group?.materialIndex??0});
 }
 if(!normal){for(const face of faces){
  const a=nodes[vertices[face.a].node],b=nodes[vertices[face.b].node],c=nodes[vertices[face.c].node];
  const bx=b.x-a.x,by=b.y-a.y,bz=b.z-a.z,cx=c.x-a.x,cy=c.y-a.y,cz=c.z-a.z;
  for(const v of [a,b,c]){v.nx+=by*cz-bz*cy;v.ny+=bz*cx-bx*cz;v.nz+=bx*cy-by*cx;}
 }}nodes.forEach(unit);
 let area=0;
 for(const face of faces){
  const a=nodes[vertices[face.a].node],b=nodes[vertices[face.b].node],c=nodes[vertices[face.c].node];
  const bx=b.x-a.x,by=b.y-a.y,bz=b.z-a.z,cx=c.x-a.x,cy=c.y-a.y,cz=c.z-a.z;
  area+=Math.hypot(by*cz-bz*cy,bz*cx-bx*cz,bx*cy-by*cx)/2;
 }
 const density=clamp(object.textureScale??1,.25,4);
 const spacing=Math.max(.055/density,Math.sqrt(area/STAGE_RELIEF_TRIANGLE_BUDGET)*1.8);
 const midpointNodes=new Map<string,number>();let passes=0;
 const midpoint=(a:number,b:number)=>{
  const va=vertices[a],vb=vertices[b],key=edgeKey(va.node,vb.node);let node=midpointNodes.get(key);
  if(node===undefined){
   const na=nodes[va.node],nb=nodes[vb.node];node=nodes.length;
   const middle={x:(na.x+nb.x)/2,y:(na.y+nb.y)/2,z:(na.z+nb.z)/2,nx:na.nx+nb.nx,ny:na.ny+nb.ny,nz:na.nz+nb.nz};unit(middle);nodes.push(middle);midpointNodes.set(key,node);
  }return vertex(node,(va.u+vb.u)/2,(va.v+vb.v)/2);
 };
 for(let pass=0;pass<9;pass++){
  const edges=new Map<string,{key:string;length:number;uses:number;attributes:Set<string>}>();
  for(const face of faces)for(const [a,b] of [[face.a,face.b],[face.b,face.c],[face.c,face.a]]){
   const va=vertices[a],vb=vertices[b],na=nodes[va.node],nb=nodes[vb.node];
   const length=(na.x-nb.x)**2+(na.y-nb.y)**2+(na.z-nb.z)**2;if(length<=spacing*spacing)continue;
   const key=edgeKey(va.node,vb.node);let edge=edges.get(key);
   if(!edge){edge={key,length,uses:0,attributes:new Set()};edges.set(key,edge);}
   edge.uses++;edge.attributes.add(edgeKey(a,b));
  }
  // Split longest shared edges first, including their neighbours. Partial
  // refinement therefore stays conforming while filling the bounded budget
  // instead of skipping a full level of detail on a large planar surface.
  const ranked=[...edges.values()].sort((a,b)=>b.length-a.length||a.key.localeCompare(b.key));
  const marked=new Set<string>();let predicted=faces.length,addedVertices=0;
  for(const edge of ranked)if(predicted+edge.uses<=STAGE_RELIEF_TRIANGLE_BUDGET&&vertices.length+addedVertices+edge.attributes.size<=STAGE_RELIEF_VERTEX_BUDGET){
   marked.add(edge.key);predicted+=edge.uses;addedVertices+=edge.attributes.size;
  }
  if(!marked.size)break;
  const next:Face[]=[];
  for(const face of faces){
   const {a,b,c,material}=face;
   const ab=marked.has(edgeKey(vertices[a].node,vertices[b].node)),bc=marked.has(edgeKey(vertices[b].node,vertices[c].node)),ca=marked.has(edgeKey(vertices[c].node,vertices[a].node));
   const mAB=ab?midpoint(a,b):-1,mBC=bc?midpoint(b,c):-1,mCA=ca?midpoint(c,a):-1;
   const add=(a:number,b:number,c:number)=>next.push({a,b,c,material});
   if(ab&&bc&&ca){add(a,mAB,mCA);add(b,mBC,mAB);add(c,mCA,mBC);add(mAB,mBC,mCA);}
   else if(ab&&bc){add(a,mAB,c);add(mAB,mBC,c);add(mAB,b,mBC);}
   else if(ab&&ca){add(a,mAB,mCA);add(mAB,b,c);add(mAB,c,mCA);}
   else if(bc&&ca){add(c,mCA,mBC);add(mCA,a,b);add(mCA,b,mBC);}
   else if(ab){add(a,mAB,c);add(mAB,b,c);}
   else if(bc){add(a,b,mBC);add(a,mBC,c);}
   else if(ca){add(a,b,mCA);add(b,c,mCA);}
   else add(a,b,c);
  }faces=next;passes++;
 }
 const seed=seedFor(object.id),halfHeight=object.size[1]/2;let support=-1,supportRadius=Infinity;
 const coordinates=new Float64Array(nodes.length*6),profile=new Float64Array(nodes.length),vertexNodes=new Uint32Array(vertices.length),uvs=new Float32Array(vertices.length*2),outputIndices=new Uint32Array(faces.length*3),nodeFaces=new Uint32Array(faces.length*3);
 for(let i=0;i<nodes.length;i++){
  const node=nodes[i];if(Math.abs(node.y-halfHeight)<Math.max(1e-5,object.size[1]*1e-6)&&node.ny>.8){
   const radius=node.x*node.x+node.z*node.z;if(radius<supportRadius){support=i;supportRadius=radius;}
  }
  const offset=i*6;coordinates[offset]=node.x;coordinates[offset+1]=node.y;coordinates[offset+2]=node.z;coordinates[offset+3]=node.nx;coordinates[offset+4]=node.ny;coordinates[offset+5]=node.nz;
  profile[i]=sampleRelief(node,object,seed);
 }
 vertices.forEach((v,i)=>{vertexNodes[i]=v.node;uvs[i*2]=v.u;uvs[i*2+1]=v.v;});
 faces.forEach((f,i)=>{const offset=i*3;outputIndices[offset]=f.a;outputIndices[offset+1]=f.b;outputIndices[offset+2]=f.c;nodeFaces[offset]=vertices[f.a].node;nodeFaces[offset+1]=vertices[f.b].node;nodeFaces[offset+2]=vertices[f.c].node;});
 const groups:{start:number;count:number;materialIndex:number}[]=[];
 if(geometry.groups.length){let start=0,material=faces[0]?.material??0;
  for(let i=1;i<=faces.length;i++)if(i===faces.length||faces[i].material!==material){groups.push({start:start*3,count:(i-start)*3,materialIndex:material});start=i;material=faces[i]?.material??0;}
 }
 return {nodes:coordinates,profile,vertexNodes,uvs,indices:outputIndices,nodeFaces,groups,support,spacing,passes,hasUV:!!uv,version:++nextTopologyVersion};
}

function bakeRelief(topology:ReliefTopology,geometry:T.BufferGeometry,object:StageObject,cacheHit:boolean){
 const {nodes:source,profile,vertexNodes,nodeFaces}=topology,nodeCount=profile.length;
 const nodePositions=new Float64Array(nodeCount*3),nodeNormals=new Float64Array(nodeCount*3);
 const halfHeight=object.size[1]/2,amount=reliefAmount(object)*(.7+.3*clamp((object.detailStrength??.65)/.65,0,1));
 for(let i=0;i<nodeCount;i++){
  const a=i*6,b=i*3,displacement=profile[i]*amount;
  nodePositions[b]=source[a]+source[a+3]*displacement;nodePositions[b+1]=Math.min(halfHeight,source[a+1]+source[a+4]*displacement);nodePositions[b+2]=source[a+2]+source[a+5]*displacement;
 }
 if(topology.support>=0)nodePositions[topology.support*3+1]=halfHeight;
 for(let i=0;i<nodeFaces.length;i+=3){
  const a=nodeFaces[i]*3,b=nodeFaces[i+1]*3,c=nodeFaces[i+2]*3;
  const bx=nodePositions[b]-nodePositions[a],by=nodePositions[b+1]-nodePositions[a+1],bz=nodePositions[b+2]-nodePositions[a+2];
  const cx=nodePositions[c]-nodePositions[a],cy=nodePositions[c+1]-nodePositions[a+1],cz=nodePositions[c+2]-nodePositions[a+2];
  const nx=by*cz-bz*cy,ny=bz*cx-bx*cz,nz=bx*cy-by*cx;
  nodeNormals[a]+=nx;nodeNormals[a+1]+=ny;nodeNormals[a+2]+=nz;nodeNormals[b]+=nx;nodeNormals[b+1]+=ny;nodeNormals[b+2]+=nz;nodeNormals[c]+=nx;nodeNormals[c+1]+=ny;nodeNormals[c+2]+=nz;
 }
 for(let i=0;i<nodeNormals.length;i+=3){const length=Math.hypot(nodeNormals[i],nodeNormals[i+1],nodeNormals[i+2])||1;nodeNormals[i]/=length;nodeNormals[i+1]/=length;nodeNormals[i+2]/=length;}
 const positions=new Float32Array(vertexNodes.length*3),normals=new Float32Array(vertexNodes.length*3);
 for(let i=0;i<vertexNodes.length;i++){
  const a=vertexNodes[i]*3,b=i*3;positions[b]=nodePositions[a];positions[b+1]=nodePositions[a+1];positions[b+2]=nodePositions[a+2];normals[b]=nodeNormals[a];normals[b+1]=nodeNormals[a+1];normals[b+2]=nodeNormals[a+2];
 }
 const result=new T.BufferGeometry();result.setAttribute('position',new T.BufferAttribute(positions,3));result.setAttribute('normal',new T.BufferAttribute(normals,3));
 // Only immutable CPU topology is cached. Output attributes and indices
 // remain private so disposal or edits never affect another live object.
 if(topology.hasUV)result.setAttribute('uv',new T.BufferAttribute(topology.uvs.slice(),2));result.setIndex(new T.BufferAttribute(topology.indices.slice(),1));
 for(const group of topology.groups)result.addGroup(group.start,group.count,group.materialIndex);
 result.userData={...geometry.userData,reliefGeometry:true,reliefDepth:reliefAmount(object),reliefResolution:topology.spacing,reliefPasses:topology.passes,reliefNodes:nodeCount,reliefTriangles:topology.indices.length/3,reliefTopologyVersion:topology.version,reliefTopologyCacheHit:cacheHit,reliefDepthChangesReuseTopology:true};
 result.computeBoundingBox();result.computeBoundingSphere();return result;
}
