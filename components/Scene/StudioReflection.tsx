import {useEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as T from 'three';
import {Reflector} from 'three/examples/jsm/objects/Reflector.js';
import type {AppState,StageObject} from '../../types';
import {studioMaterials} from '../../utils/studioMaterials';

function roundedSurface(w:number,d:number,r:number){
 const s=new T.Shape();s.moveTo(-w/2+r,-d/2);s.lineTo(w/2-r,-d/2);s.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);s.lineTo(w/2,d/2-r);s.quadraticCurveTo(w/2,d/2,w/2-r,d/2);s.lineTo(-w/2+r,d/2);s.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r);s.lineTo(-w/2,-d/2+r);s.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);return new T.ShapeGeometry(s,20);
}
/** One cached physical planar reflection, not a mirrored phone screenshot.
 * Includes current media and all phones; editor handles never enter the glass. */
export function StudioReflection({object,state}:{object:StageObject;state:AppState}){
 const {gl,scene,camera}=useThree(),last=useRef(''),assets=useRef<{sources:(string|null|undefined)[];revision:number}>({sources:[],revision:0});
 const tones=useMemo(()=>studioMaterials(),[]);
 const surface=useMemo(()=>{
  const geometry=roundedSurface(object.size[0]-.04,object.size[2]-.04,Math.min(object.bevelRadius??.09,object.size[1]/2));
  const mirror=new Reflector(geometry,{textureWidth:1024,textureHeight:1024,clipBias:.003,color:0xffffff});
  const material=mirror.material as T.ShaderMaterial;
  material.uniforms.strength={value:object.reflectivity??.5};material.uniforms.base={value:new T.Color('#aab3be')};
  material.fragmentShader=`uniform sampler2D tDiffuse;uniform float strength;uniform vec3 base;varying vec4 vUv;
   #include <logdepthbuf_pars_fragment>
   void main(){
   #include <logdepthbuf_fragment>
   vec3 reflected=texture2DProj(tDiffuse,vUv).rgb;gl_FragColor=vec4(mix(base,reflected,strength),1.);
   #include <colorspace_fragment>
   }`;
  material.toneMapped=false;mirror.rotation.x=-Math.PI/2;mirror.position.y=object.size[1]/2+.004;mirror.name='studio-planar-glass';mirror.raycast=()=>{};
  const refresh=mirror.onBeforeRender.bind(mirror);mirror.onBeforeRender=()=>{};
  return {mirror,geometry,refresh};
 },[...object.size,object.bevelRadius]);
 useEffect(()=>()=>{surface.mirror.dispose();surface.geometry.dispose()},[surface]);
 useEffect(()=>()=>tones.dispose(),[tones]);
 useFrame(()=>{
  const material=surface.mirror.material as T.ShaderMaterial;material.uniforms.strength.value=object.reflectivity??.5;material.uniforms.base.value.set(object.color);
  const sources=[state.bgImage,...state.models.flatMap(m=>[m.screenshot,m.coverScreenshot])];
  if(sources.length!==assets.current.sources.length||sources.some((src,i)=>src!==assets.current.sources[i]))assets.current={sources,revision:assets.current.revision+1};
  // Never stringify a potentially hundreds-of-MB embedded video per frame,
  // or retain old videos after replacements just to calculate a cache key.
  const key=[assets.current.revision,...camera.matrixWorld.elements,...camera.projectionMatrix.elements,object.position,object.rotation,object.size,state.models.map(m=>[m.id,m.visible,m.position,m.rotation,m.scale,m.foldAngle,m.screenshotMix,m.bodyColor,m.roughness]),state.stage,state.ambientIntensity,state.lightColor,state.texts].map(v=>typeof v==='object'?JSON.stringify(v):v).join('|');
  const video=state.models.some(m=>m.screenshotType==='video'||m.coverScreenshotType==='video')||state.bgMediaType==='video';
  // Readiness, scrubbing and paused first-video frames can change textures
  // independently of React state. Include texture uploads in the signature.
  const media:string[]=[];scene.traverse(o=>{const m=(o as T.Mesh).material;if(!m)return;for(const mat of Array.isArray(m)?m:[m]){const a=mat as T.MeshStandardMaterial;for(const t of [a.map,a.emissiveMap])if(t)media.push(t.uuid+':'+t.version);}});
  const signature=key+'|'+media.join(',');if(last.current===signature&&!state.isExporting&&!(video&&state.isPlaying))return;
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);const hidden:T.Object3D[]=[];
  scene.traverse(o=>{if(o.visible&&o.userData.sceneGizmo){hidden.push(o);o.visible=false;}});
  const restore=tones.apply(scene),tone=gl.toneMapping,target=gl.getRenderTarget();
  try{gl.toneMapping=T.NoToneMapping;surface.refresh(gl,scene,camera,surface.geometry,material,null as any);last.current=signature;surface.mirror.userData.reflectionFrames=(surface.mirror.userData.reflectionFrames||0)+1;}
  finally{surface.mirror.visible=true;restore();hidden.forEach(o=>o.visible=true);gl.toneMapping=tone;gl.setRenderTarget(target);}
 },.5);
 return <primitive object={surface.mirror}/>;
}
