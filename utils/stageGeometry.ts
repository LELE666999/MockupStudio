import * as T from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {ImprovedNoise} from 'three/examples/jsm/math/ImprovedNoise.js';
import {ConvexGeometry} from 'three/examples/jsm/geometries/ConvexGeometry.js';
import type {StageObject} from '../types';
import {subdivideAndDisplace} from './stageDisplacement.ts';
import {groovedTrayGeometry,satinSheetGeometry} from './groovedStudio.ts';
import {chromeRackGeometry} from './chromeStudio.ts';
import {brickCourtyardGeometry} from './brickStudio.ts';

const noise=new ImprovedNoise();
const seedFor=(id:string)=>[...id].reduce((n,c)=>(n*31+c.charCodeAt(0))%997,37)/37;
/** Shared macro folds keep separate woven yarn seated on the cloth core. */
export function stageClothHeight(o:StageObject,x:number,z:number){
 const [w,h,d]=o.size,edge=Math.max(Math.abs(x)/(w/2),Math.abs(z)/(d/2));
 const crease=(Math.sin(x*2.5+z*.8)+Math.sin(z*3.4-x*.5))*Math.pow(Math.min(1,edge),3)*.026;
 const fold=o.shape==='drape'?Math.sin(x*.7+z*.9)*.022:0;
 return h/2+Math.min(-.012,-Math.min(h*.14,.07)*(.5+.5*Math.sin(x*1.2+z*.5))-.035+crease+fold);
}
function combine(parts:T.BufferGeometry[],groups=false){
 // Keep the tube indices: flattening a woven mesh duplicates each vertex six
 // times and makes vertex memory and shadow rendering needlessly heavy.
 for(const part of parts)if(!part.index)part.setIndex(Array.from({length:part.getAttribute('position').count},(_,i)=>i));
 const result=mergeGeometries(parts,groups)!;
 parts.forEach(g=>g.dispose());return result;
}

export function wireLayout(size:StageObject['size']){
 const [w,h,d]=size,rim=Math.min(.16,w/12,d/12),thickness=Math.min(.11,h);
 const innerW=w-rim*2,innerD=d-rim*2;
 const nx=Math.min(28,Math.max(4,Math.round(innerW/.28))),nz=Math.min(28,Math.max(4,Math.round(innerD/.28)));
 const pitchX=innerW/nx,pitchZ=innerD/nz,radius=Math.min(.028,pitchX*.12,pitchZ*.12,h/6);
 const amplitude=radius*1.05,centerY=h/2-radius-amplitude;
 return {rim,thickness,innerW,innerD,nx,nz,pitchX,pitchZ,radius,amplitude,centerY};
}

class WovenWire extends T.Curve<T.Vector3>{
 private axis:'x'|'z';private cross:number;private lane:number;private length:number;private layout:ReturnType<typeof wireLayout>;
 constructor(axis:'x'|'z',cross:number,lane:number,length:number,layout:ReturnType<typeof wireLayout>){
  super();this.axis=axis;this.cross=cross;this.lane=lane;this.length=length;this.layout=layout;this.arcLengthDivisions=Math.max(200,(axis==='x'?layout.nx:layout.nz)*24);
 }
 getPoint(t:number,target=new T.Vector3()){
  const {innerW,innerD,pitchX,pitchZ,amplitude,centerY}=this.layout;
  const u=(t-.5)*this.length,phase=this.axis==='x'?(u+innerW/2)/pitchX:(u+innerD/2)/pitchZ;
  // Opposite phases at every crossing: a continuous strand passes over one
  // neighbour and under the next, rather than two intersecting flat grids.
  const y=centerY+(this.axis==='x'?1:-1)*amplitude*Math.cos(Math.PI*(phase+this.lane));
  return this.axis==='x'?target.set(u,y,this.cross):target.set(this.cross,y,u);
 }
}

function wovenGeometry(size:StageObject['size']){
 const [w,h,d]=size,layout=wireLayout(size),{rim,thickness,innerW,innerD,nx,nz,pitchX,pitchZ,radius}=layout;
 const frame:T.BufferGeometry[]=[],wires:T.BufferGeometry[]=[];
 const rail=(x:number,y:number,z:number,sx:number,sy:number,sz:number)=>frame.push(new RoundedBoxGeometry(sx,sy,sz,2,Math.min(.025,sx/4,sy/4,sz/4)).translate(x,y,z));
 for(const sign of [-1,1]){
  rail(0,(h-thickness)/2,sign*(d-rim)/2,w,thickness,rim);
  rail(sign*(w-rim)/2,(h-thickness)/2,0,rim,thickness,d-rim*2);
  if(h>.3){
   rail(0,(-h+thickness)/2,sign*(d-rim)/2,w,thickness,rim);
   rail(sign*(w-rim)/2,(-h+thickness)/2,0,rim,thickness,d-rim*2);
   // Posts meet the underside of the rails instead of overlapping their top
   // faces, which would create flickering seams at the corners.
   for(const z of [-1,1])rail(sign*(w-rim)/2,0,z*(d-rim)/2,rim,h-thickness*2,rim);
  }
 }
 for(let j=1;j<nz;j++)wires.push(new T.TubeGeometry(new WovenWire('x',-innerD/2+j*pitchZ,j,innerW+rim*.7,layout),nx*6,radius,8,false));
 for(let i=1;i<nx;i++)wires.push(new T.TubeGeometry(new WovenWire('z',-innerW/2+i*pitchX,i,innerD+rim*.7,layout),nz*6,radius,8,false));
 const geometry=combine([combine(frame),combine(wires)],true);
 geometry.userData.wovenWire=layout;
 return geometry;
}
/** All geometry is baked in scene units: texture density does not stretch
 * when a plinth becomes wider. Tops have a genuinely planar support area.
 */
export function stageGeometry(object:StageObject):T.BufferGeometry{
 if(object.shape==='brick-court')return brickCourtyardGeometry(object);
 if(object.shape==='grooved-tray')return groovedTrayGeometry(object);
 if(object.shape==='satin-sheet')return satinSheetGeometry(object);
 if(object.shape==='chrome-rack')return chromeRackGeometry(object);
 const [w,h,d]=object.size,r=object.bevelRadius===undefined?Math.min(.09,w/8,h/8,d/8):Math.min(object.bevelRadius,w/2,h/2,d/2);
 let geo:T.BufferGeometry;
 if(object.shape==='cyclorama'){
  // A continuous floor/cove/wall with an actual rounded sweep. Its support
  // plane remains at h/2; changing view never reveals a painted horizon seam.
  const radius=Math.min(8,d*.2),back=-d*.22,profile:[number,number][]=[[h/2,d/2],[h/2,back]];
  for(let i=1;i<=40;i++){const angle=i/40*Math.PI/2;profile.push([h/2+radius*(1-Math.cos(angle)),back-radius*Math.sin(angle)]);}
  profile.push([h/2+24,back-radius]);
  const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
  for(const [y,z] of profile)for(const x of [-w/2,w/2]){positions.push(x,y,z);uvs.push((x+w/2)/w,(z+d/2)/d);}
  for(let i=0;i<profile.length-1;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();
 }else if(object.shape==='ring'){
  geo=new T.TorusGeometry(.36,.14,20,80).scale(w,h,d/.28);
 }else if(object.shape==='ribbed-wall'){
  const parts:T.BufferGeometry[]=[new T.BoxGeometry(w,h,d*.35)],count=Math.max(4,Math.min(48,Math.round(w/.32))),radius=w/count*.48;
  for(let i=0;i<count;i++)parts.push(new T.CylinderGeometry(radius,radius,h,20).scale(1,1,d/radius*.65).translate(-w/2+(i+.5)*w/count,0,d*.1));
  geo=combine(parts);
 }else if(object.shape==='rock'){
  const points:T.Vector3[]=[],seed=seedFor(object.id);
  // Quarry-like planes rather than a noisy cube. The convex shell gives real
  // asymmetric chipped sides; the upper ring provides a flat cut surface.
  for(const [y,radius] of [[-.5,.72],[-.31,.9],[-.04,1],[.28,.94],[.5,.84]]){
   for(let i=0;i<18;i++){
    const angle=i/18*Math.PI*2+.055*noise.noise(i+seed,0,0),c=Math.cos(angle),s=Math.sin(angle);
    const radiusNoise=.87+.19*noise.noise(c*2+seed,y*3,s*2);
    points.push(new T.Vector3(c*w/2*radius*radiusNoise,y*h,s*d/2*radius*radiusNoise));
   }
  }
  geo=new ConvexGeometry(points);
  geo.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(geo.getAttribute('position').count*2),2));
 }else if(object.shape==='lattice'){
  geo=wovenGeometry(object.size);
 }else if(object.shape==='fluted'){
  const cap=Math.min(.14,h/4),rib=Math.min(.055,w/30,d/30),parts:T.BufferGeometry[]=[];
  parts.push(new RoundedBoxGeometry(w-.12,h,d-.12,4,r));
  for(const sign of [-1,1]){
   parts.push(new RoundedBoxGeometry(w,cap,d,4,Math.min(r,cap/3)).translate(0,sign*(h-cap)/2,0));
   const nx=Math.min(48,Math.max(4,Math.ceil(w/.23))),nz=Math.min(48,Math.max(4,Math.ceil(d/.23)));
   for(let i=1;i<nx;i++)parts.push(new T.CylinderGeometry(rib,rib,h-cap*2,10).translate(-w/2+w*i/nx,0,sign*(d/2-rib)));
   for(let i=1;i<nz;i++)parts.push(new T.CylinderGeometry(rib,rib,h-cap*2,10).translate(sign*(w/2-rib),0,-d/2+d*i/nz));
  }
  geo=combine(parts);
 }else if(object.shape==='drape'||object.shape==='cushion'){
  const radius=Math.min(object.shape==='drape'?.34:.5,h*.45,w/7,d/7);
  geo=new RoundedBoxGeometry(w,h,d,14,radius);
  const p=geo.getAttribute('position'),normals=geo.getAttribute('normal');
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),z=p.getZ(i);
   if(normals.getY(i)>.05){
    p.setY(i,p.getY(i)+stageClothHeight(object,x,z)-h/2);
   }
  }geo.computeVertexNormals();
 }else if(object.shape==='cylinder'){
  const bevel=Math.min(.055,h/5)/h,points:T.Vector2[]=[new T.Vector2(0,-.5),new T.Vector2(.48,-.5)];
  for(let i=0;i<=5;i++){const a=i/5*Math.PI/2;points.push(new T.Vector2(.48+.02*Math.sin(a),-.5+bevel*(1-Math.cos(a))));}
  points.push(new T.Vector2(.5,.5-bevel));
  for(let i=0;i<=5;i++){const a=i/5*Math.PI/2;points.push(new T.Vector2(.48+.02*Math.cos(a),.5-bevel+bevel*Math.sin(a)));}
  points.push(new T.Vector2(0,.5));geo=new T.LatheGeometry(points,80).scale(w,h,d);
 }else geo=new RoundedBoxGeometry(w,h,d,5,r);
 const p=geo.getAttribute('position'),n=geo.getAttribute('normal'),uv=geo.getAttribute('uv');
 const density=(object.textureScale??1)/4;
 for(let i=0;i<p.count;i++){
  // The wire's UV runs along and around its strand. Keep it continuous for
  // directional brushed reflections, not world-planar projection seams.
  if(object.shape==='lattice')continue;
  const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));
  if(ay>=ax&&ay>=az)uv.setXY(i,p.getX(i)*density,p.getZ(i)*density);
  else if(ax>az)uv.setXY(i,p.getZ(i)*density,p.getY(i)*density);
  else uv.setXY(i,p.getX(i)*density,p.getY(i)*density);
 }
 const detailed=subdivideAndDisplace(geo,object);if(detailed!==geo){geo.dispose();geo=detailed;}
 geo.computeBoundingBox();geo.computeBoundingSphere();return geo;
}
