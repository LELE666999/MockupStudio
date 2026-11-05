import {useEffect,useMemo} from 'react';
import * as T from 'three';
import type {StageObject} from '../../types';

export function ChromeRackMesh({object,geometry,events}:{object:StageObject;geometry:T.BufferGeometry;events:Record<string,(event:any)=>void>}){
 const material=useMemo(()=>{
  const m=new T.MeshPhysicalMaterial({color:object.color,metalness:1,roughness:object.roughness,clearcoat:0,envMapIntensity:1.25});m.name='studio-welded-chrome';return m;
 },[object.color,object.roughness]);
 useEffect(()=>()=>material.dispose(),[material]);
 return <mesh {...events} geometry={geometry} material={material} castShadow receiveShadow/>;
}
