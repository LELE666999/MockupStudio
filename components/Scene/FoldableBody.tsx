import React,{useMemo,useEffect} from 'react';
import {RoundedBox} from '@react-three/drei';
import type {ModelConfig,AppState} from '../../types';
import {CoverScreen} from './CoverScreen';
import {foldHalfAngle,foldPoint,foldScreen,FOLD_STRIP} from '../../utils/foldGeometry';

/** Procedural wide book fold; no imported/baked textures or duplicate videos. */
export function FoldableBody({config,state}:{config:ModelConfig;state:AppState}){
 const {width,height,depth}=config,a=foldHalfAngle(config.foldAngle),half=(width-FOLD_STRIP)/2;
 const [hx,hz]=foldPoint(FOLD_STRIP/2,config.foldAngle??180);
 const round=Math.min(config.radius,.14,depth*.45,half*.2);
 const bezel=useMemo(()=>foldScreen(width-.02,height-.02,config.radius,config.foldAngle??180,depth/2+.014),[width,height,config.radius,config.foldAngle,depth]);
 useEffect(()=>()=>bezel.dispose(),[bezel]);
 return <group>
  <mesh geometry={bezel}><meshStandardMaterial color="#090a0d" roughness={.65}/></mesh>
  {[-1,1].map(side=><group key={side} position={[side*hx,0,hz+depth/2+.03]} rotation={[0,-side*a,0]}>
   <RoundedBox args={[half,height,depth]} radius={round} smoothness={4} position={[side*half/2,0,-depth/2-.035]} castShadow>
    <meshPhysicalMaterial color={config.bodyColor} metalness={config.metalness} roughness={Math.max(.18,config.roughness)} clearcoat={config.clearcoat??.3}/>
   </RoundedBox>
   {/* Back panel, camera island and exterior details move with the shell. */}
   {side===-1&&<group name="fold-cover-screen" position={[-half/2,0,-depth-.055]} rotation={[0,Math.PI,0]}>
    <CoverScreen config={config} state={state} width={Math.max(.2,half-.14)} height={Math.max(.2,height-.18)}/>
   </group>}
   {side===1&&<group name="fold-rear-cameras" position={[half*.52,height*.32,-depth-.085]}>
    <RoundedBox args={[half*.7,height*.16,.09]} radius={.04}><meshStandardMaterial color="#24262c" metalness={.7} roughness={.25}/></RoundedBox>
    {[-1,0,1].map(n=><mesh key={n} position={[n*half*.21,0,-.06]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.09,.09,.035,24]}/><meshPhysicalMaterial color="#080c14" metalness={.55} roughness={.16}/></mesh>)}
   </group>}
   {side===1&&<RoundedBox args={[.045,height*.14,.065]} radius={.015} position={[half+.012,height*.17,-depth*.55]}><meshStandardMaterial color={config.bodyColor} metalness={.8} roughness={.25}/></RoundedBox>}
  </group>)}
  {/* Hinge hardware is enclosed by the shells. The continuous black bezel
      and flexible display form the visible seam, with no projecting barrel. */}
 </group>;
}
