import React,{useEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import type {AppState} from '../../types';
import {DEFAULT_LENS,lensDepth} from '../../utils/focus';
import {renderedScene,sceneRenderError} from '../../utils/renderReady';
import {studioMaterials} from '../../utils/studioMaterials';
import {cameraExposure} from '../../utils/camera';
import {RealtimeLensRenderer} from '../../utils/RealtimeLensRenderer';
export function LensEffects({state}:{state:AppState}){
 const {gl,scene,camera}=useThree(),failed=useRef(false);
 const renderer=useMemo(()=>new RealtimeLensRenderer(gl),[gl]);
 const materials=useMemo(()=>studioMaterials(),[]);
 useEffect(()=>()=>{renderer.dispose();materials.dispose()},[renderer,materials]);
 useFrame(()=>{
  const lens=state.lens||DEFAULT_LENS;
  const restore=state.renderStyle==='studio'&&state.lightingMode!=='flat'?materials.apply(scene):()=>{};
  try{
   renderer.render(scene,camera,{enabled:lens.enabled&&lens.maxBlur>0,focus:lensDepth(state,camera),aperture:lens.aperture,exposure:cameraExposure(lens),revision:state,exporting:state.isExporting,playing:state.isPlaying});
   failed.current=false;sceneRenderError(gl.domElement);renderedScene(gl.domElement,state.currentTime,state.isExporting);
  }catch(error){
   if(!failed.current){console.error('镜头渲染失败',error);window.dispatchEvent(new CustomEvent('mockup-render-warning',{detail:'镜头渲染失败，已回退清晰预览。'}));}
   failed.current=true;sceneRenderError(gl.domElement,'镜头渲染失败，请关闭景深后再导出。');gl.setRenderTarget(null);gl.render(scene,camera);
  }finally{restore();}
 },1);
 return null;
}
