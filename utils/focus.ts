import {Euler,Matrix4,Quaternion,Vector3,Camera} from 'three';
import type {AppState,FocusAnchor,Keyframe,LensConfig,ModelConfig} from '../types';
import {evaluateEasing} from './easing.ts';
export const DEFAULT_LENS:LensConfig={enabled:false,aperture:2.8,maxBlur:12,focus:null};
export const modelSource=(model:ModelConfig)=>model.mode==='simple'?'simple':`${model.mode}:${model.sourceFile || model.fbxFile || model.modelFormat || ''}`;
export function focusWorld(anchor:FocusAnchor|null,models:ModelConfig[],fallback:number[]){
  if(!anchor)return new Vector3(...fallback);
  const model=models.find(m=>m.id===anchor.modelId&&m.visible!==false&&(!anchor.modelSource||modelSource(m)===anchor.modelSource));
  if(!model)return new Vector3(...anchor.fallbackWorldPoint);
  const matrix=new Matrix4().compose(new Vector3(...model.position),new Quaternion().setFromEuler(new Euler(...model.rotation)),new Vector3().setScalar(model.scale));
  return new Vector3(...anchor.localPoint).applyMatrix4(matrix);
}
/** Monotone Hermite: shared derivatives, no negative aperture/depth overshoot. */
export function sampleLensValue(time:number,frames:Keyframe[],read:(f:Keyframe)=>number,continuous:boolean){
  const sorted=[...frames].sort((a,b)=>a.time-b.time).filter((f,i,a)=>!i||f.time!==a[i-1].time);
  if(time<=sorted[0].time)return read(sorted[0]);
  if(time>=sorted.at(-1)!.time)return read(sorted.at(-1)!);
  const i=sorted.findIndex((f,i)=>i<sorted.length-1&&time>=f.time&&time<sorted[i+1].time);
  const a=sorted[i],b=sorted[i+1],duration=b.time-a.time,t=(time-a.time)/duration;
  const p=read(a),q=read(b);
  if(!continuous){const u=evaluateEasing(t,a.easing,a.bezier);return p+(q-p)*u;}
  const slope=(index:number)=>{
    if(!index||index===sorted.length-1)return 0;
    const l=sorted[index].time-sorted[index-1].time,r=sorted[index+1].time-sorted[index].time;
    const x=(read(sorted[index])-read(sorted[index-1]))/l,y=(read(sorted[index+1])-read(sorted[index]))/r;
    if(x*y<=0)return 0;
    return 3*(l+r)/((2*r+l)/x+(r+2*l)/y);
  };
  const value=(2*t*t*t-3*t*t+1)*p+(t*t*t-2*t*t+t)*duration*slope(i)+(-2*t*t*t+3*t*t)*q+(t*t*t-t*t)*duration*slope(i+1);
  return Math.max(Math.min(p,q),Math.min(Math.max(p,q),value));
}
export function animatedLens(time:number,frames:Keyframe[],state:AppState):LensConfig{
  const base=frames.some(f=>f.state.lens)?DEFAULT_LENS:(state.lens||DEFAULT_LENS);
  if(!frames.length)return base;
  const ordered=[...frames].sort((a,b)=>a.time-b.time);
  const nearest=ordered.reduce((a,b)=>Math.abs(b.time-time)<Math.abs(a.time-time)?b:a);
  return {...(nearest.state.lens||base),shutter:sampleLensValue(time,frames,f=>(f.state.lens||base).shutter??1/60,state.motionMode==='continuous'),iso:sampleLensValue(time,frames,f=>(f.state.lens||base).iso??100,state.motionMode==='continuous'),aperture:sampleLensValue(time,frames,f=>(f.state.lens||base).aperture,state.motionMode==='continuous'),maxBlur:sampleLensValue(time,frames,f=>(f.state.lens||base).maxBlur,state.motionMode==='continuous')};
}
export function lensDepth(state:AppState,camera:Camera){
  const subject=state.models.find(m=>m.id===state.activeModelId&&m.visible!==false)||state.models.find(m=>m.visible!==false);
  const automaticTarget=subject?.position||state.cameraTarget;
  const depth=(anchor:FocusAnchor|null)=>Math.max(.02,-focusWorld(anchor,state.models,automaticTarget).applyMatrix4(camera.matrixWorldInverse).z);
  const base=state.keyframes.some(f=>f.state.lens)?DEFAULT_LENS:(state.lens||DEFAULT_LENS);
  if(state.lensAnimated&&state.keyframes.length)return sampleLensValue(state.currentTime,state.keyframes,f=>depth((f.state.lens||base).focus),state.motionMode==='continuous');
  return depth((state.lens||DEFAULT_LENS).focus);
}
export function editLens(state:AppState,patch:Partial<LensConfig>):Partial<AppState>{
  const lens={...(state.lens||DEFAULT_LENS),...patch};
  return {lens,lensAnimated:false,isPlaying:false,keyframes:state.keyframes.map(f=>({...f,state:{...f.state,lens:structuredClone(Math.abs(f.time-state.currentTime)<.001?lens:(f.state.lens||state.lens||DEFAULT_LENS))}}))};
}
