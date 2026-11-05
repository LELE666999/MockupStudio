import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getInitialState} from '../types.ts';
import {packProject,unpackProject} from '../utils/projectFiles.ts';
import {getInterpolatedState} from '../utils/animation.ts';
import {makeStage,patchStage,stageObjects,STAGE_PRESETS} from '../utils/stagePresets.ts';
test('stage is independently saved and retained through old animation keys',async()=>{
 const state=getInitialState();state.stage={enabled:true,position:[0,-4,0],rotation:[0,.2,0],size:[7,2,5],color:'#ded8cd',roughness:.8};
 state.keyframes=[{id:'first',time:0,state:{cameraPosition:[0,0,8]}}];
 assert.deepEqual(getInterpolatedState(0,state.keyframes,state).stage,state.stage);
 const packed=await packProject(state,'展台');const restored=await unpackProject(packed);assert.deepEqual(restored.stage,state.stage);
 const broken=structuredClone(packed);broken.data.stage.size[0]=-1;await assert.rejects(()=>unpackProject(broken),/场景展台/);
});
test('scene combinations keep separate transforms and reject corrupt materials and duplicate IDs',async()=>{
 for(const preset of STAGE_PRESETS){const state=getInitialState();state.stage=makeStage(preset.id);const packed=await packProject(state,preset.name);assert.deepEqual((await unpackProject(packed)).stage,state.stage);}
 const stage=makeStage('glass'),edited=patchStage(stage,'metal',{position:[1,2,3],color:'#ffffff'});
 assert.deepEqual(edited.position,stage.position);assert.deepEqual(stageObjects(edited).find(o=>o.id==='metal')?.position,[1,2,3]);assert.notDeepEqual(stage.items?.[0].position,[1,2,3]);
 const state=getInitialState();state.stage=stage;const broken=await packProject(state,'损坏');broken.data.stage.items[0].id='primary';await assert.rejects(()=>unpackProject(broken),/场景组合/);
});
