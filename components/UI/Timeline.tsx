
import React, { useEffect, useRef, useState } from 'react';
import { AppState, Keyframe, ExportResolution } from '../../types';
import { Play, Pause, Plus, Trash2, Video, Clock, Loader2, ChevronDown, Check, Copy, Scissors, Clipboard, PaintBucket, RefreshCw } from 'lucide-react';
import { getInterpolatedState } from '../../utils/animation';
import {CURVES,updateSegmentCurves} from '../../utils/easing';
import {CurveEditor} from './CurveEditor';
import {createPortal} from 'react-dom';
import {adjacentKeyframe} from '../../utils/keyframeNavigation';
import {waitForTimelineVideos} from '../../utils/timelineMedia';
import {SegmentedControl} from './SegmentedControl';
import {isKeyboardControl} from '../../utils/keyboard';
import {waitForSceneFrame} from '../../utils/renderReady';
import {historySnapshot} from '../../utils/history';
import {exportSizing} from '../../utils/exportSizing';
import {waitForBackground} from '../../utils/backgroundReady';
// @ts-ignore
import * as Mp4Muxer from 'mp4-muxer';

interface TimelineProps {
  state: AppState;
  updateState: (updates: Partial<AppState>) => void;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    keyframeId: string | null;
    time?: number;
}

export const Timeline: React.FC<TimelineProps> = ({ state, updateState, canvasRef }) => {
  const { currentTime, totalDuration, isPlaying, keyframes } = state;
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [draggingKeyframeId, setDraggingKeyframeId] = useState<string | null>(null);
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
  const [selectedIds,setSelectedIds]=useState<Set<string>>(new Set());
  const [curveOpen,setCurveOpen]=useState(false);
  const ordered=[...keyframes].sort((a,b)=>a.time-b.time);
  const segmentIds=new Set(ordered.slice(0,-1).filter(f=>selectedIds.has(f.id)).map(f=>f.id));
  const latest=useRef({state,updateState});latest.current={state,updateState};
  useEffect(()=>{
    let held=false,usedPointer=false;
    const reset=()=>{held=false;usedPointer=false;};
    const down=(e:KeyboardEvent)=>{
      if(e.code!=='Space' || e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || isKeyboardControl(e.target) || latest.current.state.isExporting || latest.current.state.isSelectingScreen || latest.current.state.isSelectingFocus)return;
      e.preventDefault();held=true;usedPointer=false;
    };
    const pointer=()=>{if(held)usedPointer=true;};
    const up=(e:KeyboardEvent)=>{
      if(e.code!=='Space')return;
      const shouldToggle=held&&!usedPointer&&!isKeyboardControl(e.target)&&!e.ctrlKey&&!e.metaKey&&!e.altKey;
      reset();
      const {state,updateState}=latest.current;
      if(shouldToggle&&!state.isExporting&&!state.isSelectingScreen&&!state.isSelectingFocus){e.preventDefault();updateState({isPlaying:!state.isPlaying});}
    };
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('pointerdown',pointer,true);window.addEventListener('blur',reset);
    return ()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('pointerdown',pointer,true);window.removeEventListener('blur',reset);};
  },[]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, keyframeId: null });
  const [clipboardKeyframe, setClipboardKeyframe] = useState<Partial<AppState> | null>(null);

  const muxerRef = useRef<any>(null);
  const videoEncoderRef = useRef<VideoEncoder | null>(null);
  const recordingTimeRef = useRef<number>(0);
  const recordingBaseStateRef = useRef<AppState | null>(null);
  const [exportQuality,setExportQuality]=useState<'1080p'|'4k'>('1080p');
  const exportFrameSize=useRef({width:0,height:0});
  const abortControllerRef = useRef<AbortController | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const nearbyKeyframe = keyframes.find(k => Math.abs(k.time - currentTime) < 0.1);

  // 深度快照当前状态
  const captureFullState = (): Partial<AppState> => {
      return {
          bgImage: state.bgImage,
          bgColor: state.bgColor,
          bgBlur: state.bgBlur,
          lightingMode: state.lightingMode,
          ambientIntensity: state.ambientIntensity,
          spotIntensity: state.spotIntensity,
          lightColor: state.lightColor,
          reflectionIntensity: state.reflectionIntensity,
          shadowConfig: JSON.parse(JSON.stringify(state.shadowConfig)),
          cameraPosition: [...state.cameraPosition] as [number, number, number],
          cameraTarget: [...state.cameraTarget] as [number, number, number],
          lens:state.lens?structuredClone(state.lens):undefined,
          models: JSON.parse(JSON.stringify(state.models)),
          texts: JSON.parse(JSON.stringify(state.texts))
      };
  };

  useEffect(() => {
    if(!isPlaying || isRecording) return;
    const start=performance.now();const from=latest.current.state.currentTime;
    const loop=(now:number)=>{
      const {state,updateState}=latest.current;
      const time=(from+(now-start)/1000)%state.totalDuration;
      updateState({...getInterpolatedState(time,state.keyframes,state),currentTime:time});
      animationRef.current=requestAnimationFrame(loop);
    };
    animationRef.current=requestAnimationFrame(loop);
    return ()=>cancelAnimationFrame(animationRef.current);
  },[isPlaying,isRecording]);

  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{
      if(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement || (e.target as HTMLElement)?.isContentEditable || latest.current.state.isExporting || latest.current.state.isSelectingFocus || e.isComposing) return;
      if(!e.metaKey && !e.ctrlKey && !e.altKey && ['j','k'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        const {state,updateState}=latest.current;
        const frame=adjacentKeyframe(state.keyframes,state.currentTime,e.key.toLowerCase()==='j'?-1:1);
        if(frame){updateState({...getInterpolatedState(frame.time,state.keyframes,state),currentTime:frame.time,isPlaying:false});setSelectedIds(new Set([frame.id]));setSelectedKeyframeId(frame.id);}
        return;
      }
      if((e.key==='Delete' || e.key==='Backspace') && selectedIds.size) {
        e.preventDefault();latest.current.updateState({keyframes:latest.current.state.keyframes.filter(f=>!selectedIds.has(f.id)),isPlaying:false});setSelectedIds(new Set());
      }
    };
    window.addEventListener('keydown',down);return ()=>window.removeEventListener('keydown',down);
  },[selectedIds]);

  const selectFrame=(e:React.MouseEvent,kf:Keyframe)=>{
    if(e.button!==0 || isRecording) return;
    e.stopPropagation();
    if(e.metaKey || e.ctrlKey || e.shiftKey) {
      setSelectedIds(prev=>{const next=new Set(prev);if(next.has(kf.id)) next.delete(kf.id);else next.add(kf.id);return next;});return;
    }
    setSelectedIds(new Set([kf.id]));setSelectedKeyframeId(kf.id);
    updateState({...getInterpolatedState(kf.time,keyframes,state),currentTime:kf.time,isPlaying:false});
    const start=e.clientX;const width=timelineRef.current?.clientWidth || 1;
    const move=(event:MouseEvent)=>{
      if(Math.abs(event.clientX-start)<3) return;
      setDraggingKeyframeId(kf.id);
      const time=Math.max(0,Math.min(totalDuration,kf.time+(event.clientX-start)/width*totalDuration));
      const frames=latest.current.state.keyframes;
      if(frames.some(f=>f.id!==kf.id && Math.abs(f.time-time)<.02)) return;
      latest.current.updateState({keyframes:frames.map(f=>f.id===kf.id?{...f,time}:f),currentTime:time});
    };
    const up=()=>{setDraggingKeyframeId(null);window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up);};
    window.addEventListener('mousemove',move);window.addEventListener('mouseup',up);
  };

  const startExport = async () => {
     if(isRecording)return;
     if (typeof VideoEncoder === 'undefined') {
         alert("您的浏览器不支持 WebCodecs。请使用最新版 Chrome, Edge 或 Safari。");
         return;
     }

     const canvas = document.querySelector('canvas');
     if (!canvas) {
         alert("找不到 3D 画布，请刷新页面重试。");
         return;
     }

     const controller=new AbortController();
     const signal=controller.signal;
     try {
         const rect=canvas.getBoundingClientRect();
         const sizing=exportSizing(rect.width,rect.height,exportQuality);
         recordingBaseStateRef.current = historySnapshot(state);
         abortControllerRef.current = controller;

         updateState({ isPlaying: false, currentTime: 0, isExporting: true, exportDpr:sizing.dpr, isSelectingFocus:false });
         setIsRecording(true);
         setRecordingProgress(0);
         recordingTimeRef.current = 0;

         await new Promise(resolve => setTimeout(resolve, 800));
         if(signal.aborted)return;
         await waitForBackground();
         if(signal.aborted)return;
         await waitForSceneFrame(canvas,0,signal);
         const width=Math.floor(canvas.width/2)*2,height=Math.floor(canvas.height/2)*2;
         if(width<2||height<2||Math.abs(Math.max(width,height)-sizing.longEdge)>3)throw Error('导出画布尺寸未就绪，请重试');
         exportFrameSize.current={width,height};
         const encodingConfig:VideoEncoderConfig={codec:'avc1.640034',width,height,bitrate:exportQuality==='4k'?40_000_000:16_000_000,framerate:60,latencyMode:'quality'};
         if(!(await VideoEncoder.isConfigSupported(encodingConfig)).supported)throw Error('设备不支持此分辨率的编码，请选择 1080P');
         if(signal.aborted)return;

         const muxer = new Mp4Muxer.Muxer({
             target: new Mp4Muxer.ArrayBufferTarget(),
             video: {
                 codec: 'avc',
                 width,
                 height
             },
             fastStart: 'in-memory'
         });
         muxerRef.current = muxer;

         const encoder = new VideoEncoder({
             output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
             error: (e) => {
                 console.error("VideoEncoder Error:", e);
                 // 自动清理并详细报错
                 alert(`导出失败: ${e.message}。请尝试选择 1080P 后重试。`);
                 cleanupExport();
             }
         });
         videoEncoderRef.current = encoder;

         /**
          * 编码参数说明：
          * avc1.640034
          * 64: High Profile (提供更好的画质)
          * 00: 无特殊约束
          * 34: Level 5.2 (十六进制 0x34 = 十进制 52)
          * Level 5.2 支持最高 4K @ 60fps，完全兼容您的 2.2K 分辨率。
          */
         encoder.configure(encodingConfig);

         processNextFrame(encoder, canvas, signal);
     } catch (err: any) {
         if(signal.aborted)return;
         console.error("Export initialization failed:", err);
         alert(`导出初始化失败: ${err.message}`);
         cleanupExport();
     }
  };

  const processNextFrame = async (encoder: VideoEncoder, canvas: HTMLCanvasElement, signal: AbortSignal) => {
      if (signal.aborted) return;

      const frameIndex = Math.round(recordingTimeRef.current * 60);
      const t = frameIndex / 60;
      if (frameIndex >= Math.ceil(totalDuration * 60)) {
          await finishExport();
          return;
      }

      const updates = getInterpolatedState(t, keyframes, recordingBaseStateRef.current || state);
      updateState({ ...updates, currentTime: t, isExporting: true });
      setRecordingProgress(Math.min(100, (t / totalDuration) * 100));

      requestAnimationFrame(() => {
          requestAnimationFrame(async () => {
              if (signal.aborted) return;
              try {
                  await waitForTimelineVideos(t);
                  await waitForSceneFrame(canvas,t,signal);
                  await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
                  if(signal.aborted)return;
                  if(encoder.encodeQueueSize>=3)await encoder.flush();
                  if(signal.aborted)return;
                  const {width,height}=exportFrameSize.current;
                  if(Math.abs(canvas.width-width)>1||Math.abs(canvas.height-height)>1)throw Error('导出时画布尺寸发生变化，请保持窗口大小不变后重试');
                  const frame = new VideoFrame(canvas, { visibleRect:{x:0,y:0,width,height},displayWidth:width,displayHeight:height,timestamp: Math.round(t * 1_000_000), duration: Math.round(1_000_000 / 60) });
                  const isKeyFrame = Math.floor(t * 60) % 120 === 0;
                  try{encoder.encode(frame, { keyFrame: isKeyFrame });}finally{frame.close();}
                  recordingTimeRef.current = (frameIndex + 1) / 60;
                  processNextFrame(encoder, canvas, signal);
              } catch (e: any) {
                  if(signal.aborted)return;
                  console.error("Frame capture failed:", e);
                  alert(`导出中止：${e.message || '视频帧定位失败'}`);
                  cleanupExport();
              }
          });
      });
  };

  const finishExport = async () => {
      if (!videoEncoderRef.current || !muxerRef.current) return;
      const signal=abortControllerRef.current?.signal;
      const encoder=videoEncoderRef.current,muxer=muxerRef.current;
      try {
          await encoder.flush();
          if(signal?.aborted)return;
          muxer.finalize();

          const buffer = muxer.target.buffer;
          const blob = new Blob([buffer], { type: 'video/mp4' });
          const url = URL.createObjectURL(blob);

          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `mockup-render-${Date.now()}.mp4`;
          document.body.appendChild(a);
          a.click();

          setTimeout(() => {
              document.body.removeChild(a);
              window.URL.revokeObjectURL(url);
          }, 500);
      } catch (err: any) {
          if(signal?.aborted)return;
          console.error("Finalization failed:", err);
          alert(`文件合成失败: ${err.message}`);
      } finally {
          if(!signal?.aborted)cleanupExport();
      }
  };

  const cleanupExport = () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      setIsRecording(false);
      updateState({ isPlaying: false, currentTime: 0, isExporting: false,exportDpr:undefined });
      recordingBaseStateRef.current = null;
      if (videoEncoderRef.current && videoEncoderRef.current.state !== 'closed') {
          videoEncoderRef.current.close();
      }
      videoEncoderRef.current=null;muxerRef.current=null;
  };

  const togglePlay = () => !isRecording && updateState({ isPlaying: !isPlaying });

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isRecording) return;
    const time = parseFloat(e.target.value);
    const updates = getInterpolatedState(time, keyframes, state);
    updateState({ currentTime: time, isPlaying: false, ...updates });
  };

  const addKeyframe = () => {
    const newKf: Keyframe = {
        id: Math.random().toString(36).substr(2, 9),
        time: currentTime,
        easing: 'ease-in',
        state: captureFullState()
    };
    updateState({ keyframes: [...keyframes, newKf].sort((a, b) => a.time - b.time) });
    setSelectedKeyframeId(newKf.id);
    setSelectedIds(new Set([newKf.id]));
  };

  const updateKeyframe = () => {
      if (!nearbyKeyframe) return;
      const updated = keyframes.map(k => k.id === nearbyKeyframe.id ? { ...k, state: captureFullState() } : k);
      updateState({ keyframes: updated });
  };

  const handleSyncVisuals = () => {
      if (keyframes.length === 0) return;
      if (!confirm("同步当前外观到所有关键帧？")) return;
      const updatedKeyframes = keyframes.map(kf => ({
          ...kf,
          state: {
              ...kf.state,
              bgImage: state.bgImage,
              bgColor: state.bgColor,
              bgBlur: state.bgBlur,
              lightingMode: state.lightingMode,
              ambientIntensity: state.ambientIntensity,
              spotIntensity: state.spotIntensity,
              lightColor: state.lightColor,
              shadowConfig: JSON.parse(JSON.stringify(state.shadowConfig)),
              reflectionIntensity: state.reflectionIntensity,
              models: (kf.state.models || []).map(kfm => {
                  const live = state.models.find(m => m.id === kfm.id);
                  return live ? { ...live, position: [...kfm.position] as [number, number, number], rotation: [...kfm.rotation] as [number, number, number], scale: kfm.scale } : kfm;
              })
          }
      }));
      updateState({ keyframes: updatedKeyframes });
  };

  const handleContextMenu = (e: React.MouseEvent, keyframeId: string | null = null) => {
      e.preventDefault();
      let clickTime = 0;
      if (timelineRef.current) {
          const rect = timelineRef.current.getBoundingClientRect();
          clickTime = ((e.clientX - rect.left) / rect.width) * totalDuration;
      }
      setContextMenu({ visible: true, x: e.clientX, y: e.clientY, keyframeId, time: clickTime });
  };

  useEffect(() => { const close = () => setContextMenu(p => ({ ...p, visible: false })); window.addEventListener('click', close); return () => window.removeEventListener('click', close); }, []);

  return (
    <div className="editor-timeline h-52 m-4 rounded-3xl z-40 flex flex-col pointer-events-auto bg-black/60 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] ring-1 ring-white/5 relative">
        <div className="flex items-center gap-2 px-4 pt-2 text-xs text-gray-300">
          运动方式
          <SegmentedControl label="运动方式" value={state.motionMode || 'segments'} options={[{value:'segments',label:'逐段曲线'},{value:'continuous',label:'连续平滑'}]} disabled={state.isExporting} onChange={motionMode=>updateState({...getInterpolatedState(currentTime,keyframes,{...state,motionMode}),motionMode,isPlaying:false})}/>
          <span>{state.motionMode==='continuous'?'中间不停顿 · 首尾缓动 · 逐段曲线暂不生效':'各段独立使用曲线'}</span>
        </div>
        {curveOpen && segmentIds.size>0 && createPortal(<CurveEditor frames={ordered.slice(0,-1)} ids={segmentIds} onClose={()=>setCurveOpen(false)} onChange={(easing,bezier)=>updateState({keyframes:updateSegmentCurves(keyframes,segmentIds,easing,bezier),isPlaying:false})}/>,document.body)}
        {contextMenu.visible && createPortal(
            <div className="fixed z-[100] bg-black/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-1 min-w-[120px]" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
                {contextMenu.keyframeId ? (
                    <>
                         <button onClick={() => { const k = keyframes.find(kf => kf.id === contextMenu.keyframeId); if (k) setClipboardKeyframe(k.state); setContextMenu(p=>({...p, visible:false})); }} className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/10 rounded-lg flex items-center gap-2"><Copy size={12}/> 复制</button>
                         <button onClick={() => { updateState({ keyframes: keyframes.filter(k => k.id !== contextMenu.keyframeId) }); setContextMenu(p=>({...p, visible:false})); }} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-900/20 rounded-lg flex items-center gap-2"><Trash2 size={12}/> 删除</button>
                    </>
                ) : (
                    <button onClick={() => { if (clipboardKeyframe && contextMenu.time !== undefined) { updateState({ keyframes: [...keyframes, { id: Math.random().toString(36).substr(2,9), time: contextMenu.time, state: clipboardKeyframe }].sort((a,b)=>a.time-b.time) }); } setContextMenu(p=>({...p, visible:false})); }} disabled={!clipboardKeyframe} className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/10 rounded-lg flex items-center gap-2 disabled:opacity-50"><Clipboard size={12}/> 粘贴</button>
                )}
            </div>
        ,document.body)}

        {isRecording && (
            <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-lg flex flex-col items-center justify-center rounded-3xl overflow-hidden border border-blue-500/30">
                <button onClick={cleanupExport} className="absolute top-3 right-4 z-10 px-4 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-medium shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">取消导出</button>
                <div className="relative flex flex-col items-center">
                    <Loader2 size={54} className="text-blue-500 animate-spin mb-6" />
                    <h3 className="text-2xl font-black text-white mb-2 tracking-tight">正在导出 60FPS 高清视频...</h3>
                    <div className="text-4xl font-mono text-blue-400 mb-6 font-bold">{Math.round(recordingProgress)}%</div>
                    <p className="text-xs text-gray-500 mb-8 max-w-[300px] text-center leading-relaxed">请保持当前页面开启，不要点击其他标签页。系统正在捕捉每一帧的高精画面并合成 MP4 文件。</p>
                    <div className="w-72 h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                        <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: `${recordingProgress}%` }} />
                    </div>
                </div>
            </div>
        )}

        <div className="timeline-toolbar h-14 bg-white/5 flex items-center justify-between px-6 border-b border-white/5 rounded-t-3xl">
            <div className="flex items-center gap-6">
                <button aria-label={isPlaying?'暂停动画':'播放动画'} onClick={togglePlay} className="w-9 h-9 rounded-full flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg active:scale-90">
                    {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                </button>
                <div className="flex items-center gap-4 text-xs font-mono text-gray-400 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                    <div className="flex items-center gap-3 pr-2 border-r border-white/10">
                        <Clock size={12} className="text-blue-500"/>
                        <span className="text-white w-10 text-right">{currentTime.toFixed(2)}s</span>
                        <span className="opacity-30">/</span>
                        <input aria-label="动画总时长" type="number" min={Math.max(.1,...keyframes.map(k=>k.time))} value={totalDuration} onChange={e => {const value=Number(e.target.value);if(Number.isFinite(value)&&value>0) updateState({totalDuration:Math.max(value,...keyframes.map(k=>k.time))});}} className="bg-transparent text-white w-8 text-center focus:outline-none focus:bg-white/5 rounded" />
                        <span>s</span>
                    </div>
                    {/* 时长预设按钮组 */}
                    <div className="flex items-center gap-1.5">
                        {[12, 16, 20].map((t) => (
                            <button
                                key={t}
                                onClick={() => updateState({ totalDuration: Math.max(t,...keyframes.map(k=>k.time)) })}
                                className={`px-2 py-0.5 rounded border transition-all hover:scale-105 active:scale-95 ${totalDuration === t ? 'bg-blue-500/20 border-blue-500 text-blue-200 shadow-[0_0_8px_rgba(59,130,246,0.3)]' : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20'}`}
                            >
                                {t}s
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                 <button onClick={handleSyncVisuals} className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 rounded-xl text-xs transition-all border border-purple-500/20 active:scale-95" title="将当前外观同步到所有关键帧">
                    <PaintBucket size={14} /> <span className="font-medium">同步外观</span>
                 </button>
                 <div className="w-px h-6 bg-white/10 mx-1" />
                 {nearbyKeyframe ? (
                     <button onClick={updateKeyframe} className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 rounded-xl text-xs text-yellow-200 border border-yellow-500/20 active:scale-95"><RefreshCw size={14} /> 更新关键帧</button>
                 ) : (
                     <button onClick={addKeyframe} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-white border border-white/10 active:scale-95"><Plus size={14} /> 添加关键帧</button>
                 )}
                 <div title="保持画面比例：1080P 适配 1920×1080，4K 适配 3840×2160；竖屏尺寸自动对调，预览保持轻量"><SegmentedControl<'1080p'|'4k'> label="视频导出清晰度" value={exportQuality} options={[{value:'1080p',label:'1080P'},{value:'4k',label:'4K'}]} onChange={setExportQuality}/></div>
                 <button onClick={startExport} className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-[0_4px_15px_rgba(220,38,38,0.3)] active:scale-95"><Video size={14} /> 导出视频</button>
            </div>
        </div>

        <div className="flex items-center gap-3 px-6 pt-2 text-[11px] text-gray-300">
          <button onClick={()=>setSelectedIds(new Set(ordered.slice(0,-1).map(f=>f.id)))} className="hover:text-white">全选片段</button>
          <button onClick={()=>{setSelectedIds(new Set());setCurveOpen(false);}} className="hover:text-white">取消选择</button>
          <button disabled={!segmentIds.size} onClick={()=>setCurveOpen(true)} className="rounded bg-blue-600/30 px-2 py-1 text-blue-200 disabled:opacity-30">批量曲线</button>
          <span className="text-gray-500">已选 {segmentIds.size} 段 · Shift / ⌘ / Ctrl + 点击多选</span>
        </div>
        <div className="flex-1 relative px-4 pb-4 select-none overflow-hidden" onContextMenu={(e) => handleContextMenu(e)}>
             <div ref={timelineRef} className="relative mt-5 h-14 bg-black/40 rounded-xl border border-white/5 mx-2">
                 {ordered.slice(0,-1).map((kf,i)=>{
                   const next=ordered[i+1];
                   return <div key={`segment-${kf.id}`} className="absolute top-1/2 h-px bg-blue-400/60 pointer-events-none" style={{left:`${kf.time/totalDuration*100}%`,width:`${(next.time-kf.time)/totalDuration*100}%`}}>
                     <button aria-label={`片段 ${i+1} → ${i+2}：${CURVES[kf.easing ?? 'ease-in']}`} title={`${kf.time.toFixed(2)}s → ${next.time.toFixed(2)}s · 点击编辑曲线`} onClick={e=>{e.stopPropagation();if(e.shiftKey||e.metaKey||e.ctrlKey){setSelectedIds(prev=>{const ids=new Set(prev);if(ids.has(kf.id))ids.delete(kf.id);else ids.add(kf.id);return ids;});}else{setSelectedIds(new Set([kf.id]));}setCurveOpen(true);}} className={`pointer-events-auto absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 rounded px-2 py-1 text-[10px] whitespace-nowrap border ${selectedIds.has(kf.id)?'border-blue-400 bg-blue-950 text-blue-100':'border-gray-600 bg-[#202530] text-gray-300'}`}>{CURVES[kf.easing ?? 'ease-in']} ↗</button>
                   </div>;
                 })}
                 {keyframes.map((kf) => (
                     <div
                        key={kf.id}
                        role="button" aria-label={`关键帧 ${kf.time.toFixed(2)} 秒`} aria-pressed={selectedIds.has(kf.id)}
                        className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rotate-45 border border-black cursor-grab z-40 ${draggingKeyframeId === kf.id || selectedIds.has(kf.id) ? 'bg-white scale-125 shadow-[0_0_10px_white]' : 'bg-yellow-400'}`}
                        style={{ left: `${(kf.time / totalDuration) * 100}%` }}
                        onMouseDown={(e)=>selectFrame(e,kf)}
                        onContextMenu={(e) => handleContextMenu(e, kf.id)}
                     />
                 ))}
                 <input aria-label="播放位置" type="range" min={0} max={totalDuration} step={0.01} value={currentTime} onChange={handleSeek} className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-crosshair" />
                 <div className="absolute top-0 bottom-0 w-px bg-blue-500 pointer-events-none z-0" style={{ left: `${(currentTime / totalDuration) * 100}%` }}><div className="absolute -top-1.5 -translate-x-1/2 w-3 h-3 bg-blue-500 rounded-full shadow-lg border border-white/50"></div></div>
             </div>
             <div className="absolute bottom-1 left-6 text-[9px] text-gray-500 font-mono pointer-events-none">空格 播放/暂停 · 按住空格拖动 平移 · J/K 跳关键帧 · Delete 删除 · 右键复制/粘贴</div>
        </div>
    </div>
  );
};
