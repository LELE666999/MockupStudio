import type {AppState} from '../types';

type ViewState=Pick<AppState,'cameraPosition'|'cameraTarget'>;
const degrees=180/Math.PI;
export function cameraView(state:ViewState){
 const offset=state.cameraPosition.map((v,i)=>v-state.cameraTarget[i]);
 const distance=Math.hypot(...offset);
 if(distance<1e-8)return {yaw:0,pitch:0,distance:8};
 return {yaw:Math.atan2(offset[0],offset[2])*degrees,pitch:Math.asin(Math.max(-1,Math.min(1,offset[1]/distance)))*degrees,distance};
}

// Pan the whole camera rig, not the phone or pedestal. Moving the target by
// the same delta preserves the viewing direction and the current distance.
export function panCamera(state:ViewState,axis:0|1,value:number):Partial<ViewState>{
 if(!Number.isFinite(value))return {};
 const cameraPosition=[...state.cameraPosition] as AppState['cameraPosition'];
 const cameraTarget=[...state.cameraTarget] as AppState['cameraTarget'];
 cameraTarget[axis]+=value-cameraPosition[axis];cameraPosition[axis]=value;
 return {cameraPosition,cameraTarget};
}

export function orbitCamera(state:ViewState,changes:Partial<ReturnType<typeof cameraView>>):Partial<ViewState>{
 if(Object.values(changes).some(value=>!Number.isFinite(value)))return {};
 const view={...cameraView(state),...changes};
 const yaw=view.yaw/degrees,pitch=Math.max(-85,Math.min(85,view.pitch))/degrees;
 const distance=Math.max(2,Math.min(1000,view.distance)),horizontal=distance*Math.cos(pitch);
 return {cameraPosition:[
  state.cameraTarget[0]+horizontal*Math.sin(yaw),
  state.cameraTarget[1]+distance*Math.sin(pitch),
  state.cameraTarget[2]+horizontal*Math.cos(yaw)
 ]};
}
