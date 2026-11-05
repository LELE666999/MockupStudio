import {Suspense,useEffect,useMemo,useRef} from 'react';
import {useFrame,useThree,useLoader} from '@react-three/fiber';
import * as THREE from 'three';
import type {AppState,StageObject} from '../../types';
import {patchStage,stageObjects} from '../../utils/stagePresets';
import {suppressSceneClick} from '../../utils/sceneInteraction';
import {stageGeometry} from '../../utils/stageGeometry';
import {stageMetalParameters,stageMetalStudio} from '../../utils/stageMetal';
import {stageSurfaceLibrary,stageSurfaceParameters,type SurfaceKind} from '../../utils/stageSurface';
import {isSoftStage,supportHeight} from '../../utils/stageSoftness';
import {SoftStage} from './SoftStage';
import {StageLighting} from './StageLighting';
import {StudioReflection} from './StudioReflection';
import {StudioContactShadow} from './StudioContactShadow';
import {GroovedStudioMesh} from './GroovedStudioMesh';
import {ChromeRackMesh} from './ChromeStudioMesh';
import {BrickStudioMesh} from './BrickStudioMesh';
import {studioId,composeStudio,studioCamera,groovedCamera,type StudioId,type GroovedView} from '../../utils/studioScenes';
import {boundsInFrame,placePhone,stageCamera,stageFloor,stageMatrix,type PhonePose} from '../../utils/stagePlacement';
function StoneMesh({object,geometry,events,studio,library,intensity}:{object:StageObject;geometry:THREE.BufferGeometry;events:Record<string,(event:any)=>void>;studio:ReturnType<typeof stageMetalStudio>;library:ReturnType<typeof stageSurfaceLibrary>;intensity:number}){
 const {gl}=useThree(),asset=object.surface==='mineral'?'rock_01':'concrete_floor_01';
 const maps=useLoader(THREE.TextureLoader,['color','normal','roughness'].map(map=>`/materials/${asset}/${map}.jpg`));
 useMemo(()=>{maps.forEach((texture,i)=>{
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=Math.min(8,gl.capabilities.getMaxAnisotropy());
  texture.colorSpace=i===0?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.needsUpdate=true;
 });},[maps,gl]);
 const strength=object.detailStrength??.3;
 const generated=['travertine','slate','terrazzo'].includes(object.surface||'')?library.get(object.surface as SurfaceKind):null;
 return <mesh {...events} geometry={geometry} castShadow receiveShadow><meshPhysicalMaterial {...stageSurfaceParameters(object)} key={asset+'-'+object.surface} map={generated?.color||maps[0]} normalMap={generated?.normal||maps[1]} normalScale={new THREE.Vector2(strength,strength)} roughnessMap={generated?.roughness||maps[2]} envMap={studio.environment} envMapIntensity={intensity*.55}/></mesh>;
}
function MetalMesh({object,geometry,events,studio,intensity,color}:{object:StageObject;geometry:THREE.BufferGeometry;events:Record<string,(event:any)=>void>;studio:ReturnType<typeof stageMetalStudio>;intensity:number;color:string}){
 const materials=useMemo(()=>{
  const parts:('frame'|'wire')[]=object.shape==='lattice'?['frame','wire']:['frame'];
  return parts.map(part=>{
   const material=new THREE.MeshPhysicalMaterial({...stageMetalParameters(object,part),envMap:studio.environment,envMapIntensity:intensity,roughnessMap:studio.roughness});
   material.color.multiply(new THREE.Color(color));material.name=`stage-metal-${part}`;return material;
  });
 },[object.color,object.roughness,object.shape,studio,intensity,color]);
 useEffect(()=>()=>materials.forEach(m=>m.dispose()),[materials]);
 return <mesh {...events} geometry={geometry} material={materials.length===1?materials[0]:materials} castShadow receiveShadow/>;
}
function Pedestal({object,state,onSelect,studio,library,intensity,color}:{object:StageObject;state:AppState;onSelect:()=>void;studio:ReturnType<typeof stageMetalStudio>;library:ReturnType<typeof stageSurfaceLibrary>;intensity:number;color:string}){
 const geometry=useMemo(()=>stageGeometry(object),[object.shape,object.id,object.material,object.surface,...object.size,object.textureScale,object.reliefDepth,object.detailStrength,object.bevelRadius,object.brickRows,object.brickColumns]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 const cove=useMemo(()=>{
  if(object.shape!=='cyclorama')return null;
  const material=new THREE.MeshPhysicalMaterial({...stageSurfaceParameters(object),envMap:studio.environment,envMapIntensity:intensity*.55});
  material.onBeforeCompile=shader=>{
   shader.uniforms.studioWall={value:new THREE.Color(state.bgColor)};
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 backdropPoint;').replace('#include <begin_vertex>','#include <begin_vertex>\nbackdropPoint = position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 studioWall; varying vec3 backdropPoint;').replace('#include <color_fragment>',`#include <color_fragment>
    diffuseColor.rgb = mix(diffuseColor.rgb,studioWall,smoothstep(.15,8.0,backdropPoint.y));
    float windowLine = backdropPoint.x - backdropPoint.y*.75 + 3.5;
    float windowFade = smoothstep(.6,5.0,backdropPoint.y);
    float windowLight = exp(-pow(windowLine/2.5,2.0))*windowFade;
    diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.91,.92,.95),windowLight*.24);
    float prism = exp(-pow((windowLine+1.2)/.3,2.0))*windowFade;
    diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.94,.83,.72),prism*.09);`);
  };material.customProgramCacheKey=()=>`studio-cyclorama-${state.bgColor}`;return material;
 },[object.shape,object.color,object.roughness,state.bgColor,studio,intensity]);
 useEffect(()=>()=>cove?.dispose(),[cove]);
 const physical=<meshPhysicalMaterial {...stageSurfaceParameters(object)} envMap={studio.environment} envMapIntensity={intensity*(object.material==='glass'?.8:.55)}/>;
 const textured=(!object.material||object.material==='stone')&&object.surface!=='smooth';
 const events={onClick:(e:any)=>{e.stopPropagation();if(!suppressSceneClick())onSelect();},onPointerDown:(e:any)=>e.stopPropagation()};
 const fallback=cove?<mesh {...events} geometry={geometry} material={cove} receiveShadow/>:<mesh {...events} geometry={geometry} castShadow={object.material!=='glass'} receiveShadow={object.material!=='glass'}>{physical}</mesh>;
 return <group name={'stage-'+object.id} userData={{stageId:object.id}} position={object.position} rotation={object.rotation}>
  {/* Suspend the whole mesh: a fallback material attaching/detaching on the
      same mesh can otherwise overwrite the newly loaded PBR material. */}
  {object.shape==='brick-court'?<Suspense fallback={fallback}><BrickStudioMesh object={object} events={events}/></Suspense>:object.shape==='chrome-rack'?<ChromeRackMesh object={object} geometry={geometry} events={events}/>:object.shape==='grooved-tray'||object.shape==='satin-sheet'?<GroovedStudioMesh object={object} geometry={geometry} events={events}/>:isSoftStage(object)?<Suspense fallback={fallback}><SoftStage object={object} state={state} studio={studio} library={library} events={events}/></Suspense>:object.material==='metal'?<MetalMesh object={object} geometry={geometry} events={events} studio={studio} intensity={intensity} color={color}/>:textured?<Suspense fallback={fallback}><StoneMesh object={object} geometry={geometry} events={events} studio={studio} library={library} intensity={intensity}/></Suspense>:fallback}
  {(object.reflectivity??0)>0&&<StudioReflection object={object} state={state}/>}
  {object.id==='primary'&&studioId(state.stage)&&studioId(state.stage)!=='chrome'&&state.shadowConfig.type!=='none'&&state.lightingMode!=='flat'&&<StudioContactShadow object={object} state={state}/>}
 </group>;
}
export function Stage({state,updateState}:{state:AppState;updateState?:(p:Partial<AppState>)=>void}) {
 const {scene,size,gl}=useThree();const fit=useRef<{stage?:AppState['stage'];id?:string;composition?:boolean}|null>(null);
 const placement=useRef<{modelId:string;stageId:string;pose:PhonePose;target:'stage'|'floor';started:number}|null>(null),frame=useRef(false);
 const composition=useRef<{id:StudioId;started:number}|null>(null);
 const studioView=useRef<GroovedView|null>(null);
 useEffect(()=>{
  const request=(event:Event)=>{fit.current=(event as CustomEvent).detail||{};};
  const place=(event:Event)=>{placement.current={...(event as CustomEvent).detail,started:performance.now()};};
  const view=()=>{frame.current=true;};
  const compose=(event:Event)=>{composition.current={id:(event as CustomEvent).detail,started:performance.now()};fit.current=null;frame.current=false;};
  const changeView=(event:Event)=>{studioView.current=(event as CustomEvent).detail;};
  window.addEventListener('mockup-studio-view',changeView);
  window.addEventListener('mockup-compose-studio',compose);
  window.addEventListener('mockup-fit-stage',request);window.addEventListener('mockup-place-phone',place);window.addEventListener('mockup-frame-stage',view);
  return()=>{window.removeEventListener('mockup-studio-view',changeView);window.removeEventListener('mockup-compose-studio',compose);window.removeEventListener('mockup-fit-stage',request);window.removeEventListener('mockup-place-phone',place);window.removeEventListener('mockup-frame-stage',view);};
 },[]);
 const stage=state.stage,id=studioId(stage),objects=stageObjects(stage);
 const studio=useMemo(()=>stage?.enabled?stageMetalStudio(gl):null,[stage?.enabled,gl]);
 useEffect(()=>()=>studio?.dispose(),[studio]);
 const library=useMemo(()=>stageSurfaceLibrary(gl),[gl,stage?.enabled]);
 useEffect(()=>()=>library.dispose(),[library]);
 useFrame(()=>{
  if(!stage?.enabled){composition.current=null;placement.current=null;frame.current=false;fit.current=null;studioView.current=null;return;}
  if(state.isPlaying||state.isExporting)return;
  const sceneBounds=()=>{
   const box=new THREE.Box3();for(const o of objects)box.union(new THREE.Box3(new THREE.Vector3(...o.size).multiplyScalar(-.5),new THREE.Vector3(...o.size).multiplyScalar(.5)).applyMatrix4(stageMatrix(o)));
   return box;
  };
  const findModel=(id:string|undefined)=>{let root:THREE.Object3D|undefined;scene.traverse(o=>{if(id&&o.userData.mockupModelId===id)root=o;});return root;};
  if(studioView.current){
   const view=studioView.current,root=findModel(state.models.find(m=>m.visible)?.id);studioView.current=null;
   if(studioId(stage)==='grooved'&&root){const box=boundsInFrame(root);if(!box.isEmpty())updateState?.({...groovedCamera(box,size.width/size.height,view),isPlaying:false});}
  }
  if(composition.current){
   const requested=composition.current,model=state.models.find(m=>m.visible),root=findModel(model?.id);
   // A DOM click queues React state and this event together. The next render
   // may still have the previous stage; wait for the matching preset instead
   // of dropping the composition before React commits it.
   if(studioId(stage)===requested.id&&model&&root){const result=composeStudio(requested.id,root,model,objects[0],size.width/size.height);if(result){composition.current=null;updateState?.({models:state.models.map(m=>m.id===model.id?result.models:m),cameraPosition:result.cameraPosition,cameraTarget:result.cameraTarget});return;}}
   if(composition.current&&performance.now()-requested.started>10000)composition.current=null;
  }
  const place=placement.current;
  if(place){
   const model=state.models.find(m=>m.id===place.modelId),root=findModel(model?.id),selected=objects.find(o=>o.id===place.stageId)||objects[0];
   if(root&&model){
    let support=selected;
    if(place.target==='floor'){
     const modelBox=boundsInFrame(root),extent=modelBox.getSize(new THREE.Vector3());
     support={...selected,position:[selected.position[0],stageFloor(stage),sceneBounds().max.z+Math.max(extent.x,extent.y,extent.z)/2+.65],rotation:[0,0,0],size:[100,0,100]};
    }
    const result=placePhone(root,model,support,place.pose);
    if(result){
     placement.current=null;frame.current=true;
     updateState?.({models:state.models.map(m=>m.id===model.id?{...m,position:result.position,rotation:result.rotation}:m),activeModelId:model.id,selectedModelIds:[model.id],activeStageId:null,isPlaying:false,isSelectingScreen:false,isSelectingFocus:false});
     window.dispatchEvent(new CustomEvent('mockup-placement-result',{detail:result.overhang?'已贴合；手机超出台面，可增大展台尺寸。':place.target==='floor'?'已摆放到地面，可继续用控制轴微调。':'已贴合台面，可继续用控制轴微调。'}));return;
    }
   }
   if(performance.now()-place.started>10000){placement.current=null;window.dispatchEvent(new CustomEvent('mockup-placement-result',{detail:'模型尚未加载完成，请加载后重试。'}));}
  }
  if(frame.current){
   frame.current=false;const designed=studioId(stage),box=designed?new THREE.Box3():sceneBounds();
   for(const model of state.models.filter(m=>m.visible)){const root=findModel(model.id);if(root)box.union(boundsInFrame(root));}
   if(!box.isEmpty())updateState?.(designed?studioCamera(designed,box,size.width/size.height):stageCamera(box,size.width/size.height,state.projectionMode));
  }
  const requested=fit.current,targetStage=requested?.stage||stage;
  if(!requested||!targetStage?.enabled)return;
  const id=state.activeModelId||state.models[0]?.id;const model=findModel(id);
  if(!model)return;model.updateWorldMatrix(true,true);const box=new THREE.Box3().setFromObject(model,true);if(box.isEmpty())return;
  fit.current=null;const center=box.getCenter(new THREE.Vector3()),targets=stageObjects(targetStage),selected=targets.find(o=>o.id===(requested.id||state.activeStageId))||targets[0];
  const contactHeight=isSoftStage(selected)?supportHeight(selected)+.012:selected.size[1]/2;
  const position:[number,number,number]=[center.x+(selected.shape==='grooved-tray'?selected.size[0]*.265:0),box.min.y-contactHeight,center.z];
  let next=patchStage(targetStage,selected.id,{rotation:[0,0,0],position});
  if(requested.composition&&selected.id==='primary'){
   const delta=position.map((v,i)=>v-selected.position[i]);
   next={...next,items:next.items?.map(o=>({...o,position:o.position.map((v,i)=>v+delta[i]) as [number,number,number]}))};
  }
  frame.current=true;updateState?.({stage:next});
 });
 if(!stage?.enabled)return null;
 const floor=stageFloor(stage);
 return <group>
  <StageLighting state={state}/>
  {[false,true].map(backdrop=><group key={String(backdrop)} userData={backdrop?{lensGroupId:'studio-architecture'}:{}}>{objects.filter(o=>(o.role==='backdrop')===backdrop&&!(id==='chrome'&&o.id==='warm-floor')).map(object=><Pedestal key={object.id} object={object} state={state} studio={studio!} library={library} intensity={state.ambientIntensity*(state.lightingMode==='flat'?.2:1.25)} color={state.lightColor} onSelect={()=>{if(!state.isPlaying&&!state.isExporting&&!state.isSelectingFocus&&!state.isSelectingScreen)updateState?.({activeStageId:object.id,activeModelId:null,activeTextId:null});}}/>)}</group>)}
  {id!=='chrome'&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,floor,0]} receiveShadow><planeGeometry args={[200,200]}/><shadowMaterial transparent opacity={.16}/></mesh>}
 </group>;
}
