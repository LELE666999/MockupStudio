import test from 'node:test';
import assert from 'node:assert/strict';
import {publicAsset,usesLocalWorkspace} from '../utils/publicAssets.ts';
test('public assets resolve on Pages subpaths without hijacking media or APIs',()=>{
 const base='https://example.github.io/MockupStudio/';
 for(const p of ['/models/phone.glb','/materials/rough_linen/normal.jpg','/environments/studio.hdr','/scenes/bricks.png','/fonts/NotoSansSC-VF.ttf','/potsdamer_platz_1k.hdr'])assert.equal(publicAsset(p,base),base+p.slice(1));
 for(const url of ['blob:https://example.com/123','data:image/png;base64,AA==','https://elsewhere.test/photo.png','/api/workspace'])assert.equal(publicAsset(url,base),url);
 assert.equal(publicAsset('/scenes/bricks.png','http://localhost:3000/'),'http://localhost:3000/scenes/bricks.png');
});
test('static hosting never expects a local workspace API',()=>{
 assert.equal(usesLocalWorkspace('https:','lele666999.github.io'),false);
 assert.equal(usesLocalWorkspace('file:',''),false);
 for(const host of ['localhost','127.0.0.1','[::1]'])assert.equal(usesLocalWorkspace('http:',host),true);
});
