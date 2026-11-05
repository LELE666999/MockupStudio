import React,{useEffect,useMemo,useState} from 'react';
import * as THREE from 'three';
import type {AppState,ModelConfig} from '../../types';
import {useTimelineVideo} from './useTimelineVideo';
import {foldScreen} from '../../utils/foldGeometry';

/** Independent exterior display. Both media controllers share project time,
 * not each other's playback clocks; exports wait for both decoded frames. */
export function CoverScreen({config,state,width,height}:{config:ModelConfig;state:AppState;width:number;height:number}){
 const [texture,setTexture]=useState<THREE.Texture|null>(null);
 const geometry=useMemo(()=>foldScreen(width,height,.12,180,0),[width,height]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 useTimelineVideo(texture?.image instanceof HTMLVideoElement?texture.image:null,state);
 useEffect(()=>{
  setTexture(null);if(!config.coverScreenshot)return;
  let active=true,tex:THREE.Texture|undefined,video:HTMLVideoElement|undefined;
  const fit=()=>{
   if(!tex)return;const source=tex.image;
   const w=source?.videoWidth||source?.width,h=source?.videoHeight||source?.height;if(!w||!h)return;
   const image=w/h,screen=width/height;tex.center.set(.5,.5);
   tex.repeat.set(screen>image?1:screen/image,screen>image?image/screen:1);
  };
  const ready=(value:THREE.Texture)=>{
   if(!active){value.dispose();return;}tex=value;tex.colorSpace=THREE.SRGBColorSpace;
   tex.minFilter=THREE.LinearFilter;tex.magFilter=THREE.LinearFilter;fit();setTexture(tex);
  };
  if(config.coverScreenshotType==='video'){
   video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';
   video.addEventListener('loadedmetadata',fit);video.addEventListener('resize',fit);
   video.src=config.coverScreenshot;ready(new THREE.VideoTexture(video));
  }else new THREE.TextureLoader().load(config.coverScreenshot,ready);
  return ()=>{active=false;if(video){video.removeEventListener('loadedmetadata',fit);video.removeEventListener('resize',fit);video.pause();video.removeAttribute('src');video.load();}tex?.dispose();};
 },[config.coverScreenshot,config.coverScreenshotType,width,height]);
 return <mesh geometry={geometry} userData={{studioColorCritical:true}}>
  <meshBasicMaterial key={texture?.uuid||'empty'} map={texture} color={texture?'#ffffff':'#080a0e'} toneMapped={false}/>
 </mesh>;
}
