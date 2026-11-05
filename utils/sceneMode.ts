import {getInitialState} from '../types.ts';
import type {AppState} from '../types';
import {makeStage} from './stagePresets.ts';
export function switchSceneMode(state:AppState,enabled:boolean):Partial<AppState>{
 if(!!state.stage?.enabled===enabled)return {};
 const stage={...(state.stage||makeStage('single')),enabled};
 if(enabled)return {stage,activeStageId:null,isPlaying:false,showGizmo:true,phoneViewBeforeScene:{cameraPosition:[...state.cameraPosition],cameraTarget:[...state.cameraTarget],activeModelId:state.activeModelId,showGizmo:state.showGizmo,projectionMode:state.projectionMode},cameraPosition:stage.items?.length?[10,7,17]:[8,5,12],cameraTarget:[0,-1,0]};
 const previous=state.phoneViewBeforeScene,defaults=getInitialState();
 const model=state.models.find(m=>m.id===previous?.activeModelId&&m.visible!==false)||state.models.find(m=>m.id===state.activeModelId&&m.visible!==false)||state.models.find(m=>m.visible!==false)||state.models[0];
 return {stage,phoneViewBeforeScene:undefined,activeStageId:null,activeModelId:model?.id||null,activeTextId:null,isPlaying:false,isSelectingScreen:false,isSelectingFocus:false,cameraPosition:[...defaults.cameraPosition],cameraTarget:[...defaults.cameraTarget],projectionMode:'perspective',showGizmo:previous?.showGizmo??defaults.showGizmo};
}
