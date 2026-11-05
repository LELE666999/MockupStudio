import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {ImprovedNoise} from 'three/examples/jsm/math/ImprovedNoise.js';
import type {StageObject} from '../types';
import {brickWaterPotential} from './brickWetness.ts';
import {brickBasin,brickBasinDepth,type BrickBasin} from './brickBasins.ts';

export const BRICK_MATERIAL='/materials/rough_concrete';
export const BRICK_HEIGHT_SIZE=256;
const noise=new ImprovedNoise();
const fraction=(x:number)=>x-Math.floor(x);
const random=(seed:number)=>fraction(Math.sin(seed*127.1+19.7)*43758.5453);

/** Repeat and bilinear-filter the same UV coordinates as the PBR maps.
 * TextureLoader flips image rows on upload; the CPU field must do likewise. */
export function brickHeightSample(data:Uint8Array|undefined,u:number,v:number){
 if(!data)return T.MathUtils.clamp(.5+noise.noise(u*24,v*24,3)*.28,0,1);
 const size=Math.sqrt(data.length);
 if(!Number.isInteger(size)||size<2)throw Error('砖面高度图尺寸无效');
 const x=fraction(u)*size-.5,y=fraction(1-v)*size-.5,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
 const at=(a:number,b:number)=>data[((b%size+size)%size)*size+(a%size+size)%size]/255;
 return T.MathUtils.lerp(T.MathUtils.lerp(at(ix,iy),at(ix+1,iy),fx),T.MathUtils.lerp(at(ix,iy+1),at(ix+1,iy+1),fx),fy);
}

export function brickLayout(o:StageObject){
 const [w,h,d]=o.size,rows=Math.round(T.MathUtils.clamp(o.brickRows??3,2,10)),columns=Math.round(T.MathUtils.clamp(o.brickColumns??3,2,10)),joint=Math.min(.085,w/columns*.022,d/rows*.025),parts:{size:[number,number,number];center:[number,number,number];seed:number}[]=[];
 const pitchX=w/columns,pitchZ=d/rows;
 for(let row=0;row<rows;row++){
  const offset=row%2?pitchX/2:0;
  for(let col=-1;col<columns;col++){
   const left=Math.max(-w/2,-w/2+col*pitchX+offset),right=Math.min(w/2,-w/2+(col+1)*pitchX+offset);
   if(right-left<joint*2)continue;
   const seed=row*17+col+13,drop=random(seed)*Math.min(.025,h*.025);
   parts.push({size:[right-left-joint,h-drop,pitchZ-joint],center:[(left+right)/2,-drop/2,-d/2+(row+.5)*pitchZ],seed});
  }
 }
 return {parts,joint};
}

/** Joined, indexed geometry: each block is a closed, chipped solid, not a
 * brick pattern on a flat plane. Height displacement is baked on edit only.
 * Relief always recedes from the support plane, so a phone cannot intersect
 * a randomly raised stone. Fine pores remain in the filtered 2K normal map. */
export function brickCourtyardGeometry(o:StageObject,height?:Uint8Array){
 const {parts,joint}=brickLayout(o),geometries:T.BufferGeometry[]=[],basins:BrickBasin[]=[];
 const density=T.MathUtils.clamp(o.textureScale??1,.25,4)/3.5;
 const depth=T.MathUtils.clamp(o.reliefDepth??.13,0,.35),strength=o.detailStrength??.8;
 for(const block of parts){
  const [w,h,d]=block.size,r=Math.min(o.bevelRadius??.055,w*.09,h*.09,d*.09);
  const basin=brickBasin(block);if(basin)basins.push(basin);
  const geometry=new T.BoxGeometry(w,h,d,Math.max(10,Math.min(basin?23:28,Math.ceil(w*(basin?7.5:5)))),7,Math.max(10,Math.min(basin?19:24,Math.ceil(d*(basin?7.5:5))))),position=geometry.getAttribute('position'),uv=geometry.getAttribute('uv'),normal=geometry.getAttribute('normal'),color=new Float32Array(position.count*3),ecology=new Float32Array(position.count),water=new Float32Array(position.count);
  const tint=.9+random(block.seed+4)*.15,shiftU=random(block.seed+1)*3,shiftV=random(block.seed+2)*3;
  const half=new T.Vector3(w/2,h/2,d/2),inside=half.clone().addScalar(-r),point=new T.Vector3(),inset=new T.Vector3(),direction=new T.Vector3();
  for(let i=0;i<position.count;i++){
   point.fromBufferAttribute(position,i);
   ecology[i]=normal.getY(i)>.5?1-T.MathUtils.smoothstep(Math.min(w/2-Math.abs(point.x),d/2-Math.abs(point.z)),.025,.4):.4;
   const sourceEdges=[half.x-Math.abs(point.x),half.y-Math.abs(point.y),half.z-Math.abs(point.z)].sort((a,b)=>a-b);
   const scanFade=T.MathUtils.smoothstep(sourceEdges[1],0,Math.min(.2,h*.16));
   inset.copy(point).clamp(inside.clone().negate(),inside);direction.copy(point).sub(inset).normalize();point.copy(inset).addScaledVector(direction,r);
   const ax=Math.abs(normal.getX(i)),ay=Math.abs(normal.getY(i));
   const u=(ay>.5?point.x:ax>.5?-point.z:point.x)*density+shiftU;
   const v=(ay>.5?-point.z:point.y)*density+shiftV;
   uv.setXY(i,u,v);
   const distances=[half.x-Math.abs(point.x),half.y-Math.abs(point.y),half.z-Math.abs(point.z)].sort((a,b)=>a-b);
   const edge=1-T.MathUtils.smoothstep(distances[1],r*.4,r+Math.min(.14,h*.13));
   const chip=Math.pow(Math.max(0,noise.noise(point.x*7+block.seed,point.y*8,point.z*7)*1.6+.08),2)*edge*Math.min(.085,h*.12);
   // The scan's low-frequency height is genuine geometry; its normal map
   // covers subpixel aggregate without more tessellation / shimmer.
   // UV faces use different scan coordinates. Fade only the scanned offset
   // to exactly zero at their shared edge; 3D edge chips remain continuous.
   // Otherwise the displaced face copies open visible cracks / saw teeth.
   const relief=(1-brickHeightSample(height,u,v))*depth*.72*strength*scanFade;
   point.addScaledVector(direction,-chip-relief);
   // Concave, irregular bowls are actual geometry, independent of rain
   // amount. Water will fill below the measured rim, never cover the bevel.
   if(basin&&normal.getY(i)>.5)point.y-=brickBasinDepth(basin,point.x+block.center[0],point.z+block.center[2]);
   position.setXYZ(i,point.x+block.center[0],point.y+block.center[1],point.z+block.center[2]);
   water[i]=brickWaterPotential(point.x+block.center[0],point.z+block.center[2],block.seed,depth>0?relief/(depth*.72):0)*T.MathUtils.smoothstep(normal.getY(i),.25,.85);
   color.set([tint,tint,tint],i*3);
  }
  geometry.clearGroups();geometry.setAttribute('color',new T.BufferAttribute(color,3));geometry.setAttribute('brickEdge',new T.BufferAttribute(ecology,1));geometry.setAttribute('brickWater',new T.BufferAttribute(water,1));geometry.computeVertexNormals();
  // Share geometric normals across position-identical UV copies, while
  // retaining per-face UVs. Rounded edges do not become faceted stripes.
  const shared=new Map<string,T.Vector3>(),key=(i:number)=>[position.getX(i),position.getY(i),position.getZ(i)].map(v=>Math.round(v*1e6)).join(':');
  for(let i=0;i<position.count;i++){const k=key(i),value=shared.get(k)??new T.Vector3();value.x+=normal.getX(i);value.y+=normal.getY(i);value.z+=normal.getZ(i);shared.set(k,value);}
  for(const value of shared.values())value.normalize();
  for(let i=0;i<position.count;i++){const value=shared.get(key(i))!;normal.setXYZ(i,value.x,value.y,value.z);}
  geometries.push(geometry);
 }
 const result=mergeGeometries(geometries)!;geometries.forEach(g=>g.dispose());
 result.computeBoundingBox();result.computeBoundingSphere();
 result.userData={brickCourt:true,brickCount:parts.length,jointWidth:joint,scannedHeight:!!height,bakedDisplacement:true,brickBasins:basins};return result;
}

/** Floor-filling brick course, but camera framing follows the phone rather
 * than the whole masonry field. The front row shows the block thickness. */
export function brickCamera(bounds:T.Box3,aspect:number){
 const size=bounds.getSize(new T.Vector3()),target=bounds.getCenter(new T.Vector3());
 target.y-=size.y*.3;
 const direction=new T.Vector3(.23,1.48,1).normalize();
 const height=Math.max(size.z,size.y)*1.37,width=Math.max(size.x,size.z*.75)*1.52;
 const distance=Math.max(height,width/Math.max(.35,aspect))/(2*Math.tan(Math.PI/8));
 return {cameraPosition:target.clone().addScaledVector(direction,distance).toArray() as [number,number,number],cameraTarget:target.toArray() as [number,number,number]};
}
