import * as T from 'three';
import {foldHalfAngle,foldPoint,foldScreen,FOLD_STRIP} from './foldGeometry.ts';
import {modelFileName} from './modelMaterials.ts';

export const APPLE_DUO_INNER='AppleDuoInnerScreen';
export const APPLE_DUO_COVER='hhgAIoCGsHXeDPY001';
export const isAppleDuo=(source:string|undefined)=>modelFileName(source).toLowerCase()==='iphone-duo.glb';
export interface AppleDuoRig {
 frame:T.Object3D;left:T.Group;right:T.Group;screen:T.Mesh<T.BufferGeometry>;bezel:T.Mesh<T.BufferGeometry>;
 flat:Float32Array;flatBezel:Float32Array;angle:number;
}
/** This particular asset bakes two rigid halves in their closed poses. Its
 * local vertex data retains the original open modelling frame. Never apply
 * this reconstruction to an arbitrary GLB or to a straight iPhone. */
export function prepareAppleDuo(object:T.Object3D):AppleDuoRig{
 const parts:T.Mesh[]=[];object.traverse(o=>{if((o as T.Mesh).isMesh)parts.push(o as T.Mesh);});
 const left=new T.Group(),right=new T.Group();left.name='apple-duo-left-panel';right.name='apple-duo-right-panel';
 const scale=5/16.4669285;
 // The old closed display, bend sheets and invisible export envelope are
 // superseded by one continuous inner display, not shown on top of it.
 const replaced=new Set(['JnJdTkxbQgUtLwU001','UXtsBZYlaUvHoEh001','xdyyaajWsatVNxN001','lJPfQMFXvvcmdtA001']);
 for(const mesh of parts){
  mesh.removeFromParent();
  if(replaced.has(mesh.name)){mesh.geometry.dispose();continue;}
  mesh.position.set(0,0,0);mesh.quaternion.identity();mesh.scale.set(1,1,1);mesh.updateMatrix();
  mesh.geometry.scale(scale,scale,scale);mesh.geometry.rotateX(Math.PI);mesh.geometry.computeBoundingBox();
  const mid=mesh.geometry.boundingBox!.getCenter(new T.Vector3()).x;
  if(mesh.name==='MvKPXGSdYDVvSpk001'){
   // Retain the original hinge surface, tucked behind the flexible screen.
   mesh.geometry.scale(.4,1,.5);object.add(mesh);
  }else (mid<0?left:right).add(mesh);
 }
 object.add(left,right);
 const geometry=foldScreen(5.04,3.46,.16,180,.014);
 // Generated UVs follow glTF's top-origin image convention (flipY=false).
 const uv=geometry.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setY(i,1-uv.getY(i));
 geometry.userData.screenAspect=5.04/3.46;
 const screen=new T.Mesh(geometry,new T.MeshPhysicalMaterial({color:'#111111',roughness:1,metalness:0,side:T.DoubleSide}));
 screen.name=APPLE_DUO_INNER;screen.userData.originalMaterial=screen.material;
 const bezel=new T.Mesh(foldScreen(5.15,3.55,.17,180,.008),new T.MeshStandardMaterial({color:'#08090c',roughness:.5,side:T.DoubleSide}));
 bezel.name='AppleDuoInnerBezel';bezel.userData.originalMaterial=bezel.material;object.add(bezel,screen);
 // Cover aspect must not change as the panel rotates through the hinge.
 const cover=parts.find(m=>m.name===APPLE_DUO_COVER);
 if(cover?.geometry.boundingBox){const size=cover.geometry.boundingBox.getSize(new T.Vector3());cover.geometry.userData.screenAspect=size.x/size.y;}
 const rig={frame:object,left,right,screen,bezel,flat:new Float32Array(geometry.getAttribute('position').array),flatBezel:new Float32Array(bezel.geometry.getAttribute('position').array),angle:NaN};
 updateAppleDuoFold(rig,180);return rig;
}
/** Only rigid group matrices and the small flexible strip update per frame.
 * Body/camera/UV buffers and the two media elements remain the same objects. */
export function updateAppleDuoFold(rig:AppleDuoRig,angle:number){
 angle=Math.max(0,Math.min(180,Number.isFinite(angle)?angle:180));if(rig.angle===angle)return;
 rig.angle=angle;const a=foldHalfAngle(angle),[x,z]=foldPoint(FOLD_STRIP/2,angle);
 rig.left.position.set(-x,0,z);rig.right.position.set(x,0,z);
 rig.left.rotation.y=a;rig.right.rotation.y=-a;
 rig.frame.position.z=-foldPoint(2.59,angle)[1]/2;
 for(const [geometry,flat] of [[rig.screen.geometry,rig.flat],[rig.bezel.geometry,rig.flatBezel]] as const){
  const pos=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');
  for(let i=0;i<pos.count;i++){
   const px=flat[i*3],bend=foldPoint(px,angle),tilt=Math.sign(px)*Math.min(Math.abs(px)/(FOLD_STRIP/2),1)*a;
   const nx=-Math.sin(tilt),nz=Math.cos(tilt),offset=flat[i*3+2];
   pos.setXYZ(i,bend[0]+nx*offset,flat[i*3+1],bend[1]+nz*offset);
   normal.setXYZ(i,nx,0,nz);
  }
  pos.needsUpdate=true;normal.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();
 }
 rig.screen.userData.foldAngle=angle;
}
