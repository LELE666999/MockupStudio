import type {AppState,ModelConfig} from '../types';
export function replaceCoverScreen(state:AppState,id:string,url:string|null,type?:'image'|'video'):Partial<AppState>{
 const old=state.models.find(m=>m.id===id);if(!old)return {};
 const patch={coverScreenshot:url,coverScreenshotType:type};
 return {isPlaying:false,models:state.models.map(m=>m.id===id?{...m,...patch}:m),
  keyframes:state.keyframes.map(f=>({...f,state:{...f.state,...(f.state.models?{models:f.state.models.map(m=>m.id===id&&m.coverScreenshot===old.coverScreenshot?{...m,...patch}:m)}:{})}}))};
}
// Replace this clip wherever this phone's animation still references it, without
// erasing deliberate transitions to other clips or changing other phones.
export function replaceScreen(state:AppState,id:string,patch:Partial<ModelConfig>):Partial<AppState>{
 const old=state.models.find(m=>m.id===id);if(!old)return {};
 const clean={...patch,screenshotPrev:null,screenshotPrevType:undefined,screenshotMix:1};
 return {isPlaying:false,models:state.models.map(m=>m.id===id?{...m,...clean}:m),
  keyframes:state.keyframes.map(f=>({...f,state:{...f.state,models:f.state.models?.map(m=>{
   if(m.id!==id)return m;
   if(m.screenshot===old.screenshot)return {...m,...clean};
   if(m.screenshotPrev===old.screenshot)return {...m,screenshotPrev:patch.screenshot,screenshotPrevType:patch.screenshotType};
   return m;
  })}}))};
}
