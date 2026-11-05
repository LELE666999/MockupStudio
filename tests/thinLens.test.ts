import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,OrthographicCamera,Vector3} from 'three';
import {aperturePoint,offsetLensCamera,lensRadius} from '../utils/thinLens.ts';
test('all aperture viewpoints agree on the focus plane, but not on near/far geometry',()=>{
 for(const camera of [new PerspectiveCamera(45,1.5,.01,100),new OrthographicCamera(-4,4,3,-3,.01,100)]){
  camera.position.set(0,0,10);camera.updateMatrixWorld();const original=new Vector3(1,2,0).project(camera),sample=camera.clone();
  offsetLensCamera(camera,sample,10,.3,-.2);
  assert.ok(new Vector3(1,2,0).project(sample).distanceTo(original)<1e-8);
  assert.ok(new Vector3(1,2,3).project(sample).distanceTo(new Vector3(1,2,3).project(camera))>.005);
  assert.ok(new Vector3(1,2,-3).project(sample).distanceTo(new Vector3(1,2,-3).project(camera))>.005);
  assert.deepEqual(camera.position.toArray(),[0,0,10]);
 }
});
test('iris samples have no pinhole sample and are balanced, aperture scales physically',()=>{
 let x=0,y=0;for(let i=0;i<128;i++){const p=aperturePoint(i);const r=Math.hypot(...p);assert.ok(r>0&&r<=1);x+=p[0];y+=p[1]}
 assert.ok(Math.abs(x)<1e-8&&Math.abs(y)<1e-8);
 assert.equal(lensRadius(50,2),lensRadius(50,1)/2);
 assert.equal(lensRadius(50,1),1); // 6 scene units ≈ a 150 mm phone
});
