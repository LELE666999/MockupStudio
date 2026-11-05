import * as T from 'three';
import type {StageObject} from '../types';
import {stageClothHeight} from './stageGeometry.ts';

/*! @license The periodic plain-knit centreline follows A Simple Parametric Model of
 * Plain-Knit Yarns, Keenan Crane, 2023:
 * https://github.com/keenancrane/plain-knit-yarn
 * MIT License — Copyright (c) 2023 Keenan Crane
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * Tube meshing, twisted-ply relief, cable braids and scene integration below are
 * purpose-built for the local editor. No external meshes or textures are needed.
 */

export const MAX_KNIT_TRIANGLES=150000;
const TAU=Math.PI*2;
const random=(i:number,salt:number)=>{let x=Math.imul(i+salt,0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return ((x^(x>>>16))>>>0)/4294967295;};

/** This clearance belongs above the folded backing cloth. The yarn is actual
 * geometry, so the same silhouette is visible in colour, shadow and DOF depth. */
export function yarnHeight(o:StageObject){return Math.min(o.size[1]*.4,Math.max(.008,o.reliefDepth??.24));}

function layout(o:StageObject){
 const [w,,d]=o.size,density=T.MathUtils.clamp(o.textureScale??1,.25,4),height=yarnHeight(o);
 const radial=10,samples=density>1.5?18:20,cable=o.knitPattern==='cable';
 let requestedPitch=.46/Math.sqrt(density),nx=1,nz=1,pitch=1,amplitudeZ=1,radius=1,innerW=1,innerD=1,bands=0,triangles=0,intervals:[number,number][]=[],bandCenters:number[]=[],ribSegments=0;
 // Reduce only geometric frequency when extremely large/high-density fabric
 // exceeds its budget. Orbiting, changing light or focusing never calls this.
 for(let i=0;i<100;i++){
  // Wool occupies roughly a third of each stitch width. A slightly flattened
  // cross-section preserves interlocking depth without leaving a lacy grid of
  // hair-thin cords, or needing a huge backing slab to fit round yarn.
  radius=Math.min(requestedPitch*.15,height*.37,w*.04,d*.04);
  const margin=Math.min(.12,Math.min(w,d)*.08)+radius*1.12;
  innerW=Math.max(w*.1,w-margin*2);innerD=Math.max(d*.1,d-margin*2);
  nx=Math.max(1,Math.floor(innerW/requestedPitch));pitch=innerW/nx;
  amplitudeZ=Math.min(pitch*4/TAU,Math.max(0,(innerD-radius*2)/2));
  nz=Math.max(1,Math.floor(Math.max(0,innerD-amplitudeZ*2)/(pitch*4.5/TAU))+1);
  bands=cable?Math.max(1,Math.floor(innerW/(pitch*6.8))):0;
  bandCenters=Array.from({length:bands},(_,band)=>-innerW/2+(band+.5)*innerW/bands);
  intervals=[];let start=-1;
  for(let column=0;column<=nx;column++){
   const x=-innerW/2+(column+.5)*pitch,visible=column<nx&&!bandCenters.some(center=>Math.abs(x-center)<pitch*1.62);
   if(visible&&start<0)start=column;
   if(!visible&&start>=0){intervals.push([start,column]);start=-1;}
  }
  const baseLoops=intervals.reduce((count,[a,b])=>count+b-a,0)*nz;
  ribSegments=Math.max(16,nz*3);
  // Cable wales are continuous: four recessed connector segments join each
  // stitch to its neighbour below the backing, not capped short cuttings.
  const braidSegments=nz*samples+Math.max(0,nz-1)*4;
  triangles=baseLoops*samples*radial*2+nz*intervals.length*radial*2+bands*3*(braidSegments*radial*2+radial*2)+bands*4*(ribSegments*radial*2+radial*2);
  if(triangles<=MAX_KNIT_TRIANGLES)break;
  requestedPitch*=1.045;
 }
 return {nx,nz,pitch,amplitudeZ,radius,innerW,innerD,bands,bandCenters,intervals,radial,samples,ribSegments,triangles,height,densityLimited:requestedPitch>.46/Math.sqrt(density)*1.01};
}

/** One indexed yarn mesh, not hundreds of individual TubeGeometry meshes.
 * Continuous interlocked courses form visible V stitches; every cross-section
 * has helically rotating three-ply lobes, not a painted flat normal-map pattern.
 * All positions are baked in support-local coordinates for the existing shared
 * soft-contact shader and its identical depth/shadow variant. */
export function knitGeometry(o:StageObject):T.BufferGeometry{
 const l=layout(o),{nx,nz,pitch,amplitudeZ,radius,innerW,innerD,radial,samples,height}=l,[w,h,d]=o.size;
 const positions:number[]=[],uvs:number[]=[],colors:number[]=[],indices:number[]=[],seams:[number,number][]=[];
 const center=new T.Vector3(),previous=new T.Vector3(),tangent=new T.Vector3(),normal=new T.Vector3(),binormal=new T.Vector3();
 const top=h/2,verticalRadius=Math.min(radius*.65,height*.22),thicknessAmplitude=Math.max(0,(height-verticalRadius*2.22)/2),centerY=top-height/2;
 let strands=0;
 const tube=(segments:number,point:(u:number,target:T.Vector3)=>T.Vector3,r:number,salt:number)=>{
  const offset=positions.length/3,stride=radial+1,tone=.91+random(salt,43)*.09;
  let distance=0;
  for(let i=0;i<=segments;i++){
   const u=i/segments;point(u,center);
   const epsilon=.00002;tangent.copy(point(Math.min(1,u+epsilon),new T.Vector3())).sub(point(Math.max(0,u-epsilon),new T.Vector3())).normalize();
   normal.set(0,1,0).addScaledVector(tangent,-tangent.y).normalize();binormal.crossVectors(tangent,normal).normalize();
   if(i)distance+=center.distanceTo(previous);previous.copy(center);
   for(let j=0;j<=radial;j++){
    const angle=j/radial*TAU;
    // A three-ply, slowly twisting cross-section gives actual winding ridges
    // and highlight variation even without a normal/displacement texture.
    const twist=distance/Math.max(.001,r)*.88+salt*.31;
    // Broad lobes without a star/hexagonal silhouette at macro distance.
    const cordRadius=r*(1+.045*Math.cos(angle*3-twist)),verticalScale=Math.min(.65,height*.22/r);
    let x=center.x+cordRadius*(Math.cos(angle)*normal.x+Math.sin(angle)*binormal.x);
    let z=center.z+cordRadius*(Math.cos(angle)*normal.z+Math.sin(angle)*binormal.z);
    // Preserve the backing's rounded corners, with no yarn sticking outside
    // its nominal extents and no rectangular floating sheet above its folds.
    const corner=Math.min(o.shape==='drape'?.34:.5,h*.45,w/7,d/7),qx=Math.abs(x)-w/2+corner,qz=Math.abs(z)-d/2+corner;
    if(qx>0&&qz>0&&Math.hypot(qx,qz)>corner){const k=corner/Math.hypot(qx,qz);x=Math.sign(x)*(w/2-corner+qx*k);z=Math.sign(z)*(d/2-corner+qz*k);}
    x=T.MathUtils.clamp(x,-w/2,w/2);z=T.MathUtils.clamp(z,-d/2,d/2);
    const y=center.y+verticalScale*cordRadius*(Math.cos(angle)*normal.y+Math.sin(angle)*binormal.y)+stageClothHeight(o,x,z)-top;
    positions.push(x,Math.min(top,y),z);
    uvs.push(distance/Math.max(.015,r*7),angle/TAU+distance/Math.max(.04,r*21));
    const fiberTone=tone*(.96+.04*Math.cos(angle*3-twist));colors.push(fiberTone,fiberTone,fiberTone);
   }
   seams.push([offset+i*stride,offset+i*stride+radial]);
   if(i<segments)for(let j=0;j<radial;j++){
    const a=offset+i*stride+j,b=a+stride,c=b+1,dd=a+1;
    indices.push(a,dd,b,b,dd,c);
   }
  }
  // Closed ends avoid open black tubes at the hem. The duplicate cap vertices
  // keep the cap normals from flattening the surrounding rounded yarn normal.
  for(const [ring,sign] of [[offset,-1],[offset+segments*stride,1]]){
   const cap=positions.length/3,cp=new T.Vector3();for(let j=0;j<radial;j++)cp.add(new T.Vector3(positions[(ring+j)*3],positions[(ring+j)*3+1],positions[(ring+j)*3+2]));cp.multiplyScalar(1/radial);
   positions.push(cp.x,cp.y,cp.z);uvs.push(0,.5);colors.push(tone,tone,tone);
   for(let j=0;j<=radial;j++){const id=ring+j;positions.push(positions[id*3],positions[id*3+1],positions[id*3+2]);uvs.push(j/radial,0);colors.push(tone,tone,tone);}
   for(let j=0;j<radial;j++)sign<0?indices.push(cap,cap+j+2,cap+j+1):indices.push(cap,cap+j+1,cap+j+2);
  }
  strands++;
 };
 const rowSpan=Math.max(0,innerD-amplitudeZ*2);
 let loopCount=0;
 for(let row=0;row<nz;row++){
  const rowZ=nz===1?0:-rowSpan/2+row/(nz-1)*rowSpan;
  for(const [from,to] of l.intervals){
   loopCount+=to-from;
   tube((to-from)*samples,(u,target)=>{
    const t=(from+u*(to-from))*TAU,depth=-thicknessAmplitude*Math.cos(2*t),tuckWidth=.15/(to-from);
    const tuck=height*.37*Math.max(1-T.MathUtils.smoothstep(u,0,tuckWidth),T.MathUtils.smoothstep(u,1-tuckWidth,1));
    // x(t) reverses locally, making interlocked loops rather than disconnected
    // U rings. Recessed returns run below their neighbouring front-facing legs.
    return target.set(-innerW/2+pitch/TAU*(t+1.5*Math.sin(2*t)),centerY+depth-(l.bands?height*.11:0)-tuck,rowZ+amplitudeZ*Math.cos(t));
   },radius,row+from*17+11);
  }
 }
 if(l.bands){
  const braidRadius=radius*1.08,braidAmplitude=Math.min(pitch*.96,innerW/(l.bands*4));
  const length=Math.max(.001,innerD),repeat=Math.max(1,Math.round(length/(pitch*6.2)));
  const connectorSamples=4,cycle=samples+connectorSamples,braidSegments=nz*samples+Math.max(0,nz-1)*connectorSamples;
  for(let band=0;band<l.bands;band++)for(let strand=0;strand<3;strand++){
   const x0=l.bandCenters[band],phase=strand*TAU/3;
   const stitch=(row:number,u:number,target:T.Vector3)=>{
    const rowZ=nz===1?0:-rowSpan/2+row/(nz-1)*rowSpan,t=u*TAU,z=rowZ+amplitudeZ*Math.cos(t),braidPhase=(z/length+.5)*TAU*repeat+phase;
    return target.set(x0+pitch/TAU*(t+1.5*Math.sin(2*t))-pitch/2+braidAmplitude*Math.sin(braidPhase),centerY+height*(-.14*Math.cos(2*t)+.12*Math.cos(braidPhase)),z);
   };
   loopCount+=nz;
   tube(braidSegments,(u,target)=>{
    const sample=u*braidSegments,row=Math.min(nz-1,Math.floor(sample/cycle)),within=sample-row*cycle;
    if(within<=samples||row===nz-1){
     stitch(row,Math.min(1,within/samples),target);
     // Only the two outer hem terminals are capped, below the visible field.
     if(sample<3)target.y-=height*.4*(1-T.MathUtils.smoothstep(sample,0,3));
     if(sample>braidSegments-3)target.y-=height*.4*T.MathUtils.smoothstep(sample,braidSegments-3,braidSegments);
     return target;
    }
    const v=(within-samples)/connectorSamples,a=stitch(row,1,new T.Vector3()),b=stitch(row+1,0,new T.Vector3());
    target.lerpVectors(a,b,v);
    target.y-=height*.9*Math.sin(Math.PI*v);return target;
   },braidRadius,band*101+strand*29+101);
  }
  // Recessed purl ribs fill the braid channels. These are softly undulating
  // continuous yarn, so an oblique view never exposes a bare smooth strip of
  // backing under the crossing strands.
  for(let band=0;band<l.bands;band++)for(const rib of [-1.36,-.45,.45,1.36]){
   tube(l.ribSegments,(u,target)=>{
    const z=(u-.5)*innerD,t=z/pitch*TAU;
    return target.set(l.bandCenters[band]+rib*pitch+pitch*.055*Math.sin(t),top-height*.79+height*.025*Math.cos(t),z);
   },radius*.48,band*179+Math.round((rib+2)*100));
  }
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const normals=geometry.getAttribute('normal');
 for(const [a,b] of seams){normal.set(normals.getX(a)+normals.getX(b),normals.getY(a)+normals.getY(b),normals.getZ(a)+normals.getZ(b)).normalize();normals.setXYZ(a,normal.x,normal.y,normal.z);normals.setXYZ(b,normal.x,normal.y,normal.z);}
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.userData={stageYarn:true,knitPattern:o.knitPattern??'stockinette',loopCount,yarnStrands:strands,terminalCaps:strands*2,radialSegments:radial,braidBands:l.bands,triangleCount:indices.length/3,drawCalls:1,yarnHeight:height,pitch,densityLimited:l.densityLimited};
 return geometry;
}
