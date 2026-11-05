import {useEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as T from 'three';
import {FullScreenQuad} from 'three/examples/jsm/postprocessing/Pass.js';
import {HorizontalBlurShader} from 'three/examples/jsm/shaders/HorizontalBlurShader.js';
import {VerticalBlurShader} from 'three/examples/jsm/shaders/VerticalBlurShader.js';
import type {AppState,StageObject} from '../../types';

/** Caster-only contact capture. A studio floor/wall must not overwrite the
 * phone silhouette (ContactShadows intentionally draws without depth test).
 * Cache static captures and restore renderer state before the lens pass. */
export function StudioContactShadow({object,state}:{object:StageObject;state:AppState}){
 const {gl,scene}=useThree(),group=useRef<T.Group>(null),last=useRef('');
 const resources=useMemo(()=>{
  const target=new T.WebGLRenderTarget(512,512),scratch=new T.WebGLRenderTarget(512,512);
  const camera=new T.OrthographicCamera(-10,10,10,-10,0,12);
  const contactColor=new T.Color('#263247'),depth=new T.MeshDepthMaterial();depth.depthTest=depth.depthWrite=false;
  depth.onBeforeCompile=shader=>{
   shader.uniforms.contactColor={value:contactColor};
   shader.fragmentShader=shader.fragmentShader.replace('void main() {','uniform vec3 contactColor; void main() {').replace('vec4( vec3( 1.0 - fragCoordZ ), opacity );','vec4(contactColor, pow(1.0 - fragCoordZ, 3.0));');
  };
  const horizontal=new T.ShaderMaterial(HorizontalBlurShader),vertical=new T.ShaderMaterial(VerticalBlurShader);
  horizontal.depthTest=vertical.depthTest=false;horizontal.depthWrite=vertical.depthWrite=false;
  const quad=new FullScreenQuad(horizontal);
  return {target,scratch,camera,depth,horizontal,vertical,quad,contactColor};
 },[]);
 useEffect(()=>()=>{resources.target.dispose();resources.scratch.dispose();resources.depth.dispose();resources.horizontal.dispose();resources.vertical.dispose();resources.quad.dispose()},[resources]);
 useFrame(()=>{
  if(!group.current)return;
  scene.updateMatrixWorld(true);
  const drawables:T.Object3D[]=[],casters:T.Object3D[]=[];
  scene.traverse(o=>{
   if(!(o as T.Mesh).isMesh&&!(o as T.Line).isLine&&!(o as T.Points).isPoints)return;
   drawables.push(o);let phone=false,overlay=false;
   for(let p:T.Object3D|null=o;p;p=p.parent){if(p.userData.mockupModelId||p.userData.mockupTextId)phone=true;if(p.userData.sceneGizmo||p.userData.weatherEffect)overlay=true;}
   if(phone&&!overlay&&o.visible)casters.push(o);
  });
  const signature=JSON.stringify([object.position,object.rotation,object.size,state.shadowConfig.blur,state.shadowConfig.color,state.models.map(m=>[m.id,m.position,m.rotation,m.scale,m.visible,m.foldAngle]),state.texts,casters.map(o=>[o.uuid,(o as T.Mesh).geometry?.uuid])]);
  if(last.current===signature)return;
  const {camera,depth,target,scratch,horizontal,vertical,quad}=resources;
  resources.contactColor.set(state.shadowConfig.color);
  camera.position.set(0,0,0);camera.rotation.set(Math.PI/2,0,0);camera.updateMatrix();
  camera.matrixWorld.multiplyMatrices(group.current.matrixWorld,camera.matrix);camera.matrixWorldInverse.copy(camera.matrixWorld).invert();camera.matrixAutoUpdate=false;camera.matrixWorldAutoUpdate=false;
  camera.updateProjectionMatrix();
  // Shear the orthographic capture along the area-light direction. Geometry
  // above the floor casts a progressively offset shadow; a vertical handset
  // therefore has a broad soft shadow, not a one-pixel line beneath it.
  const light=state.stage?.preset==='silk'?[.55,.3]:[-.6,.4];
  camera.projectionMatrix.elements[8]=camera.projectionMatrix.elements[0]*light[0];
  camera.projectionMatrix.elements[9]=camera.projectionMatrix.elements[5]*light[1];
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  const visible=drawables.map(o=>o.visible),background=scene.background,override=scene.overrideMaterial,renderTarget=gl.getRenderTarget(),auto=gl.shadowMap.autoUpdate,needs=gl.shadowMap.needsUpdate,clear=gl.getClearColor(new T.Color()),alpha=gl.getClearAlpha();
  try{
   const keep=new Set(casters);drawables.forEach(o=>o.visible=keep.has(o));scene.background=null;scene.overrideMaterial=depth;
   gl.shadowMap.autoUpdate=false;gl.shadowMap.needsUpdate=false;gl.setClearColor(0x000000,0);gl.setRenderTarget(target);gl.clear();gl.render(scene,camera);
   scene.overrideMaterial=null;
   for(const radius of [Math.max(.1,state.shadowConfig.blur*.58),Math.max(.04,state.shadowConfig.blur*.23)]){
    horizontal.uniforms.tDiffuse.value=target.texture;horizontal.uniforms.h.value=radius/256;quad.material=horizontal;gl.setRenderTarget(scratch);gl.clear();quad.render(gl);
    vertical.uniforms.tDiffuse.value=scratch.texture;vertical.uniforms.v.value=radius/256;quad.material=vertical;gl.setRenderTarget(target);gl.clear();quad.render(gl);
   }
   last.current=signature;
  }finally{drawables.forEach((o,i)=>o.visible=visible[i]);scene.background=background;scene.overrideMaterial=override;gl.shadowMap.autoUpdate=auto;gl.shadowMap.needsUpdate=needs;gl.setClearColor(clear,alpha);gl.setRenderTarget(renderTarget);}
 });
 return <group ref={group} position={[0,object.size[1]/2+.008,0]}>
  <mesh rotation={[-Math.PI/2,0,0]} raycast={()=>{}}><planeGeometry args={[20,20]}/><meshBasicMaterial map={resources.target.texture} transparent opacity={Math.min(1,state.shadowConfig.opacity*1.9)} depthWrite={false} toneMapped={false}/></mesh>
 </group>;
}
