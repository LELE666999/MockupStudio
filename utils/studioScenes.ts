import * as T from 'three';
import type {AppState,ModelConfig,StageObject,StudioLighting} from '../types';
import {boundsInFrame,stageMatrix} from './stagePlacement.ts';
import {brickCamera} from './brickStudio.ts';
export const STUDIO_IDS=['midnight','gallery','silk','grooved','chrome','bricks'] as const;
export type StudioId=typeof STUDIO_IDS[number];
export const studioId=(stage:AppState['stage']):StudioId|null=>stage?.enabled&&STUDIO_IDS.includes(stage.preset as StudioId)?stage.preset as StudioId:null;
export const studioPalettes={midnight:['#031522','#17375a','#5075a4'],gallery:['#d4d9df','#d4d9df','#b7bec8'],silk:['#dce0e7','#ecedef','#819ac6'],grooved:['#170e2d','#171735','#341b45'],chrome:['#bca78e','#bca78e','#dcc6a9'],bricks:['#090a0c','#17191d','#35383d']} as const;
export function studioLighting(stage:AppState['stage']):StudioLighting{return stage?.studioLighting??{mode:'single',colors:['#507ddc','#c174dd','#f1a065']};}
export function studioLightColors(stage:AppState['stage']):[string,string,string]{
 const lighting=studioLighting(stage);
 if(lighting.mode==='multicolor')return lighting.colors;
 const primary=new T.Color(lighting.colors[0]),white=new T.Color('#ffffff');
 return [lighting.colors[0],'#'+primary.clone().lerp(white,.58).getHexString(),'#'+primary.clone().lerp(white,.8).getHexString()];
}
export function studioBackgroundPixels(id:StudioId,size=512,lighting?:StudioLighting){
 const colors=studioPalettes[id].map(c=>new T.Color(c)),color=new T.Color(),data=new Uint8Array(size*size*4);
 const custom=id==='midnight'&&lighting?lighting.colors.map(c=>new T.Color(c)):null;
 const left=custom?.[0].clone().multiplyScalar(.018),middle=custom?.[lighting!.mode==='multicolor'?1:0].clone().multiplyScalar(.12),right=custom?.[lighting!.mode==='multicolor'?2:0].clone().multiplyScalar(.38),prism=new T.Color('#f6e3cf');
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/(size-1),v=y/(size-1),amount=id==='midnight'?T.MathUtils.smoothstep(u*.72+(1-v)*.42,0,1):id==='silk'?T.MathUtils.smoothstep(u*.62+(1-v)*.5,.25,1.1):u*.2+(1-v)*.1;
  color.copy(colors[0]).lerp(colors[2],amount);
  if(custom){
   color.copy(left!).lerp(middle!,T.MathUtils.smoothstep(u+(1-v)*.2,.05,.8)).lerp(right!,T.MathUtils.smoothstep(u+(1-v)*.2,.5,1.2));
  }
  if(id==='silk'){
   const window=Math.exp(-Math.pow((u+v*.7-.59)/.12,2));color.lerp(colors[1],window*.45);
   const spectrum=Math.exp(-Math.pow((u+v*.7-.51)/.018,2));color.lerp(prism,spectrum*.11);
  }
  color.convertLinearToSRGB();const offset=(y*size+x)*4;data[offset]=Math.round(color.r*255);data[offset+1]=Math.round(color.g*255);data[offset+2]=Math.round(color.b*255);data[offset+3]=255;
 }return data;
}
export function studioDefaults(id:StudioId,state:AppState):Partial<AppState>{
 return {renderStyle:'studio',lightingMode:'realistic',bgImage:null,bgColor:studioPalettes[id][0],bgBlur:0,ambientIntensity:id==='midnight'?.28:id==='grooved'?.2:id==='chrome'?.18:id==='bricks'?.22:.72,spotIntensity:0,lightColor:'#ffffff',projectionMode:'weak',reflectionIntensity:id==='midnight'?.65:1,
  activeModelId:null,selectedModelIds:[],activeStageId:null,activeTextId:null,isPlaying:false,isSelectingScreen:false,isSelectingFocus:false,
  lens:{...state.lens,enabled:id!=='midnight',focus:null,aperture:id==='gallery'?4:id==='grooved'?11:id==='chrome'?8:id==='bricks'?11:5.6,maxBlur:18,exposureMode:'auto'},lensAnimated:false,
  shadowConfig:{type:'floor',opacity:id==='bricks'?.42:id==='grooved'?.32:.22,blur:id==='bricks'?.7:2.6,color:id==='bricks'?'#070809':id==='silk'?'#526482':'#2c3442',offset:.5}};
}
export type GroovedView='angled'|'overhead'|'close';
/** Camera presets change only the view. The cloth is deliberately excluded
 * from framing, and the hero stays visible on narrow and wide canvases. */
export function groovedCamera(bounds:T.Box3,aspect:number,view:GroovedView='angled'){
 const size=bounds.getSize(new T.Vector3()),hero=bounds.getCenter(new T.Vector3());
 const target=hero.clone().add(new T.Vector3(view==='close'?size.x*.55:size.x*.83,-size.y*.5,0));
 const direction=new T.Vector3(...(view==='overhead'?[0,1,.001]:view==='close'?[-.6,1.6,1.05]:[.64,1.65,1.05]) as [number,number,number]).normalize();
 const width=size.x*(view==='close'?2.65:3.3),height=Math.max(size.z,size.y)*(view==='close'?1.3:1.5),distance=Math.max(height,width/Math.max(.35,aspect))/(2*Math.tan(Math.PI/8));
 return {cameraPosition:target.clone().addScaledVector(direction,distance).toArray() as [number,number,number],cameraTarget:target.toArray() as [number,number,number]};
}
export function studioCamera(id:StudioId,bounds:T.Box3,aspect:number){
 if(id==='bricks')return brickCamera(bounds,aspect);
 if(id==='grooved')return groovedCamera(bounds,aspect);
 const size=bounds.getSize(new T.Vector3()),target=bounds.getCenter(new T.Vector3());
 if(id==='chrome'){
  const direction=new T.Vector3(-.18,2.6,1).normalize(),distance=Math.max(size.z*1.23,size.x*1.7/Math.max(.35,aspect))/(2*Math.tan(Math.PI/8));
  return {cameraPosition:target.clone().addScaledVector(direction,distance).toArray() as [number,number,number],cameraTarget:target.toArray() as [number,number,number]};
 }
 target.y-=size.y*.055;
 const direction=new T.Vector3(...(id==='midnight'?[.3,.38,1]:id==='gallery'?[.015,.085,1]:[.055,.025,1]) as [number,number,number]).normalize();
 const distance=Math.max(size.y/(2*Math.tan(Math.PI/8)*(id==='midnight'?.65:.63)),size.x/(2*Math.tan(Math.PI/8)*Math.max(.3,aspect)*.7));
 return {cameraPosition:target.clone().addScaledVector(direction,distance).toArray() as [number,number,number],cameraTarget:target.toArray() as [number,number,number]};
}
/** Fit the hero, not the large studio walls. Existing media, scale and other
 * models are never changed; imported bounds determine the real contact. */
export function composeStudio(id:StudioId,root:T.Object3D,model:ModelConfig,support:StageObject,aspect:number){
 const savedPosition=root.position.clone(),savedRotation=root.rotation.clone(),frame=stageMatrix(support),inverse=frame.clone().invert();
 try{
  root.position.set(...support.position);
  root.rotation.set(...(id==='bricks'?[-Math.PI/2,0,-.52]:id==='midnight'?[-.5,-.25,.4]:id==='gallery'?[0,.025,0]:id==='grooved'?[-Math.PI/2,0,0]:id==='chrome'?[-Math.PI/2,0,-.12]:[0,-.04,-.015]) as [number,number,number]);
  const box=boundsInFrame(root,inverse);if(box.isEmpty())return null;
  const center=box.getCenter(new T.Vector3()),position=new T.Vector3(-center.x+(id==='gallery'?-2:id==='grooved'?-support.size[0]*.265:0),support.size[1]/2-box.min.y+.013,-center.z+(id==='bricks'?support.size[2]*.16:id==='gallery'?-1.2:id==='midnight'?-6.4:0)).applyMatrix4(frame);
  root.position.copy(position);root.updateWorldMatrix(true,true);
  return {models:{...model,position:position.toArray() as ModelConfig['position'],rotation:root.rotation.toArray().slice(0,3) as ModelConfig['rotation']},...studioCamera(id,boundsInFrame(root),aspect)};
 }finally{root.position.copy(savedPosition);root.rotation.copy(savedRotation);root.updateWorldMatrix(true,true);}
}
