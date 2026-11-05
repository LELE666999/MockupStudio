import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {makeStage,stageObjects} from '../utils/stagePresets.ts';
import {stageGeometry} from '../utils/stageGeometry.ts';
import {trayHeight,satinHeight,microWeavePixels} from '../utils/groovedStudio.ts';
import {composeStudio,groovedCamera} from '../utils/studioScenes.ts';
import {getInitialState} from '../types.ts';
import {packProject,unpackProject} from '../utils/projectFiles.ts';
import {placePhone} from '../utils/stagePlacement.ts';

test('tray has four genuine concave rounded channels and an unbroken phone support area',()=>{
 const tray=stageObjects(makeStage('grooved'))[0],[w,h,d]=tray.size;
 for(let i=0;i<4;i++){const x=w*(.005+i*.12);assert.ok(trayHeight(tray,x,0)<h/2-.2);assert.equal(trayHeight(tray,x,d*.46),h/2);}
 for(const x of [-w*.36,-w*.24,-w*.12])for(const z of [-d*.3,0,d*.3])assert.equal(trayHeight(tray,x,z),h/2);
 const a=stageGeometry(tray),b=stageGeometry(tray);assert.ok(a.index);assert.ok(a.getAttribute('position').count<30000);assert.deepEqual(a.getAttribute('position').array,b.getAttribute('position').array);assert.ok([...a.getAttribute('normal').array].every(Number.isFinite));a.dispose();b.dispose();
});
test('satin has actual macro folds outside a quiet support area, with finite indexed normals',()=>{
 const sheet=stageObjects(makeStage('grooved'))[1],geo=stageGeometry(sheet),box=geo.boundingBox!;
 assert.equal(satinHeight(sheet,0,0),-sheet.size[1]*.35);assert.ok(box.max.y-box.min.y>.6);assert.ok(geo.index);assert.ok(geo.getAttribute('position').count<30000);assert.ok([...geo.getAttribute('position').array].every(Number.isFinite));geo.dispose();
});
test('neutral weave contains coherent height normals, colour and roughness, not a baked blue image',()=>{
 const maps=microWeavePixels(128);assert.deepEqual(maps,microWeavePixels(128));
 for(const key of ['color','normal','roughness'] as const)assert.ok(new Set(maps[key]).size>8);
 for(let i=0;i<maps.color.length;i+=4)assert.equal(maps.color[i],maps.color[i+1]);
});
test('flat hero sits above the left support and camera presets preserve media, turns and source pose',()=>{
 const root=new T.Group();root.add(new T.Mesh(new T.BoxGeometry(3,6,.3),new T.MeshBasicMaterial()));root.position.set(3,5,-1);
 const source=root.position.clone(),state=getInitialState(),model={...state.models[0],screenshot:'data:image/png;base64,AQID'},tray=stageObjects(makeStage('grooved'))[0];
 const pose=composeStudio('grooved',root,model,tray,4/3)!;assert.equal(pose.models.rotation[0],-Math.PI/2);assert.ok(pose.models.position[0]<-2);assert.equal(pose.models.screenshot,model.screenshot);assert.deepEqual(root.position,source);
 const box=new T.Box3(new T.Vector3(-4,-3,-3),new T.Vector3(-1,-2.7,3));
 const views=['angled','overhead','close'].map(v=>groovedCamera(box,4/3,v as any));assert.equal(new Set(views.map(v=>JSON.stringify(v.cameraPosition))).size,3);assert.ok(views.every(v=>v.cameraPosition.every(Number.isFinite)));
});
test('tray, purple satin, editable physical detail and multicolour rig survive a complete archive',async()=>{
 const state=getInitialState();state.stage=makeStage('grooved');state.stage.detailStrength=.72;state.stage.textureScale=2;const packed=await packProject(state,'蓝紫凹槽');assert.deepEqual((await unpackProject(packed)).stage,state.stage);
});
test('manual upright, flat and side placement continue using the tray’s left support instead of a channel',()=>{
 const root=new T.Group();root.add(new T.Mesh(new T.BoxGeometry(3,6,.3),new T.MeshBasicMaterial()));const model=getInitialState().models[0],tray=stageObjects(makeStage('grooved'))[0];
 for(const pose of ['flat','upright','side'] as const){const placed=placePhone(root,model,tray,pose)!;assert.ok(placed.position[0]<-2);assert.ok(placed.position.every(Number.isFinite));}
});
