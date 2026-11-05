import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {readFileSync} from 'node:fs';
import {getInitialState} from '../types.ts';
import {makeStage,stageObjects} from '../utils/stagePresets.ts';
import {brickCourtyardGeometry,brickLayout} from '../utils/brickStudio.ts';
import {RainCollisionField,rainSurfaces,rainSurfaceKey,rainImpactPool,rainKinematics,rainTime,rainRippleAge} from '../utils/rainWeather.ts';
import {brickWaterCoverage,brickWaterPotential} from '../utils/brickWetness.ts';
import {rainPuddleMaterial} from '../utils/rainRipples.ts';
import {rainPuddles,rainPuddleHits} from '../utils/rainPuddles.ts';
import {rainAir,rainSurfaceWater,rainUniforms} from '../utils/rainRendering.ts';
import {packProject,unpackProject} from '../utils/projectFiles.ts';
import {boundsInFrame} from '../utils/stagePlacement.ts';
import {SceneShadowCache} from '../utils/SceneShadowCache.ts';
import {lensLayers} from '../utils/LensLayers.ts';

function fixture(){
 const scene=new T.Scene(),brickRoot=new T.Group(),phoneRoot=new T.Group();brickRoot.userData.stageId='primary';phoneRoot.userData.mockupModelId='phone';scene.add(brickRoot,phoneRoot);
 const brick=new T.Mesh<T.BufferGeometry>(new T.BoxGeometry(12,1,12),new T.MeshStandardMaterial());brick.name='charcoal-brick-course';brick.castShadow=true;brickRoot.add(brick);
 const phone=new T.Mesh(new T.BoxGeometry(3,.3,6),new T.MeshStandardMaterial());phone.castShadow=true;phoneRoot.position.set(0,.65,0);phoneRoot.rotation.set(0,.45,0);phoneRoot.add(phone);scene.updateMatrixWorld(true);
 return {scene,brickRoot,phoneRoot,brick,phone,bounds:new T.Box3(new T.Vector3(-6,-.5,-6),new T.Vector3(6,.5,6))};
}
test('rain lands on real transformed topmost geometry, excluding hidden phones and helpers',()=>{
 const f=fixture(),waterHelper=new T.Mesh(new T.BoxGeometry(5,5,5),new T.MeshBasicMaterial());waterHelper.userData.weatherEffect=true;f.phoneRoot.add(waterHelper);f.scene.updateMatrixWorld(true);
 const sources=rainSurfaces(f.scene);assert.equal(sources.length,2);
 const field=new RainCollisionField(sources,f.bounds,96),pool=rainImpactPool(field);
 assert.equal(pool.length,640);assert.ok(pool.some(h=>h.phone));assert.ok(pool.some(h=>!h.phone));
 for(const h of pool){assert.ok(h.normal.y>.99);assert.ok(Math.abs(h.point.y-(h.phone?.8:.5))<1e-5);}
 const key=rainSurfaceKey(sources);f.phoneRoot.position.x=2;f.scene.updateMatrixWorld(true);assert.notEqual(rainSurfaceKey(sources),key);
 f.phoneRoot.visible=false;assert.equal(rainSurfaces(f.scene).length,1);
});
test('cached brick atlas and independently rasterized tilted phone equal a full scene collision build',()=>{
 const f=fixture();f.phoneRoot.rotation.set(.18,.3,.12);f.scene.updateMatrixWorld(true);const surfaces=rainSurfaces(f.scene);
 const base=new RainCollisionField(surfaces.filter(s=>!s.phone),f.bounds,96),incremental=new RainCollisionField(surfaces.filter(s=>s.phone),f.bounds,96,base),full=new RainCollisionField(surfaces,f.bounds,96);
 assert.deepEqual(incremental.heights,full.heights);assert.deepEqual(incremental.normals,full.normals);assert.deepEqual(incremental.owners,full.owners);assert.deepEqual(incremental.waterPotential,full.waterPotential);assert.deepEqual(base.roots.length,1);
 assert.throws(()=>new RainCollisionField([],new T.Box3(new T.Vector3(),new T.Vector3())),/范围/);
});
test('drop flight and splash use deterministic time; paused preview never contaminates exported frames',()=>{
 const state={currentTime:2,isPlaying:false,isExporting:false};assert.equal(rainTime(state,4,true),6);assert.equal(rainTime(state,4,false),2);
 assert.equal(rainTime({...state,isPlaying:true},4,true),2);assert.equal(rainTime({...state,isExporting:true},4,true),2);
 const flight=rainKinematics(.3,0,10);assert.equal(flight.falling,true);assert.ok(Math.abs(flight.above-4)<1e-10);
 const impact=rainKinematics(.8,0,10);assert.equal(impact.falling,false);assert.ok(Math.abs(impact.splashAge-.1)<1e-10);
 assert.ok(Math.abs(rainRippleAge(.8,0,10)-.1)<1e-10);assert.ok(Math.abs(rainRippleAge(1.6,0,10)-.9)<1e-10,'Water wake continues smoothly after the next drop has started falling');
 assert.deepEqual(rainKinematics(2.2,1.3,12),rainKinematics(2.2,1.3,12));
});
test('water stays in its own phone lens layer, preserves measurement/selection and does not invalidate static shadows',()=>{
 const f=fixture(),sources=rainSurfaces(f.scene),field=new RainCollisionField(sources,f.bounds,96),pool=rainImpactPool(field),u=rainUniforms(),before=boundsInFrame(f.phoneRoot),shadows=new SceneShadowCache();shadows.commit(f.scene);
 const air=rainAir(pool,u),water=rainSurfaceWater(field,pool,u,.8);f.scene.add(air.group);water.update(2.1);f.scene.updateMatrixWorld(true);
 assert.equal(shadows.needs(f.scene),false);assert.deepEqual(boundsInFrame(f.phoneRoot),before);assert.equal(rainSurfaces(f.scene).length,2);
 const camera=new T.PerspectiveCamera(),layers=lensLayers(f.scene,camera),phoneLayer=layers.find(l=>l.root===f.phoneRoot)!;
 assert.ok(phoneLayer.objects.some(o=>o.name==='rain-glass-beads'));assert.ok(layers.some(l=>l.root===air.group));
 assert.equal(air.group.children.length,2);assert.equal((air.group.children[0] as T.Mesh).geometry.getAttribute('rainImpact').count,640);
 const matrices=(phoneLayer.objects.find(o=>o.name==='rain-glass-beads') as T.InstancedMesh).instanceMatrix.array;assert.ok([...matrices].every(Number.isFinite));
 water.dispose();air.dispose();assert.equal(f.phoneRoot.children.length,1);assert.equal(f.brickRoot.children.length,1);
});
test('expanded brick courses keep real relief under a bounded geometry budget; legacy layouts remain intact',()=>{
 const o=stageObjects(makeStage('bricks'))[0],g=brickCourtyardGeometry(o);assert.equal(g.userData.brickCount,45);assert.ok(g.getAttribute('position').count<60000);g.dispose();
 assert.equal(brickLayout({...o,brickRows:undefined,brickColumns:undefined}).parts.length,10);
 const larger=brickCourtyardGeometry({...o,brickRows:8,brickColumns:9,size:[27,1.8,20]});assert.ok(larger.userData.brickCount>70);assert.ok(larger.getAttribute('position').count<100000);larger.dispose();
});
test('wet bricks retain substantial dry grain and have coherent, recessed local catchments instead of uniform gloss',()=>{
 const object=stageObjects(makeStage('bricks'))[0],geometry=brickCourtyardGeometry(object),water=geometry.getAttribute('brickWater'),normal=geometry.getAttribute('normal'),coverage:number[]=[];
 for(let i=0;i<water.count;i++){
  const potential=water.getX(i);assert.ok(Number.isFinite(potential)&&potential>=0&&potential<=1);
  if(normal.getY(i)>.85)coverage.push(brickWaterCoverage(potential,.72));
  assert.equal(brickWaterCoverage(potential,0),0);assert.ok(brickWaterCoverage(potential,.9)>=brickWaterCoverage(potential,.4));
 }
 assert.ok(coverage.filter(v=>v<.05).length>1000);assert.ok(coverage.filter(v=>v>.6).length>500);
 assert.ok(brickWaterPotential(1,2,13,1)>brickWaterPotential(1,2,13,0));assert.equal(brickWaterPotential(1,2,13,.3),brickWaterPotential(1,2,13,.3));
 geometry.dispose();
});
test('wetness is barycentrically shared with the collision field without mistaking a phone for wet stone',()=>{
 const f=fixture(),geometry=f.brick.geometry,water=new Float32Array(geometry.getAttribute('position').count).fill(.8);geometry.setAttribute('brickWater',new T.BufferAttribute(water,1));
 const field=new RainCollisionField(rainSurfaces(f.scene),f.bounds,96),hits=rainImpactPool(field);
 const brick=hits.find(h=>!h.phone)!;assert.ok(Math.abs(brick.waterPotential-.8)<1e-5);
 const phone=hits.find(h=>h.phone)!;assert.equal(phone.waterPotential,1);
});
function puddleFixture(tilted=false){
 const f=fixture(),object=stageObjects(makeStage('bricks'))[0],height=new Uint8Array(readFileSync(new URL('../public/materials/rough_concrete/height.bin',import.meta.url)));
 f.brick.geometry=brickCourtyardGeometry(object,height);f.phoneRoot.position.y=1.2;
 if(tilted){f.brickRoot.position.set(2,-4,1);f.brickRoot.rotation.set(.06,.4,.03);f.phoneRoot.visible=false;}
 f.scene.updateMatrixWorld(true);const bounds=f.brick.geometry.boundingBox!.clone().applyMatrix4(f.brick.matrixWorld),field=new RainCollisionField(rainSurfaces(f.scene),bounds,256);
 const puddles=rainPuddles(field,.72),hits=rainPuddleHits(field,puddles,rainImpactPool(field,640,puddles.lookup));
 return {...f,field,puddles,hits};
}
test('retained water fills genuine irregular basins, stays world-horizontal and has interpolated shorelines',()=>{
 const f=puddleFixture(true);assert.ok(f.field.basins.length>5);assert.ok(f.puddles.patches.length>5);assert.equal(f.puddles.surfaces.length,1);
 const geometry=f.puddles.surfaces[0].geometry,positions=geometry.getAttribute('position'),depth=geometry.getAttribute('waterDepth'),ids=geometry.getAttribute('puddleId'),world=new T.Vector3();
 assert.ok(positions.count<25000);assert.equal(geometry.userData.clippedShore,true);
 for(let i=0;i<positions.count;i++){
  world.fromBufferAttribute(positions,i).applyMatrix4(f.brickRoot.matrixWorld);assert.ok(Math.abs(world.y-f.puddles.patches[ids.getX(i)].level)<1e-6);
  assert.ok(Number.isFinite(depth.getX(i))&&depth.getX(i)>=.001-1e-8&&depth.getX(i)<.25);
 }
 assert.ok([...depth.array].some(d=>d<.003));assert.ok([...depth.array].some(d=>d>.025));
 const dry=rainPuddles(f.field,0);assert.equal(dry.patches.length,0);assert.equal(dry.surfaces.length,0);assert.ok([...dry.lookup].every(id=>id===-1));
 const less=rainPuddles(f.field,.3);assert.equal(less.patches.length,f.puddles.patches.length);assert.ok(less.patches.every((p,i)=>p.level<f.puddles.patches[i].level));less.surfaces.forEach(s=>s.geometry.dispose());
 geometry.dispose();
});
test('rain splashes on the retained water level instead of the bottom and phones occlude its shoreline',()=>{
 const f=puddleFixture(),waterHits=f.hits.filter(h=>h.puddle!==undefined);assert.ok(waterHits.length>20);
 for(const hit of waterHits){assert.equal(hit.phone,false);assert.equal(hit.point.y,f.puddles.patches[hit.puddle!].level);assert.equal(hit.normal.y,1);}
 for(let i=0;i<f.puddles.lookup.length;i++)if(f.field.phones[f.field.owners[i]])assert.equal(f.puddles.lookup[i],-1);
 f.puddles.surfaces.forEach(s=>s.geometry.dispose());
});
test('waves alter persistent physical water normals with a bounded shared packet list, not per-impact white rings',()=>{
 const f=puddleFixture(),uniforms=rainUniforms(),material=rainPuddleMaterial(uniforms,f.hits,f.brickRoot,0);assert.equal(material.isMeshPhysicalMaterial,true);assert.equal(material.depthWrite,false);assert.equal(material.emissive.getHex(),0);assert.equal(material.clearcoat,0);assert.equal(material.ior,1.333);assert.ok(material.userData.waveCount>0&&material.userData.waveCount<=48);
 const shader={uniforms:{} as Record<string,T.IUniform>,vertexShader:T.ShaderLib.physical.vertexShader,fragmentShader:T.ShaderLib.physical.fragmentShader};material.onBeforeCompile(shader as any,null as any);
 assert.match(shader.fragmentShader,/waterGradient/);assert.match(shader.fragmentShader,/waterFresnel/);assert.equal(material.color.getHex(),0);assert.match(shader.fragmentShader,/smoothstep\(.001,.023,vWaterDepth\)/);assert.match(shader.vertexShader,/vPuddleId=puddleId/);assert.equal(shader.uniforms.rainTime,uniforms.rainTime);
 const water=rainSurfaceWater(f.field,f.hits,uniforms,.72,f.puddles);
 const names:string[]=[];f.scene.traverse(o=>names.push(o.name));assert.ok(!names.includes('rain-pooled-depressions'));
 const wake=f.brickRoot.getObjectByName('rain-basin-puddles') as T.Mesh;assert.equal((wake.material as T.Material).name,'rain-retained-puddle-water');assert.ok(wake.geometry.getAttribute('waterDepth').count>0);assert.equal(f.brickRoot.getObjectByName('rain-contact-ripples'),undefined);
 water.dispose();material.dispose();
});
test('rain, moss and brick arrangement persist and invalid weather settings are rejected without dropping existing media',async()=>{
 const state=getInitialState();state.stage=makeStage('bricks');state.stage.moss=.68;state.stage.rain!.wind=-.3;
 const archive=await packProject(state,'雨后粗砖');assert.deepEqual((await unpackProject(archive)).stage,state.stage);
 for(const patch of [{moss:2},{brickRows:1},{brickColumns:2.5},{rain:{...state.stage.rain,intensity:NaN}},{rain:{...state.stage.rain,wetness:2}},{rain:{...state.stage.rain,wind:-2}},{rain:{...state.stage.rain,dropSize:8}}]){
  const invalid=structuredClone(archive);Object.assign(invalid.data.stage!,patch);await assert.rejects(()=>unpackProject(invalid),/场景展台/);
 }
 delete archive.data.stage!.rain;delete archive.data.stage!.moss;delete archive.data.stage!.brickColumns;delete archive.data.stage!.brickRows;
 assert.equal((await unpackProject(archive)).stage?.rain,undefined);
});
