import {useEffect,useMemo} from 'react';
import * as T from 'three';
import type {StageObject} from '../../types';
import {brickLayout} from '../../utils/brickStudio';
import {RainCollisionField,rainRandom} from '../../utils/rainWeather';

export function BrickMoss({object,geometry}:{object:StageObject;geometry:T.BufferGeometry}){
 const moss=useMemo(()=>{
  const source=new T.Mesh(geometry),bounds=geometry.boundingBox!,field=new RainCollisionField([{mesh:source,root:source,phone:false}],bounds,256);
  const instances:{position:T.Vector3;normal:T.Vector3;seed:number}[]=[];
  for(const block of brickLayout(object).parts)for(let i=0;i<380;i++){
   const seed=block.seed*401+i,side=i%4,t=rainRandom(seed+5),inset=.035+rainRandom(seed+12)*.22,w=block.size[0],d=block.size[2],x=block.center[0]+(side<2?(side===0?-1:1)*(w/2-inset): (t-.5)*w),z=block.center[2]+(side>=2?(side===2?-1:1)*(d/2-inset):(t-.5)*d);
   // Coherent patches, not a continuous neon outline on every block.
   const patch=.5+.5*Math.sin(x*1.9+Math.cos(z*1.3)*2.4);if(rainRandom(seed+8)>(object.moss??0)*patch*1.5)continue;
   const ix=Math.floor((x-bounds.min.x)/(bounds.max.x-bounds.min.x)*field.size),iz=Math.floor((z-bounds.min.z)/(bounds.max.z-bounds.min.z)*field.size),hit=field.hit(iz*field.size+ix);
   if(hit&&hit.normal.y>.3)instances.push({position:hit.point,normal:hit.normal,seed});
  }
  // Three cupped, pointed leaf pairs per tuft, rather than round "peas".
  const vertices:number[]=[],indices:number[]=[];
  for(let leaf=0;leaf<3;leaf++){
   const angle=leaf*Math.PI*2/3,axis=new T.Vector3(Math.cos(angle),0,Math.sin(angle)),right=new T.Vector3(-axis.z,0,axis.x),start=vertices.length/3;
   for(const [y,length,width] of [[0,0,.07],[.25,.36,.24],[.48,.65,0]])for(const side of [-1,1]){
    const p=axis.clone().multiplyScalar(length).addScaledVector(right,width*side);p.y=y;vertices.push(...p.toArray());
   }
   indices.push(start,start+1,start+2,start+1,start+3,start+2,start+2,start+3,start+4,start+3,start+5,start+4);
  }
  const tuft=new T.BufferGeometry();tuft.setAttribute('position',new T.Float32BufferAttribute(vertices,3));tuft.setIndex(indices);tuft.computeVertexNormals();
  const material=new T.MeshStandardMaterial({color:'#ffffff',roughness:1,envMapIntensity:.15,side:T.DoubleSide}),mesh=new T.InstancedMesh(tuft,material,instances.length),dummy=new T.Object3D(),color=new T.Color(),dark=new T.Color('#1e2e13'),light=new T.Color('#3d4b25');
  instances.forEach(({position,normal,seed},i)=>{
   const radius=.018+rainRandom(seed+3)*.025;dummy.position.copy(position).addScaledVector(normal,.002);dummy.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),normal);dummy.rotateY(rainRandom(seed+9)*6.28);dummy.scale.set(radius,radius*.75,radius);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   color.copy(dark).lerp(light,rainRandom(seed+2));mesh.setColorAt(i,color);
  });
  mesh.name='brick-crevice-moss';mesh.userData.weatherEffect=true;mesh.raycast=()=>{};mesh.receiveShadow=true;mesh.computeBoundingSphere();
  return {mesh,dispose(){mesh.dispose();tuft.dispose();material.dispose();}};
 },[geometry,object.moss]);
 useEffect(()=>()=>moss.dispose(),[moss]);
 return <primitive object={moss.mesh}/>;
}
