import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeStage,stageObjects} from '../utils/stagePresets.ts';
import {wovenFabricGeometry,weaveHeight} from '../utils/stageWeave.ts';
test('linen has bounded indexed over-under high-coverage oval yarn with actual depth',()=>{
 const o=stageObjects(makeStage('linen'))[0],g=wovenFabricGeometry(o),p=g.getAttribute('position');
 assert.ok(g.index&&p.count<100000);assert.ok(g.index.count/3<160000);assert.ok(g.boundingBox!.max.y-g.boundingBox!.min.y>.025);
 assert.ok(g.boundingBox!.max.y<=o.size[1]/2+.001);assert.ok(weaveHeight(o)>0);assert.ok([...p.array].every(Number.isFinite));
 assert.ok(g.userData.wovenFabric.radius>g.userData.wovenFabric.verticalRadius*2);assert.ok(g.userData.wovenFabric.coverage>.8);assert.equal(g.userData.wovenFabric.radialSegments,8);
 const flat=wovenFabricGeometry({...o,reliefDepth:0});assert.notDeepEqual(Array.from(p.array),Array.from(flat.getAttribute('position').array));g.dispose();flat.dispose();
});
