
import type { AppState, Keyframe, ModelConfig, TextConfig } from '../types';
import {evaluateEasing} from './easing.ts';
import {animatedLens} from './focus.ts';
import {isAppleDuo} from './appleDuoFold.ts';

const lerp = (start: number, end: number, t: number) => {
  return start * (1 - t) + end * t;
};

const lerpArray = (start: number[], end: number[], t: number): number[] => {
  return start.map((val, i) => lerp(val, end[i], t));
};

const lerpColor = (start: string, end: string, t: number): string => {
   const startInt = parseInt(start.replace('#', ''), 16);
   const endInt = parseInt(end.replace('#', ''), 16);

   const rStart = (startInt >> 16) & 255;
   const gStart = (startInt >> 8) & 255;
   const bStart = startInt & 255;

   const rEnd = (endInt >> 16) & 255;
   const gEnd = (endInt >> 8) & 255;
   const bEnd = endInt & 255;

   const r = Math.round(lerp(rStart, rEnd, t));
   const g = Math.round(lerp(gStart, gEnd, t));
   const b = Math.round(lerp(bStart, bEnd, t));

   return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

const interpolateModel = (start: ModelConfig, end: ModelConfig, t: number, duration: number): ModelConfig => {
    const result = { ...start };

    const numericProps: (keyof ModelConfig)[] = [
        'scale', 'width', 'height', 'depth', 'radius', 'bezelWidth',
        'roughness', 'metalness',
        'screenRoughness', 'screenEmissive', 'textureRotation', 'foldAngle'
    ];
    const arrayProps: (keyof ModelConfig)[] = ['position', 'rotation'];
    const colorProps: (keyof ModelConfig)[] = ['edgeColor', 'bodyColor'];

    numericProps.forEach(p => {
        if (typeof start[p] === 'number' && typeof end[p] === 'number') {
            (result as any)[p] = lerp(start[p] as number, end[p] as number, t);
        }
    });

    arrayProps.forEach(p => {
        if (Array.isArray(start[p]) && Array.isArray(end[p])) {
            (result as any)[p] = lerpArray(start[p] as number[], end[p] as number[], t);
        }
    });

    colorProps.forEach(p => {
        if (typeof start[p] === 'string' && typeof end[p] === 'string') {
            (result as any)[p] = lerpColor(start[p] as string, end[p] as string, t);
        }
    });

    // Colour keyframes must switch on the finish override as well as changing
    // its numeric RGB values. Otherwise an Apple frame keeps its baked colour.
    result.bodyColorOverride=!!(start.bodyColorOverride||end.bodyColorOverride);
    if(isAppleDuo(start.sourceFile||start.fbxFile)&&(start.foldAngle!==undefined||end.foldAngle!==undefined))result.foldAngle=lerp(start.foldAngle??0,end.foldAngle??0,t);

    // 状态切换（布尔值）：在插值过半时切换
    if (t > 0.5) {
        result.textureFlipX = end.textureFlipX;
        result.textureFlipY = end.textureFlipY;
        result.textureStretch = end.textureStretch;
    } else {
        result.textureFlipX = start.textureFlipX;
        result.textureFlipY = start.textureFlipY;
        result.textureStretch = start.textureStretch;
    }

    // 图片平滑过渡逻辑
    if (start.screenshot !== end.screenshot) {
        result.screenshotPrev = start.screenshot;
        result.screenshotPrevType = start.screenshotType;
        result.screenshot = end.screenshot;
        result.screenshotType = end.screenshotType;

        // 计算过渡进度
        const transitionDuration = end.imageTransitionDuration || 0.5;

        if (duration > 0) {
            const transitionWidth = transitionDuration / duration;
            const tStart = Math.max(0, 0.5 - transitionWidth / 2);
            const tEnd = Math.min(1, 0.5 + transitionWidth / 2);

            if (t < tStart) result.screenshotMix = 0;
            else if (t > tEnd) result.screenshotMix = 1;
            else {
                // 在过渡区间内线性插值
                result.screenshotMix = (t - tStart) / (tEnd - tStart);
            }
        } else {
            result.screenshotMix = t > 0.5 ? 1 : 0;
        }
    } else {
        result.screenshot = start.screenshot;
        result.screenshotType = start.screenshotType;
        result.screenshotPrev = null;
        result.screenshotPrevType = undefined;
        result.screenshotMix = 1.0;
    }

    result.fbxFile = start.fbxFile;
    result.selectedScreenMesh = start.selectedScreenMesh;
    result.subMeshes = start.subMeshes;

    return result;
};

const interpolateText = (start: TextConfig, end: TextConfig, t: number): TextConfig => {
    const result = { ...start };
    const numericProps: (keyof TextConfig)[] = ['scale', 'fontSize', 'opacity', 'blur', 'glow'];
    const arrayProps: (keyof TextConfig)[] = ['position', 'rotation'];
    const colorProps: (keyof TextConfig)[] = ['color'];

    numericProps.forEach(p => {
        if (typeof start[p] === 'number' && typeof end[p] === 'number') {
            (result as any)[p] = lerp(start[p] as number, end[p] as number, t);
        }
    });

    arrayProps.forEach(p => {
         if (Array.isArray(start[p]) && Array.isArray(end[p])) {
            (result as any)[p] = lerpArray(start[p] as number[], end[p] as number[], t);
        }
    });

    colorProps.forEach(p => {
         if (typeof start[p] === 'string' && typeof end[p] === 'string') {
            (result as any)[p] = lerpColor(start[p] as string, end[p] as string, t);
        }
    });

    return result;
};

export const getInterpolatedState = (currentTime: number, keyframes: Keyframe[], currentState: AppState): Partial<AppState> => {
  if (keyframes.length === 0) return {};

  const sortedFrames = [...keyframes].sort((a, b) => a.time - b.time);

  // 辅助函数：将插值后的模型补全实时状态（主要是不需要动画的硬连结）
  const applyLiveOverrides = (models: ModelConfig[]) => {
      return models.map(kfModel => {
          const liveModel = currentState.models.find(m => m.id === kfModel.id);
          if (!liveModel) return kfModel;
          return {
              ...kfModel,
              bodyColorLocked: liveModel.bodyColorLocked,
              initialTransform: liveModel.initialTransform,
              ...(liveModel.bodyColorLocked ? {bodyColor:liveModel.bodyColor,bodyColorOverride:liveModel.bodyColorOverride} : {}),
              // 移除了 screenshot、textureRotation 等，使关键帧可以保存并恢复它们
              fbxFile: liveModel.fbxFile,
              sourceFile: liveModel.sourceFile,
              modelFormat: liveModel.modelFormat,
              mode: liveModel.mode,
              simpleStyle: liveModel.simpleStyle,
              ...(kfModel.foldAngle===undefined?{foldAngle:liveModel.foldAngle}:{}),
              selectedScreenMesh: liveModel.selectedScreenMesh,
              subMeshes: liveModel.subMeshes
          };
      });
  };

  const finish=(value:Partial<AppState>):Partial<AppState>=>({...value,
    renderStyle:currentState.renderStyle,
    stage:currentState.stage,
    lens:animatedLens(currentTime,keyframes,currentState),lensAnimated:true,
    motionMode:currentState.motionMode,
    projectionMode:currentState.projectionMode,
    bgColorLocked:currentState.bgColorLocked,
    bgImage:currentState.bgImage,bgMediaType:currentState.bgMediaType,bgBlur:currentState.bgBlur,
    ...(currentState.bgColorLocked?{bgColor:currentState.bgColor}:{}),
  });

  if (currentTime <= sortedFrames[0].time) {
      const state = { ...sortedFrames[0].state };
      if (state.models) state.models = applyLiveOverrides(state.models);
      return finish(state);
  }

  if (currentTime >= sortedFrames[sortedFrames.length - 1].time) {
      const state = { ...sortedFrames[sortedFrames.length - 1].state };
      if (state.models) state.models = applyLiveOverrides(state.models);
      return finish(state);
  }

  let prevFrame = sortedFrames[0];
  let segmentIndex=0;
  let nextFrame = sortedFrames[sortedFrames.length - 1];

  for (let i = 0; i < sortedFrames.length - 1; i++) {
    if (currentTime >= sortedFrames[i].time && currentTime < sortedFrames[i+1].time) {
        prevFrame = sortedFrames[i];
        segmentIndex=i;
        nextFrame = sortedFrames[i+1];
        break;
    }
  }

  const duration = nextFrame.time - prevFrame.time;
  if (duration === 0) return prevFrame.state;

  const t = (currentTime - prevFrame.time) / duration;
  const continuous=currentState.motionMode==='continuous';
  const easeT = continuous?t:evaluateEasing(t, prevFrame.easing, prevFrame.bezier);

  // Time-aware Hermite tangents are shared on both sides of each key.
  // Zero-length holds and missing tracks remain stationary at their boundaries.
  const smooth=(read:(s:Partial<AppState>)=>number[]|undefined,positive=false)=>{
    const a=read(prevFrame.state),b=read(nextFrame.state);
    if(!a || !b)return undefined;
    const tangent=(index:number)=>{
      const before=sortedFrames[index-1],key=sortedFrames[index],after=sortedFrames[index+1];
      const zero=a.map(()=>0);
      if(!before || !after)return zero;
      const p=read(before.state),q=read(key.state),r=read(after.state);
      const l=key.time-before.time,h=after.time-key.time;
      if(!p || !q || !r || l<=0 || h<=0)return zero;
      if(q.every((v,i)=>v===p[i]) || q.every((v,i)=>v===r[i]))return zero;
      return q.map((v,i)=>{
        const incoming=(v-p[i])/l,outgoing=(r[i]-v)/h;
        if(positive)return incoming*outgoing<=0?0:(l+h)/((2*h+l)/(3*incoming)+(h+2*l)/(3*outgoing));
        return (incoming*h+outgoing*l)/(l+h);
      });
    };
    const m=tangent(segmentIndex),n=tangent(segmentIndex+1);
    return a.map((v,i)=>(2*t*t*t-3*t*t+1)*v+(t*t*t-2*t*t+t)*duration*m[i]+(-2*t*t*t+3*t*t)*b[i]+(t*t*t-t*t)*duration*n[i]);
  };

  const result: any = {};

  if (prevFrame.state.cameraPosition && nextFrame.state.cameraPosition) {
      result.cameraPosition = lerpArray(prevFrame.state.cameraPosition, nextFrame.state.cameraPosition, easeT);
  }
  if (prevFrame.state.cameraTarget && nextFrame.state.cameraTarget) {
      result.cameraTarget = lerpArray(prevFrame.state.cameraTarget, nextFrame.state.cameraTarget, easeT);
  }

  if (prevFrame.state.models && nextFrame.state.models) {
      const interpolated = prevFrame.state.models.map(startModel => {
          const endModel = nextFrame.state.models?.find(m => m.id === startModel.id);
          return endModel ? interpolateModel(startModel, endModel, easeT, duration) : {...startModel};
      });
      result.models = applyLiveOverrides(interpolated);
  }

  if (prevFrame.state.texts && nextFrame.state.texts) {
      result.texts = prevFrame.state.texts.map(startText => {
          const endText = nextFrame.state.texts?.find(t => t.id === startText.id);
          return endText ? interpolateText(startText, endText, easeT) : {...startText};
      });
  }

  if (prevFrame.state.bgColor && nextFrame.state.bgColor) {
      result.bgColor = lerpColor(prevFrame.state.bgColor, nextFrame.state.bgColor, easeT);
  }

  if(continuous) {
    for(const key of ['cameraPosition','cameraTarget'] as const) {
      const value=smooth(s=>s[key]);if(value)result[key]=value;
    }
    for(const collection of ['models','texts'] as const) {
      for(const item of result[collection] || []) {
        for(const key of ['position','rotation'] as const) {
          const value=smooth(s=>s[collection]?.find(m=>m.id===item.id)?.[key]);
          if(value)item[key]=value;
        }
        const scale=smooth(s=>{const value=s[collection]?.find(m=>m.id===item.id)?.scale;return typeof value==='number'?[value]:undefined;},true);
        if(scale)item.scale=scale[0];
        if(collection==='models'&&((item as ModelConfig).simpleStyle==='fold'||isAppleDuo((item as ModelConfig).sourceFile||(item as ModelConfig).fbxFile))){
          const angle=smooth(s=>{const m=s.models?.find(m=>m.id===item.id),live=currentState.models.find(m=>m.id===item.id);return m?[m.foldAngle??live?.foldAngle??(isAppleDuo(live?.sourceFile||m.sourceFile||m.fbxFile)?0:180)]:undefined;});
          if(angle)(item as ModelConfig).foldAngle=Math.max(0,Math.min(180,angle[0]));
        }
      }
    }
  }

  return finish(result);
};
