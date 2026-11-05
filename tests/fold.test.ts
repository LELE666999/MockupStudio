import {test} from 'node:test';
import assert from 'node:assert/strict';
import {foldPoint,foldScreen,FOLD_STRIP} from '../utils/foldGeometry.ts';
import {getInitialState} from '../types.ts';
import {getInterpolatedState} from '../utils/animation.ts';
import {packProject,unpackProject,validateProject} from '../utils/projectFiles.ts';

test('fold hinges remain symmetric, tangent and continuous from closed to flat',()=>{
 for(const angle of [0,15,90,135,180]){
  const [x,z]=foldPoint(2,angle),[lx,lz]=foldPoint(-2,angle);
  assert.equal(x,-lx);assert.equal(z,lz);
  const a=foldPoint(FOLD_STRIP/2-1e-6,angle),b=foldPoint(FOLD_STRIP/2+1e-6,angle);
  assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<3e-6);
 }
 assert.deepEqual(foldPoint(2,180),[2,0]);
 assert.ok(foldPoint(2,0)[0]<.06,'closed halves must meet without overlapping');
});
test('a single inner screen retains identical UVs across every fold angle',()=>{
 const flat=foldScreen(5.9,4.2,.15,180,.125),closed=foldScreen(5.9,4.2,.15,0,.125);
 assert.deepEqual(flat.attributes.uv.array,closed.attributes.uv.array);
 assert.ok([...closed.attributes.position.array].every(Number.isFinite));
 assert.ok([...closed.attributes.normal.array].every(Number.isFinite));
 flat.dispose();closed.dispose();
});
test('fold angle animates, embeds video and roundtrips in the same project',async()=>{
 const state=getInitialState();Object.assign(state.models[0],{simpleStyle:'fold',foldAngle:0,width:6,height:4.324,screenshot:'data:video/mp4;base64,AA==',screenshotType:'video'});
 state.keyframes=[{id:'a',time:0,easing:'linear',state:{models:structuredClone(state.models)}},{id:'b',time:3,state:{models:state.models.map(m=>({...m,foldAngle:180}))}}];
 for(const motionMode of ['segments','continuous'] as const){
  state.motionMode=motionMode;
  const restored=await unpackProject(await packProject(state,'fold'));
  assert.equal(restored.models[0].simpleStyle,'fold');
  assert.equal(restored.keyframes[1].state.models![0].foldAngle,180);
  assert.equal(getInterpolatedState(1.5,restored.keyframes,restored).models![0].foldAngle,90);
  assert.equal((await(await fetch(restored.models[0].screenshot!)).blob()).size,1);
 }
 const invalid=structuredClone(state);invalid.models[0].foldAngle=181;
 assert.throws(()=>validateProject({data:invalid}),/展开角度/);
});
