import * as T from 'three';
import type {RainUniforms} from './rainRendering.ts';
import {rainRandom,type RainHit} from './rainWeather.ts';

const MAX_WATER_DROPS=48;
/** Persistent irregular water surfaces carry the waves in their normals.
 * There are no per-drop planes, glowing rings or glossy brick bevels. */
export function rainPuddleMaterial(uniforms:RainUniforms,hits:RainHit[],root:T.Object3D,owner:number){
 const byPuddle=new Map<number,number[]>();hits.forEach((hit,i)=>{if(hit.owner===owner&&hit.puddle!==undefined){const list=byPuddle.get(hit.puddle)??[];list.push(i);byPuddle.set(hit.puddle,list);}});
 const selected:number[]=[];
 for(let round=0;selected.length<MAX_WATER_DROPS;round++){
  const before=selected.length;for(const list of byPuddle.values())if(list[round]!==undefined&&selected.length<MAX_WATER_DROPS)selected.push(list[round]);if(before===selected.length)break;
 }
 const inverse=root.matrixWorld.clone().invert(),drops=Array.from({length:MAX_WATER_DROPS},()=>new T.Vector4()),info=Array.from({length:MAX_WATER_DROPS},()=>new T.Vector3(-1,1,0));
 selected.forEach((index,i)=>{const hit=hits[index],local=hit.point.clone().applyMatrix4(inverse);drops[i].set(local.x,local.z,rainRandom(index+17)*8,8+rainRandom(index+18)*6);info[i].set(hit.puddle!, (index+.5)/hits.length,0);});
 const material=new T.MeshPhysicalMaterial({color:'#000000',transparent:true,opacity:1,depthWrite:false,side:T.DoubleSide,roughness:.11,metalness:0,clearcoat:0,ior:1.333,envMapIntensity:.8});
 material.name='rain-retained-puddle-water';material.userData={realPuddles:true,waveCount:selected.length};
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms,{waterDrops:{value:drops},waterDropInfo:{value:info},waterDropCount:{value:selected.length}});
  shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
   attribute float waterDepth,puddleId;
   varying float vWaterDepth,vPuddleId;varying vec2 vWaterPoint;
   varying vec3 vWaterTangent,vWaterBitangent;
  `).replace('#include <begin_vertex>',`#include <begin_vertex>
   vWaterPoint=position.xz;vWaterDepth=waterDepth;vPuddleId=puddleId;
   vWaterTangent=normalize(normalMatrix*vec3(1.,0.,0.));vWaterBitangent=normalize(normalMatrix*vec3(0.,0.,1.));
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   uniform float rainTime,rainIntensity,rainSize;
   uniform vec4 waterDrops[${MAX_WATER_DROPS}];uniform vec3 waterDropInfo[${MAX_WATER_DROPS}];uniform int waterDropCount;
   varying float vWaterDepth,vPuddleId;varying vec2 vWaterPoint;
   varying vec3 vWaterTangent,vWaterBitangent;
  `).replace('#include <color_fragment>',`#include <color_fragment>
   diffuseColor.a*=smoothstep(.001,.023,vWaterDepth);
  `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   vec2 waterGradient=vec2(0.);
   for(int i=0;i<${MAX_WATER_DROPS};i++){
    if(i>=waterDropCount)break;
    if(abs(waterDropInfo[i].x-vPuddleId)>.1||waterDropInfo[i].y>rainIntensity)continue;
    float flight=7./waterDrops[i].w;float age=mod(rainTime+waterDrops[i].z-flight,flight+.85);
    if(age>1.1)continue;
    vec2 delta=vWaterPoint-waterDrops[i].xy;float distanceToDrop=length(delta);float front=.025+age*.58*rainSize;
    float wake=distanceToDrop-front;
    float slope=sin(wake*83.)*exp(-pow(wake/.065,2.))*.036+sin((distanceToDrop-front*.62)*95.)*exp(-pow((distanceToDrop-front*.62)/.045,2.))*.012;
    waterGradient+=delta/max(distanceToDrop,.001)*slope*exp(-age*2.1)*(1.-smoothstep(.65,1.1,age))*rainSize;
   }
   vec3 waterTangent=normalize(vWaterTangent-normal*dot(normal,vWaterTangent));
   vec3 waterBitangent=normalize(vWaterBitangent-normal*dot(normal,vWaterBitangent));
   normal=normalize(normal-waterTangent*waterGradient.x-waterBitangent*waterGradient.y);
  `).replace('#include <opaque_fragment>',`
   // The PBR specular term already contains Fresnel. Alpha-composite it
   // over the visible stone without adding a flat blue diffuse "paint".
   float waterFresnel=.0204+.9796*pow(1.-abs(dot(normal,normalize(vViewPosition))),5.);
   float waterCoverage=clamp(.12+waterFresnel,.12,.82);
   outgoingLight/=waterCoverage;
   diffuseColor.a=waterCoverage*smoothstep(.001,.023,vWaterDepth);
   #include <opaque_fragment>
  `);
 };
 material.customProgramCacheKey=()=> 'rain-retained-puddle-waves-v1';return material;
}
