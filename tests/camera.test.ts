import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cameraExposure} from '../utils/camera.ts';
import {DEFAULT_LENS,animatedLens} from '../utils/focus.ts';
import {getInitialState} from '../types.ts';
import {packProject,unpackProject,validateProject} from '../utils/projectFiles.ts';
import {Vector3,PerspectiveCamera,OrthographicCamera} from 'three';
import {configureProjection,pixelWorldSize} from '../utils/cameraProjection.ts';
test('projection modes preserve target-plane framing while orthographic removes depth scaling',()=>{
  const widths:number[]=[];
  for(const mode of ['perspective','weak','orthographic'] as const){
    const camera=mode==='orthographic'?new OrthographicCamera():new PerspectiveCamera();
    configureProjection(camera,mode,[0,0,8],[0,0,0],2);
    widths.push(new Vector3(1,0,0).project(camera).x);
    assert.ok(Number.isFinite(pixelWorldSize(camera,new Vector3(),500)));
    const front=new Vector3(1,0,2).project(camera).x;
    if(mode==='orthographic')assert.equal(front,widths.at(-1));
    else assert.ok(front>widths.at(-1)!);
  }
  assert.ok(Math.max(...widths)-Math.min(...widths)<1e-12);
});
test('manual shutter and ISO affect exposure in stops; auto keeps aperture changes neutral',()=>{
 assert.equal(cameraExposure({...DEFAULT_LENS,aperture:8}),1);
 assert.equal(cameraExposure({...DEFAULT_LENS,exposureMode:'manual',shutter:1/30,iso:100}),2);
 assert.equal(cameraExposure({...DEFAULT_LENS,exposureMode:'manual',shutter:1/60,iso:200}),2);
 assert.equal(cameraExposure({...DEFAULT_LENS,exposureMode:'manual',shutter:1/60,iso:100,aperture:5.6}),.25);
});
test('camera settings persist and interpolate with keyframes; invalid shutter rejected',async()=>{
 const state=getInitialState();state.lens={...DEFAULT_LENS,exposureMode:'manual',shutter:1/125,iso:400};
 const doc=await packProject(state,'相机');assert.deepEqual((await unpackProject(doc)).lens,state.lens);
 const frames:any[]=[{time:0,easing:'linear',state:{lens:{...state.lens,shutter:1/100,iso:100}}},{time:2,state:{lens:{...state.lens,shutter:1/50,iso:400}}}];
 assert.equal(animatedLens(1,frames,state).shutter,.015);
 (doc.data as any).lens.shutter=0;assert.throws(()=>validateProject(doc));
});
