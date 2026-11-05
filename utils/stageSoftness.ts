import * as T from 'three';
import type {StageObject} from '../types';
import {yarnHeight} from './stageKnit.ts';
import {weaveHeight} from './stageWeave.ts';
export const MAX_SOFT_CONTACTS=8;
export const isSoftStage=(o:StageObject)=>['fabric','velvet','fur','knit'].includes(o.material||'');
export const pileHeight=(o:StageObject)=>o.material==='fur'?Math.min(o.pileLength??.24,o.size[1]*.45):o.material==='knit'?yarnHeight(o):o.material==='fabric'?weaveHeight(o):o.material==='velvet'?Math.min(.06,o.size[1]*.16,.012+(o.reliefDepth??.06)*.7):0;
export const supportHeight=(o:StageObject)=>o.size[1]/2-(isSoftStage(o)?(o.softness??.75)*(['fur','knit'].includes(o.material||'')?pileHeight(o)*.68:Math.min(.07,o.size[1]*.12)):0);
export interface SoftContact {center:[number,number];halfSize:[number,number];angle:number;bottom:number;strength:number}

/** Cached local boxes, not a vertex walk every time the camera rotates. Child
 * geometry replacements and folded-part transforms invalidate the cache. */
export function localModelBounds(root:T.Object3D){
 root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),box=new T.Box3(),matrix=new T.Matrix4();
 root.traverseVisible(o=>{
  const mesh=o as T.Mesh;if(!mesh.isMesh||!mesh.geometry)return;
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  if(!materials.some(m=>m?.visible&&(!m.transparent||m.opacity>0)))return;
  if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
  matrix.multiplyMatrices(inverse,mesh.matrixWorld);box.union(mesh.geometry.boundingBox!.clone().applyMatrix4(matrix));
 });return box;
}

/** Clip the phone volume to the contact slab before projecting its footprint.
 * A standing phone presses a narrow bottom edge, not its entire height. */
export function softContact(bounds:T.Box3,phoneMatrix:T.Matrix4,support:StageObject):SoftContact|null{
 if(bounds.isEmpty()||!isSoftStage(support)||(support.softness??.75)===0)return null;
 const matrix=new T.Matrix4().compose(new T.Vector3(...support.position),new T.Quaternion().setFromEuler(new T.Euler(...support.rotation)),new T.Vector3(1,1,1)).invert().multiply(phoneMatrix),points:T.Vector3[]=[];
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])points.push(new T.Vector3(x,y,z).applyMatrix4(matrix));
 const bottom=Math.min(...points.map(p=>p.y)),top=support.size[1]/2,ceiling=top+.045;
 if(bottom>ceiling||Math.max(...points.map(p=>p.y))<top-Math.max(.5,support.size[1]*.4))return null;
 const clipped=points.filter(p=>p.y<=ceiling);
 for(let i=0;i<8;i++)for(const bit of [1,2,4]){
  const j=i^bit;if(j<=i)continue;const a=points[i],b=points[j];
  if((a.y-ceiling)*(b.y-ceiling)<0)clipped.push(a.clone().lerp(b,(ceiling-a.y)/(b.y-a.y)));
 }
 if(!clipped.length)return null;
 const basis=[new T.Vector3().setFromMatrixColumn(matrix,0),new T.Vector3().setFromMatrixColumn(matrix,1),new T.Vector3().setFromMatrixColumn(matrix,2)].sort((a,b)=>b.x*b.x+b.z*b.z-a.x*a.x-a.z*a.z)[0];
 const angle=Math.atan2(basis.z,basis.x),c=Math.cos(angle),s=Math.sin(angle);
 const xx=clipped.map(p=>p.x*c+p.z*s),zz=clipped.map(p=>-p.x*s+p.z*c);
 const minX=Math.min(...xx),maxX=Math.max(...xx),minZ=Math.min(...zz),maxZ=Math.max(...zz),x=(minX+maxX)/2,z=(minZ+maxZ)/2;
 const center:[number,number]=[x*c-z*s,x*s+z*c],halfSize:[number,number]=[Math.max(.025,(maxX-minX)/2),Math.max(.025,(maxZ-minZ)/2)];
 if(Math.abs(center[0])>support.size[0]/2+Math.hypot(...halfSize)||Math.abs(center[1])>support.size[2]/2+Math.hypot(...halfSize))return null;
 return {center,halfSize,angle,bottom,strength:(support.softness??.75)*(1-T.MathUtils.smoothstep(bottom-top,0,.045))};
}
export function pressureAt(contact:SoftContact,x:number,z:number){
 const dx=x-contact.center[0],dz=z-contact.center[1],c=Math.cos(contact.angle),s=Math.sin(contact.angle);
 const radius=Math.min(.14,...contact.halfSize),qx=Math.abs(dx*c+dz*s)-contact.halfSize[0]+radius,qz=Math.abs(-dx*s+dz*c)-contact.halfSize[1]+radius;
 const distance=Math.hypot(Math.max(qx,0),Math.max(qz,0))+Math.min(Math.max(qx,qz),0)-radius;
 return (1-T.MathUtils.smoothstep(distance,-.015,.18))*contact.strength;
}

export function softUniforms(o:StageObject){
 return {touchA:{value:Array.from({length:MAX_SOFT_CONTACTS},()=>new T.Vector4())},touchB:{value:Array.from({length:MAX_SOFT_CONTACTS},()=>new T.Vector4())},touchCount:{value:0},softTop:{value:o.size[1]/2-pileHeight(o)},softDepth:{value:Math.min(.13,o.size[1]*.22)},softHeight:{value:o.size[1]},furTone:{value:o.material==='velvet'?1:0}};
}
export function updateSoftContacts(uniforms:ReturnType<typeof softUniforms>,contacts:SoftContact[]){
 const chosen=[...contacts].sort((a,b)=>b.strength-a.strength).slice(0,MAX_SOFT_CONTACTS);
 let changed=uniforms.touchCount.value!==chosen.length;
 chosen.forEach((p,i)=>{
  const a=uniforms.touchA.value[i],b=uniforms.touchB.value[i],c=Math.cos(p.angle),s=Math.sin(p.angle);
  if(a.x!==p.center[0]||a.y!==p.center[1]||a.z!==p.halfSize[0]||a.w!==p.halfSize[1]||b.x!==c||b.y!==s||b.z!==p.strength||b.w!==p.bottom)changed=true;
 });
 uniforms.touchCount.value=chosen.length;
 chosen.forEach((p,i)=>{uniforms.touchA.value[i].set(...p.center,...p.halfSize);uniforms.touchB.value[i].set(Math.cos(p.angle),Math.sin(p.angle),p.strength,p.bottom);});
 return changed;
}

const contactGLSL=`
 uniform vec4 touchA[${MAX_SOFT_CONTACTS}],touchB[${MAX_SOFT_CONTACTS}];uniform int touchCount;
 uniform float softTop,softDepth,softHeight;
 vec2 softTouch(vec2 p){
  float pressure=0.;float bottom=softTop+10.;
  for(int i=0;i<${MAX_SOFT_CONTACTS};i++){
   if(i>=touchCount)break;
   vec2 d=p-touchA[i].xy;vec4 b=touchB[i];
   vec2 q=abs(vec2(d.x*b.x+d.y*b.y,-d.x*b.y+d.y*b.x));
   float r=min(.14,min(touchA[i].z,touchA[i].w));q-=touchA[i].zw-vec2(r);
   float distance=length(max(q,0.))+min(max(q.x,q.y),0.)-r;
   float weight=(1.-smoothstep(-.015,.18,distance))*b.z;
   if(weight>pressure){pressure=weight;bottom=b.w;}
  }return vec2(pressure,bottom);
 }
 float softDrop(vec3 p){vec2 contact=softTouch(p.xz);return contact.x*min(softDepth,max(0.,p.y-contact.y+.01))*smoothstep(softTop-softHeight*.8,softTop,p.y);}
`;
/** The same displacement is used by the colour, depth and shadow shaders.
 * Uniform updates move impressions; they do not recompile or rebuild meshes. */
export function attachSoftDeformation(material:T.Material,uniforms:ReturnType<typeof softUniforms>,fur=false,yarn=false){
 material.userData.shadowStatic=true;material.userData.stageSoftDeformation=true;
 material.customProgramCacheKey=()=>`stage-soft-v2-${fur?'fibers':yarn?'yarn':'surface'}`;
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  const furGLSL=fur?`
   attribute vec3 fiberRoot;attribute vec4 fiberStyle;
   vec3 fiberPoint(vec3 p){
    vec2 touch=softTouch(fiberRoot.xz);float pressure=touch.x;
    float angle=fiberStyle.x+p.y*p.y*(fiberStyle.w-.5)*1.1,c=cos(angle),s=sin(angle),height=p.y*fiberStyle.y;
    vec2 horizontal=vec2(p.x*c-p.z*s,p.x*s+p.z*c)*fiberStyle.z*(1.-p.y*.86);
    horizontal+=vec2(c,s)*height*height/fiberStyle.y*(.24+pressure*.6);
    float y=fiberRoot.y+height-softDrop(vec3(fiberRoot.x,softTop,fiberRoot.z));
    // Strong interior contact clamps the pile below the actual phone. The
    // fringe bends progressively rather than disappearing at a hard mask.
    float collision=smoothstep(.02,.35,pressure);
    y=mix(y,min(y,touch.y-.012),collision);
    return vec3(fiberRoot.x+horizontal.x,y,fiberRoot.z+horizontal.y);
   }
  `:'';
  shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>\n${contactGLSL}\n${furGLSL}`);
  const surface='#include <begin_vertex>\ntransformed.y-=softDrop(position);'+(yarn?'\nvec2 contact=softTouch(position.xz);transformed.y=mix(transformed.y,min(transformed.y,contact.y-.008),smoothstep(.04,.5,contact.x));':'');
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',fur?'vec3 transformed=fiberPoint(position);':surface);
  if(fur){
   shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nfloat c=cos(fiberStyle.x),s=sin(fiberStyle.x);objectNormal=vec3(objectNormal.x*c-objectNormal.z*s,objectNormal.y,objectNormal.x*s+objectNormal.z*c);');
  }else{
   shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nfloat epsilon=.025;vec3 grad=vec3((softDrop(position+vec3(epsilon,0.,0.))-softDrop(position-vec3(epsilon,0.,0.)))/(2.*epsilon),0.,(softDrop(position+vec3(0.,0.,epsilon))-softDrop(position-vec3(0.,0.,epsilon)))/(2.*epsilon));objectNormal=normalize(objectNormal+grad*max(0.,objectNormal.y));');
  }
 };
}
