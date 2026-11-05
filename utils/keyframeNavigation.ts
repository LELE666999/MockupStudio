import type {Keyframe} from '../types';
export function adjacentKeyframe(frames:Keyframe[],time:number,direction:-1|1) {
  const sorted=[...frames].sort((a,b)=>a.time-b.time);
  return direction<0 ? sorted.filter(f=>f.time<time-1e-6).at(-1) : sorted.find(f=>f.time>time+1e-6);
}
