import test from 'node:test';
import assert from 'node:assert/strict';
import {MODEL_PRESETS} from '../utils/modelPresets.ts';
import {presetForFile,validatePresetFile} from '../utils/localModelLibrary.ts';

test('full catalog retains both brands while only original meshes are bundled',()=>{
  assert.equal(MODEL_PRESETS.length,10);
  assert.equal(new Set(MODEL_PRESETS.map(p=>p.id)).size,10);
  assert.equal(MODEL_PRESETS.filter(p=>p.name.startsWith('Apple')).length,5);
  assert.deepEqual(MODEL_PRESETS.filter(p=>p.bundled).map(p=>p.id),['mate70','purax']);
  assert.equal(MODEL_PRESETS.find(p=>p.id==='iphoneduo')?.screen,'AppleDuoInnerScreen');
});

test('library installation matches exact basenames across folders and case',()=>{
  assert.equal(presetForFile('C:\\models\\IPHONE-DUO.GLB')?.id,'iphoneduo');
  assert.equal(presetForFile('/old/public/Pura70pro.fbx')?.id,'pura');
  assert.equal(presetForFile('iphone18-pro-max.glb')?.id,'iphone18max');
  assert.equal(presetForFile('my-video.mp4'),undefined);
  assert.equal(presetForFile('huawei-mate70-pro.glb'),undefined);
  assert.equal(presetForFile('iphone-duo.glb.exe'),undefined);
});

test('invalid and truncated files cannot replace a stored preset',async()=>{
  const preset=presetForFile('iphone-duo.glb')!;
  for(const blob of [new Blob([]),new Blob(['<!doctype html>not a model'])])
    await assert.rejects(validatePresetFile(preset,blob),/完整的 GLB/);
  const bytes=new Uint8Array(20),view=new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('glTF'));view.setUint32(4,2,true);view.setUint32(8,20,true);
  await validatePresetFile(preset,new Blob([bytes]));
  view.setUint32(8,100,true);
  await assert.rejects(validatePresetFile(preset,new Blob([bytes])),/完整的 GLB/);
  view.setUint32(8,20,true);view.setUint32(4,1,true);
  await assert.rejects(validatePresetFile(preset,new Blob([bytes])),/完整的 GLB/);
});

test('FBX import accepts the original binary header and ASCII FBX',async()=>{
  const preset=presetForFile('Pura70pro.fbx')!;
  await validatePresetFile(preset,new Blob(['Kaydara FBX Binary  \0\x1a\0',new Uint8Array(32)]));
  await validatePresetFile(preset,new Blob(['; FBX 7.4.0 project file\n']));
  await assert.rejects(validatePresetFile(preset,new Blob(['bad data'])),/有效的 FBX/);
});
