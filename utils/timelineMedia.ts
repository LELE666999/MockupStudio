type Playback={currentTime:number;isPlaying:boolean;isExporting:boolean};
const controllers=new Set<ReturnType<typeof makeController>>();
function makeController(video:HTMLVideoElement) {
  let state:Playback={currentTime:0,isPlaying:false,isExporting:false};
  let disposed=false;
  video.autoplay=false;video.loop=false;video.muted=true;video.playsInline=true;video.preload='auto';video.playbackRate=1;
  const target=()=>Number.isFinite(video.duration)?Math.min(Math.max(0,state.currentTime),Math.max(0,video.duration-.001)):0;
  const sync=()=>{
    if(disposed)return;
    const playing=state.isPlaying&&!state.isExporting&&state.currentTime<video.duration;
    if(!playing)video.pause();
    if(video.readyState<1 || video.seeking)return;
    const desired=target();
    if(Math.abs(video.currentTime-desired)>(playing?.15:.001)){video.currentTime=desired;return;}
    if(playing && video.paused && video.readyState>=2)video.play().catch(()=>{});
  };
  for(const event of ['loadedmetadata','loadeddata','seeked','canplay'])video.addEventListener(event,sync);
  const controller={
    update(value:Playback){state=value;sync();},
    async seekForCapture(time:number) {
      state={currentTime:time,isPlaying:false,isExporting:true};sync();
      await new Promise<void>((resolve,reject)=>{
        const cleanup=()=>{clearTimeout(timer);for(const event of events)video.removeEventListener(event,check);};
        const check=()=>{
          if(disposed){cleanup();resolve();return;}
          if(video.error){cleanup();reject(new Error('视频无法解码，请检查视频格式'));return;}
          sync();
          if(video.readyState>=2&&!video.seeking&&Math.abs(video.currentTime-target())<.002){cleanup();resolve();}
        };
        const events=['loadeddata','seeked','canplay','error'];
        const timer=setTimeout(()=>{cleanup();reject(new Error('等待视频定位超时，请检查视频是否能正常播放'));},15000);
        for(const event of events)video.addEventListener(event,check);check();
      });
    },
    dispose(){disposed=true;video.pause();for(const event of ['loadedmetadata','loadeddata','seeked','canplay'])video.removeEventListener(event,sync);controllers.delete(controller);},
  };
  controllers.add(controller);return controller;
}
export const bindTimelineVideo=makeController;
export async function waitForTimelineVideos(time:number){await Promise.all([...controllers].map(c=>c.seekForCapture(time)));}
