import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import type {StageObject} from '../types.ts';
import {knitGeometry,yarnHeight,MAX_KNIT_TRIANGLES} from '../utils/stageKnit.ts';

const cloth:StageObject={id:'sweater',name:'针织毛衣',position:[0,0,0],rotation:[0,0,0],size:[8.5,.7,9.5],material:'knit',shape:'drape',color:'#d2bc98',roughness:.88,textureScale:1,reliefDepth:.22,knitPattern:'stockinette'};

test('sweater is one indexed yarn mesh with closed curved stitches, not a flat texture or per-loop draw calls',()=>{
 const g=knitGeometry(cloth),p=g.getAttribute('position'),n=g.getAttribute('normal');
 assert.ok(g.index);assert.equal(g.groups.length,0);assert.equal(g.userData.drawCalls,1);assert.equal(g.userData.stageYarn,true);
 assert.ok(g.userData.radialSegments>=10,'macro silhouettes must not use hexagonal yarn cross-sections');
 assert.ok(g.userData.loopCount>300);assert.ok(g.userData.triangleCount<=MAX_KNIT_TRIANGLES);assert.equal(g.index!.count/3,g.userData.triangleCount);
 assert.ok(p.count>20000);assert.equal(g.getAttribute('uv').count,p.count);assert.equal(n.count,p.count);assert.equal(g.getAttribute('color').count,p.count);
 assert.ok(Array.from(p.array).every(Number.isFinite));assert.ok(Array.from(n.array).every(Number.isFinite));assert.ok(Array.from(g.getAttribute('uv').array).every(Number.isFinite));
 assert.ok(g.boundingBox!.max.y<=cloth.size[1]/2+1e-6);assert.ok(g.boundingBox!.max.x<=cloth.size[0]/2+1e-6);assert.ok(g.boundingBox!.min.x>=-cloth.size[0]/2-1e-6);
 assert.ok(g.boundingBox!.max.z<=cloth.size[2]/2+1e-6);assert.ok(g.boundingBox!.min.z>=-cloth.size[2]/2-1e-6);assert.ok(g.boundingBox!.max.y-g.boundingBox!.min.y>.16,'real surface relief remains visible in silhouettes and depth');
 const length=new T.Vector3();for(let i=0;i<n.count;i+=37){length.fromBufferAttribute(n,i);assert.ok(Math.abs(length.length()-1)<.0001);}
 g.dispose();
});
test('cable knit adds raised intertwined yarn bands while staying within the single-draw triangle budget',()=>{
 const plain=knitGeometry(cloth),cable=knitGeometry({...cloth,knitPattern:'cable'});
 assert.ok(cable.userData.braidBands>=2);assert.ok(cable.userData.yarnStrands>plain.userData.yarnStrands);assert.ok(cable.userData.triangleCount>plain.userData.triangleCount);
 assert.ok(cable.userData.triangleCount<=MAX_KNIT_TRIANGLES);assert.equal(cable.groups.length,0);assert.ok(cable.boundingBox!.max.y<=cloth.size[1]/2+1e-6);
 assert.ok(cable.userData.terminalCaps<cable.userData.loopCount*.6,'continuous braided wales must not cap every visible stitch');
 assert.notDeepEqual(cable.getAttribute('position').array,plain.getAttribute('position').array);plain.dispose();cable.dispose();
});
test('knit is deterministic, density/detail editable and bounded at extreme scene sizes',()=>{
 const a=knitGeometry(cloth),b=knitGeometry({...cloth,position:[99,5,10],rotation:[1,2,3]});
 assert.deepEqual(a.getAttribute('position').array,b.getAttribute('position').array,'world camera/transform never changes local yarn mesh');
 const low=knitGeometry({...cloth,textureScale:.25}),high=knitGeometry({...cloth,textureScale:4}),thin=knitGeometry({...cloth,reliefDepth:.08});
 assert.ok(low.userData.loopCount<a.userData.loopCount);assert.ok(high.userData.loopCount>a.userData.loopCount);assert.ok(high.userData.triangleCount<=MAX_KNIT_TRIANGLES);
 assert.ok(thin.boundingBox!.max.y-thin.boundingBox!.min.y<a.boundingBox!.max.y-a.boundingBox!.min.y);assert.equal(yarnHeight({...cloth,size:[4,.2,4],reliefDepth:.35}),.2*.4);
 const extreme=knitGeometry({...cloth,size:[40,2,40],textureScale:4,knitPattern:'cable'});assert.ok(extreme.userData.triangleCount<=MAX_KNIT_TRIANGLES);assert.equal(extreme.userData.densityLimited,true);
 for(const g of [a,b,low,high,thin,extreme])g.dispose();
});
