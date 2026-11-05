import {useEffect,useRef} from 'react';
import type {AppState} from '../../types';
import {bindTimelineVideo} from '../../utils/timelineMedia';
export function useTimelineVideo(video:HTMLVideoElement|null|undefined,state:Pick<AppState,'currentTime'|'isPlaying'|'isExporting'>) {
  const controller=useRef<ReturnType<typeof bindTimelineVideo>>();
  const latest=useRef(state);latest.current=state;
  useEffect(()=>{
    if(!video)return;
    const binding=bindTimelineVideo(video);controller.current=binding;binding.update(latest.current);
    return ()=>{binding.dispose();controller.current=undefined;};
  },[video]);
  useEffect(()=>controller.current?.update(state),[video,state.currentTime,state.isPlaying,state.isExporting]);
}
