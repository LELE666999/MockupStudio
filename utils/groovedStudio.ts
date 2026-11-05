import * as T from 'three';
import type {StageObject} from '../types';

/** Four rounded channels in the right half; the left half is a flat, real
 * support area. Positive depth always subtracts from the surface. */
export function trayHeight(o:StageObject,x:number,z:number){
 const [w,h,d]=o.size,radius=w*.042,halfLength=d*.335;
 let depression=0;
 for(let i=0;i<4;i++){
  const center=w*(.005+i*.12),distance=Math.hypot(x-center,Math.max(0,Math.abs(z)-halfLength));
  const t=T.MathUtils.clamp(distance/radius,0,1);
  depression=Math.max(depression,Math.min(h*.62,w*.04)*Math.pow(1-t*t,1.6));
 }
 return h/2-depression;
}
/** Mapped rounded footprint, with enough true geometry for smooth channel
 * profiles even in close-ups. One indexed draw, never a mesh per indentation. */
export function groovedTrayGeometry(o:StageObject){
 const [w,h,d]=o.size,r=Math.min(w*.055,d*.055),bevel=Math.min(h*.22,r*.4),capSteps=80,profileSteps=36;
 const positions:number[]=[],uv:number[]=[],normals:number[]=[],indices:number[]=[];
 const vertex=(x:number,y:number,z:number,nx:number,ny:number,nz:number)=>{positions.push(x,y,z);uv.push(x/4,z/4);normals.push(nx,ny,nz);return positions.length/3-1;};
 const outline=(inset:number)=>{
  const points:T.Vector2[]=[];
  for(let q=0;q<4;q++)for(let i=0;i<=28;i++){
   const a=(q+i/28)*Math.PI/2,cx=(q===0||q===3?1:-1)*(w/2-r),cz=(q<2?1:-1)*(d/2-r);
   points.push(new T.Vector2(cx+(r-inset)*Math.cos(a),cz+(r-inset)*Math.sin(a)));
  }return points;
 };
 const capsule=(cx:number,radius:number)=>{
  const points:T.Vector2[]=[];
  for(let end=0;end<2;end++)for(let i=0;i<=capSteps;i++){
   const a=(end+i/capSteps)*Math.PI;points.push(new T.Vector2(cx+radius*Math.cos(a),(end===0?1:-1)*d*.335+radius*Math.sin(a)));
  }return points;
 };
 const shape=new T.Shape(outline(bevel).map(p=>new T.Vector2(p.x,-p.y)));
 for(let channel=0;channel<4;channel++)shape.holes.push(new T.Path(capsule(w*(.005+channel*.12),w*.042).map(p=>new T.Vector2(p.x,-p.y))));
 const flat=new T.ShapeGeometry(shape),p=flat.getAttribute('position');
 for(let i=0;i<p.count;i++)vertex(p.getX(i),h/2,-p.getY(i),0,1,0);
 indices.push(...Array.from(flat.index!.array));flat.dispose();
 // Capsule-aligned rings remove Cartesian stair steps at the ends. Normals
 // are derivatives of the profile, not triangulation-dependent averages.
 const depth=Math.min(h*.62,w*.04),radius=w*.042;
 for(let channel=0;channel<4;channel++){
  const cx=w*(.005+channel*.12),start=positions.length/3,ring=2*(capSteps+1);
  for(let j=0;j<=profileSteps;j++){
   const t=1-j/profileSteps,rr=radius*t,y=h/2-depth*Math.pow(1-t*t,1.6),slope=depth*3.2*t*Math.pow(Math.max(0,1-t*t),.6)/radius;
   for(let end=0;end<2;end++)for(let i=0;i<=capSteps;i++){
    const a=(end+i/capSteps)*Math.PI,dx=Math.cos(a),dz=Math.sin(a),length=Math.hypot(slope,1);
    vertex(cx+rr*dx,y,(end===0?1:-1)*d*.335+rr*dz,-dx*slope/length,1/length,-dz*slope/length);
   }
  }
  for(let j=0;j<profileSteps;j++)for(let i=0;i<ring;i++){
   const a=start+j*ring+i,b=start+j*ring+(i+1)%ring;indices.push(a,a+ring,b,b,a+ring,b+ring);
  }
 }
 // A true round-over joins the top to the sides, with a second round-over
 // below. No bulging vertical wall or sharp highlight discontinuity.
 const profiles:{inset:number;y:number;ny:number;horizontal:number}[]=[];
 for(let i=0;i<=12;i++){const a=i/12*Math.PI/2;profiles.push({inset:bevel*(1-Math.sin(a)),y:h/2-bevel*(1-Math.cos(a)),ny:Math.cos(a),horizontal:Math.sin(a)});}
 for(let i=0;i<=12;i++){const a=i/12*Math.PI/2;profiles.push({inset:bevel*(1-Math.cos(a)),y:-h/2+bevel*(1-Math.sin(a)),ny:-Math.sin(a),horizontal:Math.cos(a)});}
 const start=positions.length/3,ring=outline(0).length;
 for(const profile of profiles){const points=outline(profile.inset);points.forEach((p,i)=>{const a=(Math.floor(i/29)+(i%29)/28)*Math.PI/2;vertex(p.x,profile.y,p.y,Math.cos(a)*profile.horizontal,profile.ny,Math.sin(a)*profile.horizontal);});}
 for(let j=0;j<profiles.length-1;j++)for(let i=0;i<ring;i++){const a=start+j*ring+i,b=start+j*ring+(i+1)%ring;indices.push(a,b,a+ring,b,b+ring,a+ring);}
 const bottom=vertex(0,-h/2,0,0,-1,0),last=start+(profiles.length-1)*ring;
 for(let i=0;i<ring;i++)indices.push(bottom,last+i,last+(i+1)%ring);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.userData.groovedTray=true;geometry.userData.continuousChannels=true;return geometry;
}

export function satinHeight(o:StageObject,x:number,z:number){
 const [w,h,d]=o.size,xx=x/w,zz=z/d;
 // Broad diagonal folds with secondary creases. The quiet center stays
 // below the tray, so cloth never tunnels through the phone's support area.
 const quiet=T.MathUtils.smoothstep(Math.max(Math.abs(x)/4.7,Math.abs(z)/3.3),.96,1.2);
 const ridge=(p:number,c:number,s:number)=>Math.exp(-Math.pow((p-c)/s,2));
 const a=xx+zz*.42,b=zz-xx*.28;
 const folds=ridge(a,-.145,.022)*.78+ridge(a,.17,.031)*.64+ridge(b,.135,.032)*.57+ridge(b,-.135,.028)*.4;
 const small=Math.pow(.5+.5*Math.sin(x*.68+z*.54),3)*.13;
 return -h*.35+quiet*h*(folds+small)*.64;
}
export function satinSheetGeometry(o:StageObject){
 const [w,,d]=o.size,n=152,positions:number[]=[],uv:number[]=[],indices:number[]=[];
 for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const x=(i/n-.5)*w,z=(j/n-.5)*d;positions.push(x,satinHeight(o,x,z),z);uv.push(x/4,z/4);}
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i;indices.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2);}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.satinSheet=true;return geometry;
}

/** Seamless neutral maps. Small embossed crossing threads are filtered with
 * mipmaps; their normals produce real moving highlights, not baked blue. */
export function microWeavePixels(size=512){
 const heights=new Float32Array(size*size),color=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4),roughness=new Uint8Array(size*size*4),count=Math.max(2,Math.min(32,Math.floor(size/16/2)*2));
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size*count,v=y/size*count,over=(Math.floor(u)+Math.floor(v))%2;
  const a=Math.pow(Math.sin((u%1)*Math.PI),1.4),b=Math.pow(Math.sin((v%1)*Math.PI),1.4),thread=over?a*b*b:b*a*a;
  const index=y*size+x,offset=index*4,c=Math.round(232+thread*21),r=Math.round(199-thread*85);
  heights[index]=thread*.36;color.set([c,c,c,255],offset);roughness.set([r,r,r,255],offset);
 }
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const dx=(heights[y*size+(x+1)%size]-heights[y*size+(x+size-1)%size])*3,dy=(heights[((y+1)%size)*size+x]-heights[((y+size-1)%size)*size+x])*3,length=Math.hypot(dx,dy,1),offset=(y*size+x)*4;
  normal.set([Math.round((-.5*dx/length+.5)*255),Math.round((-.5*dy/length+.5)*255),Math.round((.5/length+.5)*255),255],offset);
 }
 return {color,normal,roughness,size};
}
