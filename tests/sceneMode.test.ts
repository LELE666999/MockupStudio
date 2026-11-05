import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getInitialState} from '../types.ts';
import {switchSceneMode} from '../utils/sceneMode.ts';
import {makeStage} from '../utils/stagePresets.ts';
import {packProject,unpackProject} from '../utils/projectFiles.ts';
test('leaving a scene resets the camera to the initial front view without reverting phone edits',async()=>{
 const state=getInitialState();state.cameraPosition=[1,2,12];state.cameraTarget=[0,1,0];state.projectionMode='orthographic';
 const entered={...state,...switchSceneMode(state,true)};entered.stage=makeStage('glass');entered.activeModelId=null;entered.activeStageId='primary';entered.models[0].bodyColor='#ff0000';
 const loaded=await unpackProject(await packProject(entered,'场景'));
 const restored={...loaded,...switchSceneMode(loaded,false)};
 assert.deepEqual(restored.cameraPosition,[0,0,8]);assert.deepEqual(restored.cameraTarget,[0,0,0]);assert.equal(restored.activeModelId,state.models[0].id);assert.equal(restored.activeStageId,null);assert.equal(restored.showGizmo,state.showGizmo);assert.equal(restored.models[0].bodyColor,'#ff0000');assert.equal(restored.projectionMode,'perspective');assert.equal(restored.stage?.enabled,false);
});
test('older scene projects without a previous view return to normal phone editing',()=>{
 const state=getInitialState();state.stage=makeStage('stairs');state.activeModelId=null;state.activeStageId='primary';
 const result=switchSceneMode(state,false);assert.equal(result.activeModelId,state.models[0].id);assert.deepEqual(result.cameraPosition,getInitialState().cameraPosition);
});
