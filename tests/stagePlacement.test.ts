import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {getInitialState} from '../types.ts';
import {stageObjects,makeStage} from '../utils/stagePresets.ts';
import {boundsInFrame,placePhone,poseRotation,stageMatrix,stageFloor,stageCamera} from '../utils/stagePlacement.ts';
import {stageGeometry,wireLayout} from '../utils/stageGeometry.ts';
import {packProject,unpackProject} from '../utils/projectFiles.ts';
import {configureProjection} from '../utils/cameraProjection.ts';

test('phone placement follows tilted platforms and exact imported bounds without changing scale or the live scene',()=>{
 const root=new T.Group(),body=new T.Mesh(new T.BoxGeometry(3,6,.24),new T.MeshBasicMaterial()),cameraBump=new T.Mesh(new T.BoxGeometry(.8,.8,.2),new T.MeshBasicMaterial());
 root.add(body,cameraBump);body.position.x=.15;cameraBump.position.set(.3,2,-.2);root.scale.setScalar(1.4);root.position.set(3,4,2);root.rotation.set(.2+Math.PI*4,.4,.1);
 const position=root.position.clone(),rotation=root.rotation.clone(),model=getInitialState().models[0];
 for(const pose of Object.keys(poseRotation) as (keyof typeof poseRotation)[]){
  const support={...stageObjects(makeStage('rocks'))[0],rotation:[.2,.3,-.12] as [number,number,number]};
  const result=placePhone(root,model,support,pose)!;assert.ok(result);
  assert.deepEqual(root.position,position);assert.deepEqual(root.rotation.toArray(),rotation.toArray());assert.equal(root.scale.x,1.4);
  root.position.set(...result.position);root.rotation.set(...result.rotation);
  const bounds=boundsInFrame(root,stageMatrix(support).invert());
  assert.ok(Math.abs(bounds.min.y-support.size[1]/2-.012)<1e-6);
  assert.ok(Math.abs(bounds.getCenter(new T.Vector3()).x)<1e-6);assert.ok(Math.abs(bounds.getCenter(new T.Vector3()).z)<1e-6);
  root.position.copy(position);root.rotation.copy(rotation);
 }
});
test('new stage geometry is deterministic, bounded, and contains real lattice holes',()=>{
 for(const preset of ['rocks','lattice','fluted']){
  for(const object of stageObjects(makeStage(preset))){
   const a=stageGeometry(object),b=stageGeometry(object),p=a.getAttribute('position');
   assert.deepEqual(Array.from(p.array),Array.from(b.getAttribute('position').array));
   assert.ok(p.count<100000);assert.ok(Array.from(p.array).every(Number.isFinite));
   assert.ok(Math.abs(a.boundingBox!.max.y-object.size[1]/2)<1e-5);
   a.dispose();b.dispose();
  }
 }
 const object=stageObjects(makeStage('lattice'))[0],mesh=new T.Mesh(stageGeometry(object),new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.updateMatrixWorld();
 const ray=new T.Raycaster(new T.Vector3(object.size[0]/2-.06,5,0),new T.Vector3(0,-1,0));assert.ok(ray.intersectObject(mesh).length>0);
 const {innerW,innerD,pitchX,pitchZ}=wireLayout(object.size);
 ray.ray.origin.set(-innerW/2+pitchX*1.5,5,-innerD/2+pitchZ*1.5);assert.equal(ray.intersectObject(mesh).length,0);
});
test('material detail, laid-flat poses and complete scenes survive local archives',async()=>{
 const state=getInitialState();state.stage=makeStage('rocks');state.models[0].rotation=[-Math.PI/2,0,0];state.models[0].position=[0,-2.8,0];state.stage.textureScale=2.5;state.stage.detailStrength=.7;
 const loaded=await unpackProject(await packProject(state,'岩台平躺'));
 assert.deepEqual(loaded.stage,state.stage);assert.deepEqual(loaded.models,state.models);
 const broken=await packProject(state,'bad');broken.data.stage!.textureScale=Infinity;await assert.rejects(()=>unpackProject(broken),/场景展台/);
 assert.ok(stageFloor(state.stage)<state.stage.position[1]);
 const view=stageCamera(new T.Box3(new T.Vector3(-6,-5,-5),new T.Vector3(6,3,5)),.5);
 assert.ok(view.cameraPosition.every(Number.isFinite));
});
test('automatic scene framing retains all corners at portrait and landscape canvas ratios',()=>{
 const bounds=new T.Box3(new T.Vector3(-6,-5,-5),new T.Vector3(6,3,5));
 for(const aspect of [.4,1,2])for(const mode of ['perspective','weak','orthographic'] as const){
  const view=stageCamera(bounds,aspect,mode),camera=mode==='orthographic'?new T.OrthographicCamera():new T.PerspectiveCamera();
  configureProjection(camera,mode,view.cameraPosition,view.cameraTarget,aspect);
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
   const p=new T.Vector3(x,y,z).project(camera);assert.ok(Math.abs(p.x)<.85&&Math.abs(p.y)<.85);
  }
 }
});
