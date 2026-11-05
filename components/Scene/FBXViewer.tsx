import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useLoader } from '@react-three/fiber';
import { FBXLoader, STLLoader, GLTFLoader } from 'three-stdlib';
import { ModelConfig, AppState } from '../../types';
import * as THREE from 'three';
import { centerModel } from '../../utils/modelGeometry';
import {useTimelineVideo} from './useTimelineVideo';
import {isBodyFinish,isAppleModel} from '../../utils/modelMaterials';
import {isAppleDuo,prepareAppleDuo,updateAppleDuoFold,APPLE_DUO_COVER} from '../../utils/appleDuoFold';

function useScreenTexture(url:string|null|undefined,type:string|undefined,isGlb:boolean,state:AppState){
  const [texture,setTexture]=useState<THREE.Texture|null>(null);
  useTimelineVideo(texture?.image?.tagName==='VIDEO'?texture.image:null,state);
  useEffect(()=>{
    setTexture(null);if(!url)return;
    let alive=true,tex:THREE.Texture|undefined,video:HTMLVideoElement|undefined;
    const ready=(loaded:THREE.Texture)=>{
      if(!alive){loaded.dispose();return;}tex=loaded;tex.colorSpace=THREE.SRGBColorSpace;tex.flipY=!isGlb;
      tex.minFilter=THREE.LinearFilter;tex.magFilter=THREE.LinearFilter;tex.generateMipmaps=false;setTexture(tex);
    };
    if(type==='video'){video=document.createElement('video');video.src=url;video.preload='auto';video.muted=true;video.playsInline=true;ready(new THREE.VideoTexture(video));}
    else new THREE.TextureLoader().load(url,ready);
    return ()=>{alive=false;tex?.dispose();if(video){video.pause();video.removeAttribute('src');video.load();}};
  },[url,type,isGlb]);
  return texture;
}

interface Props {
  config: ModelConfig;
  appState: AppState;
  onMeshSelect: (name: string) => void;
  updateModel: (updates: Partial<ModelConfig>) => void;
  isSelected: boolean;
}

export const FBXViewer: React.FC<Props> = ({config, appState, onMeshSelect, updateModel, isSelected}) => {
  const isGlb = config.fbxFile?.toLowerCase().endsWith('.glb') || config.modelFormat === 'glb';
  const isStl = config.mode === 'stl';
  const useUniformBody=(config.sourceFile||config.fbxFile)?.includes('/models/huawei-user-24693859.glb');
  const data: any = useLoader(isGlb ? GLTFLoader : isStl ? STLLoader : FBXLoader, config.fbxFile!);
  const [hovered, setHovered] = useState<string | null>(null);
  const texture=useScreenTexture(config.screenshot,config.screenshotType,!!isGlb,appState);
  const duo=isAppleDuo(config.sourceFile||config.fbxFile);
  const coverTexture=useScreenTexture(duo?config.coverScreenshot:null,config.coverScreenshotType,!!isGlb,appState);
  const {scene,rig} = useMemo(() => {
    let object: THREE.Object3D;
    if (isStl) {
      object = new THREE.Mesh(data.clone(), new THREE.MeshStandardMaterial());
      object.name = 'Screen';
    } else object = (isGlb ? data.scene : data).clone(true);
    const used = new Set<string>();
    object.traverse(child => {
      if ((child as THREE.Light).isLight) child.visible = false;
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      let name = mesh.name || 'Mesh';
      while (used.has(name)) name += '_part';
      mesh.name = name; used.add(name);
      mesh.geometry = mesh.geometry.clone();
      if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
      mesh.userData.originalMaterial = mesh.material;
    });
    const source=config.sourceFile || config.fbxFile;
    const rig=isAppleDuo(source)?prepareAppleDuo(object):null;
    if (source === '/Pura70pro.fbx') object.rotateY(Math.PI);
    if (isAppleModel(source)&&!rig) object.rotateX(Math.PI);
    return {scene:centerModel(object),rig};
  }, [data, isGlb, isStl]);
  useLayoutEffect(()=>{if(rig)updateAppleDuoFold(rig,config.foldAngle??0);},[rig,config.foldAngle]);
  useEffect(()=>()=>{rig?.screen.userData.originalMaterial.dispose();rig?.bezel.userData.originalMaterial.dispose();},[rig]);
  const meshes = useMemo(() => {
    const map = new Map<string, THREE.Mesh>();
    scene.traverse(child => { if ((child as THREE.Mesh).isMesh) map.set(child.name, child as THREE.Mesh); });
    return map;
  }, [scene]);
  useEffect(() => {
    if (config.subMeshes.length === 0) updateModel({subMeshes: Array.from(meshes.keys(), name => ({name,visible:true}))});
  }, [meshes, config.subMeshes, updateModel]);
  useEffect(() => () => { meshes.forEach(mesh => mesh.geometry.dispose()); }, [meshes]);
  const aspect = useMemo(() => {
    const mesh = meshes.get(config.selectedScreenMesh ?? '');
    if (!mesh) return 1;
    const geo = mesh.geometry;
    if(geo.userData.screenAspect)return geo.userData.screenAspect;
    scene.updateWorldMatrix(true,true);
    const matrix = scene.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
    const pos = geo.attributes.position;
    const point=new THREE.Vector3();const box=new THREE.Box3();
    for(let i=0;i<pos.count;i++)box.expandByPoint(point.fromBufferAttribute(pos,i).applyMatrix4(matrix));
    const size = box.getSize(new THREE.Vector3());
    const axes = [0,1,2].sort((a,b) => size.getComponent(b)-size.getComponent(a));
    const u = axes[2] !== 0 ? 0 : 2;
    const v = axes[2] !== 1 ? 1 : 2;
    if (!isGlb && !mesh.userData.screenUV) {
      const uv = new THREE.BufferAttribute(new Float32Array(pos.count*2),2);
      for (let i=0;i<pos.count;i++) {
        point.fromBufferAttribute(pos,i).applyMatrix4(matrix);
        uv.setXY(i,(point.getComponent(u)-box.min.getComponent(u))/Math.max(size.getComponent(u),1e-9),
        (point.getComponent(v)-box.min.getComponent(v))/Math.max(size.getComponent(v),1e-9));
      }
      geo.setAttribute('uv',uv); mesh.userData.screenUV = true;
    }
    return size.getComponent(u) / Math.max(size.getComponent(v),1e-9);
  }, [meshes, config.selectedScreenMesh, isGlb]);
  useEffect(() => {
    if (!texture) return;
    const fit=()=>{
    texture.center.set(0.5,0.5); texture.rotation = -config.textureRotation*Math.PI/180;
    const img = texture.image;
    let imageAspect = (img?.videoWidth || img?.width || 1)/(img?.videoHeight || img?.height || 1);
    if (Math.abs(Math.round(config.textureRotation/90))%2) imageAspect=1/imageAspect;
    let x=1,y=1;
    if (!config.textureStretch) { if (aspect>imageAspect) y=imageAspect/aspect; else x=aspect/imageAspect; }
    texture.repeat.set(config.textureFlipX?-x:x,config.textureFlipY?-y:y);
    };
    fit();
    const video=texture.image;
    if(video instanceof HTMLVideoElement){video.addEventListener('loadedmetadata',fit);video.addEventListener('resize',fit);return ()=>{video.removeEventListener('loadedmetadata',fit);video.removeEventListener('resize',fit);};}
  }, [texture,aspect,config.textureRotation,config.textureFlipX,config.textureFlipY,config.textureStretch]);
  useEffect(()=>{
    if(!coverTexture||!rig)return;
    const fit=()=>{
      const aspect=meshes.get(APPLE_DUO_COVER)?.geometry.userData.screenAspect||1;
      const img=coverTexture.image,ratio=(img?.videoWidth||img?.width||1)/(img?.videoHeight||img?.height||1);
      coverTexture.center.set(.5,.5);coverTexture.repeat.set(aspect<ratio?aspect/ratio:1,aspect>ratio?ratio/aspect:1);
    };fit();const video=coverTexture.image;
    if(video instanceof HTMLVideoElement){video.addEventListener('loadedmetadata',fit);return ()=>video.removeEventListener('loadedmetadata',fit);}
  },[coverTexture,rig,meshes]);
  const body = useMemo(() => new THREE.MeshPhysicalMaterial({
    color:config.bodyColor,roughness:config.roughness,metalness:config.metalness,
    clearcoat:config.clearcoat ?? 0.5,side:THREE.DoubleSide,
  }), [config.bodyColor,config.roughness,config.metalness,config.clearcoat]);
  const screen = useMemo(() => new THREE.MeshPhysicalMaterial({
    color:texture?'#000000':'#111111',emissive:texture?'#ffffff':'#000000',emissiveMap:texture,
    emissiveIntensity:config.screenEmissive,roughness:1,metalness:0,specularIntensity:0,envMapIntensity:0,clearcoat:0,toneMapped:false,side:THREE.DoubleSide,
  }), [texture,config.screenEmissive,config.screenRoughness]);
  const coverScreen=useMemo(()=>new THREE.MeshPhysicalMaterial({color:coverTexture?'#000000':'#111111',emissive:coverTexture?'#ffffff':'#000000',emissiveMap:coverTexture,emissiveIntensity:config.screenEmissive,roughness:1,metalness:0,specularIntensity:0,envMapIntensity:0,toneMapped:false,side:THREE.DoubleSide}),[coverTexture,config.screenEmissive]);
  useEffect(()=>()=>coverScreen.dispose(),[coverScreen]);
  const highlight = useMemo(() => new THREE.MeshBasicMaterial({color:'#38bdf8',side:THREE.DoubleSide}),[]);
  const coloredMaterials=useMemo(()=>{
    const cache=new Map<THREE.Material,THREE.Material>();
    if(config.bodyColorOverride)meshes.forEach(mesh=>{
      const originals=mesh.userData.originalMaterial;
      for(const original of Array.isArray(originals)?originals:[originals]){
        if(!cache.has(original)&&isBodyFinish(config.sourceFile||config.fbxFile,original.name)){
          const material=original.clone() as THREE.MeshStandardMaterial;
          material.color.set(config.bodyColor);
          if(material.map){
            // Remove the baked finish hue, retaining texture detail, alpha and markings.
            const reference=(config.sourceFile||config.fbxFile)?.includes('iphone18') ? .09 : .7;
            material.onBeforeCompile=shader=>{
              shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',THREE.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;',`sampledDiffuseColor.rgb = vec3(clamp(max(max(sampledDiffuseColor.r, sampledDiffuseColor.g), sampledDiffuseColor.b) / ${reference.toFixed(2)}, 0.0, 1.0)); diffuseColor *= sampledDiffuseColor;`));
            };
            material.userData.shadowStatic=true;
            material.customProgramCacheKey=()=>`body-finish-neutral-${reference}`;
          }
          cache.set(original,material);
        }
      }
    });
    return cache;
  },[meshes,config.bodyColorOverride,config.bodyColor,config.sourceFile,config.fbxFile]);
  useEffect(()=>()=>coloredMaterials.forEach(material=>material.dispose()),[coloredMaterials]);
  useEffect(() => () => body.dispose(),[body]);
  useEffect(() => () => screen.dispose(),[screen]);
  useEffect(() => () => highlight.dispose(),[highlight]);
  useEffect(() => {
    meshes.forEach((mesh,name) => {
      const entry = config.subMeshes.find(item => item.name === name);
      mesh.visible = entry?.visible !== false;
      mesh.castShadow = appState.lightingMode !== 'flat';
      // Keep ground shadows without low-resolution self-shadow acne on thin rims.
      mesh.receiveShadow = false;
      const selected = name === config.selectedScreenMesh;
      const cover=duo&&name===APPLE_DUO_COVER;
      mesh.userData.studioColorCritical=selected||cover;
      const original=mesh.userData.originalMaterial;
      const colored=Array.isArray(original)?original.map(m=>coloredMaterials.get(m)||m):coloredMaterials.get(original)||original;
      mesh.material = selected ? screen : cover ? coverScreen : isGlb && !useUniformBody ? colored : body;
      if (appState.isSelectingScreen && isSelected && hovered === name && !(selected && texture) && !entry?.locked) mesh.material = highlight;
    });
  }, [meshes,config.subMeshes,config.selectedScreenMesh,appState.lightingMode,appState.isSelectingScreen,isSelected,hovered,texture,screen,body,highlight,isGlb,coloredMaterials,useUniformBody,duo,coverScreen]);
  return <primitive object={scene}
    onClick={(e:any) => { if(appState.isSelectingScreen){e.stopPropagation();if (isSelected && !config.subMeshes.find(s=>s.name===e.object.name)?.locked) onMeshSelect(e.object.name);} }}
    onPointerOver={(e:any) => { if (!appState.isSelectingScreen || !isSelected) return; e.stopPropagation(); setHovered(e.object.name); }}
    onPointerOut={() => setHovered(null)}
  />;
};
