import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getInitialState} from '../types.ts';
import {getInterpolatedState} from '../utils/animation.ts';
import {packProject,unpackProject,validateProject} from '../utils/projectFiles.ts';
import {focusWorld,lensDepth,sampleLensValue,editLens,DEFAULT_LENS,modelSource} from '../utils/focus.ts';
import {PerspectiveCamera} from 'three';
test('automatic focus follows the active model instead of an unrelated camera target',()=>{
 const state=getInitialState(),camera=new PerspectiveCamera();camera.position.set(0,0,15);camera.updateMatrixWorld();
 state.models[0].position=[2,1,5];state.cameraTarget=[0,0,0];state.lens={...DEFAULT_LENS,enabled:true};
 assert.equal(lensDepth(state,camera),10);
 state.models[0].position=[2,1,7];assert.equal(lensDepth(state,camera),8);
 state.models[0].visible=false;assert.equal(lensDepth(state,camera),15);
});
test('lens values animate with keyframes and restore at endpoints',()=>{
  const state=getInitialState();
  const frames:any[]=[{id:'a',time:0,easing:'linear',state:{lens:{enabled:true,aperture:2,maxBlur:8,focus:null}}},{id:'b',time:2,state:{lens:{enabled:true,aperture:8,maxBlur:16,focus:null}}}];
  assert.equal((getInterpolatedState(1,frames,state) as any).lens?.aperture,5);
  assert.equal((getInterpolatedState(2,frames,state) as any).lens?.aperture,8);
});
test('old projects retain legacy rendering and invalid lens is rejected',async()=>{
  const doc=await packProject(getInitialState(),'兼容');delete (doc.data as any).renderStyle;
  assert.equal((await unpackProject(doc) as any).renderStyle,'legacy');
  (doc.data as any).lens={enabled:true,aperture:-1,maxBlur:NaN,focus:null};
  assert.throws(()=>validateProject(doc));
});
test('surface anchor follows transforms and falls back safely after model removal',()=>{
 const state=getInitialState(),model=state.models[0];
 Object.assign(model,{position:[3,4,5],rotation:[0,0,Math.PI/2],scale:2});
 const focus:any={modelId:model.id,localPoint:[1,0,0],fallbackWorldPoint:[7,8,9]};
 const p=focusWorld(focus,state.models,[0,0,0]);assert.ok(p.distanceTo({x:3,y:6,z:5} as any)<1e-9);
 assert.deepEqual(focusWorld(focus,[],[0,0,0]).toArray(),[7,8,9]);
 const camera=new PerspectiveCamera();camera.position.set(0,0,15);camera.updateMatrixWorld();
 state.lens={...DEFAULT_LENS,enabled:true,focus};assert.equal(lensDepth(state,camera),10);
});
test('continuous lens derivatives meet at intermediate keys without stopping or overshoot',()=>{
 const frames:any[]=[{time:0,value:2},{time:1,value:4},{time:3,value:8}];
 const value=(time:number)=>sampleLensValue(time,frames,f=>(f as any).value,true);
 const h=.0001,left=(value(1)-value(1-h))/h,right=(value(1+h)-value(1))/h;
 assert.ok(left>1);assert.ok(Math.abs(left-right)<.002);
 for(let t=0;t<3;t+=.03)assert.ok(value(t)>=2&&value(t)<=8);
});
test('editing lens only changes the matching key lens and roundtrips complete anchors',async()=>{
 const state=getInitialState();state.keyframes=[{id:'a',time:0,easing:'ease-in',state:{bgColor:'#123456'}},{id:'b',time:2,easing:'ease-in',state:{bgColor:'#abcdef'}}];
 Object.assign(state,editLens(state,{enabled:true,focus:{modelId:state.models[0].id,localPoint:[1,2,3],fallbackWorldPoint:[1,2,3]}}));
 assert.equal(state.keyframes[0].state.bgColor,'#123456');assert.deepEqual(state.keyframes[1].state.lens,DEFAULT_LENS);
 const restored=await unpackProject(await packProject(state,'镜头'));
 assert.deepEqual(restored.lens,state.lens);assert.deepEqual(restored.keyframes,state.keyframes);
});
test('missing lens keys do not accumulate interpolation drift when scrubbing repeatedly',()=>{
 const state=getInitialState();const frames:any[]=[{id:'a',time:0,easing:'linear',state:{lens:{...DEFAULT_LENS,enabled:true,aperture:2}}},{id:'b',time:2,state:{}}];
 const expected=getInterpolatedState(1,frames,state).lens;
 for(let i=0;i<10;i++){Object.assign(state,getInterpolatedState(1,frames,state));assert.deepEqual(state.lens,expected);}
});
test('model source normalization during packing keeps anchors attached after reopen',async()=>{
 const state=getInitialState(),model=state.models[0];
 model.mode='fbx';model.fbxFile='data:application/octet-stream;base64,AQID';
 state.lens={...DEFAULT_LENS,enabled:true,focus:{modelId:model.id,modelSource:modelSource(model),localPoint:[1,0,0],fallbackWorldPoint:[1,0,0]}};
 const restored=await unpackProject(await packProject(state,'内置模型焦点'));
 restored.models[0].position=[4,0,0];
 assert.deepEqual(focusWorld(restored.lens!.focus,restored.models,[0,0,0]).toArray(),[5,0,0]);
});
