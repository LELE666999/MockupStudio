import {useEffect,useMemo} from 'react';
import * as T from 'three';
import {RectAreaLightUniformsLib} from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import type {AppState} from '../../types';
import {studioId,studioLightColors} from '../../utils/studioScenes';
let initialized=false;
export function StageLighting({state}:{state:AppState}){
 const paletteKey=JSON.stringify(state.stage?.studioLighting);
 const lights=useMemo(()=>{
  if(!initialized){RectAreaLightUniformsLib.init();initialized=true;}
  const scale=state.lightingMode==='flat'?0:state.ambientIntensity,id=studioId(state.stage),target=new T.Vector3(0,id==='grooved'||id==='chrome'||id==='bricks'?(state.stage?.position[1]??-3.4):id?0:-1,0);
  const colors=studioLightColors(state.stage),standard=[
   {position:[-8,8,4],width:8,height:10,color:'#fff3df',gain:.35},
   {position:[7,5,0],width:4,height:8,color:'#dce9ff',gain:.2},
   {position:[0,9,-7],width:10,height:4,color:'#ffffff',gain:.3}
  ],designed=id==='bricks'?[
   {position:[-6,8,-4],width:4,height:10,color:'#f3f1eb',gain:4.2},{position:[7,5,3],width:3,height:9,color:'#dce5f3',gain:.75},{position:[-3,3,7],width:7,height:4,color:'#ffffff',gain:.42}
  ]:id==='chrome'?[
   {position:[-5,7,5],width:2,height:12,color:'#eff8ff',gain:1.8},{position:[7,3,-3],width:1,height:12,color:'#87b2e2',gain:1.1},{position:[-5,5,-5],width:7,height:9,color:'#ffe5c2',gain:1.2}
  ]:id==='grooved'?[
   {position:[-5,2,6],width:1.8,height:11,color:colors[0],gain:13},{position:[4,3,-2],width:2,height:12,color:colors[1],gain:12},{position:[-7,2,4],width:9,height:6,color:colors[2],gain:20}
  ]:id==='midnight'?[
   {position:[-6,5,-2],width:3,height:9,color:colors[0],gain:1.8},{position:[5,4,5],width:3,height:7,color:colors[1],gain:.7},{position:[0,7,2],width:6,height:4,color:colors[2],gain:.55}
  ]:[{position:[-7,5,7],width:6,height:11,color:'#f6f8ff',gain:.48},{position:[5,5,2],width:8,height:10,color:id==='silk'?'#b5cdf7':'#e2e8f0',gain:.33},{position:[0,8,-4],width:8,height:6,color:'#ffffff',gain:.42}];
  return (id?designed:standard).map(config=>{
   const color=new T.Color(config.color).multiply(new T.Color(state.lightColor)),light=new T.RectAreaLight(color,config.gain*scale,config.width,config.height);
   light.position.set(...config.position as [number,number,number]);light.lookAt(target);return light;
  });
 },[state.ambientIntensity,state.lightColor,state.lightingMode,state.stage?.preset,state.stage?.enabled,state.stage?.position[1],paletteKey]);
 useEffect(()=>()=>lights.forEach(l=>l.dispose()),[lights]);
 return <group name="stage-softboxes">{lights.map((light,i)=><primitive key={i} object={light}/>)}</group>;
}
