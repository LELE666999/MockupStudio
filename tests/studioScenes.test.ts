import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {getInitialState} from '../types.ts';
import {makeStage,stageObjects} from '../utils/stagePresets.ts';
import {stageGeometry} from '../utils/stageGeometry.ts';
import {studioId,studioDefaults,studioLighting,studioLightColors,studioBackgroundPixels,composeStudio,STUDIO_IDS} from '../utils/studioScenes.ts';
import {packProject,unpackProject} from '../utils/projectFiles.ts';
test('minimal studios have deterministic clean geometry and distinct backgrounds, without stone displacement',()=>{
 for(const id of STUDIO_IDS){
  const stage=makeStage(id);assert.equal(studioId(stage),id);assert.equal(studioId({...stage,enabled:false}),null);
  for(const object of stageObjects(stage)){
   const g=stageGeometry(object);assert.equal(g.userData.reliefGeometry,undefined);assert.ok(g.getAttribute('position').count<(id==='bricks'?60000:30000));assert.ok([...g.getAttribute('position').array].every(Number.isFinite));g.dispose();
  }
  const a=studioBackgroundPixels(id,64);assert.deepEqual(a,studioBackgroundPixels(id,64));assert.equal(a.length,64*64*4);assert.ok(new Set(a).size>8);
 }
});
test('composition adapts to imported bounds and canvas, preserving media, scale and live objects',()=>{
 const root=new T.Group();root.add(new T.Mesh(new T.BoxGeometry(3,6,.3),new T.MeshBasicMaterial()));root.scale.setScalar(1.2);root.position.set(8,5,4);root.rotation.set(.1,.2,.3);
 const before=root.position.clone(),rotation=root.rotation.clone(),model={...getInitialState().models[0],scale:1.2,screenshot:'data:image/png;base64,AQID'};
 for(const id of STUDIO_IDS){const stage=stageObjects(makeStage(id))[0],wide=composeStudio(id,root,model,stage,1.5)!,narrow=composeStudio(id,root,model,stage,.4)!;
  assert.equal(wide.models.screenshot,model.screenshot);assert.equal(wide.models.scale,1.2);assert.deepEqual(root.position,before);assert.deepEqual(root.rotation.toArray(),rotation.toArray());
  assert.ok(wide.cameraPosition.every(Number.isFinite));assert.ok(new T.Vector3(...narrow.cameraPosition).distanceTo(new T.Vector3(...narrow.cameraTarget))>=new T.Vector3(...wide.cameraPosition).distanceTo(new T.Vector3(...wide.cameraTarget)));
 }
});
test('studio background, lighting, real reflection and composition survive complete project files',async()=>{
 for(const id of STUDIO_IDS){const state=getInitialState();Object.assign(state,studioDefaults(id,state));state.stage=makeStage(id);state.models[0].screenshot='data:image/png;base64,AQID';const result=await unpackProject(await packProject(state,id));assert.deepEqual(result.stage,state.stage);assert.deepEqual(result.lens,state.lens);assert.equal(result.bgColor,state.bgColor);assert.equal(result.ambientIntensity,state.ambientIntensity);}
 const state=getInitialState();state.stage=makeStage('gallery');const archive=await packProject(state,'invalid');archive.data.stage!.reflectivity=2;await assert.rejects(()=>unpackProject(archive),/场景展台/);
});
test('single and multicolour lighting drive distinct backgrounds and real studio light colours',()=>{
 const stage=makeStage('midnight');assert.equal(studioLighting(stage).mode,'single');
 stage.studioLighting={mode:'single',colors:['#ff3355','#59edb2','#5555ff']};
 const light=studioLightColors(stage);assert.equal(light[0],'#ff3355');assert.notEqual(light[1],light[0]);
 const red=studioBackgroundPixels('midnight',64,stage.studioLighting);
 stage.studioLighting.colors[0]='#3355ff';assert.notDeepEqual(studioBackgroundPixels('midnight',64,stage.studioLighting),red);
 stage.studioLighting.mode='multicolor';assert.deepEqual(studioLightColors(stage),stage.studioLighting.colors);
 assert.notDeepEqual(studioBackgroundPixels('midnight',64,stage.studioLighting),studioBackgroundPixels('midnight',64,{...stage.studioLighting,mode:'single'}));
});
test('custom studio colours persist with assets, and malformed colour records cannot enter a project',async()=>{
 const state=getInitialState();state.stage=makeStage('midnight');state.stage.studioLighting={mode:'multicolor',colors:['#346cff','#ed6ed8','#ffac62']};
 const archive=await packProject(state,'三色灯光');assert.deepEqual((await unpackProject(archive)).stage,state.stage);
 for(const invalid of [{mode:'random',colors:['#346cff','#ed6ed8','#ffac62']},{mode:'single',colors:['#346cff']},{mode:'multicolor',colors:['#gggggg','#ed6ed8','#ffac62']}]){archive.data.stage!.studioLighting=invalid as any;await assert.rejects(()=>unpackProject(archive),/棚景灯光/);}
});
