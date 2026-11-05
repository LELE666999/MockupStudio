import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,OrthographicCamera,Vector3} from 'three';
import {getInitialState} from '../types.ts';
import {cameraView,panCamera,orbitCamera} from '../utils/cameraView.ts';
import {configureProjection,cameraPositionFromView,projectionDistanceScale} from '../utils/cameraProjection.ts';
import {packProject,unpackProject} from '../utils/projectFiles.ts';
import {getInterpolatedState} from '../utils/animation.ts';

const rig={cameraPosition:[8,5,12] as [number,number,number],cameraTarget:[0,-1,0] as [number,number,number]};
function close(a:number[],b:number[]){a.forEach((value,i)=>assert.ok(Math.abs(value-b[i])<1e-10,`${value} != ${b[i]}`));}
test('camera X/Y pan translates both camera and target, preserving orientation without moving objects',()=>{
 for(const axis of [0,1] as const){
  const before=structuredClone(rig),patch=panCamera(rig,axis,15);
  const after={...rig,...patch};
  assert.equal(after.cameraPosition[axis],15);
  assert.equal(after.cameraTarget[axis],rig.cameraTarget[axis]+15-rig.cameraPosition[axis]);
  close(Object.values(cameraView(after)),Object.values(cameraView(rig)));
  assert.deepEqual(rig,before);assert.deepEqual(Object.keys(patch),['cameraPosition','cameraTarget']);
 }
 assert.deepEqual(panCamera(rig,0,NaN),{});
});
test('orbit, pitch and distance share a single camera rig and reject nonfinite inputs',()=>{
 const next={...rig,...orbitCamera(rig,{yaw:135,pitch:30,distance:22})};
 close(Object.values(cameraView(next)),[135,30,22]);
 assert.deepEqual(next.cameraTarget,rig.cameraTarget);
 const capped={...rig,...orbitCamera(rig,{pitch:120,distance:.1})};
 close(Object.values(cameraView(capped)),[cameraView(rig).yaw,85,2]);
 assert.deepEqual(orbitCamera(rig,{yaw:Infinity}),{});
 assert.deepEqual(cameraView({cameraPosition:[0,0,0],cameraTarget:[0,0,0]}),{yaw:0,pitch:0,distance:8});
});
test('physical orbit coordinates round-trip in every projection without weak-perspective distance drift',()=>{
 for(const mode of ['perspective','weak','orthographic'] as const){
  const camera=mode==='orthographic'?new OrthographicCamera():new PerspectiveCamera();
  let position=rig.cameraPosition;
  for(let i=0;i<20;i++){
   configureProjection(camera,mode,position,rig.cameraTarget,1.5);
   position=cameraPositionFromView(camera.position.toArray(),rig.cameraTarget,mode,camera.zoom);
  }
  close(position,rig.cameraPosition);
  const zoom=mode==='orthographic'?2:1,scaled=cameraPositionFromView(camera.position.toArray(),rig.cameraTarget,mode,zoom);
  close(scaled,rig.cameraPosition.map((v,i)=>rig.cameraTarget[i]+(v-rig.cameraTarget[i])/zoom));
 }
 assert.ok(projectionDistanceScale('weak')>2);assert.equal(projectionDistanceScale('perspective'),1);
 const distant=new PerspectiveCamera();configureProjection(distant,'weak',[0,0,1000],[0,0,0],1);
 assert.ok(new Vector3().project(distant).z<1,'a distant weak-perspective rig must not clip the composition');
});
test('camera inspector changes survive project files and keyframe animation',async()=>{
 const state=getInitialState();Object.assign(state,rig,panCamera(rig,0,3));
 const end={...state,...orbitCamera(state,{yaw:60,pitch:35,distance:18})};
 const frames=[{id:'start',time:0,easing:'linear' as const,state:{cameraPosition:state.cameraPosition,cameraTarget:state.cameraTarget}},{id:'end',time:2,easing:'linear' as const,state:{cameraPosition:end.cameraPosition,cameraTarget:end.cameraTarget}}];
 state.keyframes=frames;
 const restored=await unpackProject(await packProject(state,'相机视角检查'));
 assert.deepEqual(restored.cameraPosition,state.cameraPosition);assert.deepEqual(restored.cameraTarget,state.cameraTarget);assert.deepEqual(restored.keyframes,frames);
 const middle=getInterpolatedState(1,frames,{...state,motionMode:'segments'});
 close(middle.cameraPosition!,state.cameraPosition.map((v,i)=>(v+end.cameraPosition[i])/2));
 close(middle.cameraTarget!,state.cameraTarget);
});
