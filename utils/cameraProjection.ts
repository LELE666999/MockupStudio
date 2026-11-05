import {PerspectiveCamera,OrthographicCamera,Vector3,MathUtils} from 'three';
export type ProjectionMode='perspective'|'weak'|'orthographic';
export function projectionDistanceScale(mode:ProjectionMode){
 return mode==='weak'?Math.tan(MathUtils.degToRad(22.5))/Math.tan(MathUtils.degToRad(10)):1;
}
// AppState stores the same 45-degree calibrated rig for every projection.
// OrbitControls works in physical camera coordinates (and zoom for ortho).
export function cameraPositionFromView(position:number[],target:number[],mode:ProjectionMode,zoom=1):[number,number,number]{
 const scale=projectionDistanceScale(mode)*(mode==='orthographic'?Math.max(1e-8,zoom):1);
 const offset=new Vector3(...position).sub(new Vector3(...target)).divideScalar(scale);
 offset.clampLength(2,1000);
 return offset.add(new Vector3(...target)).toArray() as [number,number,number];
}
export function configureProjection(camera:PerspectiveCamera|OrthographicCamera,mode:ProjectionMode,position:number[],target:number[],aspect:number){
  const focus=new Vector3(...target),offset=new Vector3(...position).sub(focus);
  if(offset.lengthSq()<1e-10)offset.set(0,0,8);
  const halfHeight=offset.length()*Math.tan(MathUtils.degToRad(22.5));
  camera.near=.01;camera.far=2000;camera.zoom=1;
  if(camera instanceof OrthographicCamera){
    camera.top=halfHeight;camera.bottom=-halfHeight;camera.right=halfHeight*aspect;camera.left=-camera.right;
  }else{
    camera.fov=mode==='weak'?20:45;camera.aspect=aspect;
    offset.multiplyScalar(projectionDistanceScale(mode));
  }
  camera.far=Math.max(2000,offset.length()*2);
  camera.position.copy(focus).add(offset);camera.lookAt(focus);
  camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
}
export function pixelWorldSize(camera:PerspectiveCamera|OrthographicCamera,point:Vector3,height:number){
  if(camera instanceof OrthographicCamera)return (camera.top-camera.bottom)/camera.zoom/Math.max(1,height);
  const depth=Math.abs(point.clone().applyMatrix4(camera.matrixWorldInverse).z);
  return 2*Math.tan(MathUtils.degToRad(camera.fov/2))*depth/camera.zoom/Math.max(1,height);
}
