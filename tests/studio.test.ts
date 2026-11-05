import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Mesh,BoxGeometry,MeshPhysicalMaterial} from 'three';
import {studioMaterials} from '../utils/studioMaterials.ts';
test('studio material copies track live colors and restore original ownership',()=>{
 const scene=new Scene(),original=new MeshPhysicalMaterial({color:'#112233',roughness:.2}),mesh=new Mesh(new BoxGeometry(),original);scene.add(mesh);const studio=studioMaterials();
 let restore=studio.apply(scene);assert.notEqual(mesh.material,original);restore();assert.equal(mesh.material,original);
 original.color.set('#ff0000');original.roughness=.8;
 restore=studio.apply(scene);assert.equal(mesh.material.color.getHexString(),'ff0000');assert.equal(mesh.material.roughness,.8);restore();
 mesh.userData.studioColorCritical=true;restore=studio.apply(scene);assert.equal(mesh.material,original);restore();studio.dispose();original.dispose();mesh.geometry.dispose();
});
