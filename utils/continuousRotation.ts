import {Euler,Quaternion} from 'three';
type Rotation=[number,number,number];
const turn=2*Math.PI;
const unwrap=(angle:number,near:number)=>angle+Math.round((near-angle)/turn)*turn;

/** Quaternions forget winding. Choose the equivalent XYZ Euler solution
 * nearest the user's existing angles, including the branch beyond +/-90° Y.
 */
export function continuousRotation(q:Quaternion,previous:Rotation):Rotation{
 const reference=new Quaternion().setFromEuler(new Euler(...previous));
 if(1-Math.abs(q.dot(reference))<1e-14)return [...previous];
 const e=new Euler().setFromQuaternion(q,'XYZ');
 const candidates:Rotation[]=[[e.x,e.y,e.z],[e.x+Math.PI,Math.PI-e.y,e.z+Math.PI]];
 if(Math.abs(Math.cos(e.y))<1e-7){
  candidates.push([e.x-Math.sign(e.y)*previous[2],e.y,previous[2]]);
 }
 const nearest=candidates.map(c=>c.map((angle,i)=>unwrap(angle,previous[i])) as Rotation);
 const distance=(r:Rotation)=>r.reduce((sum,angle,i)=>sum+(angle-previous[i])**2,0);
 return nearest.reduce((a,b)=>distance(a)<=distance(b)?a:b);
}
