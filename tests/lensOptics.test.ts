import {test} from 'node:test';
import assert from 'node:assert/strict';
import {focusBlurScale} from '../utils/lensOptics.ts';
test('thin lens blur respects aperture and focus distance, measured in output pixels',()=>{
 const scale=focusBlurScale(10,2,50,24,1000);
 assert.ok(Math.abs(scale-27.4122807)<.00001);
 assert.equal(focusBlurScale(10,4,50,24,1000),scale/2);
 assert.equal(focusBlurScale(10,2,50,24,2000),scale*2);
 assert.ok(focusBlurScale(20,2,50,24,1000)<scale);
 assert.ok(Number.isFinite(focusBlurScale(.01,1,50,24,1000)));
});
