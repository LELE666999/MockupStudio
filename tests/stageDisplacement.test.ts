import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {subdivideAndDisplace,needsStageRelief,reliefAmount,STAGE_RELIEF_VERTEX_BUDGET,STAGE_RELIEF_TRIANGLE_BUDGET,stageReliefCacheStats,clearStageReliefCache} from '../utils/stageDisplacement.ts';
import type {StageObject} from '../types.ts';

const stone=(patch:Partial<StageObject>&{reliefDepth?:number}={}):StageObject=>({id:'cut-stone',name:'洞石',position:[0,0,0],rotation:[0,0,0],size:[3,1,2],color:'#d6c6af',roughness:.8,material:'stone',shape:'box',surface:'travertine',detailStrength:.65,textureScale:1,reliefDepth:.15,...patch} as StageObject);
const source=(object:StageObject)=>new T.BoxGeometry(...object.size);

test('stone relief is deterministic, geometrically detailed, bounded and keeps a nominal top support plane',()=>{
 const object=stone(),input=source(object),before=Array.from(input.getAttribute('position').array);
 const a=subdivideAndDisplace(input,object),b=subdivideAndDisplace(input,object);
 assert.notEqual(a,input);assert.deepEqual(Array.from(input.getAttribute('position').array),before);
 assert.deepEqual(Array.from(a.getAttribute('position').array),Array.from(b.getAttribute('position').array));
 assert.equal(a.userData.reliefGeometry,true);assert.ok(a.userData.reliefPasses>=3);
 assert.ok(a.getAttribute('position').count>2000);assert.ok(a.getAttribute('position').count<=STAGE_RELIEF_VERTEX_BUDGET);
 assert.ok(a.index!.count/3<=STAGE_RELIEF_TRIANGLE_BUDGET);assert.ok(Array.from(a.getAttribute('position').array).every(Number.isFinite));
 assert.ok(Math.abs(a.boundingBox!.max.y-object.size[1]/2)<1e-6);
 const p=a.getAttribute('position');let indented=0,deepest=0;
 for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))<object.size[0]/2-.08&&Math.abs(p.getZ(i))<object.size[2]/2-.08&&p.getY(i)>.3){
  const depth=.5-p.getY(i);if(depth>.008)indented++;deepest=Math.max(deepest,depth);
 }
 assert.ok(indented>30);assert.ok(deepest>.03,'vugs must indent real geometry, not merely change shading');
 for(let i=0;i<a.getAttribute('normal').count;i++){
  const n=a.getAttribute('normal');assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-4);
 }input.dispose();a.dispose();b.dispose();
});

test('all UV seam copies are displaced to identical positions and share geometric normals',()=>{
 const object=stone({size:[2,1,2],surface:'mineral'}),result=subdivideAndDisplace(source(object),object);
 const p=result.getAttribute('position'),n=result.getAttribute('normal'),uv=result.getAttribute('uv');
 const copies=new Map<string,{normal:number[];uv:Set<string>}>();let seams=0;
 for(let i=0;i<p.count;i++){
  const key=`${p.getX(i)},${p.getY(i)},${p.getZ(i)}`,entry=copies.get(key),normal=[n.getX(i),n.getY(i),n.getZ(i)],uvKey=`${uv.getX(i)},${uv.getY(i)}`;
  if(entry){assert.deepEqual(entry.normal,normal);entry.uv.add(uvKey);if(entry.uv.size>1)seams++;}
  else copies.set(key,{normal,uv:new Set([uvKey])});
 }
 assert.ok(seams>50,'cut-face UV seams should remain coincident after subdivision');
 // Every geometric edge has exactly two incident faces, including those
 // across duplicated top / side UVs. No displacement cracks or T junctions.
 const edges=new Map<string,number>(),index=result.index!;
 const pointKey=(i:number)=>`${p.getX(i)},${p.getY(i)},${p.getZ(i)}`;
 for(let i=0;i<index.count;i+=3)for(const [a,b] of [[index.getX(i),index.getX(i+1)],[index.getX(i+1),index.getX(i+2)],[index.getX(i+2),index.getX(i)]]){
  const ka=pointKey(a),kb=pointKey(b),key=ka<kb?`${ka}|${kb}`:`${kb}|${ka}`;edges.set(key,(edges.get(key)??0)+1);
 }
 assert.ok([...edges.values()].every(count=>count===2),'shared adaptive edges must form a closed shell');result.dispose();
});

test('distinct stone surfaces sculpt distinct relief and relief amount and density remain editable',()=>{
 const positions:number[][]=[];
 for(const surface of ['mineral','concrete','travertine','slate','terrazzo'] as const){
  const object=stone({surface}),input=source(object),geometry=subdivideAndDisplace(input,object);
  positions.push(Array.from(geometry.getAttribute('position').array));geometry.dispose();input.dispose();
 }
 for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++)assert.notDeepEqual(positions[i],positions[j]);
 const low=stone({reliefDepth:.02}),high=stone({reliefDepth:.25}),dense=stone({textureScale:2});
 const a=subdivideAndDisplace(source(low),low),b=subdivideAndDisplace(source(high),high),c=subdivideAndDisplace(source(dense),dense);
 assert.notDeepEqual(Array.from(a.getAttribute('position').array),Array.from(b.getAttribute('position').array));
 assert.ok(c.getAttribute('position').count>a.getAttribute('position').count);
 a.dispose();b.dispose();c.dispose();
});

test('tiny and large stages are finite and budgeted; smooth, metal, glass, lattice and disabled displacement remain untouched',()=>{
 for(const size of [[.1,.1,.1],[100,.1,100],[100,100,100]] as [number,number,number][]){
  const object=stone({size,reliefDepth:.35}),input=source(object),geometry=subdivideAndDisplace(input,object);
  assert.ok(geometry.getAttribute('position').count<=STAGE_RELIEF_VERTEX_BUDGET);assert.ok(geometry.index!.count/3<=STAGE_RELIEF_TRIANGLE_BUDGET);
  assert.ok(Array.from(geometry.getAttribute('position').array).every(Number.isFinite));assert.ok(geometry.boundingSphere!.radius>0);
  assert.ok(Math.abs(geometry.boundingBox!.max.y-size[1]/2)<1e-5);assert.ok(reliefAmount(object)<=Math.min(...size)*.22+1e-10);
  input.dispose();geometry.dispose();
 }
 for(const patch of [{material:'glass'},{material:'metal'},{material:'fabric'},{shape:'lattice'},{surface:'smooth'},{reliefDepth:0}] as const){
  const object=stone(patch),input=source(object);assert.equal(needsStageRelief(object),false);assert.equal(subdivideAndDisplace(input,object),input);input.dispose();
 }
});

test('depth and detail edits reuse bounded CPU topology but return independently owned attributes',()=>{
 clearStageReliefCache();
 const low=stone({reliefDepth:.02}),high=stone({reliefDepth:.25}),detail=stone({reliefDepth:.25,detailStrength:.15});
 const a=subdivideAndDisplace(source(low),low),b=subdivideAndDisplace(source(high),high),c=subdivideAndDisplace(source(detail),detail);
 assert.equal(a.userData.reliefTopologyCacheHit,false);assert.equal(b.userData.reliefTopologyCacheHit,true);assert.equal(c.userData.reliefTopologyCacheHit,true);
 assert.equal(a.userData.reliefTopologyVersion,b.userData.reliefTopologyVersion);assert.equal(b.userData.reliefTopologyVersion,c.userData.reliefTopologyVersion);
 assert.equal(b.userData.reliefDepthChangesReuseTopology,true);assert.equal(stageReliefCacheStats().builds,1);assert.equal(stageReliefCacheStats().hits,2);
 assert.deepEqual(Array.from(a.index!.array),Array.from(b.index!.array));assert.notEqual(a.index!.array,b.index!.array);
 assert.notEqual(a.getAttribute('uv').array,b.getAttribute('uv').array);assert.notEqual(a.getAttribute('position').array,b.getAttribute('position').array);
 assert.notDeepEqual(Array.from(a.getAttribute('position').array),Array.from(b.getAttribute('position').array));assert.notDeepEqual(Array.from(b.getAttribute('position').array),Array.from(c.getAttribute('position').array));
 const expected=Array.from(b.getAttribute('position').array),lowExpected=Array.from(a.getAttribute('position').array);
 a.getAttribute('position').setXYZ(0,999,999,999);a.index!.setX(0,999);a.getAttribute('uv').setXY(0,999,999);a.dispose();
 assert.deepEqual(Array.from(b.getAttribute('position').array),expected);
 const again=subdivideAndDisplace(source(low),low);assert.equal(again.userData.reliefTopologyCacheHit,true);assert.deepEqual(Array.from(again.getAttribute('position').array),lowExpected);assert.notEqual(again.index!.getX(0),999);
 const changed=source(low);changed.getAttribute('position').setX(0,changed.getAttribute('position').getX(0)+.025);
 const edited=subdivideAndDisplace(changed,low);assert.equal(edited.userData.reliefTopologyCacheHit,false);assert.notEqual(edited.userData.reliefTopologyVersion,b.userData.reliefTopologyVersion);
 for(let i=0;i<8;i++){
  const object=stone({id:`cache-limit-${i}`}),input=source(object),geometry=subdivideAndDisplace(input,object);
  const stats=stageReliefCacheStats();assert.ok(stats.entries<=stats.maxEntries);assert.ok(stats.vertices<=stats.maxVertices);input.dispose();geometry.dispose();
 }
 b.dispose();c.dispose();again.dispose();changed.dispose();edited.dispose();clearStageReliefCache();assert.equal(stageReliefCacheStats().entries,0);
});
