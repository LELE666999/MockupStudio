import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {readFileSync} from 'node:fs';
import {RGBELoader} from 'three/examples/jsm/loaders/RGBELoader.js';
import {getInitialState} from '../types.ts';
import {makeStage,STAGE_PRESETS} from '../utils/stagePresets.ts';
import {STUDIO_IDS} from '../utils/studioScenes.ts';
import {HDR_DEFAULTS,studioEnvironment,showsStudioHDR,environmentBackdrop} from '../utils/studioEnvironment.ts';
import {packProject,unpackProject} from '../utils/projectFiles.ts';

test('chrome uses a bundled real unclipped HDR, but its visible panorama is safely display-mapped',()=>{
 const bytes=readFileSync(new URL('../public/environments/brown_photostudio_01_2k.hdr',import.meta.url)),parsed=new RGBELoader().setDataType(T.FloatType).parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 const source=new T.DataTexture(parsed.data,parsed.width,parsed.height,T.RGBAFormat,T.FloatType);
 source.flipY=true; // RGBELoader.load sets this after parse.
 assert.equal(parsed.width,2048);assert.equal(parsed.height,1024);
 let maximum=0;for(let i=0;i<parsed.data.length;i+=4)maximum=Math.max(maximum,parsed.data[i]);assert.ok(maximum>10,'real lighting must retain HDR window values');
 const before=parsed.data.slice(),backdrop=environmentBackdrop(source);
 assert.deepEqual(source.image.data,before);assert.equal(backdrop.mapping,T.EquirectangularReflectionMapping);assert.equal(backdrop.colorSpace,T.LinearSRGBColorSpace);assert.equal(backdrop.flipY,source.flipY,'visible room and lighting must not be vertically mirrored');
 for(const value of backdrop.image.data as Float32Array)assert.ok(Number.isFinite(value)&&value>=0&&value<=1);source.dispose();backdrop.dispose();
});
test('chrome HDR only replaces its own default background, not user images, video, transparency or colours',()=>{
 const state=getInitialState();state.stage=makeStage('chrome');state.bgColor='#bca78e';assert.equal(showsStudioHDR(state),true);assert.deepEqual(studioEnvironment(state.stage),HDR_DEFAULTS);
 for(const patch of [{bgImage:'data:image/png;base64,AQID'},{bgColor:'transparent'},{bgColor:'#112233'},{stage:makeStage('grooved')}])assert.equal(showsStudioHDR({...state,...patch}),false);
 assert.equal(state.stage.items!.length,0,'no opaque backdrop plane below the grid');
});
test('HDR controls survive archives and reject nonfinite or unsafe parameters',async()=>{
 const state=getInitialState();state.stage=makeStage('chrome');state.stage.studioEnvironment={rotation:-1.4,blur:.45,intensity:1.25};
 const archive=await packProject(state,'HDR');assert.deepEqual((await unpackProject(archive)).stage,state.stage);
 for(const patch of [{rotation:Infinity},{rotation:4},{blur:1},{intensity:0}]){const invalid=structuredClone(archive);Object.assign(invalid.data.stage!.studioEnvironment!,patch);await assert.rejects(()=>unpackProject(invalid),/HDR/);}
});
test('old chrome projects lose only the superseded solid backdrop, not other edited props',async()=>{
 const state=getInitialState();state.stage=makeStage('chrome');const object={...makeStage('single'),id:'warm-floor',name:'旧地面'};
 state.stage.items=[object,{...object,id:'custom',name:'用户展台'}];const restored=await unpackProject(await packProject(state,'旧网架'));
 assert.deepEqual(restored.stage!.items,[state.stage.items[1]]);assert.deepEqual(restored.models,state.models);
});
test('retired hand scenes disappear, while old archives retain phone media and keyframes',async()=>{
 assert.ok(!STAGE_PRESETS.some(p=>p.id==='handheld'));assert.ok(!STUDIO_IDS.includes('handheld' as any));
 const state=getInitialState();state.models[0].screenshot='data:image/png;base64,AQID';state.stage={...makeStage('single'),preset:'handheld',shape:'hand-grip' as any};
 state.keyframes=[{id:'a',time:0,state:{stage:structuredClone(state.stage),models:structuredClone(state.models)}}];
 const restored=await unpackProject(await packProject(state,'旧存档'));assert.equal(restored.stage!.enabled,false);assert.equal(restored.stage!.preset,'single');
 assert.deepEqual(restored.models,state.models.map(m=>({...m,screenshot:restored.models[0].screenshot})));assert.deepEqual(restored.keyframes[0].state.models,restored.models);assert.equal(restored.keyframes[0].state.stage!.enabled,false);
 assert.deepEqual(new Uint8Array(await(await fetch(restored.models[0].screenshot!)).arrayBuffer()),new Uint8Array([1,2,3]));
});
