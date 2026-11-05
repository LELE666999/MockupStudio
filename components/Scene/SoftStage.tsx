import {useEffect,useMemo,useRef} from 'react';
import {useFrame,useLoader,useThree} from '@react-three/fiber';
import * as T from 'three';
import type {AppState,StageObject} from '../../types';
import {stageGeometry} from '../../utils/stageGeometry';
import {furGeometry} from '../../utils/stageFur';
import {knitGeometry} from '../../utils/stageKnit';
import {wovenFabricGeometry} from '../../utils/stageWeave';
import {yarnFuzzGeometry} from '../../utils/stageYarnFuzz';
import {attachSoftDeformation,localModelBounds,pileHeight,softContact,softUniforms,updateSoftContacts} from '../../utils/stageSoftness';
import {stageSurfaceParameters,stageSurfaceLibrary} from '../../utils/stageSurface';
import {stageMetalStudio} from '../../utils/stageMetal';

interface Props{object:StageObject;state:AppState;studio:ReturnType<typeof stageMetalStudio>;library:ReturnType<typeof stageSurfaceLibrary>;events:Record<string,(event:any)=>void>}
export function SoftStage({object,state,studio,library,events}:Props){
 const {scene,gl}=useThree(),last=useRef(''),cache=useRef(new Map<string,{root:T.Object3D;source:string|null;key:string;box:T.Box3}>());
 const isFur=object.material==='fur',hasFibers=isFur||object.material==='velvet'||object.material==='knit';
 const uniforms=useMemo(()=>softUniforms(object),[object.material,...object.size,object.pileLength,object.reliefDepth,object.knitPattern,object.textureScale]);
 const geometry=useMemo(()=>{
  const height=pileHeight(object);
  const geo=stageGeometry({...object,shape:object.shape==='drape'?'drape':'cushion',size:[object.size[0],object.size[1]-height,object.size[2]]});
  geo.translate(0,-height/2,0);return geo;
 },[object.shape,object.material,...object.size,object.pileLength,object.textureScale,object.reliefDepth,object.knitPattern]);
 const yarn=useMemo(()=>object.material==='knit'?knitGeometry(object):object.material==='fabric'?wovenFabricGeometry(object):null,[object.material,object.shape,...object.size,object.knitPattern,object.reliefDepth,object.textureScale]);
 const fibers=useMemo(()=>object.material==='knit'&&yarn?yarnFuzzGeometry(yarn):hasFibers?furGeometry(object):null,[hasFibers,object.material,...object.size,object.pileLength,object.fiberDensity,object.reliefDepth,yarn]);
 const linen=useLoader(T.TextureLoader,['normal','roughness'].map(key=>`/materials/rough_linen/${key}.jpg`));
 useMemo(()=>linen.forEach(texture=>{texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.colorSpace=T.NoColorSpace;texture.anisotropy=Math.min(8,gl.capabilities.getMaxAnisotropy());texture.needsUpdate=true;}),[linen,gl]);
 const materials=useMemo(()=>{
  const maps=library.get(isFur?'fur':object.material==='velvet'||object.material==='knit'?'velvet':'fabric');
  const base=new T.MeshPhysicalMaterial({...stageSurfaceParameters(object),map:maps.color,normalMap:object.material==='fabric'?linen[0]:maps.normal,normalScale:new T.Vector2(object.material==='fabric'?.65:.2,object.material==='fabric'?.65:.2),roughnessMap:object.material==='fabric'?linen[1]:maps.roughness,envMap:studio.environment,envMapIntensity:.6*state.ambientIntensity});
  base.name='stage-'+object.material+'-surface';attachSoftDeformation(base,uniforms);
  const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});attachSoftDeformation(depth,uniforms);
  const fur=hasFibers?new T.MeshPhysicalMaterial({...stageSurfaceParameters(object),vertexColors:true,side:T.DoubleSide,envMap:studio.environment,envMapIntensity:.4*state.ambientIntensity,sheen:1,sheenRoughness:.85,specularIntensity:.16}):null;
  if(fur){fur.name=isFur?'stage-fur-fibers':object.material==='knit'?'stage-wool-flyaways':'stage-velvet-fibers';attachSoftDeformation(fur,uniforms,true);}
  const thread=new T.MeshPhysicalMaterial({...stageSurfaceParameters(object),vertexColors:true,map:maps.color,normalMap:maps.normal,normalScale:new T.Vector2(.12,.12),roughnessMap:maps.roughness,envMap:studio.environment,envMapIntensity:.45*state.ambientIntensity,sheen:.85,sheenRoughness:.9,specularIntensity:.22});
  thread.name=object.material==='knit'?'stage-knit-yarn':'stage-fabric-yarn';attachSoftDeformation(thread,uniforms,false,true);
  const yarnDepth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});attachSoftDeformation(yarnDepth,uniforms,false,true);
  return {base,depth,fur,thread,yarnDepth};
 },[object.color,object.material,object.roughness,library,studio,linen,uniforms,state.ambientIntensity,isFur,hasFibers]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 useEffect(()=>()=>fibers?.dispose(),[fibers]);
 useEffect(()=>()=>yarn?.dispose(),[yarn]);
 useEffect(()=>()=>{materials.base.dispose();materials.depth.dispose();materials.fur?.dispose();materials.thread.dispose();materials.yarnDepth.dispose();},[materials]);
 useEffect(()=>{last.current='';},[state.models,object.softness,...object.position,...object.rotation,uniforms]);
 useFrame(()=>{
  const key=state.models.map(m=>[m.id,m.visible,m.mode,m.simpleStyle,m.foldAngle,m.width,m.height,m.depth,...m.position,...m.rotation,m.scale].join(',')).join('|');
  if(last.current===key)return;
  const roots=new Map<string,T.Object3D>();scene.traverse(o=>{if(o.userData.mockupModelId)roots.set(o.userData.mockupModelId,o);});
  const contacts=[];let retry=false;
  for(const model of state.models){
   if(!model.visible)continue;
   const root=roots.get(model.id);if(!root){retry=true;continue;}
   const boundsKey=[model.mode,model.simpleStyle,model.foldAngle,model.width,model.height,model.depth,model.radius,model.bezelWidth].join(',');
   let entry=cache.current.get(model.id);
   if(!entry||entry.root!==root||entry.source!==model.fbxFile||entry.key!==boundsKey||entry.box.isEmpty()){
    entry={root,source:model.fbxFile,key:boundsKey,box:localModelBounds(root)};cache.current.set(model.id,entry);
   }
   if(entry.box.isEmpty()){retry=true;continue;}
   root.updateWorldMatrix(true,false);const contact=softContact(entry.box,root.matrixWorld,object);if(contact)contacts.push(contact);
  }
  // Moving a camera does not invalidate this signature. Export/keyframe
  // changes do, so the same pressure shader is used in preview and movies.
  last.current=retry?'':key;
  if(updateSoftContacts(uniforms,contacts))for(const depth of [materials.depth,materials.yarnDepth])depth.userData.stageContactRevision=(depth.userData.stageContactRevision||0)+1;
  for(const id of cache.current.keys())if(!state.models.some(m=>m.id===id))cache.current.delete(id);
 },-.25);
 return <>
  <mesh {...events} geometry={geometry} material={materials.base} customDepthMaterial={materials.depth} castShadow receiveShadow/>
  {yarn&&<mesh geometry={yarn} material={materials.thread} customDepthMaterial={materials.yarnDepth} userData={{stageYarn:true}} castShadow receiveShadow raycast={()=>{}}/>}
  {fibers&&materials.fur&&<mesh geometry={fibers} material={materials.fur} receiveShadow raycast={()=>{}}/>}
 </>;
}
