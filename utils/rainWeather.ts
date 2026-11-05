import * as T from 'three';
import type {RainConfig,StageObject} from '../types';
import type {BrickBasin} from './brickBasins.ts';

export const RAIN_DEFAULTS:RainConfig={enabled:false,intensity:.4,wind:.12,dropSize:1,wetness:.72,preview:true};
export const rainSettings=(o:StageObject):RainConfig=>({...RAIN_DEFAULTS,...o.rain});
export const rainRandom=(seed:number)=>{const x=Math.sin(seed*127.1+91.7)*43758.5453;return x-Math.floor(x);};
export type RainSurface={mesh:T.Mesh;root:T.Object3D;phone:boolean};

/** Collision sources are the loaded handset meshes and displaced bricks,
 * never their bounding boxes, selection helpers, droplets or hidden meshes. */
export function rainSurfaces(scene:T.Scene):RainSurface[]{
 const result:RainSurface[]=[];
 scene.traverseVisible(object=>{
  const mesh=object as T.Mesh;if(!mesh.isMesh||!mesh.geometry?.attributes.position||(mesh as T.InstancedMesh).isInstancedMesh)return;
  const material=Array.isArray(mesh.material)?mesh.material:[mesh.material];if(!material.some(m=>m.visible&&(!m.transparent||m.opacity>0)))return;
  let root:T.Object3D|null=null,phone=false;
  for(let p:T.Object3D|null=object;p;p=p.parent){
   if(p.userData.weatherEffect||p.userData.sceneGizmo)return;
   if(p.userData.mockupModelId){root=p;phone=true;}
   if(!phone&&p.userData.stageId&&mesh.name==='charcoal-brick-course')root=p;
  }
  if(root)result.push({mesh,root,phone});
 });return result;
}
export function rainSurfaceKey(surfaces:RainSurface[]){return surfaces.map(({mesh,root})=>{const p=mesh.geometry.getAttribute('position');return `${root.uuid}:${mesh.geometry.uuid}:${(p as T.BufferAttribute).version??(p as T.InterleavedBufferAttribute).data.version}:${mesh.matrixWorld.elements.join(',')}`;}).join('|');}

export interface RainHit {point:T.Vector3;normal:T.Vector3;owner:number;phone:boolean;waterPotential:number;puddle?:number}
export interface RainBasin {basin:BrickBasin;owner:number;matrix:T.Matrix4;inverse:T.Matrix4;bounds:T.Box3}
/** A top-down collision atlas rasterized from actual world triangles. It is
 * rebuilt only on geometry/transform edits. A stationary view needs no rays
 * and no physics allocations each frame. Top-most depth prevents rain from
 * passing through screens and also handles multiple/tilted handsets. */
export class RainCollisionField {
 readonly heights:Float32Array;readonly normals:Float32Array;readonly owners:Int16Array;readonly waterPotential:Float32Array;
 readonly roots:T.Object3D[]=[];readonly phones:boolean[]=[];
 readonly basins:RainBasin[]=[];
 readonly bounds:T.Box3;readonly size:number;
 constructor(surfaces:RainSurface[],bounds:T.Box3,size=192,base?:RainCollisionField){
  this.size=size;this.bounds=bounds.clone();this.heights=new Float32Array(size*size).fill(-Infinity);this.normals=new Float32Array(size*size*3);this.owners=new Int16Array(size*size).fill(-1);this.waterPotential=new Float32Array(size*size);
  const width=bounds.max.x-bounds.min.x,depth=bounds.max.z-bounds.min.z;
  if(!(width>0&&depth>0&&Number.isFinite(width+depth)))throw Error('雨景碰撞范围无效');
  if(base){this.heights.set(base.heights);this.normals.set(base.normals);this.owners.set(base.owners);this.waterPotential.set(base.waterPotential);this.roots.push(...base.roots);this.phones.push(...base.phones);this.basins.push(...base.basins);}
  const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),n=new T.Vector3(),ab=new T.Vector3(),ac=new T.Vector3();
  for(const {mesh,root,phone} of surfaces){
   let owner=this.roots.indexOf(root);if(owner<0){owner=this.roots.length;this.roots.push(root);this.phones.push(phone);}
   const geometry=mesh.geometry,positions=geometry.getAttribute('position'),index=geometry.index,water=geometry.getAttribute('brickWater');
   if(!phone)for(const basin of (geometry.userData.brickBasins??[]) as BrickBasin[]){
    const matrix=mesh.matrixWorld.clone(),bounds=new T.Box3(new T.Vector3(basin.x-basin.rx*1.2,basin.rimY-basin.depth-.15,basin.z-basin.rz*1.2),new T.Vector3(basin.x+basin.rx*1.2,basin.rimY,basin.z+basin.rz*1.2)).applyMatrix4(matrix);
    this.basins.push({basin,owner,matrix,inverse:matrix.clone().invert(),bounds});
   }
   const start=Math.max(0,geometry.drawRange.start),end=Math.min(index?.count??positions.count,start+geometry.drawRange.count);
   for(let i=start;i+2<end;i+=3){
    a.fromBufferAttribute(positions,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);
    b.fromBufferAttribute(positions,index?index.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld);
    c.fromBufferAttribute(positions,index?index.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);
    n.crossVectors(ab.subVectors(b,a),ac.subVectors(c,a));if(Math.abs(n.y)<1e-9)continue;
    n.normalize();if(n.y<0)n.negate();if(n.y<.08)continue;
    const wa=water?.getX(index?index.getX(i):i)??.8,wb=water?.getX(index?index.getX(i+1):i+1)??.8,wc=water?.getX(index?index.getX(i+2):i+2)??.8;
    const ax=(a.x-bounds.min.x)/width*size-.5,az=(a.z-bounds.min.z)/depth*size-.5;
    const bx=(b.x-bounds.min.x)/width*size-.5,bz=(b.z-bounds.min.z)/depth*size-.5;
    const cx=(c.x-bounds.min.x)/width*size-.5,cz=(c.z-bounds.min.z)/depth*size-.5;
    const area=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(area)<1e-10)continue;
    const x0=Math.max(0,Math.ceil(Math.min(ax,bx,cx))),x1=Math.min(size-1,Math.floor(Math.max(ax,bx,cx)));
    const z0=Math.max(0,Math.ceil(Math.min(az,bz,cz))),z1=Math.min(size-1,Math.floor(Math.max(az,bz,cz)));
    for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
     const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/area,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/area,w=1-u-v;
     if(Math.min(u,v,w)<-1e-5)continue;const y=u*a.y+v*b.y+w*c.y,k=z*size+x;
     if(y<=this.heights[k])continue;this.heights[k]=y;this.owners[k]=owner;this.normals.set([n.x,n.y,n.z],k*3);this.waterPotential[k]=phone?1:u*wa+v*wb+w*wc;
    }
   }
  }
 }
 hit(index:number):RainHit|null{
  if(index<0||index>=this.owners.length||this.owners[index]<0)return null;
  const x=index%this.size,z=Math.floor(index/this.size),o=this.owners[index];
  return {point:new T.Vector3(T.MathUtils.lerp(this.bounds.min.x,this.bounds.max.x,(x+.5)/this.size),this.heights[index],T.MathUtils.lerp(this.bounds.min.z,this.bounds.max.z,(z+.5)/this.size)),normal:new T.Vector3().fromArray(this.normals,index*3),owner:o,phone:this.phones[o],waterPotential:this.waterPotential[index]};
 }
}
export const rainPhase=(time:number,seed:number,period:number)=>((time+seed)%period+period)%period;
export const rainRippleAge=(time:number,seed:number,speed:number)=>rainPhase(time+seed-7/speed,0,7/speed+.85);
export function rainKinematics(time:number,seed:number,speed:number,height=7){
 const flight=height/speed,period=flight+.85,age=rainPhase(time,seed,period);
 return {age,flight,period,falling:age<flight,splashAge:age-flight,above:Math.max(0,height-speed*age)};
}
/** Export, playback and paused scrubbing share the same deterministic clock.
 * Optional ambient preview adds elapsed time only while the timeline is idle. */
export function rainTime(state:{currentTime:number;isPlaying:boolean;isExporting:boolean},idle:number,preview:boolean){return state.currentTime+(preview&&!state.isPlaying&&!state.isExporting?idle:0);}

export function rainImpactPool(field:RainCollisionField,count=640,puddles?:Int16Array){
 const available:number[]=[],phone:number[]=[],water:number[]=[];
 for(let i=0;i<field.owners.length;i++)if(field.owners[i]>=0){available.push(i);if(field.phones[field.owners[i]]&&field.normals[i*3+1]>.3)phone.push(i);if(puddles&&puddles[i]>=0)water.push(i);}
 if(!available.length)return [];
 // A small importance sample keeps the hero's impacts legible. Most drops
 // still cover the full masonry area rather than clustering on the phone.
 return Array.from({length:count},(_,i)=>{const region=i%7===0&&phone.length?phone:i%11===0&&water.length?water:available;return field.hit(region[Math.floor(rainRandom(i+41)*region.length)])!;});
}
