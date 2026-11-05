import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {makeStage,stageObjects} from '../utils/stagePresets.ts';
import {brickCourtyardGeometry,brickHeightSample,brickLayout,brickCamera} from '../utils/brickStudio.ts';
import {composeStudio,studioDefaults,studioId} from '../utils/studioScenes.ts';
import {getInitialState} from '../types.ts';
import {packProject,unpackProject} from '../utils/projectFiles.ts';
import {placePhone} from '../utils/stagePlacement.ts';
const height=new Uint8Array(readFileSync(new URL('../public/materials/rough_concrete/height.bin',import.meta.url)));

test('scanned height repeats continuously and creates real, bounded, indexed brick relief',()=>{
 assert.equal(height.length,256*256);assert.ok(new Set(height).size>40);
 assert.ok(Math.abs(brickHeightSample(height,.2,.3)-brickHeightSample(height,1.2,-.7))<1e-12);
 const object=stageObjects(makeStage('bricks'))[0],layout=brickLayout(object);
 assert.equal(layout.parts.length,45);assert.ok(layout.joint>.06);
 const geometry=brickCourtyardGeometry(object,height),same=brickCourtyardGeometry(object,height),flat=brickCourtyardGeometry({...object,reliefDepth:0},height);
 assert.ok(geometry.index);assert.ok(geometry.getAttribute('position').count<60000);assert.equal(geometry.userData.scannedHeight,true);
 assert.deepEqual(geometry.getAttribute('position').array,same.getAttribute('position').array);
 assert.notDeepEqual(geometry.getAttribute('position').array,flat.getAttribute('position').array);
 assert.ok(geometry.boundingBox!.max.y<=object.size[1]/2+.000001);
 for(const name of ['position','normal','uv','color'])assert.ok([...geometry.getAttribute(name).array].every(Number.isFinite));
 const positions=geometry.getAttribute('position'),nodes=new Map<string,number>(),ids:number[]=[],edges=new Map<string,number>();
 for(let i=0;i<positions.count;i++){const key=[positions.getX(i),positions.getY(i),positions.getZ(i)].map(v=>Math.round(v*1e5)).join(':');if(!nodes.has(key))nodes.set(key,nodes.size);ids.push(nodes.get(key)!);}
 for(let i=0;i<geometry.index!.count;i+=3){const face=[0,1,2].map(j=>ids[geometry.index!.getX(i+j)]);for(let j=0;j<3;j++){const a=face[j],b=face[(j+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;edges.set(key,(edges.get(key)??0)+1);}}
 assert.ok([...edges.values()].every(count=>count===2),'Every displaced brick stays closed across all UV seams');
 geometry.dispose();same.dispose();flat.dispose();
});
test('composition gives a diagonal flat phone, fits narrow canvases and does not modify media or live objects',()=>{
 const state=getInitialState(),root=new T.Group();root.add(new T.Mesh(new T.BoxGeometry(3,6,.3),new T.MeshBasicMaterial()));root.position.set(3,5,-1);
 const before=root.position.clone(),model={...state.models[0],screenshot:'data:image/png;base64,AQID'},support=stageObjects(makeStage('bricks'))[0];
 const result=composeStudio('bricks',root,model,support,4/3)!;
 assert.equal(result.models.rotation[0],-Math.PI/2);assert.equal(result.models.rotation[2],-.52);assert.equal(result.models.screenshot,model.screenshot);assert.equal(result.models.scale,model.scale);assert.deepEqual(root.position,before);
 for(const pose of ['upright','flat','side'] as const)assert.ok(placePhone(root,model,support,pose)!.position.every(Number.isFinite));
 const bounds=new T.Box3(new T.Vector3(-2,-3,-3),new T.Vector3(2,-2.6,3));
 const wide=brickCamera(bounds,1.5),narrow=brickCamera(bounds,.4),distance=(c:typeof wide)=>new T.Vector3(...c.cameraPosition).distanceTo(new T.Vector3(...c.cameraTarget));
 assert.ok(distance(narrow)>distance(wide));
});
test('brick tint, relief, original media and complete scene survive project save and reopen',async()=>{
 const state=getInitialState();Object.assign(state,studioDefaults('bricks',state));state.stage=makeStage('bricks');state.stage.color='#727b89';state.stage.reliefDepth=.19;
 state.models[0].screenshot='data:image/png;base64,AQID';assert.equal(studioId(state.stage),'bricks');
 const saved=await packProject(state,'炭黑粗砖'),restored=await unpackProject(saved);
 assert.deepEqual(restored.stage,state.stage);assert.deepEqual({...restored.models[0],screenshot:null},{...state.models[0],screenshot:null});assert.deepEqual(restored.lens,state.lens);
 assert.deepEqual(new Uint8Array(await(await fetch(restored.models[0].screenshot!)).arrayBuffer()),new Uint8Array([1,2,3]));
});
