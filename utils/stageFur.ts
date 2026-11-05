import * as T from 'three';
import type {StageObject} from '../types';
import {pileHeight} from './stageSoftness.ts';
import {stageClothHeight} from './stageGeometry.ts';
const random=(i:number,salt:number)=>{let x=Math.imul(i+salt,0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return ((x^(x>>>16))>>>0)/4294967295;};
export function furGeometry(o:StageObject){
 const [w,h,d]=o.size,pile=pileHeight(o),density=o.fiberDensity??1;
 const velvet=o.material==='velvet';
 const count=Math.min(velvet?9000:36000,Math.max(1800,Math.round(w*d*(velvet?110:420)*density)));
 // A curved, randomly oriented, double-sided ribbon has the same strand
 // silhouette without drawing two overlapping cards per fibre. Keep the
 // middle row for a bent shaft and taper the tip in the shared shader.
 const blade=new T.PlaneGeometry(1,1,1,2).translate(0,.5,0);
 const geometry=new T.InstancedBufferGeometry();T.BufferGeometry.prototype.copy.call(geometry,blade);blade.dispose();
 const roots=new Float32Array(count*3),styles=new Float32Array(count*4),colors=new Float32Array(count*3);
 const nx=Math.max(1,Math.round(Math.sqrt(count*w/d))),nz=Math.ceil(count/nx);
 for(let i=0;i<count;i++){
  const x=((i%nx+random(i,71))/nx-.5)*(w-.05),z=((Math.floor(i/nx)+random(i,997))/nz-.5)*(d-.05),edge=Math.max(Math.abs(x)/(w/2),Math.abs(z)/(d/2));
  // A rounded lip hides the support core; loose tip variation prevents a
  // perfectly flat, plastic-looking top. Geometry is never rebuilt on orbit.
  const sag=Math.pow(edge,10)*Math.min(h*.12,.09),tone=.65+random(i,29)*.35;
  roots.set([x,stageClothHeight(o,x,z)-pile-sag,z],i*3);styles.set([random(i,43)*Math.PI*2,pile*(.65+random(i,109)*.35),(velvet?.005:.014)+random(i,163)*(velvet?.004:.009),random(i,263)],i*4);
  colors.set([tone,tone,tone],i*3);
 }
 geometry.setAttribute('fiberRoot',new T.InstancedBufferAttribute(roots,3));geometry.setAttribute('fiberStyle',new T.InstancedBufferAttribute(styles,4));geometry.setAttribute('color',new T.InstancedBufferAttribute(colors,3));
 geometry.instanceCount=count;geometry.boundingBox=new T.Box3(new T.Vector3(-w/2,-h/2,-d/2),new T.Vector3(w/2,h/2,d/2));geometry.boundingSphere=geometry.boundingBox.getBoundingSphere(new T.Sphere());
 geometry.userData.fiberCount=count;return geometry;
}
