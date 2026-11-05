import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {StageObject} from '../types';
import {stageClothHeight} from './stageGeometry.ts';

export const weaveHeight=(o:StageObject)=>Math.min(o.size[1]*.28,Math.max(.018,(o.reliefDepth??.1)*.65));
/** Alternating warp and weft are real softly flattened yarn, not a sparse grid.
 * Fixed budgets prevent a large/dense swatch from creating millions of faces. */
export function wovenFabricGeometry(o:StageObject){
 const [w,h,d]=o.size,inset=Math.min(.12,w*.08,d*.08),iw=w-inset*2,id=d-inset*2;
 const density=Math.max(.25,Math.min(4,o.textureScale??1)),nx=Math.min(38,Math.max(3,Math.round(iw*density/.24))),nz=Math.min(38,Math.max(3,Math.round(id*density/.24)));
 const pitchX=iw/nx,pitchZ=id/nz,layer=weaveHeight(o),radius=Math.min(pitchX,pitchZ)*.42,verticalRadius=Math.min(layer*.16,radius*.35),amp=verticalRadius*1.15;
 const parts:T.BufferGeometry[]=[];
 class Thread extends T.Curve<T.Vector3>{
  readonly axis:'x'|'z';readonly lane:number;
  constructor(axis:'x'|'z',lane:number){super();this.axis=axis;this.lane=lane;}
  getPoint(t:number,target=new T.Vector3()){
   const x=this.axis==='x'?(t-.5)*iw:-iw/2+this.lane*pitchX;
   const z=this.axis==='z'?(t-.5)*id:-id/2+this.lane*pitchZ;
   const phase=this.axis==='x'?t*nx:t*nz;
   const tuck=layer*.85*(1-T.MathUtils.smoothstep(t,0,.025)+T.MathUtils.smoothstep(t,.975,1));
   const top=stageClothHeight(o,x,z),y=top-verticalRadius-amp+(this.axis==='x'?1:-1)*amp*Math.cos(Math.PI*(phase+this.lane))-tuck;
   return target.set(x,y,z);
  }
 }
 for(const axis of ['x','z'] as const){
  const lanes=axis==='x'?nz:nx,segments=(axis==='x'?nx:nz)*3,radial=8;
  for(let i=1;i<lanes;i++){
   const curve=new Thread(axis,i),part=new T.TubeGeometry(curve,segments,radius,radial,false),positions=part.getAttribute('position'),center=new T.Vector3();
   // Cloth yarn spreads laterally at each interlacing, retaining enough real
   // vertical separation to alternate over/under. Round thin cords leave a
   // wire-fence pattern; this high-coverage oval fills the cloth naturally.
   for(let ring=0;ring<=segments;ring++){
    curve.getPointAt(ring/segments,center);
    for(let j=0;j<=radial;j++){const vertex=ring*(radial+1)+j;positions.setY(vertex,center.y+(positions.getY(vertex)-center.y)*verticalRadius/radius);}
   }
   part.computeVertexNormals();const normals=part.getAttribute('normal'),average=new T.Vector3();
   for(let ring=0;ring<=segments;ring++){
    const a=ring*(radial+1),b=a+radial;average.set(normals.getX(a)+normals.getX(b),normals.getY(a)+normals.getY(b),normals.getZ(a)+normals.getZ(b)).normalize();normals.setXYZ(a,average.x,average.y,average.z);normals.setXYZ(b,average.x,average.y,average.z);
   }
   parts.push(part);
  }
 }
 const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());
 // Muted per-strand variation retains the selected colour without painting
 // dark fake gaps into the image. Actual gaps and occlusion provide depth.
 const colors=new Float32Array(geometry.getAttribute('position').count*3),p=geometry.getAttribute('position');
 for(let i=0;i<p.count;i++){
  const tone=.86+.12*(.5+.5*Math.sin(p.getX(i)*17+p.getZ(i)*23));colors.set([tone,tone,tone],i*3);
 }
 geometry.setAttribute('color',new T.BufferAttribute(colors,3));
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.userData.wovenFabric={nx,nz,radius,verticalRadius,height:layer,coverage:.84,radialSegments:8};return geometry;
}
