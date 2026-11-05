import * as T from 'three';
import type {AppState} from '../types';
import {studioId,studioPalettes} from './studioScenes.ts';

export const CHROME_HDR='/environments/brown_photostudio_01_2k.hdr';
export const HDR_DEFAULTS={rotation:-1.92,blur:.12,intensity:1};
export const studioEnvironment=(stage:AppState['stage'])=>({...HDR_DEFAULTS,...stage?.studioEnvironment});
export const showsStudioHDR=(state:AppState)=>studioId(state.stage)==='chrome'&&!state.bgImage&&state.bgColor===studioPalettes.chrome[0];

/** The lighting stays unclipped HDR. Only the visible distant panorama is
 * display-referred, because the existing lens compositor renders without
 * tone mapping. This avoids clipping window detail or colouring the screen.
 * Decode and map once, not during orbit or during each exported frame. */
export function environmentBackdrop(source:T.DataTexture){
 const image=source.image as {data:Uint16Array|Float32Array;width:number;height:number},pixels=new Float32Array(image.width*image.height*4);
 for(let i=0;i<pixels.length;i+=4){
  for(let c=0;c<3;c++){
   const v=(source.type===T.HalfFloatType?T.DataUtils.fromHalfFloat(image.data[i+c]):image.data[i+c])*.72;
   pixels[i+c]=Math.max(0,Math.min(1,(v*(2.51*v+.03))/(v*(2.43*v+.59)+.14)));
  }
  pixels[i+3]=1;
 }
 const texture=new T.DataTexture(pixels,image.width,image.height,T.RGBAFormat,T.FloatType);
 texture.mapping=T.EquirectangularReflectionMapping;texture.colorSpace=T.LinearSRGBColorSpace;texture.flipY=source.flipY;
 texture.minFilter=texture.magFilter=T.LinearFilter;texture.needsUpdate=true;texture.name='chrome-photostudio-background';
 return texture;
}
