import * as T from 'three';
const random=(i:number,salt:number)=>{let x=Math.imul(i+salt,0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return ((x^(x>>>16))>>>0)/4294967295;};
/** Sparse real wool flyaways grow from the rounded yarn itself, not from a
 * floating carpet. A single short, tapered-ribbon batch catches grazing light. */
export function yarnFuzzGeometry(yarn:T.BufferGeometry){
 const p=yarn.getAttribute('position'),n=yarn.getAttribute('normal'),eligible:number[]=[];
 for(let i=0;i<p.count;i++)if(n.getY(i)>.35)eligible.push(i);
 const count=Math.min(6000,Math.floor(eligible.length*.38));
 const blade=new T.PlaneGeometry(1,1,1,2).translate(0,.5,0),geometry=new T.InstancedBufferGeometry();
 T.BufferGeometry.prototype.copy.call(geometry,blade);blade.dispose();
 const roots=new Float32Array(count*3),styles=new Float32Array(count*4),colors=new Float32Array(count*3);
 for(let i=0;i<count;i++){
  const v=eligible[Math.floor(random(i,127)*eligible.length)],length=.012+random(i,59)*.014,tone=.85+random(i,331)*.15;
  roots.set([p.getX(v)+n.getX(v)*.002,p.getY(v)+n.getY(v)*.002,p.getZ(v)+n.getZ(v)*.002],i*3);
  styles.set([random(i,73)*Math.PI*2,length,.002+random(i,97)*.0015,random(i,211)],i*4);colors.set([tone,tone,tone],i*3);
 }
 geometry.setAttribute('fiberRoot',new T.InstancedBufferAttribute(roots,3));geometry.setAttribute('fiberStyle',new T.InstancedBufferAttribute(styles,4));geometry.setAttribute('color',new T.InstancedBufferAttribute(colors,3));
 geometry.instanceCount=count;geometry.boundingBox=yarn.boundingBox!.clone().expandByScalar(.035);geometry.boundingSphere=geometry.boundingBox.getBoundingSphere(new T.Sphere());
 geometry.userData.woolFlyaways=count;return geometry;
}
