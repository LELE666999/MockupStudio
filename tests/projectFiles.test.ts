import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getInitialState} from '../types.ts';
import {packProject,unpackProject,validateProject} from '../utils/projectFiles.ts';
import {evaluateEasing,updateSegmentCurves} from '../utils/easing.ts';
import {getInterpolatedState} from '../utils/animation.ts';

test('custom fonts restore as worker-readable data URLs in scenes and keyframes',async()=>{
 const state=getInitialState();
 const font='data:font/ttf;base64,AAEAAA==';
 state.texts=[{id:'text',content:'测试',font,fontSize:1,position:[0,0,0],rotation:[0,0,0],scale:1,color:'#ffffff',opacity:1,blur:0,glow:0,visible:true}];
 state.keyframes=[{id:'a',time:0,state:{texts:structuredClone(state.texts)}}];
 const restored=await unpackProject(await packProject(state,'font'));
 assert.equal(restored.texts[0].font,font);
 assert.equal(restored.keyframes[0].state.texts![0].font,font);
});

test('complete scene roundtrip preserves environment, backgrounds, aspect, camera and model colors',async()=>{
 const state=getInitialState();
 Object.assign(state,{bgColor:'#a1b2c3',bgBlur:7,canvasAspectRatio:9/16,customCanvasWidth:1170,customCanvasHeight:2532,lightingMode:'flat',renderStyle:'studio',ambientIntensity:1.7,spotIntensity:.8,lightColor:'#fff8ee',reflectionIntensity:.3,projectionMode:'orthographic'});
 state.models[0].bodyColor='#174fc2';state.models[0].bodyColorOverride=true;
 state.bgImage=URL.createObjectURL(new Blob(['background'],{type:'image/png'}));
 state.keyframes=[{id:'first',time:0,easing:'ease-in',state:{bgColor:'#fafafa',canvasAspectRatio:1,models:structuredClone(state.models)}}];
 const packed=await packProject(state,'complete');
 URL.revokeObjectURL(state.bgImage);
 const restored=await unpackProject(JSON.parse(JSON.stringify(packed)));
 for(const key of ['bgColor','bgBlur','canvasAspectRatio','customCanvasWidth','customCanvasHeight','lightingMode','renderStyle','ambientIntensity','spotIntensity','lightColor','reflectionIntensity','projectionMode','shadowConfig','lens','models','keyframes'])assert.deepEqual(restored[key],state[key],key);
 assert.equal(await(await fetch(restored.bgImage!)).text(),'background');
});

test('batch edits touch selected outgoing segments only',()=>{
  const frames:any[]=[{id:'c',time:3},{id:'a',time:0},{id:'b',time:1}];
  const changed=updateSegmentCurves(frames,new Set(['a','c']),'linear');
  assert.equal(changed[1].easing,'linear');
  assert.equal(changed[0],frames[0]);assert.equal(changed[2],frames[2]);
});
test('custom curve solves time on x axis, with exact endpoints',()=>{
  assert.ok(Math.abs(evaluateEasing(.5,'custom',[0,0,1,1])-.5)<1e-8);
  assert.equal(evaluateEasing(0,'custom'),0);assert.equal(evaluateEasing(1,'custom'),1);
  assert.equal(evaluateEasing(.5,'ease-out'),.75);
});
test('project embeds shared model/media bytes once and restores after original blobs are revoked',async()=>{
  const state=getInitialState();
  const modelURL=URL.createObjectURL(new Blob(['model-bytes'],{type:'model/gltf-binary'}));
  const videoURL=URL.createObjectURL(new Blob(['video-bytes'],{type:'video/mp4'}));
  Object.assign(state.models[0],{mode:'fbx',modelFormat:'glb',fbxFile:modelURL,screenshot:videoURL,screenshotType:'video'});
  state.totalDuration=4;state.currentTime=1.25;
  state.keyframes=[{id:'a',time:0,easing:'linear',state:{models:structuredClone(state.models)}},{id:'b',time:4,state:{models:state.models.map(m=>({...m,position:[4,0,0]}))}}];
  const packed=await packProject(state,'test');
  assert.equal(Object.keys(packed.assets!).length,2);
  URL.revokeObjectURL(modelURL);URL.revokeObjectURL(videoURL);
  const restored=await unpackProject(JSON.parse(JSON.stringify(packed)));
  assert.equal(await (await fetch(restored.models[0].fbxFile!)).text(),'model-bytes');
  assert.equal(await (await fetch(restored.models[0].screenshot!)).text(),'video-bytes');
  assert.equal(restored.models[0].modelFormat,'glb');
  assert.equal(restored.currentTime,1.25);assert.equal(restored.totalDuration,4);
  assert.equal(restored.keyframes[0].easing,'linear');
  assert.equal(getInterpolatedState(2,restored.keyframes,restored).models?.[0].position[0],2);
});
test('missing source assets fail saving, never report a partial package as success',async()=>{
  const state=getInitialState();
  const url=URL.createObjectURL(new Blob(['x']));URL.revokeObjectURL(url);
  state.models[0].screenshot=url;
  await assert.rejects(()=>packProject(state,'broken'),/资源/);
});
test('broken packages and unsupported future formats are rejected before modifying current project',()=>{
  assert.throws(()=>validateProject({data:{models:[]}}));
  assert.throws(()=>validateProject({format:'mockup3d',version:999,data:getInitialState()}));
});
test('malformed scene values are rejected instead of crashing the restored renderer',()=>{
  const data=getInitialState();
  assert.throws(()=>validateProject({name:'bad',data:{...data,cameraPosition:['oops',0,0]}}));
  assert.throws(()=>validateProject({name:'bad',data:{...data,models:[{...data.models[0],screenshot:{bad:true}}]}}));
});
test('missing embedded payload does not open a partially restored project',async()=>{
  const data=getInitialState();data.models[0].fbxFile='asset:missing';
  await assert.rejects(()=>unpackProject({format:'mockup3d',version:2,name:'bad',data,assets:{}}),/缺少/);
});
test('old documents keep their original smoothstep curve instead of silently changing motion',async()=>{
  const data=getInitialState();data.keyframes=[{id:'a',time:0,state:{cameraPosition:[0,0,0]}},{id:'b',time:4,state:{cameraPosition:[4,0,0]}}];
  const restored=await unpackProject({name:'old',data});
  assert.equal(getInterpolatedState(1,restored.keyframes,restored).cameraPosition?.[0],.625);
});
