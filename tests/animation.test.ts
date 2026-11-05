import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getInterpolatedState} from '../utils/animation.ts';
import {getInitialState} from '../types.ts';
import {packProject,unpackProject} from '../utils/projectFiles.ts';

const frames:any[] = [
  {id:'a',time:0,state:{cameraPosition:[0,0,0]}},
  {id:'b',time:4,state:{cameraPosition:[4,0,0]}}
];
test('continuous mode survives project save and reopen without changing recorded segment curves',async()=>{
  const state=getInitialState();state.motionMode='continuous';
  state.keyframes=frames.map(f=>({...f,easing:'ease-in-out'}));
  const restored=await unpackProject(await packProject(state,'连续动画'));
  assert.equal(restored.motionMode,'continuous');
  assert.equal(restored.keyframes[0].easing,'ease-in-out');
});
test('continuous motion preserves deliberate holds and positive scales without mutating keys',()=>{
  const state=getInitialState();state.motionMode='continuous';
  const keys:any[]=[0,1,2,3].map((time,i)=>({id:String(i),time,state:{models:[{...state.models[0],position:[i===0?0:i===3?4:2,0,0],scale:[.1,10,.2,.1][i]}]}}));
  const original=JSON.stringify(keys);
  for(let t=0;t<=3;t+=.01){const m=getInterpolatedState(t,keys,state).models![0];assert.ok(m.scale>0);if(t>1&&t<2)assert.ok(Math.abs(m.position[0]-2)<1e-10);}
  assert.equal(JSON.stringify(keys),original);
});
test('new unconfigured segments accelerate without slowing at the end',()=>{
  assert.equal(getInterpolatedState(2,frames,{models:[]} as any).cameraPosition?.[0],1);
});
test('color locks preserve live colors at endpoints and between frames without changing recordings',()=>{
  const state=getInitialState();
  Object.assign(state,{bgColor:'#00ff00',bgColorLocked:true});
  Object.assign(state.models[0],{bodyColor:'#00ff00',bodyColorLocked:true});
  const keyframes:any[]=[{id:'a',time:0,easing:'linear',state:{bgColor:'#000000',bgColorLocked:false,models:[{...state.models[0],bodyColor:'#000000',bodyColorLocked:false}]}},{id:'b',time:4,state:{bgColor:'#ffffff',models:[{...state.models[0],bodyColor:'#ffffff'}]}}];
  for(const time of [0,2,4]) {
    const value=getInterpolatedState(time,keyframes,state) as any;
    assert.equal(value.bgColor,'#00ff00');assert.equal(value.models[0].bodyColor,'#00ff00');
    assert.equal(value.bgColorLocked,true);assert.equal(value.models[0].bodyColorLocked,true);
  }
  Object.assign(state,{bgColorLocked:false});Object.assign(state.models[0],{bodyColorLocked:false});
  const unlocked=getInterpolatedState(2,keyframes,state);
  assert.equal(unlocked.bgColor,'#808080');assert.equal(unlocked.models?.[0].bodyColor,'#808080');
  assert.equal(keyframes[0].state.models[0].bodyColor,'#000000');
});
test('linear segments travel equal distances in equal time',()=>{
  const linear=frames.map(f=>({...f,easing:'linear'}));
  assert.deepEqual([1,2,3].map(t=>getInterpolatedState(t,linear,{models:[]} as any).cameraPosition?.[0]),[1,2,3]);
});
test('continuous motion crosses unevenly timed keys with matching nonzero velocity and rests only at endpoints',()=>{
  const state=getInitialState();Object.assign(state,{motionMode:'continuous'});
  const keys:any[]=[0,1,3,5].map((time,i)=>({id:String(i),time,easing:'ease-in-out',state:{motionMode:'segments',cameraPosition:[i*2,i%2,0],models:[{...state.models[0],position:[i*2,i%2,0],rotation:[0,i*.6,0]}]}}));
  const at=(t:number)=>getInterpolatedState(t,keys,state);
  const h=.0001;
  for(const time of [1,3]) {
    const left=at(time-h),mid=at(time),right=at(time+h);
    for(const read of [(s:any)=>s.cameraPosition,(s:any)=>s.models[0].position,(s:any)=>s.models[0].rotation]) {
      const a=read(left),b=read(mid),c=read(right);
      const v=b.map((x:number,i:number)=>(x-a[i])/h),w=c.map((x:number,i:number)=>(x-b[i])/h);
      assert.ok(Math.hypot(...v)>.1);
      v.forEach((x:number,i:number)=>assert.ok(Math.abs(x-w[i])<.002));
    }
  }
  for(const key of keys)assert.deepEqual(at(key.time).cameraPosition,key.state.cameraPosition);
  assert.equal(at(0).motionMode,'continuous');
  assert.ok(Math.abs(at(h).cameraPosition![0]/h)<.002);
  assert.ok(Math.abs((6-at(5-h).cameraPosition![0])/h)<.002);
});
