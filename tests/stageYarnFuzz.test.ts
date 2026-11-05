import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeStage,stageObjects} from '../utils/stagePresets.ts';
import {knitGeometry} from '../utils/stageKnit.ts';
import {yarnFuzzGeometry} from '../utils/stageYarnFuzz.ts';
test('wool flyaways are a bounded deterministic batch rooted on actual yarn vertices',()=>{
 const yarn=knitGeometry(stageObjects(makeStage('knit'))[0]),a=yarnFuzzGeometry(yarn),b=yarnFuzzGeometry(yarn);
 assert.ok(a.instanceCount>1000&&a.instanceCount<=6000);assert.equal(a.getAttribute('position').count,6);assert.equal(a.index!.count,12);
 assert.deepEqual(a.getAttribute('fiberRoot').array,b.getAttribute('fiberRoot').array);assert.ok(Array.from(a.getAttribute('fiberRoot').array).every(Number.isFinite));
 assert.ok(a.boundingBox!.containsBox(yarn.boundingBox!));a.dispose();b.dispose();yarn.dispose();
});
