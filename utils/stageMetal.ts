import * as T from 'three';
import type {StageObject} from '../types';

/** Cached per Canvas, not captured again when the user orbits the scene. This
 * reflection rig is shared by stage surfaces; screen colours stay untouched. */
export function stageMetalStudio(renderer:T.WebGLRenderer){
 const studio=new T.Scene();studio.background=new T.Color('#303640');
 const panels:T.Mesh[]=[];
 const softbox=(position:[number,number,number],width:number,height:number,color:string,intensity:number)=>{
  const material=new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(intensity),side:T.DoubleSide,toneMapped:false});
  const panel=new T.Mesh(new T.PlaneGeometry(width,height),material);
  panel.position.set(...position);panel.lookAt(0,0,0);studio.add(panel);panels.push(panel);
 };
 // Broad diffuse sources and dark gaps give cylindrical wires a light side,
 // a restrained specular strip, and a dark side instead of flat grey paint.
 softbox([-4,4,4],4,7,'#fff6ec',3.2);
 softbox([4,2,1],1.2,7,'#e6f0ff',2.6);
 softbox([0,7,-1],5,4,'#ffffff',2.8);
 softbox([0,1,-6],3,5,'#d6e3f4',1.2);
 softbox([0,-5,0],7,7,'#b2b6bc',.25);
 const pmrem=new T.PMREMGenerator(renderer);
 const target=pmrem.fromScene(studio,.035,.1,30);
 pmrem.dispose();panels.forEach(p=>{p.geometry.dispose();(p.material as T.Material).dispose();});
 // Low-contrast micro-roughness. No normal-map scratches on subpixel wires:
 // those shimmer when the camera moves and are not useful surface detail.
 const width=256,height=64,data=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const hash=(Math.imul(x+1,73856093)^Math.imul(y+1,19349663))>>>0;
  const value=Math.round(224+13*Math.sin(y*2.31)+(hash%9));
  const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
 }
 const roughness=new T.DataTexture(data,width,height,T.RGBAFormat);
 roughness.wrapS=roughness.wrapT=T.RepeatWrapping;
 roughness.minFilter=T.LinearMipmapLinearFilter;roughness.magFilter=T.LinearFilter;
 roughness.generateMipmaps=true;roughness.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());roughness.needsUpdate=true;
 return {environment:target.texture,roughness,dispose:()=>{target.dispose();roughness.dispose();}};
}

export function stageMetalParameters(object:StageObject,part:'frame'|'wire'='frame'):T.MeshPhysicalMaterialParameters{
 return {
  color:object.color,metalness:1,roughness:object.roughness*(part==='wire'?.78:1),
  anisotropy:part==='wire'?.18:.35,
  clearcoat:0,transmission:0,
 };
}
