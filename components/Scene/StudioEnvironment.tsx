import {useEffect,useMemo} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Environment,useEnvironment} from '@react-three/drei';
import * as T from 'three';
import type {AppState} from '../../types';
import {CHROME_HDR,environmentBackdrop,showsStudioHDR,studioEnvironment} from '../../utils/studioEnvironment';

export function StudioEnvironment({state}:{state:AppState}){
 const {scene}=useThree(),hdr=useEnvironment({files:CHROME_HDR}) as T.DataTexture;
 const backdrop=useMemo(()=>environmentBackdrop(hdr),[hdr]),settings=studioEnvironment(state.stage),visible=showsStudioHDR(state);
 useEffect(()=>()=>{if(scene.background===backdrop)scene.background=null;scene.backgroundBlurriness=0;scene.backgroundRotation.set(0,0,0);backdrop.dispose();},[scene,backdrop]);
 useFrame(()=>{if(visible){scene.background=backdrop;scene.backgroundBlurriness=settings.blur;scene.backgroundIntensity=1;scene.backgroundRotation.set(0,settings.rotation,0);}},-.5);
 return <>
  <Environment map={hdr} environmentIntensity={state.lightingMode==='flat'?.2:settings.intensity*.65} environmentRotation={[0,settings.rotation,0]} backgroundRotation={[0,settings.rotation,0]}/>
  {/* A distant transparent receiver adds spatially correct shadows without
      covering the real room in an opaque, camera-facing colour card. */}
  {visible&&<mesh name="chrome-distant-shadows" rotation={[-Math.PI/2,0,0]} position={[state.stage?.position[0]??0,(state.stage?.position[1]??-3.4)-4.4,state.stage?.position[2]??0]} receiveShadow userData={{lensGroupId:'studio-architecture'}}>
   <planeGeometry args={[70,70]}/><shadowMaterial color="#261d19" opacity={.12} transparent depthWrite={false}/>
  </mesh>}
 </>;
}
