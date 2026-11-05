import {useMemo,useEffect,useRef} from 'react';
import {PivotControls} from '@react-three/drei';
import * as THREE from 'three';
import type {AppState} from '../../types';
import {patchStage,stageObjects} from '../../utils/stagePresets';
import {gizmoGesture} from '../../utils/sceneInteraction';
import {selectedModels,transformModels} from '../../utils/modelSelection';
import {continuousRotation} from '../../utils/continuousRotation';
export function SceneGizmo({state,updateState,saveHistory}:{state:AppState;updateState?:(p:Partial<AppState>)=>void;saveHistory?:()=>void}){
 useEffect(()=>{const release=()=>gizmoGesture(false);window.addEventListener('blur',release);return()=>{release();window.removeEventListener('blur',release);};},[]);
 const models=selectedModels(state),model=models[0],object=stageObjects(state.stage).find(o=>o.id===state.activeStageId);
 const originals=useRef(models),dragging=useRef(false),dragMatrix=useRef(new THREE.Matrix4());
 const target=model||object;
 const matrix=useMemo(()=>{
  if(dragging.current)return dragMatrix.current;
  if(models.length>1)return new THREE.Matrix4().makeTranslation(models.reduce((v,m)=>v.add(new THREE.Vector3(...m.position)),new THREE.Vector3()).divideScalar(models.length));
  return target?new THREE.Matrix4().compose(new THREE.Vector3(...target.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...target.rotation)),new THREE.Vector3().setScalar(model?.scale||1)):new THREE.Matrix4();
 },[target,models]);
 if(!target)return null;
 // PivotControls passes userData only to its invisible picking meshes. Tag a
 // real ancestor too so visible arrows/arcs remain sharp in the lens pass.
 return <group userData={{sceneGizmo:true}}><PivotControls key={model?`phone-${models.map(m=>m.id).join('-')}`:`stage-${object!.id}`} matrix={matrix} autoTransform={false} fixed scale={90} lineWidth={2} depthTest={false} disableScaling disableSliders onDragStart={()=>{originals.current=models;dragMatrix.current.copy(matrix);dragging.current=true;gizmoGesture(true);saveHistory?.();}} onDragEnd={()=>{dragging.current=false;gizmoGesture(false);}} onDrag={(m,_dl,_w,dw)=>{
  dragMatrix.current.copy(m);
  const position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3();m.decompose(position,quaternion,scale);
  const patch={position:position.toArray() as [number,number,number],rotation:continuousRotation(quaternion,target.rotation)};
  if(model)updateState?.({models:transformModels(state.models,originals.current,dw)});
  else if(object&&state.stage)updateState?.({stage:patchStage(state.stage,object.id,patch)});
 }} userData={{sceneGizmo:true}}/></group>;
}
