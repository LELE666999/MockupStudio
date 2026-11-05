import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {getInitialState} from '../types.ts';
import {selectModel,selectedModels,rightOfModels,modelBounds,transformModels} from '../utils/modelSelection.ts';
test('new phones are spaced right; extended selection toggles without losing inspector',()=>{
 const s=getInitialState(),a=s.models[0],b={...a,id:'b'},c={...a,id:'c'};
 b.position=rightOfModels([a],b,a.id);c.position=rightOfModels([a,b],c,b.id);
 assert.ok(modelBounds(b).min.x>modelBounds(a).max.x);assert.ok(modelBounds(c).min.x>modelBounds(b).max.x);
 s.models=[a,b,c];Object.assign(s,selectModel(s,a.id));Object.assign(s,selectModel(s,b.id,true));
 assert.equal(selectedModels(s).length,2);Object.assign(s,selectModel(s,a.id,true));assert.equal(selectedModels(s)[0].id,b.id);
 Object.assign(s,selectModel(s,b.id,true));assert.equal(selectedModels(s).length,0);assert.equal(s.activeModelId,b.id);
});
test('group world transform preserves spacing and leaves unselected phone untouched',()=>{
 const a={...getInitialState().models[0],position:[-2,0,0] as [number,number,number]},b={...a,id:'b',position:[2,0,0] as [number,number,number]},c={...a,id:'c'};
 const delta=new THREE.Matrix4().makeRotationZ(Math.PI/2);delta.setPosition(0,3,0);
 const result=transformModels([a,b,c],[a,b],delta);
 assert.ok(Math.abs(result[0].position[1]-1)<1e-8);assert.ok(Math.abs(result[1].position[1]-5)<1e-8);assert.equal(result[2],c);
 assert.deepEqual(transformModels(result,[a,b],delta),result);
});
