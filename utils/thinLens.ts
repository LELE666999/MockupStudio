import {Camera,Vector3} from 'three';
// A six-unit phone represents approximately 150 mm.
export const lensRadius=(focalLength:number,fNumber:number)=>focalLength/(2*Math.max(1,fNumber)*25);
function radicalInverse(n:number,base:number){let value=0,f=1/base;while(n){value+=(n%base)*f;n=Math.floor(n/base);f/=base}return value;}
export function aperturePoint(index:number):[number,number]{
 const n=Math.floor(index/2)+1,r=Math.sqrt(radicalInverse(n,2)),angle=2*Math.PI*radicalInverse(n,3),sign=index%2?-1:1;
 return [sign*r*Math.cos(angle),sign*r*Math.sin(angle)];
}
/** Off-axis pupil views agree exactly on the focal plane. */
export function offsetLensCamera(base:Camera,sample:Camera,focus:number,x:number,y:number){
 sample.copy(base,false);sample.position.add(new Vector3(x,y,0).applyQuaternion(base.quaternion));sample.updateMatrixWorld(true);
 sample.projectionMatrix.copy(base.projectionMatrix);const p=sample.projectionMatrix.elements;
 p[8]-=p[0]*x/Math.max(.02,focus);p[9]-=p[5]*y/Math.max(.02,focus);
 sample.projectionMatrixInverse.copy(sample.projectionMatrix).invert();
}
