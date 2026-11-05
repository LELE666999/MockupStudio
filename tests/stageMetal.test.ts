import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {stageGeometry,wireLayout} from '../utils/stageGeometry.ts';
import {stageMetalParameters} from '../utils/stageMetal.ts';
import {makeStage,stageObjects} from '../utils/stagePresets.ts';

test('woven steel has smooth round strands, alternating crossings, real holes and two batched surfaces',()=>{
 const object=stageObjects(makeStage('lattice'))[0],geometry=stageGeometry(object),layout=wireLayout(object.size);
 const {innerW,innerD,pitchX,pitchZ,centerY,amplitude}=layout;
 assert.ok(geometry.index);assert.equal(geometry.groups.length,2);
 assert.ok(geometry.index.count/3<150000);assert.ok(geometry.getAttribute('position').count<100000);
 assert.deepEqual(geometry.groups.map(g=>g.materialIndex),[0,1]);
 const p=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');
 assert.ok(Array.from({length:normals.count},(_,i)=>Math.abs(normals.getX(i))>.1&&Math.abs(normals.getY(i))>.1).some(Boolean));
 const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.updateMatrixWorld();
 const at=(i:number,j:number)=>{
  const x=-innerW/2+i*pitchX,z=-innerD/2+j*pitchZ;
  const ray=new T.Raycaster(new T.Vector3(x,4,z),new T.Vector3(0,-1,0));
  return ray.intersectObject(mesh);
 };
 const crossings=at(3,4);assert.ok(crossings.length>=4);
 assert.ok(crossings[0].point.y>centerY+amplitude);
 const next=at(4,4);assert.ok(next.length>=4);
 // The upper strand is X at an even sum and Z at an odd sum.
 assert.ok(Math.abs(next[0].face!.normal.x)<Math.abs(crossings[0].face!.normal.x));
 assert.equal(at(3.5,4.5).length,0);
 assert.ok(Array.from(p.array).every(Number.isFinite));
 geometry.dispose();(mesh.material as T.Material).dispose();
});

test('tiny and large wire panels are bounded without inverted rims or unbounded tessellation',()=>{
 for(const size of [[.1,.1,.1],[1,.1,6],[100,2,100]] as [number,number,number][]){
  const object={...stageObjects(makeStage('lattice'))[0],size},g=stageGeometry(object);
  assert.ok(g.index!.count/3<150000);assert.ok(g.getAttribute('position').count<100000);
  const box=g.boundingBox!;size.forEach((s,i)=>{
   assert.ok(Math.abs(box.min.getComponent(i)+s/2)<1e-4);
   assert.ok(Math.abs(box.max.getComponent(i)-s/2)<1e-4);
  });g.dispose();
 }
});

test('steel is genuinely metallic, uncoated, and retains user colour and roughness controls',()=>{
 const object=stageObjects(makeStage('lattice'))[0];
 for(const roughness of [0,.26,1])for(const part of ['frame','wire'] as const){
  const config=stageMetalParameters({...object,color:'#c0a266',roughness},part);
  assert.equal(config.color,'#c0a266');assert.equal(config.metalness,1);
  assert.equal(config.clearcoat,0);assert.equal(config.transmission,0);
  assert.equal(config.roughness,roughness*(part==='wire'?.78:1));
  assert.ok((config.anisotropy||0)>0);
 }
});
