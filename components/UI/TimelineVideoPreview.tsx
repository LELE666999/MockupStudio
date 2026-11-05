import React,{useState} from 'react';
import type {AppState} from '../../types';
import {useTimelineVideo} from '../Scene/useTimelineVideo';
export function TimelineVideoPreview({src,state}:{src:string;state:AppState}) {
  const [video,setVideo]=useState<HTMLVideoElement|null>(null);
  useTimelineVideo(video,state);
  return <video key={src} ref={setVideo} src={src} aria-label="视频时间轴预览" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" preload="auto" muted playsInline/>;
}
