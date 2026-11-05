import * as THREE from 'three';
import {continuousRotation} from './continuousRotation.ts';

/** Keep all imported transforms intact; normalize a parent, then center its result. */
export function centerModel(object: THREE.Object3D, targetSize = 5): THREE.Group {
  const scaled = new THREE.Group();
  scaled.add(object);
  const bounds = new THREE.Box3().setFromObject(scaled, true);
  const size = bounds.getSize(new THREE.Vector3());
  const max = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(max) || max <= 0) throw new Error('模型不包含可显示的几何体');
  scaled.scale.setScalar(targetSize / max);
  scaled.updateMatrixWorld(true);
  bounds.setFromObject(scaled, true);
  scaled.position.copy(bounds.getCenter(new THREE.Vector3())).negate();
  const pivot = new THREE.Group();
  pivot.add(scaled);
  pivot.updateMatrixWorld(true);
  return pivot;
}

export function rotateModel(rotation: [number,number,number], dx: number, dy: number, camera: THREE.Quaternion): [number,number,number] {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation, 'XYZ'));
  const right = new THREE.Vector3(1,0,0).applyQuaternion(camera);
  q.premultiply(new THREE.Quaternion().setFromAxisAngle(right, dy * 0.006));
  q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), dx * 0.006));
  return continuousRotation(q,rotation);
}
