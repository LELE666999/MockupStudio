const frames=new WeakMap<HTMLCanvasElement,{time:number;exporting:boolean;revision:number}>();
const errors=new WeakMap<HTMLCanvasElement,string>();
export function sceneRenderError(canvas:HTMLCanvasElement,error?:string){if(error)errors.set(canvas,error);else errors.delete(canvas);}
export function renderedScene(canvas:HTMLCanvasElement,time:number,exporting:boolean){frames.set(canvas,{time,exporting,revision:(frames.get(canvas)?.revision||0)+1});}
export function waitForSceneFrame(canvas:HTMLCanvasElement,time:number,signal?:AbortSignal){
  const previous=frames.get(canvas)?.revision||0,start=performance.now();
  return new Promise<void>((resolve,reject)=>{
    const check=()=>{
      if(errors.has(canvas)){reject(new Error(errors.get(canvas)));return;}
      if(signal?.aborted){reject(new Error('导出已取消'));return;}
      const frame=frames.get(canvas);
      if(frame&&frame.revision>previous&&frame.exporting&&Math.abs(frame.time-time)<1e-6){resolve();return;}
      if(performance.now()-start>10000){reject(new Error('等待渲染超时，请检查显卡或降低画质'));return;}
      requestAnimationFrame(check);
    };check();
  });
}
