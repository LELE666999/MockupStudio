
import React, {useEffect,useRef,useState} from 'react';
import { AppState, ModelConfig, TextConfig, StageObject } from '../../types';
import {makeStage,patchStage,stageObjects} from '../../utils/stagePresets';
import { Move, Rotate3d, Maximize, Type, Box, RefreshCcw } from 'lucide-react';

interface Props {
  state: AppState;
  updateState: (updates: Partial<AppState>) => void;
  saveHistory?: () => void;
}

interface MiniSliderProps {
    label: string;
    value: number;
    onChange: (val: number) => void;
    min: number;
    max: number;
    step?: number;
    colorClass?: string;
    centered?: boolean;
    ariaLabel?: string;
    onEditStart?: () => void;
}

export const MiniSlider = ({ label, value, onChange, min, max, step = 0.1, colorClass = "bg-blue-500", centered = false, ariaLabel, onEditStart }: MiniSliderProps) => {
    const drag=useRef<{x:number;value:number;width:number}|null>(null);
    const [editing,setEditing]=useState(false);
    const [draft,setDraft]=useState(String(Number(value.toFixed(2))));
    useEffect(()=>{if(!editing)setDraft(String(Number(value.toFixed(2))));},[value,editing]);
    const safeMin = min ?? -10;
    const safeMax = max ?? 10;
    const range = safeMax - safeMin;
    const percent = Math.min(100, Math.max(0, ((value - safeMin) / range) * 100));

    let barLeft = '0%';
    let barWidth = `${percent}%`;

    if (centered) {
        const middle = 50;
        if (percent >= middle) {
            barLeft = '50%';
            barWidth = `${percent - middle}%`;
        } else {
            barLeft = `${percent}%`;
            barWidth = `${middle - percent}%`;
        }
    }

    return (
        <div className="flex items-center gap-3 mb-3 last:mb-0">
            <span className={`text-xs font-bold ${label.length>1?'w-8':'w-4'} shrink-0 ${label === 'X' ? 'text-red-400' : label === 'Y' ? 'text-green-400' : label === 'Z' ? 'text-blue-400' : 'text-gray-400'}`}>{label}</span>
            <div className="flex-1 relative h-7 flex items-center group cursor-ew-resize">
                 <div className="absolute inset-x-0 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      {centered && <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20 -translate-x-1/2" />}
                      <div className={`absolute top-0 bottom-0 opacity-80 ${colorClass} transition-all duration-75 ease-out`} style={{ left: barLeft, width: barWidth }} />
                 </div>
                 <div className="absolute h-4 w-4 bg-white rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.5)] border border-gray-300 pointer-events-none transition-transform group-hover:scale-110 flex items-center justify-center" style={{ left: `calc(${percent}% - 8px)` }}><div className={`w-1.5 h-1.5 rounded-full ${colorClass}`} /></div>
                 {centered?<div role="slider" tabIndex={0} aria-label={`旋转 ${label}`} aria-valuenow={value} aria-valuetext={`${value} 度`} title="拖动增减角度，支持多圈；方向键微调"
                   onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,value,width:Math.max(1,e.currentTarget.getBoundingClientRect().width)};}}
                   onPointerMove={e=>{const start=drag.current;if(start)onChange(start.value+Math.round((e.clientX-start.x)/start.width*range/step)*step);}}
                   onPointerUp={e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
                   onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}
                   onKeyDown={e=>{const delta=({ArrowRight:1,ArrowUp:1,ArrowLeft:-1,ArrowDown:-1,PageUp:10,PageDown:-10} as Record<string,number>)[e.key];if(delta!==undefined){e.preventDefault();e.stopPropagation();onChange(value+delta*step*(e.shiftKey?10:1));}}}
                   className="absolute inset-0 w-full h-full cursor-ew-resize z-10 touch-none rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500" />:
                   <input aria-label={ariaLabel||`${label} 滑块`} type="range" min={safeMin} max={safeMax} step={step} value={value} onPointerDown={onEditStart} onKeyDown={e=>{if(!e.repeat&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(e.key))onEditStart?.();}} onChange={(e) => onChange(parseFloat(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-10" />}
            </div>
            <input aria-label={ariaLabel?`${ariaLabel} 数值`:centered?`旋转 ${label} 角度`:`${label} 数值`} type="number" step={step} value={draft}
              onFocus={()=>{setEditing(true);onEditStart?.();}} onBlur={()=>{setEditing(false);setDraft(String(Number(value.toFixed(2))));}}
              onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}
              onChange={e=>{setDraft(e.target.value);const next=Number(e.target.value);if(e.target.value.trim()&&Number.isFinite(next))onChange(next);}}
              className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white text-right focus:outline-none focus:border-blue-500/50 hover:bg-black/50 transition-colors font-mono shrink-0 tabular-nums" />
        </div>
    )
}

export const GroupSection = ({ title, icon: Icon, children }: any) => (
  <div className="mb-4 last:mb-0 bg-white/5 rounded-xl p-3 border border-white/5">
    <div className="flex items-center gap-2 mb-3 text-gray-400"><Icon size={12} /><span className="text-[10px] font-bold uppercase tracking-wider">{title}</span></div>
    {children}
  </div>
);

export const TransformHUD: React.FC<Props> = ({ state, updateState, saveHistory }) => {
  const activeModel = state.models.find(m => m.id === state.activeModelId);
  const activeText = state.texts.find(t => t.id === state.activeTextId);
  const activeStage = stageObjects(state.stage).find(s=>s.id===state.activeStageId);

  const target = activeModel || activeText || activeStage;
  if (!target) return null;

  const isText = !!activeText;
  const name = isText ? (activeText?.content || 'Text') : (activeModel?.name || activeStage?.name || 'Model');

  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const updateTarget = (changes: Partial<ModelConfig> | Partial<TextConfig> | Partial<StageObject>) => {
      if (activeModel) {
          updateState({ models: state.models.map(m => m.id === activeModel.id ? { ...m, ...changes } : m) });
      } else if (activeText) {
          updateState({ texts: state.texts.map(t => t.id === activeText.id ? { ...t, ...changes } : t) });
      } else if(activeStage&&state.stage){
          updateState({stage:patchStage(state.stage,activeStage.id,changes)});
      }
  };

  const updatePos = (axis: number, val: number) => {
    if (!Number.isFinite(val)) return;
    const newPos = [...target.position] as [number, number, number];
    newPos[axis] = val;
    updateTarget({ position: newPos });
  };

  const updateRot = (axis: number, valDeg: number) => {
    if (!Number.isFinite(valDeg)) return;
    const newRot = [...target.rotation] as [number, number, number];
    newRot[axis] = toRad(valDeg);
    updateTarget({ rotation: newRot });
  };

  const updateScale = (val: number) => {
    if (Number.isFinite(val) && val > 0) updateTarget({ scale: val });
  };

  // 改进的重置函数
  const handleReset = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      saveHistory?.();
      if(activeStage){
          const initial=stageObjects(makeStage(state.stage?.preset||'single')).find(s=>s.id===activeStage.id);
          updateTarget({position:initial?.position||[0,-4,0],rotation:initial?.rotation||[0,0,0]});
          return;
      }
      updateTarget(activeModel?.initialTransform ? structuredClone(activeModel.initialTransform) : {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: 1
      });
  };

  return (
    <div className="transform-hud w-64 animate-fade-in pointer-events-auto" aria-label="模型变换控制">
      <div className="bg-black/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden ring-1 ring-white/5 p-3">
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10 px-1">
           <div className="flex items-center gap-2 overflow-hidden">
               {isText ? <Type size={14} className="text-blue-400 shrink-0"/> : <Box size={14} className="text-blue-400 shrink-0"/>}
               <span className="text-sm font-bold text-gray-200 tracking-wide truncate" title={name}>{name}</span>
           </div>
           <div className="flex gap-1 shrink-0"><div className="w-1.5 h-1.5 rounded-full bg-white/30"></div><div className="w-1.5 h-1.5 rounded-full bg-white/30"></div></div>
        </div>

        <GroupSection title="位置 Position" icon={Move}>
          <MiniSlider label="X" value={target.position[0]} min={-10} max={10} onChange={(v: number) => updatePos(0, v)} colorClass="bg-red-500" />
          <MiniSlider label="Y" value={target.position[1]} min={-10} max={10} onChange={(v: number) => updatePos(1, v)} colorClass="bg-green-500" />
          <MiniSlider label="Z" value={target.position[2]} min={-10} max={10} onChange={(v: number) => updatePos(2, v)} colorClass="bg-blue-500" />
        </GroupSection>

        <GroupSection title="旋转 Rotation (°)" icon={Rotate3d}>
          <MiniSlider centered label="X" value={toDeg(target.rotation[0])} min={-180} max={180} step={1} onChange={(v: number) => updateRot(0, v)} colorClass="bg-red-500" />
          <MiniSlider centered label="Y" value={toDeg(target.rotation[1])} min={-180} max={180} step={1} onChange={(v: number) => updateRot(1, v)} colorClass="bg-green-500" />
          <MiniSlider centered label="Z" value={toDeg(target.rotation[2])} min={-180} max={180} step={1} onChange={(v: number) => updateRot(2, v)} colorClass="bg-blue-500" />
        </GroupSection>

        <GroupSection title={activeStage?"展台尺寸 Size":"缩放 Scale"} icon={Maximize}>
           {activeStage?activeStage.size.map((value,axis)=><MiniSlider key={axis} label={['X','Y','Z'][axis]} ariaLabel={`物体展台尺寸 ${['X','Y','Z'][axis]}`} value={value} min={.1} max={Math.max(20,value)} step={.1} onChange={v=>{if(v<=0||v>100)return;const size=[...activeStage.size] as StageObject['size'];size[axis]=v;updateTarget({size});}}/>):<MiniSlider label="S" value={(target as ModelConfig|TextConfig).scale} min={0.1} max={5} step={0.01} onChange={(v: number) => updateScale(v)} colorClass="bg-white" />}
        </GroupSection>

        <button
            onClick={handleReset}
            className="w-full py-2 bg-white/5 hover:bg-blue-600/20 rounded-lg text-xs text-gray-400 hover:text-white flex items-center justify-center gap-2 mt-2 transition-all border border-transparent hover:border-blue-500/30 active:scale-95"
        >
            <RefreshCcw size={12} /> 恢复默认位置
        </button>
      </div>
    </div>
  );
};
