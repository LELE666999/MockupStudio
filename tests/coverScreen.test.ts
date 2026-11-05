import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getInitialState} from '../types.ts';
import {packProject,unpackProject,validateProject} from '../utils/projectFiles.ts';
import {replaceCoverScreen} from '../utils/replaceScreen.ts';
import {getInterpolatedState} from '../utils/animation.ts';

test('independent inner and cover videos are embedded and restored in scene and keys',async()=>{
 const s=getInitialState();Object.assign(s.models[0],{simpleStyle:'fold',foldAngle:90,screenshot:URL.createObjectURL(new Blob(['inner'],{type:'video/mp4'})),screenshotType:'video',coverScreenshot:URL.createObjectURL(new Blob(['cover'],{type:'video/mp4'})),coverScreenshotType:'video'});
 s.keyframes=[{id:'a',time:0,state:{models:structuredClone(s.models)}},{id:'b',time:3,state:{models:s.models.map(m=>({...m,foldAngle:180}))}}];
 const packed=await packProject(s,'dual');assert.equal(Object.keys(packed.assets!).length,2);
 URL.revokeObjectURL(s.models[0].screenshot!);URL.revokeObjectURL(s.models[0].coverScreenshot!);
 const restored=await unpackProject(packed);
 assert.equal(await(await fetch(restored.models[0].screenshot!)).text(),'inner');
 assert.equal(await(await fetch(restored.models[0].coverScreenshot!)).text(),'cover');
 assert.equal(getInterpolatedState(1.5,restored.keyframes,restored).models![0].coverScreenshot,restored.models[0].coverScreenshot);
});
test('cover replacement and removal update matching keys without touching the inner screen or other phones',()=>{
 const s=getInitialState();s.models[0].screenshot='inner';s.models.push({...s.models[0],id:'other'});
 s.keyframes=[{id:'a',time:0,state:{models:structuredClone(s.models)}}];
 Object.assign(s,replaceCoverScreen(s,s.models[0].id,'cover','video'));
 assert.equal(s.models[0].screenshot,'inner');assert.equal(s.models[1].coverScreenshot,undefined);
 assert.equal(s.keyframes[0].state.models![0].coverScreenshot,'cover');
 Object.assign(s,replaceCoverScreen(s,s.models[0].id,null));
 assert.equal(s.keyframes[0].state.models![0].coverScreenshot,null);
 assert.equal(s.models[0].screenshot,'inner');
});
test('invalid cover assets and media types are rejected',()=>{
 const s=getInitialState();(s.models[0] as any).coverScreenshot={bad:true};
 assert.throws(()=>validateProject({data:s}),/资源/);
 s.models[0].coverScreenshot=null;(s.models[0] as any).coverScreenshotType='audio';
 assert.throws(()=>validateProject({data:s}),/外屏/);
});
