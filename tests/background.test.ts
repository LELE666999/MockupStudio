import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getInitialState} from '../types.ts';
import {getInterpolatedState} from '../utils/animation.ts';
import {packProject,unpackProject} from '../utils/projectFiles.ts';
test('global background survives old keyframes and video type roundtrips with embedded data',async()=>{
 const state=getInitialState();state.keyframes=[{id:'a',time:0,easing:'linear',state:{bgImage:null,bgColor:'#000000'}},{id:'b',time:1,easing:'linear',state:{bgImage:null,bgColor:'#ffffff'}}];
 state.bgImage='data:video/mp4;base64,AAAA';state.bgMediaType='video';state.bgBlur=3;
 for(const t of [0,.5,1]){const result=getInterpolatedState(t,state.keyframes,state);assert.equal(result.bgImage,state.bgImage);assert.equal(result.bgMediaType,'video');assert.equal(result.bgBlur,3);}
 const packed=await packProject(state,'视频背景');const restored=await unpackProject(packed);assert.equal(restored.bgMediaType,'video');assert.ok(restored.bgImage);
});
