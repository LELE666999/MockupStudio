import * as T from 'three';
import {ImprovedNoise} from 'three/examples/jsm/math/ImprovedNoise.js';
import type {StageObject} from '../types';
export type SurfaceKind='travertine'|'slate'|'terrazzo'|'fabric'|'velvet'|'fur';
const noise=new ImprovedNoise(),hash=(x:number,y:number)=>((Math.imul(x+17,73856093)^Math.imul(y+53,19349663))>>>0)/4294967295;
const n=(x:number,y:number,frequency=1)=>noise.noise(Math.cos(x*Math.PI*2)*frequency,Math.sin(x*Math.PI*2)*frequency,Math.cos(y*Math.PI*2)*frequency+Math.sin(y*Math.PI*2)*frequency);

/** Neutral albedo preserves the user's colour. Real geometry supplies the
 * silhouette; these mipmapped PBR maps supply pores, aggregate and threads. */
export function surfacePixels(kind:SurfaceKind,size=512){
 const height=new Float32Array(size*size),color=new Uint8Array(size*size*4),roughness=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,index=y*size+x,rand=hash(x,y),grain=n(u,v,15),broad=n(u,v,3);
  let h=.5,albedo=.9,rough=.9;
  if(kind==='travertine'){
   const vein=n(u,v,5)*.11+Math.sin((v+n(u,v,2)*.04)*Math.PI*32)*.02;
   const pore=Math.pow(Math.max(0,n(u,v,35)*1.6+.08),3);
   h=.6+vein*.4-pore*.6;albedo=.86+vein-pore*.28+grain*.025;rough=.75+pore*.25;
  }else if(kind==='slate'){
   const ridge=Math.sin((v+n(u,v,4)*.04)*Math.PI*46);
   h=.45+ridge*.035+grain*.06;albedo=.73+broad*.1+grain*.05+ridge*.018;rough=.76+grain*.1;
  }else if(kind==='terrazzo'){
   let nearest=10,chip=0;const cell=24,xx=u*cell,yy=v*cell;
   for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){
    const cx=Math.floor(xx)+i,cy=Math.floor(yy)+j,dist=Math.hypot(xx-cx-hash(cx,cy),yy-cy-hash(cy,cx));
    if(dist<nearest){nearest=dist;chip=hash(cx*3,cy*7);}
   }
   const aggregate=nearest<.17+chip*.18;
   h=.5+(aggregate?.008:grain*.018);albedo=aggregate?.49+chip*.38:.94+grain*.025;rough=aggregate?.55:.83;
  }else{
   const threadX=Math.sin(u*Math.PI*128),threadY=Math.sin(v*Math.PI*128),over=((Math.floor(u*64)+Math.floor(v*64))%2)*2-1;
   h=.5+(kind==='fabric'?.16:.035)*((over>0?threadX:threadY)*.8+grain*.2);
   albedo=(kind==='fabric'?.91:.82)+(kind==='fabric'?.05:.09)*grain+(rand-.5)*.04;rough=kind==='fabric'?.88:.94;
  }
  height[index]=h;const c=Math.round(T.MathUtils.clamp(albedo,0,1)*255),r=Math.round(T.MathUtils.clamp(rough,0,1)*255),offset=index*4;
  color.set([c,c,c,255],offset);roughness.set([r,r,r,255],offset);
 }
 const strength=kind==='fabric'?3:kind==='velvet'||kind==='fur'?1.2:4;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const dx=(height[y*size+(x+1)%size]-height[y*size+(x+size-1)%size])*strength,dz=(height[((y+1)%size)*size+x]-height[((y+size-1)%size)*size+x])*strength;
  const length=Math.hypot(dx,dz,1);normal.set([Math.round((-.5*dx/length+.5)*255),Math.round((-.5*dz/length+.5)*255),Math.round((.5/length+.5)*255),255],(y*size+x)*4);
 }
 return {color,normal,roughness,size};
}
export function stageSurfaceLibrary(renderer:T.WebGLRenderer){
 const cache=new Map<SurfaceKind,{color:T.DataTexture;normal:T.DataTexture;roughness:T.DataTexture}>();
 return {get(kind:SurfaceKind){
  if(cache.has(kind))return cache.get(kind)!;
  const pixels=surfacePixels(kind),maps={} as {color:T.DataTexture;normal:T.DataTexture;roughness:T.DataTexture};
  for(const key of ['color','normal','roughness'] as const){
   const texture=new T.DataTexture(pixels[key],pixels.size,pixels.size,T.RGBAFormat);
   texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.generateMipmaps=true;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;
   texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());texture.colorSpace=key==='color'?T.SRGBColorSpace:T.NoColorSpace;texture.needsUpdate=true;maps[key]=texture;
  }cache.set(kind,maps);return maps;
 },dispose(){cache.forEach(m=>Object.values(m).forEach(t=>t.dispose()));cache.clear();}};
}
export function stageSurfaceParameters(o:StageObject):T.MeshPhysicalMaterialParameters{
 const soft=['fabric','velvet','fur','knit'].includes(o.material||'');
 return {color:o.color,roughness:o.roughness,metalness:0,clearcoat:o.material==='glass'?.6:0,
  specularIntensity:soft?.32:.55,sheen:soft?(o.material==='fabric'?.45:.85):0,sheenColor:soft?new T.Color(o.color).lerp(new T.Color('#ffffff'),.35):'#000000',sheenRoughness:.8,
  transmission:o.material==='glass'?.96:0,thickness:o.material==='glass'?o.size[1]:0,ior:1.5,attenuationColor:o.color,attenuationDistance:o.material==='glass'?12:0};
}
