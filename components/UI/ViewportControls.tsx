import {useEffect,useState} from 'react';
import {Camera,Move,Rotate3d,Maximize,RefreshCcw} from 'lucide-react';
import type {AppState} from '../../types';
import {cameraView,panCamera,orbitCamera} from '../../utils/cameraView';
import {TransformHUD,MiniSlider,GroupSection} from './TransformHUD';
import {SegmentedControl} from './SegmentedControl';

interface Props{state:AppState;updateState:(updates:Partial<AppState>)=>void;saveHistory:()=>void}
function CameraHUD({state,updateState,saveHistory}:Props){
 const view=cameraView(state);
 const locked=state.isPlaying||state.isExporting||state.isSelectingScreen||state.isSelectingFocus;
 const pan=(axis:0|1,value:number)=>updateState(panCamera(state,axis,value));
 const orbit=(changes:Partial<typeof view>)=>updateState(orbitCamera(state,changes));
 return <div className="transform-hud camera-view-hud pointer-events-auto" aria-label="相机视角控制">
  <div className="bg-black/80 backdrop-blur-xl rounded-2xl border border-white/10 p-3">
   <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/10 px-1">
    <Camera size={14} className="text-blue-400 shrink-0"/><span className="text-sm font-bold text-gray-200">相机视角</span>
   </div>
   <fieldset disabled={locked}>
    <GroupSection title="相机平移" icon={Move}>
     {([0,1] as const).map(axis=>{
      const value=state.cameraPosition[axis],limit=Math.max(20,Math.ceil(Math.abs(value)/10)*10);
      return <MiniSlider key={axis} label={['X','Y'][axis]} ariaLabel={`相机平移 ${['X','Y'][axis]}`} value={value} min={-limit} max={limit} step={.1} colorClass={axis===0?'bg-red-500':'bg-green-500'} onEditStart={saveHistory} onChange={n=>pan(axis,n)}/>;
     })}
    </GroupSection>
    <GroupSection title="环绕 / 俯仰（°）" icon={Rotate3d}>
     <MiniSlider label="环绕" ariaLabel="视角环绕" value={view.yaw} min={-180} max={180} step={.1} onEditStart={saveHistory} onChange={yaw=>orbit({yaw})}/>
     <MiniSlider label="俯仰" ariaLabel="视角俯仰" value={view.pitch} min={-85} max={85} step={.1} onEditStart={saveHistory} onChange={pitch=>orbit({pitch})}/>
    </GroupSection>
    <GroupSection title="视角距离" icon={Maximize}>
     <MiniSlider label="距离" ariaLabel="视角距离" value={view.distance} min={2} max={Math.max(60,Math.ceil(view.distance/10)*10)} step={.1} onEditStart={saveHistory} onChange={distance=>orbit({distance})}/>
    </GroupSection>
    <button type="button" className="camera-view-reset" onClick={()=>{saveHistory();window.dispatchEvent(new Event('mockup-frame-stage'));}}><RefreshCcw size={12}/>重置视角</button>
   </fieldset>
   <p className="camera-view-note">{locked?'暂停播放后可调整视角':'仅调整相机 · 不改变物体位置'}</p>
  </div>
 </div>;
}

export function ViewportControls(props:Props){
 const scene=!!props.state.stage?.enabled;
 const [mode,setMode]=useState<'camera'|'object'>('camera');
 useEffect(()=>{setMode('camera');},[scene]);
 if(!scene)return <TransformHUD {...props}/>;
 const selected=props.state.activeModelId||props.state.activeTextId||props.state.activeStageId;
 return <section className="viewport-controls" aria-label="预览参数">
  <div className="viewport-controls-tabs"><SegmentedControl<'camera'|'object'> label="预览控制" value={mode} options={[{value:'camera',label:'视角'},{value:'object',label:'物体'}]} onChange={setMode}/></div>
  {mode==='camera'?<CameraHUD {...props}/>:selected?<TransformHUD {...props}/>:<p className="camera-view-empty">点击手机、文字或展台<br/>调整选中物体的位置和旋转</p>}
 </section>;
}
