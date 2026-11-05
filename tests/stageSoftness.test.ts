import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {getInitialState} from '../types.ts';
import {makeStage,stageObjects} from '../utils/stagePresets.ts';
import {localModelBounds,softContact,pressureAt,supportHeight,softUniforms,updateSoftContacts,attachSoftDeformation,pileHeight} from '../utils/stageSoftness.ts';
import {placePhone,stageMatrix,boundsInFrame} from '../utils/stagePlacement.ts';
import {furGeometry} from '../utils/stageFur.ts';
import {surfacePixels,stageSurfaceParameters} from '../utils/stageSurface.ts';
import {packProject,unpackProject} from '../utils/projectFiles.ts';

test('soft placement sinks into pile without changing phone size; rotated platforms share the same contact frame',()=>{
 const root=new T.Group();root.add(new T.Mesh(new T.BoxGeometry(3,6,.25),new T.MeshBasicMaterial()));root.scale.setScalar(1.2);
 const support={...stageObjects(makeStage('fur'))[0],rotation:[.12,.3,-.15] as [number,number,number]},model=getInitialState().models[0];
 const bounds=localModelBounds(root),flat=placePhone(root,model,support,'flat')!;
 root.position.set(...flat.position);root.rotation.set(...flat.rotation);root.updateMatrixWorld(true);
 const current=boundsInFrame(root,stageMatrix(support).invert());assert.ok(Math.abs(current.min.y-supportHeight(support)-.012)<1e-6);assert.equal(root.scale.x,1.2);
 const contact=softContact(bounds,root.matrixWorld,support)!;assert.ok(contact);assert.ok(pressureAt(contact,0,0)>.7);assert.equal(pressureAt(contact,20,20),0);
 assert.ok(Math.max(...contact.halfSize)>3);assert.ok(pileHeight(support)>0);
 const standing=placePhone(root,model,support,'upright')!;root.position.set(...standing.position);root.rotation.set(...standing.rotation);root.updateMatrixWorld(true);
 const edge=softContact(bounds,root.matrixWorld,support)!;assert.ok(Math.min(...edge.halfSize)<.2,'standing volume must not press the whole screen-sized rectangle');
 root.position.y+=4;root.updateMatrixWorld(true);assert.equal(softContact(bounds,root.matrixWorld,support),null);
});
test('contact follows translation; inactive, disabled and far-away supports have no pressure',()=>{
 const bounds=new T.Box3(new T.Vector3(-1.5,-.15,-3),new T.Vector3(1.5,.15,3)),support=stageObjects(makeStage('fur'))[0];
 const matrix=new T.Matrix4().makeTranslation(1,support.position[1]+supportHeight(support)+.15,2);
 const touch=softContact(bounds,matrix,support)!;assert.ok(touch);assert.ok(pressureAt(touch,1,2)>.7);assert.equal(pressureAt(touch,-4,-4),0);
 assert.equal(softContact(bounds,matrix,{...support,softness:0}),null);assert.equal(softContact(bounds,new T.Matrix4().makeTranslation(30,5,0),support),null);
 const uniforms=softUniforms(support),first=uniforms.touchA.value[0];updateSoftContacts(uniforms,[touch]);assert.equal(uniforms.touchCount.value,1);assert.equal(uniforms.touchA.value[0],first);
 updateSoftContacts(uniforms,[]);assert.equal(uniforms.touchCount.value,0);
});
test('fiber geometry is deterministic, instanced and bounded instead of a mesh for each strand',()=>{
 const o=stageObjects(makeStage('fur'))[0],a=furGeometry(o),b=furGeometry(o);
 assert.ok(a.instanceCount<=36000);assert.equal(a.getAttribute('position').count,6);assert.equal(a.index!.count,12,'one curved ribbon, not two overlapping fibre cards');
 assert.deepEqual(Array.from(a.getAttribute('fiberRoot').array),Array.from(b.getAttribute('fiberRoot').array));
 assert.ok(Array.from(a.getAttribute('fiberStyle').array).every(Number.isFinite));assert.equal(a.getAttribute('fiberRoot').count,a.instanceCount);
 a.dispose();b.dispose();
});
test('unchanged contact uniforms do not invalidate static shadows or mutate caller contacts',()=>{
 const o=stageObjects(makeStage('knit'))[0],uniforms=softUniforms(o);
 const a={center:[0,0] as [number,number],halfSize:[1,2] as [number,number],angle:0,strength:.5,bottom:.3};
 const b={...a,center:[2,0] as [number,number],strength:.9},contacts=[a,b];
 assert.equal(updateSoftContacts(uniforms,contacts),true);assert.deepEqual(contacts,[a,b]);
 assert.equal(updateSoftContacts(uniforms,[{...a},{...b}]),false);
 assert.equal(updateSoftContacts(uniforms,[{...a,angle:.2},b]),true);
 assert.equal(updateSoftContacts(uniforms,[]),true);assert.equal(updateSoftContacts(uniforms,[]),false);
});
test('surface and shadow shaders share the contact deformation with stable uniform references',()=>{
 const o=stageObjects(makeStage('fur'))[0],uniforms=softUniforms(o);
 for(const material of [new T.MeshPhysicalMaterial(),new T.MeshDepthMaterial()]){
  attachSoftDeformation(material,uniforms);const shader:any={uniforms:{},vertexShader:'#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>'};material.onBeforeCompile(shader,null as any);
  assert.equal(shader.uniforms.touchA,uniforms.touchA);assert.match(shader.vertexShader,/transformed.y-=softDrop/);assert.ok(material.customProgramCacheKey().includes('surface'));material.dispose();
 }
});
test('all PBR texture channels contain coherent finite surface detail, not a flat color',()=>{
 for(const kind of ['travertine','slate','terrazzo','fabric','velvet','fur'] as const){
  const a=surfacePixels(kind,256),b=surfacePixels(kind,256);assert.deepEqual(a.color,b.color);assert.equal(a.normal.length,256*256*4);
  assert.ok(new Set(a.color).size>12);assert.ok(new Set(a.roughness).size>2||['fabric','velvet','fur'].includes(kind));assert.ok(new Set(a.normal).size>10);
 }
 assert.ok(stageSurfaceParameters(stageObjects(makeStage('velvet'))[0]).sheen!>0);
});
test('new cloth, fur and stone settings roundtrip completely and malformed parameters are rejected',async()=>{
 for(const preset of ['knit','cable','linen','velvet','fur','single','terrace','stairs']){
  const state=getInitialState();state.stage=makeStage(preset);const restored=await unpackProject(await packProject(state,preset));assert.deepEqual(restored.stage,state.stage);
 }
 const state=getInitialState();state.stage=makeStage('fur');const broken=await packProject(state,'invalid');broken.data.stage!.fiberDensity=100;await assert.rejects(()=>unpackProject(broken),/场景展台/);
 const invalid=await packProject({...state,stage:makeStage('knit')},'invalid');invalid.data.stage!.reliefDepth=.9;await assert.rejects(()=>unpackProject(invalid),/场景展台/);
 invalid.data.stage!.reliefDepth=.24;invalid.data.stage!.knitPattern='invalid' as any;await assert.rejects(()=>unpackProject(invalid),/场景展台/);
});
test('baked yarn colour and shadow shaders clamp the same thread relief below the contacting phone',()=>{
 const o=stageObjects(makeStage('knit'))[0],uniforms=softUniforms(o);
 for(const material of [new T.MeshPhysicalMaterial(),new T.MeshDepthMaterial()]){
  attachSoftDeformation(material,uniforms,false,true);const shader:any={uniforms:{},vertexShader:'#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>'};material.onBeforeCompile(shader,null as any);
  assert.equal(shader.uniforms.touchA,uniforms.touchA);assert.match(shader.vertexShader,/min\(transformed.y,contact.y-.008\)/);assert.ok(material.customProgramCacheKey().includes('yarn'));material.dispose();
 }
});
