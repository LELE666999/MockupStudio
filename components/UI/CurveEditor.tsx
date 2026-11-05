import React from 'react';
import type {Keyframe} from '../../types';
import {CURVES,evaluateEasing} from '../../utils/easing';

export function CurveEditor({frames,ids,onChange,onClose}:{frames:Keyframe[];ids:Set<string>;onChange:(easing:Keyframe['easing'],bezier?:Keyframe['bezier'])=>void;onClose:()=>void}) {
  const selected=frames.filter(f=>ids.has(f.id));
  const first=selected[0];
  const easing=first?.easing ?? 'ease-in';
  const points=first?.bezier ?? [0.42,0,1,1];
  const mixed=selected.some(f=>(f.easing ?? 'ease-in')!==easing || (easing==='custom' && JSON.stringify(f.bezier)!==JSON.stringify(first?.bezier)));
  const path=Array.from({length:61},(_,i)=>`${i?'L':'M'} ${i/60*220+10} ${150-evaluateEasing(i/60,easing,points)*140}`).join(' ');
  return <aside aria-label="曲线编辑器" className="fixed right-4 bottom-56 z-[100] w-[280px] rounded-2xl border border-blue-400/40 bg-[#151922] p-4 text-white shadow-2xl">
    <div className="flex items-center justify-between mb-2"><h3 className="font-semibold text-sm">运动曲线 · {selected.length} 个片段</h3><button aria-label="关闭曲线编辑器" onClick={onClose} className="px-2 py-1 text-gray-300">×</button></div>
    <p className="text-xs text-gray-400 mb-3">应用到所选关键帧 → 下一帧。不会改变关键帧时间。</p>
    {mixed && <p className="text-xs text-amber-300 mb-2">当前曲线不同，选择后统一应用。</p>}
    <svg viewBox="0 0 240 170" role="img" aria-label="横轴为时间，纵轴为运动进度" className="w-full rounded-lg bg-black/30 mb-3">
      <path d="M10 10V150H230 M10 80H230 M120 10V150" stroke="#334155" fill="none"/>
      <path d={path} stroke="#60a5fa" strokeWidth="3" fill="none"/>
      <text x="170" y="165" fontSize="9" fill="#94a3b8">时间 →</text>
    </svg>
    <div className="grid grid-cols-2 gap-2">{Object.entries(CURVES).map(([key,label])=><button key={key} aria-pressed={!mixed && easing===key} onClick={()=>onChange(key as Keyframe['easing'],key==='custom'?points:undefined)} className={`rounded-lg px-2 py-2 text-xs border ${!mixed && easing===key?'bg-blue-600 border-blue-400':'bg-white/5 border-white/10 hover:bg-white/10'}`}>{label}</button>)}</div>
    {easing==='custom' && <div className="mt-3 space-y-2">{['控制点 1 · X','控制点 1 · Y','控制点 2 · X','控制点 2 · Y'].map((label,i)=><label key={label} className="flex items-center gap-2 text-[10px] text-gray-300">{label}<input aria-label={label} type="range" min="0" max="1" step=".01" value={points[i]} className="w-20 accent-blue-500" onChange={e=>{const next=[...points] as Keyframe['bezier'];next![i]=Number(e.target.value);onChange('custom',next);}}/><span>{points[i].toFixed(2)}</span></label>)}</div>}
    <p className="text-[10px] mt-3 text-gray-400">默认缓入：起步慢、逐渐加速，到下一帧不减速。</p>
  </aside>;
}
