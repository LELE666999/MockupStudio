import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getInitialState} from '../types.ts';
import {replaceScreen} from '../utils/replaceScreen.ts';
test('replacement removes stale blend and updates matching clip in keys, preserving other phones and clips',()=>{
 const s=getInitialState(),a=s.models[0];a.screenshot='old';a.screenshotPrev='older';a.screenshotMix=0;
 const b={...a,id:'other'};s.models.push(b);
 s.keyframes=[{id:'a',time:0,state:{models:structuredClone(s.models)}},{id:'b',time:1,state:{models:[{...a,screenshot:'different',screenshotPrev:'old'}]}}];
 const updated=replaceScreen(s,a.id,{screenshot:'new',screenshotType:'video'});
 assert.equal(updated.models![0].screenshot,'new');assert.equal(updated.models![0].screenshotPrev,null);assert.equal(updated.models![0].screenshotMix,1);
 assert.equal(updated.models![1],b);assert.equal(updated.keyframes![0].state.models![0].screenshot,'new');
 assert.equal(updated.keyframes![1].state.models![0].screenshot,'different');assert.equal(updated.keyframes![1].state.models![0].screenshotPrev,'new');
});
