import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isBodyFinish,isAppleModel} from '../utils/modelMaterials.ts';
test('Apple body color targeting excludes screen and optics and unknown imported models',()=>{
 assert.equal(isBodyFinish('/models/iphone18-pro-max.glb','vUgmkmbQjXTaqEc.001'),true);
 assert.equal(isBodyFinish('/models/iphone-duo.glb','pOHYMArkYgGMSvE'),true);
 assert.equal(isBodyFinish('/models/iphone17-pro.glb','nwfiSfJrPZRLBAj'),true);
 assert.equal(isBodyFinish('/models/iphone18-pro.glb','KSynYqGGNGMUJti'),false);
 assert.equal(isBodyFinish('/models/iphone-duo.glb','AfMuGuGyrRdWvGa'),false);
 assert.equal(isBodyFinish('blob:uploaded','pOHYMArkYgGMSvE'),false);
});
test('all Apple exterior trim finishes recolor, including Duo hinge, buttons and straight-phone port shells',()=>{
 assert.equal(isAppleModel('/models/iphone-duo.glb'),true);assert.equal(isAppleModel('/models/iphone17-pro-max.glb'),true);
 for(const name of ['isnmyjbXNQZlHGY','TJvImvzeubEEDzE','lncqqAffdcKCPyc','oEGeLQAOjZgdIFG'])assert.equal(isBodyFinish('/models/iphone-duo.glb',name),true);
 for(const name of ['ooxVuxObmmqIeuh','PJgHvfOhNXkxvzq','VXTclbUnoLmmPoD','awYxKfiOpRgQIxD'])assert.equal(isBodyFinish('iphone17-pro.glb',name),true);
 for(const name of ['DHVeopyQCCjAHKQ','AfMuGuGyrRdWvGa','VKnKoHfJjSdRybB','ZdlykFGlVXrMgnF'])assert.equal(isBodyFinish('/models/iphone-duo.glb',name),false);
});
