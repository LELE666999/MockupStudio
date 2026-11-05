import type {Keyframe} from '../types';

export const CURVES = {
  'linear':'匀速', 'ease-in':'缓入', 'ease-out':'缓出', 'ease-in-out':'缓入缓出', 'custom':'自定义'
} as const;

export function evaluateEasing(t:number, easing:Keyframe['easing']='ease-in', bezier:Keyframe['bezier']=[0.42,0,1,1]) {
  t=Math.min(1,Math.max(0,t));
  if(t===0 || t===1) return t;
  if(easing==='linear') return t;
  if(easing==='ease-in') return t*t;
  if(easing==='ease-out') return 1-(1-t)*(1-t);
  if(easing==='ease-in-out') return t*t*(3-2*t);
  const [x1,y1,x2,y2]=bezier;
  const curve=(s:number,a:number,b:number)=>3*(1-s)**2*s*a+3*(1-s)*s*s*b+s**3;
  let lo=0,hi=1;
  for(let i=0;i<32;i++) {
    const s=(lo+hi)/2;
    if(curve(s,x1,x2)<t) lo=s; else hi=s;
  }
  return curve((lo+hi)/2,y1,y2);
}

/** An outgoing segment belongs to its starting keyframe; the final frame has none. */
export function updateSegmentCurves(frames:Keyframe[], ids:ReadonlySet<string>, easing:Keyframe['easing'], bezier?:Keyframe['bezier']) {
  const last=[...frames].sort((a,b)=>a.time-b.time).at(-1)?.id;
  return frames.map(f=>ids.has(f.id) && f.id!==last ? {...f,easing,bezier:bezier ? [...bezier] as Keyframe['bezier'] : undefined} : f);
}
