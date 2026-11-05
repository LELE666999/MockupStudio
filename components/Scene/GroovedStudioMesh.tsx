import {useEffect,useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import * as T from 'three';
import type {StageObject} from '../../types';
import {microWeavePixels} from '../../utils/groovedStudio';
import {stageSurfaceParameters} from '../../utils/stageSurface';

export function GroovedStudioMesh({object,geometry,events}:{object:StageObject;geometry:T.BufferGeometry;events:Record<string,(event:any)=>void>}){
 const {gl}=useThree();
 const maps=useMemo(()=>{
  const pixels=microWeavePixels(),textures={} as Record<'color'|'normal'|'roughness',T.DataTexture>;
  for(const key of ['color','normal','roughness'] as const){
   const texture=new T.DataTexture(pixels[key],pixels.size,pixels.size,T.RGBAFormat);
   texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.generateMipmaps=true;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;texture.anisotropy=Math.min(8,gl.capabilities.getMaxAnisotropy());texture.colorSpace=key==='color'?T.SRGBColorSpace:T.NoColorSpace;texture.needsUpdate=true;textures[key]=texture;
  }return textures;
 },[gl]);
 useEffect(()=>()=>Object.values(maps).forEach(t=>t.dispose()),[maps]);
 useEffect(()=>{Object.values(maps).forEach(t=>t.repeat.setScalar(object.textureScale??1));},[maps,object.textureScale]);
 const satin=object.shape==='satin-sheet';
 const material=useMemo(()=>{
  const strength=object.detailStrength??(satin?.18:.65);
  const silky=object.material==='satin',metal=object.material==='metal';
  const m=new T.MeshPhysicalMaterial({...stageSurfaceParameters(object),map:silky?null:maps.color,normalMap:maps.normal,normalScale:new T.Vector2(strength,strength),roughnessMap:silky?null:maps.roughness,metalness:silky?.04:metal?.7:0,clearcoat:silky?.16:metal?.12:0,clearcoatRoughness:silky?.32:.3,specularIntensity:silky?1:.85,sheen:silky?1:0,sheenColor:silky?new T.Color(object.color).lerp(new T.Color('#ffffff'),.65):object.color,sheenRoughness:silky?.4:.8,anisotropy:silky?.65:metal?.08:0,anisotropyRotation:Math.PI/2,envMapIntensity:satin?1.6:2,side:satin?T.DoubleSide:T.FrontSide});
  m.name=satin?'studio-purple-satin':'studio-embossed-tray';return m;
 },[object.color,object.roughness,object.detailStrength,object.material,satin,maps]);
 useEffect(()=>()=>material.dispose(),[material]);
 return <mesh {...events} geometry={geometry} material={material} castShadow={!satin} receiveShadow/>;
}
