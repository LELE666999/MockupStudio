import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {lensLayers,LensLayers} from '../utils/LensLayers.ts';

const mesh=()=>new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());
test('lens layers keep each phone together and exclude hidden geometry, but never include lights',()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),phone=new T.Group(),rear=new T.Group();
 phone.userData.mockupModelId='a';rear.userData.mockupModelId='b';scene.add(phone,rear,new T.DirectionalLight());
 const a=mesh(),b=mesh(),c=mesh(),hidden=mesh(),invisible=mesh();phone.add(a,b,hidden,invisible);rear.add(c);
 hidden.visible=false;invisible.material.visible=false;
 const layers=lensLayers(scene,camera);
 assert.equal(layers.length,2);assert.deepEqual(layers[0].objects,[a,b]);assert.deepEqual(layers[1].objects,[c]);
 rear.visible=false;assert.equal(lensLayers(scene,camera).length,1);
});
test('stages, text, and editor handles are independent; handles do not acquire depth of field',()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera();
 for(const userData of [{stageId:'stage'},{mockupTextId:'text'},{sceneGizmo:true}]){
  const group=new T.Group();group.userData=userData;group.add(mesh());scene.add(group);
 }
 const layers=lensLayers(scene,camera);assert.equal(layers.length,3);
 assert.deepEqual(layers.map(l=>l.overlay),[false,false,true]);
});
test('studio architecture shares one lens layer without merging the handset or editor controls',()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),architecture=new T.Group(),phone=new T.Group();
 architecture.userData.lensGroupId='studio-architecture';phone.userData.mockupModelId='hero';phone.add(mesh());scene.add(architecture,phone);
 for(let i=0;i<5;i++){const prop=new T.Group();prop.userData.stageId='prop-'+i;prop.add(mesh());architecture.add(prop);}
 const layers=lensLayers(scene,camera);assert.equal(layers.length,2);assert.equal(layers[0].objects.length,5);assert.equal(layers[0].root,architecture);assert.equal(layers[1].root,phone);
});
test('shadow refresh discards only a tiny colour pass and consumes one-shot requests',()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera();scene.add(mesh());scene.children[0].castShadow=true;
 const frame=new T.WebGLRenderTarget(64,32),result=new T.WebGLRenderTarget(64,32),layers=lensLayers(scene,camera),renderer=new LensLayers();
 const targets:number[][]=[];let current=frame,fail=false;
 const gl:any={shadowMap:{enabled:true,autoUpdate:true,needsUpdate:true,type:T.PCFSoftShadowMap},capabilities:{logarithmicDepthBuffer:false},domElement:{addEventListener(){},removeEventListener(){}},setRenderTarget(target:any){current=target;},clear(){},render(object:any){
  if(object===scene){targets.push([current.width,current.height]);if(fail)throw Error('render failed');}
 }};
 const render=()=>renderer.render(gl,scene,camera,layers,frame,result,8,()=>{});
 render();assert.deepEqual(targets,[[1,1],[64,32]]);assert.equal(gl.shadowMap.autoUpdate,true);assert.equal(gl.shadowMap.needsUpdate,false);
 targets.length=0;render();assert.deepEqual(targets,[[64,32]],'stationary scene does not refresh shared shadows');
 targets.length=0;gl.shadowMap.needsUpdate=true;render();assert.deepEqual(targets,[[1,1],[64,32]]);assert.equal(gl.shadowMap.needsUpdate,false);
 gl.shadowMap.needsUpdate=true;fail=true;assert.throws(render,/render failed/);assert.equal(gl.shadowMap.needsUpdate,true,'failed render must retain the request');assert.equal(scene.children[0].visible,true);
 renderer.dispose();frame.dispose();result.dispose();
});
