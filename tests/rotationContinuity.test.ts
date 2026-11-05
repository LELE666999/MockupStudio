import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {rotateModel} from '../utils/modelGeometry.ts';
import {transformModels} from '../utils/modelSelection.ts';
import {getInitialState} from '../types.ts';

test('viewport drag preserves user-entered turns and the Euler branch beyond 90 degrees',()=>{
 for(const degrees of [[720,120,-450],[-1080,240,810],[360,0,0]]){
  const previous=degrees.map(n=>n*Math.PI/180) as [number,number,number];
  assert.deepEqual(rotateModel(previous,0,0,new THREE.Quaternion()),previous);
  const next=rotateModel(previous,.2,.1,new THREE.Quaternion());
  next.forEach((v,i)=>assert.ok(Math.abs(v-previous[i])<.02,`axis ${i} must not lose turns or jump Euler branches`));
  const expected=new THREE.Quaternion().setFromEuler(new THREE.Euler(...previous));
  expected.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.1*.006));
  expected.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.2*.006));
  const actual=new THREE.Quaternion().setFromEuler(new THREE.Euler(...next));
  assert.ok(Math.abs(actual.dot(expected))>1-1e-12,'stored continuous angles must still describe the correct orientation');
 }
});

test('gizmo translation and group rotation retain each model winding',()=>{
 const base=getInitialState().models[0];base.rotation=[4*Math.PI,2*Math.PI/3,-5*Math.PI/2];
 const shifted=transformModels([base],[base],new THREE.Matrix4().makeTranslation(1,0,0))[0];
 shifted.rotation.forEach((n,i)=>assert.ok(Math.abs(n-base.rotation[i])<1e-10));
 const rotated=transformModels([base],[base],new THREE.Matrix4().makeRotationY(.001))[0];
 rotated.rotation.forEach((n,i)=>assert.ok(Math.abs(n-base.rotation[i])<.01));
});
