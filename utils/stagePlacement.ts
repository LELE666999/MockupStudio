import * as T from 'three';
import type {AppState,ModelConfig,StageObject} from '../types';
import {stageObjects} from './stagePresets.ts';
import {supportHeight} from './stageSoftness.ts';

export type PhonePose='upright'|'flat'|'side';
export const poseRotation:Record<PhonePose,[number,number,number]>={upright:[0,0,0],flat:[-Math.PI/2,0,0],side:[0,0,-Math.PI/2]};
export const stageMatrix=(o:StageObject)=>new T.Matrix4().compose(new T.Vector3(...o.position),new T.Quaternion().setFromEuler(new T.Euler(...o.rotation)),new T.Vector3(1,1,1));
export function stageFloor(stage:AppState['stage']){
 return Math.min(...stageObjects(stage).map(o=>new T.Box3(new T.Vector3(...o.size).multiplyScalar(-.5),new T.Vector3(...o.size).multiplyScalar(.5)).applyMatrix4(stageMatrix(o)).min.y))-.03;
}
/** Measure vertices in an arbitrary support coordinate system, including
 * folded/normalized imported geometry and off-centre camera bumps.
 */
export function boundsInFrame(root:T.Object3D,frameInverse=new T.Matrix4()):T.Box3{
 root.updateWorldMatrix(true,true);const box=new T.Box3(),p=new T.Vector3(),matrix=new T.Matrix4();
 root.traverseVisible(o=>{
  const mesh=o as T.Mesh;if(!mesh.isMesh)return;
  for(let p:T.Object3D|null=o;p;p=p.parent)if(p.userData.weatherEffect)return;
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  if(!materials.some(m=>m.visible&&(!m.transparent||m.opacity>0)))return;
  matrix.multiplyMatrices(frameInverse,mesh.matrixWorld);
  for(let i=0;i<mesh.geometry.getAttribute('position').count;i++)box.expandByPoint(mesh.getVertexPosition(i,p).applyMatrix4(matrix));
 });return box;
}
export function placePhone(root:T.Object3D,model:ModelConfig,support:StageObject,pose:PhonePose){
 const frame=stageMatrix(support),frameInverse=frame.clone().invert();
 const rotation=new T.Quaternion().setFromEuler(new T.Euler(...support.rotation)).multiply(new T.Quaternion().setFromEuler(new T.Euler(...poseRotation[pose])));
 const savedPosition=root.position.clone(),savedRotation=root.rotation.clone();
 try{
  root.position.set(...support.position);root.quaternion.copy(rotation);
  const bounds=boundsInFrame(root,frameInverse);if(bounds.isEmpty())return null;
  const center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
  const offset=new T.Vector3(-center.x-(support.shape==='grooved-tray'?support.size[0]*.265:0),supportHeight(support)-bounds.min.y+.012,-center.z);
  const position=offset.applyMatrix4(frame).toArray() as ModelConfig['position'];
  const euler=new T.Euler().setFromQuaternion(rotation);
  return {position,rotation:[euler.x,euler.y,euler.z] as ModelConfig['rotation'],overhang:size.x>support.size[0]+.03||size.z>support.size[2]+.03};
 }finally{root.position.copy(savedPosition);root.rotation.copy(savedRotation);root.updateWorldMatrix(true,true);}
}
/** Fit the selected composition at the current canvas aspect, not a fixed
 * desktop camera distance. Wide plinths remain visible on narrow canvases.
 */
export function stageCamera(bounds:T.Box3,aspect:number,mode:'perspective'|'weak'|'orthographic'='perspective'){
 const center=bounds.getCenter(new T.Vector3()),direction=new T.Vector3(.52,.55,1).normalize();
 const right=new T.Vector3(0,1,0).cross(direction).normalize(),up=direction.clone().cross(right);
 const tanY=Math.tan(T.MathUtils.degToRad(mode==='weak'?10:22.5)),tanX=tanY*Math.max(.25,aspect);
 // Stored camera distances are calibrated to 45 degrees in configureProjection.
 const canonicalScale=tanY/Math.tan(T.MathUtils.degToRad(22.5));
 let distance=8/canonicalScale;
 // Fit the projected corners rather than a bounding sphere: shallow scenes
 // should not become tiny merely because the stone slab is wide.
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
  const p=new T.Vector3(x,y,z).sub(center);
  distance=Math.max(distance,(mode==='orthographic'?0:p.dot(direction))+1.2*Math.max(Math.abs(p.dot(right))/tanX,Math.abs(p.dot(up))/tanY));
 }
 const position=center.clone().addScaledVector(direction,distance*canonicalScale);
 return {cameraPosition:position.toArray() as [number,number,number],cameraTarget:center.toArray() as [number,number,number]};
}
