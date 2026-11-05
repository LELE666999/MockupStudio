import {useEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as T from 'three';
import type {AppState,StageObject} from '../../types';
import {RainCollisionField,rainSurfaces,rainSurfaceKey,rainImpactPool,rainSettings,rainTime} from '../../utils/rainWeather';
import {rainAir,rainSurfaceWater,rainUniforms} from '../../utils/rainRendering';
import {rainPuddles,rainPuddleHits} from '../../utils/rainPuddles';

export function RainWeather({state,object}:{state:AppState;object:StageObject}){
 const {scene}=useThree(),group=useRef<T.Group>(null),uniforms=useMemo(()=>rainUniforms(),[]),settings=rainSettings(object),userData=useMemo(()=>({weatherEffect:true}),[]);
 const clock=useRef({time:NaN,idle:0,mode:'',preview:settings.preview});
 const cache=useRef<{brickKey:string;key:string;base:RainCollisionField;air:ReturnType<typeof rainAir>;water:ReturnType<typeof rainSurfaceWater>}|null>(null);
 useEffect(()=>()=>{cache.current?.air.dispose();cache.current?.water.dispose();cache.current=null;},[]);
 useFrame((_,delta)=>{
  if(!group.current)return;
  const mode=state.isExporting?'export':state.isPlaying?'play':'idle',c=clock.current;
  if(c.time!==state.currentTime||c.mode!==mode||c.preview!==settings.preview){c.time=state.currentTime;c.mode=mode;c.preview=settings.preview;c.idle=0;}else if(mode==='idle')c.idle+=Math.min(delta,.1);
  const time=rainTime(state,c.idle,settings.preview);
  uniforms.rainTime.value=time;uniforms.rainIntensity.value=settings.intensity;uniforms.rainWind.value=settings.wind;uniforms.rainSize.value=settings.dropSize;
  scene.updateMatrixWorld(true);
  const surfaces=rainSurfaces(scene),bricks=surfaces.filter(s=>!s.phone);if(!bricks.length)return;
  const brickKey=rainSurfaceKey(bricks),key=rainSurfaceKey(surfaces)+'|'+settings.wetness;
  if(cache.current?.key!==key){
   const start=performance.now();
   const bounds=new T.Box3();bricks.forEach(({mesh})=>{mesh.geometry.computeBoundingBox();bounds.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld));});
   const base=cache.current?.brickKey===brickKey?cache.current.base:new RainCollisionField(bricks,bounds,256);
   const field=new RainCollisionField(surfaces.filter(s=>s.phone),bounds,base.size,base),puddles=rainPuddles(field,settings.wetness),hits=rainPuddleHits(field,puddles,rainImpactPool(field,640,puddles.lookup));
   cache.current?.air.dispose();cache.current?.water.dispose();
   const air=rainAir(hits,uniforms),water=rainSurfaceWater(field,hits,uniforms,settings.wetness,puddles);group.current.add(air.group);
   cache.current={brickKey,key,base,air,water};
   group.current.userData.collisions={revision:(group.current.userData.collisions?.revision??0)+1,buildMs:performance.now()-start,phoneImpacts:hits.filter(h=>h.phone).length,brickImpacts:hits.filter(h=>!h.phone).length,puddleImpacts:hits.filter(h=>h.puddle!==undefined).length,puddles:puddles.patches.length,surfaces:field.roots.length};
  }
  cache.current.water.update(time);group.current.userData.time=time;
 },-.1);
 return <group ref={group} name="brick-rain-weather" userData={userData}/>;
}
