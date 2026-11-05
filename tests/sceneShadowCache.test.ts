import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {SceneShadowCache} from '../utils/SceneShadowCache.ts';
test('view changes reuse shadows; caster, alpha, lights, geometry and soft-contact edits invalidate them',()=>{
 const scene=new T.Scene(),mesh=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()),light=new T.DirectionalLight(),camera=new T.PerspectiveCamera(),cache=new SceneShadowCache();
 mesh.castShadow=light.castShadow=true;scene.add(mesh,light,camera);scene.updateMatrixWorld(true);
 light.shadow.autoUpdate=false;
 assert.equal(cache.needs(scene),true);cache.commit(scene);assert.equal(cache.needs(scene),false);
 camera.position.set(8,8,8);camera.lookAt(0,0,0);scene.updateMatrixWorld(true);assert.equal(cache.needs(scene),false);
 mesh.position.x=1;scene.updateMatrixWorld(true);assert.equal(cache.needs(scene),true);cache.commit(scene);
 mesh.material.opacity=.7;assert.equal(cache.needs(scene),true);cache.commit(scene);
 mesh.customDepthMaterial=new T.MeshDepthMaterial();cache.commit(scene);mesh.customDepthMaterial.userData.stageContactRevision=1;assert.equal(cache.needs(scene),true);cache.commit(scene);
 light.position.y=8;scene.updateMatrixWorld(true);assert.equal(cache.needs(scene),true);cache.commit(scene);
 light.shadow.mapSize.set(1024,1024);assert.equal(cache.needs(scene),true);cache.commit(scene);
 mesh.geometry.getAttribute('position').needsUpdate=true;assert.equal(cache.needs(scene),true);cache.commit(scene);
 mesh.geometry.index!.needsUpdate=true;assert.equal(cache.needs(scene),true);cache.commit(scene);
 mesh.morphTargetInfluences=[0];cache.commit(scene);mesh.morphTargetInfluences[0]=.4;assert.equal(cache.needs(scene),true);cache.commit(scene);
 assert.equal(cache.needs(scene,'shadow-type-changed'),true);
 mesh.visible=false;assert.equal(cache.needs(scene),true);cache.commit(scene);mesh.visible=true;assert.equal(cache.needs(scene),true);
 mesh.geometry.dispose();mesh.material.dispose();mesh.customDepthMaterial.dispose();
});
test('unknown custom vertex shaders stay dynamic unless their owner explicitly supplies a static-shadow contract',()=>{
 const scene=new T.Scene(),mesh=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()),cache=new SceneShadowCache();mesh.castShadow=true;scene.add(mesh);scene.updateMatrixWorld(true);
 mesh.material.onBeforeCompile=()=>{};cache.commit(scene);assert.equal(cache.needs(scene),true);
 mesh.material.userData.shadowStatic=true;cache.commit(scene);assert.equal(cache.needs(scene),false);mesh.material.userData.dynamicShadow=true;assert.equal(cache.needs(scene),true);
});
test('skinned animation and explicit per-light shadow invalidation never get cached away',()=>{
 const scene=new T.Scene(),mesh=new T.SkinnedMesh(new T.BoxGeometry(),new T.MeshStandardMaterial()),light=new T.DirectionalLight(),cache=new SceneShadowCache();
 mesh.castShadow=light.castShadow=true;scene.add(mesh,light);scene.updateMatrixWorld(true);cache.commit(scene);assert.equal(cache.needs(scene),true);
 light.shadow.autoUpdate=false;
 mesh.castShadow=false;cache.commit(scene);assert.equal(cache.needs(scene),false);light.shadow.needsUpdate=true;assert.equal(cache.needs(scene),true);
});
test('alpha and displacement UV transformations invalidate shadows without requiring texture uploads',()=>{
 const material=new T.MeshStandardMaterial({alphaTest:.5}),scene=new T.Scene(),mesh=new T.Mesh(new T.BoxGeometry(),material),cache=new SceneShadowCache(),camera=new T.PerspectiveCamera();
 mesh.castShadow=true;scene.add(mesh,camera);scene.updateMatrixWorld(true);
 material.alphaMap=new T.Texture();material.map=new T.Texture();material.displacementMap=new T.Texture();
 for(const texture of [material.alphaMap,material.map,material.displacementMap]){
  const version=texture.version;
  const mutations=[()=>texture.offset.set(.3,.2),()=>texture.repeat.set(2,3),()=>texture.rotation=.6,()=>texture.center.set(.5,.4),()=>texture.matrixAutoUpdate=false,()=>texture.matrix.elements[6]+=.25,()=>texture.wrapS=T.RepeatWrapping,()=>texture.source.needsUpdate=true];
  for(const mutation of mutations){cache.commit(scene);assert.equal(cache.needs(scene),false);mutation();assert.equal(cache.needs(scene),true);}
  assert.equal(texture.version,version,'UV edits must be detected independently of texture.version');
 }
 cache.commit(scene);camera.position.set(4,7,3);camera.lookAt(0,0,0);scene.updateMatrixWorld(true);assert.equal(cache.needs(scene),false,'view camera orbit must remain cached');
 // Ordinary RGB screen content is not part of an opaque caster silhouette.
 material.alphaTest=0;cache.commit(scene);material.map.offset.x+=.1;assert.equal(cache.needs(scene),false);
 material.alphaMap.dispose();material.map.dispose();material.displacementMap.dispose();material.dispose();mesh.geometry.dispose();
});
test('spotlight and shadow projection drivers invalidate before their matrices update',()=>{
 const scene=new T.Scene(),mesh=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()),spot=new T.SpotLight(),point=new T.PointLight(),directional=new T.DirectionalLight(),cache=new SceneShadowCache();
 mesh.castShadow=spot.castShadow=point.castShadow=directional.castShadow=true;
 for(const light of [spot,point,directional])light.shadow.autoUpdate=false;
 scene.add(mesh,spot,point,directional);scene.updateMatrixWorld(true);
 const mutations=[()=>spot.angle=.3,()=>spot.distance=25,()=>spot.shadow.focus=.7,()=>point.distance=18,()=>spot.shadow.camera.near=.3,()=>spot.shadow.camera.far=80,()=>spot.shadow.camera.zoom=1.2,()=>spot.shadow.camera.fov=36,()=>spot.shadow.camera.aspect=2,()=>spot.shadow.camera.filmOffset=2,()=>directional.shadow.camera.left=-9,()=>directional.shadow.camera.top=8,()=>directional.shadow.blurSamples=12];
 for(const mutation of mutations){cache.commit(scene);assert.equal(cache.needs(scene),false);mutation();assert.equal(cache.needs(scene),true);}
 spot.shadow.camera.setViewOffset(1200,800,0,0,600,800);cache.commit(scene);spot.shadow.camera.view!.offsetX=20;assert.equal(cache.needs(scene),true);
 mesh.geometry.dispose();mesh.material.dispose();
});
test('wireframe and shadow clipping edits invalidate while ordinary light colour and view edits remain reusable',()=>{
 const scene=new T.Scene(),material=new T.MeshStandardMaterial(),mesh=new T.Mesh(new T.BoxGeometry(),material),light=new T.DirectionalLight(),cache=new SceneShadowCache();
 mesh.castShadow=light.castShadow=true;light.shadow.autoUpdate=false;scene.add(mesh,light);scene.updateMatrixWorld(true);
 const clipping=new T.Plane(new T.Vector3(1,0,0),.2),mutations=[()=>material.wireframe=true,()=>material.wireframeLinewidth=2,()=>material.clipShadows=true,()=>material.clippingPlanes=[clipping],()=>clipping.constant=.8,()=>clipping.normal.set(0,1,0),()=>material.clipIntersection=true,()=>material.clippingPlanes.push(new T.Plane(new T.Vector3(0,0,1),.4)),()=>material.clippingPlanes=null];
 for(const mutation of mutations){cache.commit(scene);assert.equal(cache.needs(scene),false);mutation();assert.equal(cache.needs(scene),true);}
 cache.commit(scene);material.color.set('#faebb3');light.color.set('#fff2e6');assert.equal(cache.needs(scene),false);
 material.dispose();mesh.geometry.dispose();
});
