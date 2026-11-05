import * as THREE from 'three';

export const foldHalfAngle=(angle=180)=>THREE.MathUtils.degToRad((180-Math.max(0,Math.min(180,angle)))/2);
export const FOLD_STRIP=.18;
/** Inextensible flexible strip, tangent to both rigid panels. UVs stay unfolded. */
export function foldPoint(x:number,angle:number):[number,number]{
 const a=foldHalfAngle(angle),s=FOLD_STRIP/2,u=Math.abs(x),sign=Math.sign(x);
 if(a<1e-6)return [x,0];
 const r=s/a,t=Math.min(u/s,1)*a,outer=Math.max(0,u-s);
 return [sign*(r*Math.sin(t)+outer*Math.cos(a)),r*(1-Math.cos(t))+outer*Math.sin(a)];
}
export function foldScreen(width:number,height:number,radius:number,angle:number,z:number){
 const geo=new THREE.BufferGeometry(),positions:number[]=[],uv:number[]=[],indices:number[]=[];
 const nx=128,ny=16,w=width/2,h=height/2,r=Math.max(0,Math.min(radius,w,h));
 for(let i=0;i<=nx;i++){
  // Reserve 32 columns for the hinge so a closed bend remains smooth even
  // on a wide display; outer rigid panels need far fewer subdivisions.
  const s=Math.min(FOLD_STRIP/2,w),x=i<=48?-w+(w-s)*i/48:i<=80?-s+2*s*(i-48)/32:s+(w-s)*(i-80)/48;
  const corner=Math.max(0,Math.abs(x)-(w-r));
  const limit=h-r+Math.sqrt(Math.max(0,r*r-corner*corner));
  const [fx,fz]=foldPoint(x,angle);
  for(let j=0;j<=ny;j++){const y=(j/ny*2-1)*limit;positions.push(fx,y,fz+z);uv.push((x+w)/width,(y+h)/height);}
 }
 for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){const a=i*(ny+1)+j,b=a+ny+1;indices.push(a,b,a+1,b,b+1,a+1);}
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
