import * as THREE from 'three';
import {continuousRotation} from './continuousRotation.ts';
import type {AppState,ModelConfig} from '../types';
import {foldPoint} from './foldGeometry.ts';
export function selectedModels(state:AppState){const ids=state.selectedModelIds??(state.activeModelId?[state.activeModelId]:[]);return state.models.filter(m=>ids.includes(m.id)&&m.visible!==false);}
export function selectModel(state:AppState,id:string,extend=false):Partial<AppState>{
 const current=selectedModels(state).map(m=>m.id);const ids=extend?(current.includes(id)?current.filter(i=>i!==id):[...current,id]):[id];
 return {selectedModelIds:ids,activeModelId:ids.includes(id)?id:ids.at(-1)||id,activeStageId:null,activeTextId:null,showGizmo:true};
}
export function modelBounds(m:ModelConfig){
 const size=m.mode==='simple'?new THREE.Vector3(m.width+.1,m.height+.1,m.depth+.1):new THREE.Vector3(5,5,5);
 if(m.mode==='simple'&&m.simpleStyle==='fold'){
  const [x,z]=foldPoint(m.width/2,m.foldAngle??180);
  size.set(2*x+2*m.depth+.2,m.height+.1,z+2*m.depth+.2);
 }
 const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...m.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...m.rotation)),new THREE.Vector3().setScalar(m.scale||1));
 return new THREE.Box3(size.clone().multiplyScalar(-.5),size.clone().multiplyScalar(.5)).applyMatrix4(matrix);
}
export function rightOfModels(models:ModelConfig[],next:ModelConfig,activeId:string|null):[number,number,number]{
 const anchor=models.find(m=>m.id===activeId)||models.at(-1);if(!anchor)return [0,0,0];
 const edge=Math.max(...models.map(m=>modelBounds(m).max.x));const half=modelBounds({...next,position:[0,0,0]}).max.x;
 return [edge+half+.75,anchor.position[1],anchor.position[2]];
}
export function frameModels(state:AppState,models:ModelConfig[],aspect=1):Partial<AppState>{
 const bounds=new THREE.Box3();models.filter(m=>m.visible!==false).forEach(m=>bounds.union(modelBounds(m)));if(bounds.isEmpty())return {};
 const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
 const distance=Math.max(size.y,size.x/Math.max(.2,aspect))/(2*Math.tan(Math.PI/8))*1.2+size.z/2;
 const direction=new THREE.Vector3(...state.cameraPosition).sub(new THREE.Vector3(...state.cameraTarget)).normalize();if(direction.lengthSq()<.1)direction.set(0,0,1);
 return {cameraTarget:center.toArray() as [number,number,number],cameraPosition:center.clone().addScaledVector(direction,distance).toArray() as [number,number,number]};
}
export function transformModels(models:ModelConfig[],originals:ModelConfig[],delta:THREE.Matrix4){
 return models.map(model=>{const base=originals.find(m=>m.id===model.id);if(!base)return model;
  const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...base.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...base.rotation)),new THREE.Vector3().setScalar(base.scale)).premultiply(delta);
  const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();matrix.decompose(p,q,s);
  return {...model,position:p.toArray() as [number,number,number],rotation:continuousRotation(q,model.rotation),scale:s.x};
 });
}
