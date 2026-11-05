import {useEffect,useRef,useMemo} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {AppState} from '../../types';
import {bindTimelineVideo} from '../../utils/timelineMedia';
import {trackBackground} from '../../utils/backgroundReady';
import {studioId,studioBackgroundPixels,studioPalettes} from '../../utils/studioScenes';

export function SceneBackground({state}:{state:AppState}){
 const {scene,size}=useThree();
 const latest=useRef(state);latest.current=state;
 const id=studioId(state.stage);
 const paletteKey=JSON.stringify(state.stage?.studioLighting);
 const backdrop=useMemo(()=>{if(!id||id==='chrome')return null;const texture=new THREE.DataTexture(studioBackgroundPixels(id,512,state.stage?.studioLighting),512,512);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;},[id,paletteKey]);
 useEffect(()=>()=>backdrop?.dispose(),[backdrop]);
 const asset=useRef<{media:HTMLImageElement|HTMLVideoElement;texture:THREE.CanvasTexture;canvas:HTMLCanvasElement;binding?:ReturnType<typeof bindTimelineVideo>;lastTime:number;blur:number}|null>(null);
 useEffect(()=>{
  if(!state.bgImage){scene.background=state.bgColor==='transparent'?null:new THREE.Color(state.bgColor);trackBackground(Promise.resolve());return;}
  let disposed=false,settle:()=>void=()=>{};
  const video=state.bgMediaType==='video';
  const media=video?document.createElement('video'):new Image();
  media.crossOrigin='anonymous';
  const canvas=document.createElement('canvas');const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const binding=video?bindTimelineVideo(media as HTMLVideoElement):undefined;
  binding?.update(latest.current);
  const value={media,texture,canvas,binding,lastTime:-1,blur:-1};asset.current=value;
  const task=new Promise<void>((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('背景加载超时，请重新选择背景文件')),15000);
   settle=()=>{clearTimeout(timer);resolve();};
   const ready=()=>{if(disposed)return;scene.background=texture;settle();};
   media.addEventListener(video?'loadeddata':'load',ready,{once:true});
   media.addEventListener('error',()=>{clearTimeout(timer);reject(Error('背景无法读取，请检查图片或视频格式'));},{once:true});
  });
  trackBackground(task);media.src=state.bgImage;if(video)(media as HTMLVideoElement).load();
  return ()=>{disposed=true;settle();binding?.dispose();if(video){(media as HTMLVideoElement).pause();media.removeAttribute('src');(media as HTMLVideoElement).load();}else media.removeAttribute('src');if(scene.background===texture)scene.background=null;texture.dispose();asset.current=null;};
 },[state.bgImage,state.bgMediaType,scene]);
 useFrame(()=>{
  const a=asset.current;
  if(!a){if(id==='chrome'&&state.bgColor===studioPalettes.chrome[0])return;scene.background=state.bgColor==='transparent'?null:id&&backdrop&&state.bgColor===studioPalettes[id][0]?backdrop:new THREE.Color(state.bgColor);return;}
  const video=a.media instanceof HTMLVideoElement;
  a.binding?.update(state);
  const w=video?(a.media as HTMLVideoElement).videoWidth:(a.media as HTMLImageElement).naturalWidth;
  const h=video?(a.media as HTMLVideoElement).videoHeight:(a.media as HTMLImageElement).naturalHeight;
  if(!w||!h||(video&&(a.media as HTMLVideoElement).readyState<2))return;
  const time=video?(a.media as HTMLVideoElement).currentTime:0;
  if(a.lastTime!==time||a.blur!==state.bgBlur){
   const scale=Math.min(1,4096/Math.max(w,h));
   const cw=Math.max(1,Math.round(w*scale)),ch=Math.max(1,Math.round(h*scale));
   if(a.canvas.width!==cw||a.canvas.height!==ch){a.canvas.width=cw;a.canvas.height=ch;}
   const ctx=a.canvas.getContext('2d');if(ctx){ctx.clearRect(0,0,cw,ch);ctx.filter=`blur(${state.bgBlur*scale}px)`;ctx.drawImage(a.media,0,0,cw,ch);a.texture.needsUpdate=true;}
   a.lastTime=time;a.blur=state.bgBlur;
  }
  const ratio=(w/h)/(size.width/size.height);
  a.texture.repeat.set(ratio>1?1/ratio:1,ratio<1?ratio:1);
  a.texture.offset.set((1-a.texture.repeat.x)/2,(1-a.texture.repeat.y)/2);
  scene.background=a.texture;
 },-1);
 return null;
}
