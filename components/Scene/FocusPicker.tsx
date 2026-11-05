import React,{useLayoutEffect} from 'react';
import {useThree} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import * as THREE from 'three';
import type {AppState} from '../../types';
import {DEFAULT_LENS,editLens,focusWorld,modelSource} from '../../utils/focus';
export function FocusPicker({state,updateState,saveHistory}:{state:AppState;updateState?:(s:Partial<AppState>)=>void;saveHistory?:()=>void}){
 const {gl,camera,scene}=useThree();
 useLayoutEffect(()=>{
   if(!state.isSelectingFocus)return;
   const canvas=gl.domElement,oldCursor=canvas.style.cursor;canvas.style.cursor='crosshair';
   const cancel=(e:KeyboardEvent)=>{if(e.key==='Escape')updateState?.({isSelectingFocus:false});};
   const pick=(e:PointerEvent)=>{
     if(e.button!==0)return;e.preventDefault();e.stopImmediatePropagation();
     const rect=canvas.getBoundingClientRect();const ray=new THREE.Raycaster();
     ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
     scene.updateMatrixWorld(true);
     const roots:THREE.Object3D[]=[];scene.traverse(o=>{if(o.userData.mockupModelId)roots.push(o);});
     const hit=ray.intersectObjects(roots,true).find(h=>{let o:THREE.Object3D|null=h.object;while(o){if(!o.visible)return false;o=o.parent;}const material=(h.object as THREE.Mesh).material;return !material||!(Array.isArray(material)?material:[material]).every(m=>!m.visible||(m.transparent&&m.opacity===0));});
     if(!hit)return;
     let root:THREE.Object3D|null=hit.object;while(root&&!root.userData.mockupModelId)root=root.parent;
     const model=state.models.find(m=>m.id===root?.userData.mockupModelId);if(!root||!model)return;
     saveHistory?.();
     updateState?.({...editLens(state,{enabled:true,focus:{modelId:model.id,modelSource:modelSource(model),localPoint:root.worldToLocal(hit.point.clone()).toArray() as [number,number,number],fallbackWorldPoint:hit.point.toArray() as [number,number,number]}}),isSelectingFocus:false});
   };
   canvas.addEventListener('pointerdown',pick,true);window.addEventListener('keydown',cancel);
   return ()=>{canvas.removeEventListener('pointerdown',pick,true);window.removeEventListener('keydown',cancel);canvas.style.cursor=oldCursor;};
 },[state,camera,scene,gl,updateState,saveHistory]);
 const lens=state.lens||DEFAULT_LENS;
 if(!lens.enabled||!lens.focus||state.isPlaying||state.isExporting)return null;
 const p=focusWorld(lens.focus,state.models,state.cameraTarget);
 return <Html position={p} center style={{pointerEvents:'none'}}><div aria-label="焦点标记" style={{width:18,height:18,border:'2px solid #fbbf24',borderRadius:'50%',boxShadow:'0 0 0 1px #111'}}/></Html>;
}
