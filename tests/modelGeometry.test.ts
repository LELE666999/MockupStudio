import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { centerModel, rotateModel } from '../utils/modelGeometry.ts';

test('off-origin nested models remain centered after normalization and rotation', () => {
  const root = new THREE.Group(); root.position.set(50,-20,30); root.scale.set(3,2,4);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(20,40,3)); mesh.position.set(8,7,-3); root.add(mesh);
  const pivot = centerModel(root);
  const box = new THREE.Box3().setFromObject(pivot, true);
  assert.ok(box.getCenter(new THREE.Vector3()).length() < 1e-6);
  assert.ok(Math.abs(Math.max(...box.getSize(new THREE.Vector3()).toArray()) - 5) < 1e-6);
  pivot.rotation.set(0.4,1.2,0.6); pivot.updateMatrixWorld(true);
  assert.ok(new THREE.Box3().setFromObject(pivot,true).getCenter(new THREE.Vector3()).length() < 1e-6);
});
test('zero pointer motion preserves a compound model orientation', () => {
  const r: [number,number,number] = [0.4,1.2,-0.7];
  const actual = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotateModel(r,0,0,new THREE.Quaternion())));
  const expected = new THREE.Quaternion().setFromEuler(new THREE.Euler(...r));
  assert.ok(actual.angleTo(expected) < 1e-6);
});
