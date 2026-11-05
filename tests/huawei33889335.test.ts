import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {MODEL_PRESETS} from '../utils/modelPresets.ts';
import {isBodyFinish} from '../utils/modelMaterials.ts';

test('optional downloaded Huawei fixture has a selectable UV screen',{skip:!existsSync(new URL('../public/models/huawei-user-33889335.glb',import.meta.url))},()=>{
 const preset={file:'/models/huawei-user-33889335.glb',screen:'Screen'};
 const bytes=readFileSync(new URL('../public'+preset.file,import.meta.url));
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
 const node=gltf.nodes.find(n=>n.name===preset.screen);
 assert.ok(node&&node.mesh!==undefined,'screen must be its own mesh');
 const screen=gltf.meshes[node.mesh];
 assert.equal(screen.primitives.length,1);
 assert.ok(screen.primitives[0].attributes.TEXCOORD_0!==undefined);
 assert.ok(gltf.buffers.every(b=>!b.uri),'no source-file dependencies');
 assert.ok((gltf.images||[]).every(i=>i.bufferView!==undefined),'textures are embedded');
 assert.ok(bytes.length<12*1024*1024,'single-phone asset budget');
});
test('new Huawei body recolors without tinting the display, camera glass or lettering',()=>{
 const path='/models/huawei-user-33889335.glb';
 assert.equal(isBodyFinish(path,'HuaweiBody'),true);
 assert.equal(isBodyFinish(path,'HuaweiMetal'),true);
 for(const name of ['ScreenContent','CameraGlass','CameraPrint','Lettering','Bezel'])
  assert.equal(isBodyFinish(path,name),false);
});
