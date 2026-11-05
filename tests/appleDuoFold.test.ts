import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as T from 'three';
import {prepareAppleDuo,updateAppleDuoFold,APPLE_DUO_INNER,APPLE_DUO_COVER,isAppleDuo} from '../utils/appleDuoFold.ts';
import {getInitialState} from '../types.ts';
import {getInterpolatedState} from '../utils/animation.ts';
import {packProject,unpackProject} from '../utils/projectFiles.ts';

/** Load the actual local mesh buffers without needing DOM image decoders. */
function asset(){
 const bytes=readFileSync(new URL('../public/models/iphone-duo.glb',import.meta.url));
 const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12))),base=28+bytes.readUInt32LE(12);
 const attribute=(id:number)=>{
  const a=gltf.accessors[id],view=gltf.bufferViews[a.bufferView],size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type]!,width=a.componentType===5123?2:4;
  const values=a.componentType===5126?new Float32Array(a.count*size):a.componentType===5123?new Uint16Array(a.count*size):new Uint32Array(a.count*size);
  for(let i=0;i<a.count;i++)for(let j=0;j<size;j++){
   const at=base+(view.byteOffset??0)+(a.byteOffset??0)+i*(view.byteStride??width*size)+j*width;
   values[i*size+j]=a.componentType===5126?bytes.readFloatLE(at):width===2?bytes.readUInt16LE(at):bytes.readUInt32LE(at);
  }
  return new T.BufferAttribute(values,size);
 };
 const object=new T.Group();
 for(const n of gltf.nodes){
  if(n.mesh===undefined)continue;const p=gltf.meshes[n.mesh].primitives[0],geo=new T.BufferGeometry();
  for(const [gltfName,name] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']])if(p.attributes[gltfName]!==undefined)geo.setAttribute(name,attribute(p.attributes[gltfName]));
  if(p.indices!==undefined)geo.setIndex(attribute(p.indices));
  const m=new T.Mesh(geo,new T.MeshStandardMaterial());m.name=n.name.replace(/\./g,'');m.userData.originalMaterial=m.material;
  if(n.translation)m.position.fromArray(n.translation);if(n.rotation)m.quaternion.fromArray(n.rotation);object.add(m);
 }
 return object;
}
test('optional local Duo fixture keeps its detailed rigid halves, hinge and exterior display while gaining one continuous inner display',{skip:!existsSync(new URL('../public/models/iphone-duo.glb',import.meta.url))},()=>{
 const object=asset(),body=object.getObjectByName('jJermpgmctotTSe001') as T.Mesh,geometry=body.geometry;
 const rig=prepareAppleDuo(object),uv=rig.screen.geometry.getAttribute('uv').array.slice();
 assert.equal(body.geometry,geometry);assert.ok(geometry.getAttribute('position').count>5000);
 assert.equal(object.getObjectByName('lJPfQMFXvvcmdtA001'),undefined,'invisible baked export envelope must not distort framing');
 assert.ok(object.getObjectByName(APPLE_DUO_COVER));assert.equal(rig.screen.name,APPLE_DUO_INNER);
 assert.ok(rig.screen.geometry.userData.screenAspect>1.4);
 const flat=new T.Box3().setFromObject(object,true).getSize(new T.Vector3());
 for(const angle of [0,15,60,90,135,180]){
  updateAppleDuoFold(rig,angle);object.updateMatrixWorld(true);
  assert.equal(body.geometry,geometry);assert.deepEqual(rig.screen.geometry.getAttribute('uv').array,uv);
  assert.equal(rig.left.rotation.y,-rig.right.rotation.y);
  assert.ok([...rig.screen.geometry.getAttribute('position').array].every(Number.isFinite));
  assert.ok([...rig.screen.geometry.getAttribute('normal').array].every(Number.isFinite));
  const size=new T.Box3().setFromObject(object,true).getSize(new T.Vector3());assert.ok(size.y<3.9&&size.x<5.4);
  if(angle===0)assert.ok(size.x<flat.x*.2,'closed front view must not retain a flat inner screen');
 }
 assert.equal(isAppleDuo('/models/iphone-duo.glb'),true);assert.equal(isAppleDuo('iphone-duo.glb'),true);assert.equal(isAppleDuo('/models/iphone18-pro.glb'),false);
});
test('Duo angle, separate videos and Apple colour override interpolate and persist without changing other models',async()=>{
 const s=getInitialState();Object.assign(s.models[0],{mode:'fbx',modelFormat:'glb',sourceFile:'/models/iphone-duo.glb',fbxFile:'data:model/gltf-binary;base64,AA==',selectedScreenMesh:APPLE_DUO_INNER,foldAngle:0,bodyColor:'#f3ede5',bodyColorOverride:false,screenshot:'data:video/mp4;base64,AQ==',screenshotType:'video',coverScreenshot:'data:video/mp4;base64,Ag==',coverScreenshotType:'video'});
 s.keyframes=[{id:'a',time:0,easing:'linear',state:{models:structuredClone(s.models)}},{id:'b',time:3,state:{models:s.models.map(m=>({...m,foldAngle:180,bodyColor:'#18c76b',bodyColorOverride:true}))}}];
 for(const motionMode of ['segments','continuous'] as const){
  s.motionMode=motionMode;const restored=await unpackProject(await packProject(s,'Duo'));
  const midway=getInterpolatedState(1.5,restored.keyframes,restored).models![0];
  assert.equal(midway.foldAngle,90);assert.equal(midway.bodyColorOverride,true);assert.equal(midway.sourceFile,'/models/iphone-duo.glb');
  assert.equal(midway.screenshot,restored.models[0].screenshot);assert.equal(midway.coverScreenshot,restored.models[0].coverScreenshot);
  assert.equal(getInterpolatedState(0,restored.keyframes,restored).models![0].bodyColorOverride,false);
 }
});
test('choosing Duo in an existing straight-phone animation retains the live model and unkeyed opening angle',()=>{
 const s=getInitialState();s.keyframes=[{id:'a',time:0,state:{models:structuredClone(s.models)}},{id:'b',time:3,state:{models:structuredClone(s.models)}}];
 Object.assign(s.models[0],{mode:'fbx',modelFormat:'glb',sourceFile:'/models/iphone-duo.glb',fbxFile:'blob:new-model',selectedScreenMesh:APPLE_DUO_INNER,foldAngle:120});
 for(const motionMode of ['segments','continuous'] as const){
  s.motionMode=motionMode;
  for(const time of [0,1.5,3]){
   const m=getInterpolatedState(time,s.keyframes,s).models![0];assert.equal(m.mode,'fbx');assert.equal(m.modelFormat,'glb');assert.equal(m.foldAngle,120);assert.equal(m.sourceFile,'/models/iphone-duo.glb');
  }
 }
});
