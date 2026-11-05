import * as T from 'three';
import {brickBasinRadius} from './brickBasins.ts';
import type {RainCollisionField,RainHit} from './rainWeather.ts';

export interface RainPuddle {id:number;owner:number;level:number;triangles:number;maxDepth:number}
export interface RainPuddles {patches:RainPuddle[];lookup:Int16Array;surfaces:{owner:number;geometry:T.BufferGeometry}[]}
type ShoreVertex={point:T.Vector3;distance:number;bottom:number};
/** Clip a triangle to a measured horizontal water level. Interpolated
 * shore crossings, not a raster square or a circular decal, form its rim. */
function shore(triangle:ShoreVertex[]){
 const result:ShoreVertex[]=[];
 for(let i=0;i<triangle.length;i++){
  const a=triangle[i],b=triangle[(i+1)%triangle.length];if(a.distance<=0)result.push(a);
  if((a.distance<=0)!==(b.distance<=0)){
   const t=a.distance/(a.distance-b.distance);result.push({point:a.point.clone().lerp(b.point,t),distance:0,bottom:T.MathUtils.lerp(a.bottom,b.bottom,t)});
  }
 }return result;
}

/** Fill actual worn bowls below their measured spill rim. The shared
 * collision field clips out raised stone, gaps and phones; all water in
 * one basin is horizontal in world space, even on a tilted pedestal. */
export function rainPuddles(field:RainCollisionField,wetness:number):RainPuddles{
 const lookup=new Int16Array(field.owners.length).fill(-1),patches:RainPuddle[]=[],arrays=new Map<number,{positions:number[];depths:number[];ids:number[]}>();
 const width=field.bounds.max.x-field.bounds.min.x,depth=field.bounds.max.z-field.bounds.min.z,stepX=width/field.size,stepZ=depth/field.size;
 if(wetness<=.08)return {patches,lookup,surfaces:[]};
 const worldPoint=(x:number,z:number,y:number)=>new T.Vector3(field.bounds.min.x+(x+.5)*stepX,y,field.bounds.min.z+(z+.5)*stepZ);
 for(const candidate of field.basins){
  const {basin,owner,inverse,bounds}=candidate;
  const x0=Math.max(0,Math.floor((bounds.min.x-field.bounds.min.x)/stepX)),x1=Math.min(field.size-1,Math.ceil((bounds.max.x-field.bounds.min.x)/stepX));
  const z0=Math.max(0,Math.floor((bounds.min.z-field.bounds.min.z)/stepZ)),z1=Math.min(field.size-1,Math.ceil((bounds.max.z-field.bounds.min.z)/stepZ));
  const samples:{index:number;x:number;z:number;radius:number;height:number}[]=[],bottom:number[]=[],rim:number[]=[];
  for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
   const index=z*field.size+x;if(field.owners[index]!==owner||field.normals[index*3+1]<.35)continue;
   const height=field.heights[index],local=worldPoint(x,z,height).applyMatrix4(inverse),radius=brickBasinRadius(basin,local.x,local.z);
   if(radius>1.12)continue;samples.push({index,x,z,radius,height});if(radius<.45)bottom.push(height);if(radius>.8&&radius<1.06)rim.push(height);
  }
  if(bottom.length<3||rim.length<3)continue;
  bottom.sort((a,b)=>a-b);rim.sort((a,b)=>a-b);
  const low=bottom[Math.floor(bottom.length*.12)],spill=rim[Math.floor(rim.length*.12)]-.004;
  if(spill-low<.018)continue;
  const level=T.MathUtils.lerp(low,spill,.32+T.MathUtils.clamp(wetness,0,1)*.53),id=patches.length;
  const data=arrays.get(owner)??{positions:[],depths:[],ids:[]},start=data.ids.length,rootInverse=field.roots[owner].matrixWorld.clone().invert();
  const vertex=(x:number,z:number):ShoreVertex=>{
   const index=z*field.size+x,height=field.heights[index],point=worldPoint(x,z,level),local=worldPoint(x,z,Number.isFinite(height)?height:level).applyMatrix4(inverse),radius=brickBasinRadius(basin,local.x,local.z);
   const valid=field.owners[index]===owner&&Number.isFinite(height);
   return {point,distance:valid?Math.max(height-level+.001,(radius-1.02)*.15):.25,bottom:valid?height:level};
  };
  for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){
   const a=vertex(x,z),b=vertex(x+1,z),c=vertex(x,z+1),d=vertex(x+1,z+1);
   for(const triangle of [[a,c,b],[b,c,d]]){
    const polygon=shore(triangle);if(polygon.length<3)continue;
    for(let i=1;i<polygon.length-1;i++)for(const v of [polygon[0],polygon[i],polygon[i+1]]){
     const p=v.point.clone().applyMatrix4(rootInverse);data.positions.push(...p.toArray());data.depths.push(Math.max(.001,level-v.bottom));data.ids.push(id);
    }
   }
  }
  const triangles=(data.ids.length-start)/3;if(triangles<2){data.positions.length=start*3;data.depths.length=start;data.ids.length=start;continue;}
  arrays.set(owner,data);let maxDepth=0;
  for(const sample of samples)if(sample.radius<1.02&&sample.height<level-.001){lookup[sample.index]=id;maxDepth=Math.max(maxDepth,level-sample.height);}
  patches.push({id,owner,level,triangles,maxDepth});
 }
 const surfaces=Array.from(arrays,([owner,data])=>{
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));geometry.setAttribute('waterDepth',new T.Float32BufferAttribute(data.depths,1));geometry.setAttribute('puddleId',new T.Float32BufferAttribute(data.ids,1));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData={puddleCount:patches.filter(p=>p.owner===owner).length,worldHorizontal:true,clippedShore:true};return {owner,geometry};
 });return {patches,lookup,surfaces};
}

/** Rain hits the retained water level, not the solid floor below it. */
export function rainPuddleHits(field:RainCollisionField,puddles:RainPuddles,hits:RainHit[]){
 const width=field.bounds.max.x-field.bounds.min.x,depth=field.bounds.max.z-field.bounds.min.z;
 return hits.map(hit=>{
  if(hit.phone)return hit;
  const x=Math.floor((hit.point.x-field.bounds.min.x)/width*field.size),z=Math.floor((hit.point.z-field.bounds.min.z)/depth*field.size),index=z*field.size+x;
  const puddle=puddles.patches[puddles.lookup[index]];if(!puddle||puddle.owner!==hit.owner)return hit;
  return {...hit,point:new T.Vector3(hit.point.x,puddle.level,hit.point.z),normal:new T.Vector3(0,1,0),puddle:puddle.id};
 });
}
