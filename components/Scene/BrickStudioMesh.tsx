import {useEffect,useMemo} from 'react';
import {useLoader,useThree} from '@react-three/fiber';
import * as T from 'three';
import type {StageObject} from '../../types';
import {BRICK_MATERIAL,brickCourtyardGeometry} from '../../utils/brickStudio';
import {BrickMoss} from './BrickMoss';
import {rainSettings} from '../../utils/rainWeather';
import {BRICK_WATER_GLSL} from '../../utils/brickWetness';

export function BrickStudioMesh({object,events}:{object:StageObject;events:Record<string,(event:any)=>void>}){
 const {gl}=useThree();
 const source=useLoader(T.TextureLoader,['color','normal','roughness','ao'].map(channel=>`${BRICK_MATERIAL}/${channel}.jpg`));
 const height=useLoader(T.FileLoader,`${BRICK_MATERIAL}/height.bin`,loader=>loader.setResponseType('arraybuffer')) as ArrayBuffer;
 const maps=useMemo(()=>source.map((texture,i)=>{
  const map=texture.clone();map.wrapS=map.wrapT=T.RepeatWrapping;map.generateMipmaps=true;
  map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;map.anisotropy=Math.min(8,gl.capabilities.getMaxAnisotropy());
  map.colorSpace=i===0?T.SRGBColorSpace:T.NoColorSpace;map.needsUpdate=true;return map;
 }),[source,gl]);
 const geometry=useMemo(()=>brickCourtyardGeometry(object,new Uint8Array(height)),[height,...object.size,object.reliefDepth,object.textureScale,object.detailStrength,object.bevelRadius,object.brickRows,object.brickColumns]);
 const rain=rainSettings(object),wet=rain.enabled?rain.wetness:0;
 const material=useMemo(()=>{
  const stone=object.material==='stone'||!object.material;
  const material=new T.MeshPhysicalMaterial({color:object.color,vertexColors:true,map:maps[0],normalMap:maps[1],normalScale:new T.Vector2((object.detailStrength??.8)*.85,(object.detailStrength??.8)*.85),roughness:object.roughness,roughnessMap:maps[2],aoMap:maps[3],aoMapIntensity:stone?.72:.3,metalness:object.material==='metal'?.9:0,clearcoat:object.material==='glass'?.4:0,clearcoatRoughness:.32,transmission:object.material==='glass'?.8:0,thickness:object.size[1],specularIntensity:stone?.2:1,envMapIntensity:stone?.3:1});
  // Keep the photographed aggregate, but remove the source's beige cast.
  // Neutral albedo lets the user-selected brick colour remain authoritative.
  material.onBeforeCompile=shader=>{
   shader.uniforms.brickWet={value:wet};shader.uniforms.brickMoss={value:object.moss??0};
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float brickEdge,brickWater;varying float vBrickEdge,vBrickWater;varying vec3 vBrickPoint;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBrickEdge=brickEdge;vBrickWater=brickWater;vBrickPoint=position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
    uniform float brickWet,brickMoss;varying float vBrickEdge,vBrickWater;varying vec3 vBrickPoint;
    ${BRICK_WATER_GLSL}
    float brickNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);vec4 h=fract(sin(vec4(dot(i,vec2(127.1,311.7)),dot(i+vec2(1.,0.),vec2(127.1,311.7)),dot(i+vec2(0.,1.),vec2(127.1,311.7)),dot(i+1.,vec2(127.1,311.7))))*43758.5453);return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);}
   `).replace('#include <map_fragment>',T.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;',`sampledDiffuseColor.rgb = vec3(dot(sampledDiffuseColor.rgb, vec3(.2126,.7152,.0722)));
    diffuseColor *= sampledDiffuseColor;
    float mossPatch=smoothstep(.35,.76,brickNoise(vBrickPoint.xz*1.3))*vBrickEdge*min(1.,brickMoss*2.5);
    float mossFiber=brickNoise(vBrickPoint.xz*95.);
    diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.025,.045,.012),vec3(.11,.14,.041),mossFiber),mossPatch*.8);
    diffuseColor.rgb*=1.-brickWet*.09-brickWaterCoverage(vBrickWater,brickWet)*.24;
   `)).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    float localBrickWet=brickWaterCoverage(vBrickWater,brickWet);
    roughnessFactor=max(roughnessFactor,roughness*mix(.88,.77,localBrickWet));
   `);
  };
  material.customProgramCacheKey=()=> 'charcoal-brick-weather-v4-porous-stone';
  material.userData.shadowStatic=true;
  material.name='studio-charcoal-bricks';return material;
 },[maps,object.color,object.roughness,object.detailStrength,object.material,object.size[1],wet,object.moss]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 useEffect(()=>()=>material.dispose(),[material]);
 useEffect(()=>()=>maps.forEach(t=>t.dispose()),[maps]);
 return <group><mesh name="charcoal-brick-course" {...events} geometry={geometry} material={material} castShadow receiveShadow/>{(object.moss??0)>0&&<BrickMoss object={object} geometry={geometry}/>}</group>;
}
