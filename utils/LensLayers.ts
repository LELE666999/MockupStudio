import * as THREE from 'three';
import {FullScreenQuad} from 'three/examples/jsm/postprocessing/Pass.js';
import {SceneShadowCache} from './SceneShadowCache.ts';

type Drawable=THREE.Object3D & {material?:THREE.Material|THREE.Material[]};
export type LensLayer={root:THREE.Object3D;objects:Drawable[];overlay:boolean};

/** Render each handset separately, retaining surfaces hidden by other phones.
 * Lights are never hidden. Invisible descendants / materials stay invisible.
 */
export function lensLayers(scene:THREE.Scene,camera:THREE.Camera):LensLayer[]{
 const groups=new Map<THREE.Object3D,LensLayer>();
 scene.traverseVisible(object=>{
  const mesh=object as THREE.Mesh;
  if(!(mesh.isMesh||(object as THREE.Line).isLine||(object as THREE.Points).isPoints||(object as THREE.Sprite).isSprite)||!camera.layers.test(object.layers))return;
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  if(!materials.some(m=>m?.visible&&(!m.transparent||m.opacity>0)))return;
  let root:THREE.Object3D=scene,overlay=false;
  for(let p:THREE.Object3D|null=object;p&&p!==scene;p=p.parent){
   if(p.userData.sceneGizmo||(p as any).isTransformControls){root=p;overlay=true;break;}
   if(p.userData.mockupModelId||p.userData.stageId||p.userData.mockupTextId||p.userData.lensGroupId)root=p;
  }
  if(!groups.has(root))groups.set(root,{root,objects:[],overlay});
  groups.get(root)!.objects.push(object);
 });
 return [...groups.values()];
}

const vertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const settings={depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false};

/** Per-object linear premultiplied colour and view-depth arrays. The expensive
 * bokeh intermediates are shared; only the finished layers are retained.
 * Texture arrays avoid a sampler-count limit when the user adds more phones.
 */
export class LensLayers {
 private shadows=new SceneShadowCache();
 // The colour produced while refreshing shadows is discarded. A tiny target
 // avoids a redundant full-resolution colour pass without altering the light
 // camera, shadow-map dimensions or any visible bokeh layer.
 private shadowFrame=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false});
 private shadowRenderer:THREE.WebGLRenderer|null=null;
 private restoreShadows=()=>this.shadows.reset();
 private color:THREE.WebGLArrayRenderTarget|null=null;
 private depth:THREE.WebGLArrayRenderTarget|null=null;
 private count=0;
 private copy=new THREE.ShaderMaterial({...settings,vertexShader:vertex,
  uniforms:{map:{value:null}},fragmentShader:'uniform sampler2D map;varying vec2 vUv;void main(){gl_FragColor=texture2D(map,vUv);}'});
 private depthCopy=new THREE.ShaderMaterial({...settings,vertexShader:vertex,
  uniforms:{depthMap:{value:null},texel:{value:new THREE.Vector2()},near:{value:.1},far:{value:100},ortho:{value:0},logDepth:{value:0},fallback:{value:8},radius:{value:24},overlay:{value:0}},
  fragmentShader:`#include <packing>
   uniform sampler2D depthMap;uniform vec2 texel;
   uniform float near,far,ortho,logDepth,fallback,radius,overlay;varying vec2 vUv;
   float viewDepth(float d){return ortho>.5?mix(near,far,d):(logDepth>.5?exp2(d*log2(far+1.))-1.:-perspectiveDepthToViewZ(d,near,far));}
   void main(){
    if(overlay>.5){gl_FragColor=vec4(.001,0.,0.,1.);return;}
    float d=texture2D(depthMap,vUv).r;
    if(d<.999999){gl_FragColor=vec4(viewDepth(d),0.,0.,1.);return;}
    // Defocused coverage extends beyond the pinhole silhouette. Carry the
    // closest spatial neighbour's depth into that support, not clear depth.
    float z=fallback,best=1e10;
    for(int ring=1;ring<=3;ring++)for(int i=0;i<8;i++){
     float a=float(i)*.78539816339,dist=radius*float(ring)/3.;
     float sampleDepth=texture2D(depthMap,clamp(vUv+vec2(cos(a),sin(a))*texel*dist,0.,1.)).r;
     if(sampleDepth<.999999&&dist<best){z=viewDepth(sampleDepth);best=dist;}
    }
    gl_FragColor=vec4(z,0.,0.,1.);
   }`});
 private composite:THREE.ShaderMaterial|null=null;
 private quad=new FullScreenQuad(this.copy);

 private setup(width:number,height:number,count:number){
  if(this.count!==count){
   this.release();this.count=count;
   this.color=new THREE.WebGLArrayRenderTarget(width,height,count,{depthBuffer:false});
   this.color.texture.type=THREE.HalfFloatType;this.color.texture.minFilter=THREE.LinearFilter;this.color.texture.magFilter=THREE.LinearFilter;
   this.depth=new THREE.WebGLArrayRenderTarget(Math.ceil(width/2),Math.ceil(height/2),count,{depthBuffer:false});
   this.depth.texture.type=THREE.FloatType;this.depth.texture.format=THREE.RedFormat;
   this.depth.texture.minFilter=THREE.NearestFilter;this.depth.texture.magFilter=THREE.NearestFilter;
   this.composite=new THREE.ShaderMaterial({...settings,vertexShader:vertex,
    uniforms:{colors:{value:this.color.texture},depths:{value:this.depth.texture}},
    fragmentShader:`precision highp sampler2DArray;
     uniform sampler2DArray colors,depths;varying vec2 vUv;
     void main(){vec4 c[${count}];float z[${count}];
      for(int i=0;i<${count};i++){c[i]=texture(colors,vec3(vUv,float(i)));z[i]=texture(depths,vec3(vUv,float(i))).r;}
      // Per-pixel depth order also handles tilted / crossing handsets. Array
      // order and active selection never determine which model is in front.
      for(int i=1;i<${count};i++)for(int j=i;j>0;j--){
       if(z[j]>z[j-1]){float t=z[j];z[j]=z[j-1];z[j-1]=t;vec4 v=c[j];c[j]=c[j-1];c[j-1]=v;}
      }
      vec4 sum=vec4(0.);for(int i=0;i<${count};i++)sum=c[i]+sum*(1.-clamp(c[i].a,0.,1.));
      gl_FragColor=sum;
     }`});
  }else{
   this.color!.setSize(width,height,count);this.depth!.setSize(Math.ceil(width/2),Math.ceil(height/2),count);
  }
 }

 render(gl:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,layers:LensLayer[],frame:THREE.WebGLRenderTarget,result:THREE.WebGLRenderTarget,radius:number,blur:()=>void){
  if(this.shadowRenderer!==gl){this.shadowRenderer?.domElement.removeEventListener('webglcontextrestored',this.restoreShadows);this.shadowRenderer=gl;gl.domElement.addEventListener('webglcontextrestored',this.restoreShadows);this.shadows.reset();}
  this.setup(frame.width,frame.height,layers.length);
  const objects=layers.flatMap(l=>l.objects),visibility=objects.map(o=>o.visible);
  const shadowAuto=gl.shadowMap.autoUpdate,shadowNeeds=gl.shadowMap.needsUpdate;
  let shadowUpdated=false;
  const clip=camera as THREE.PerspectiveCamera|THREE.OrthographicCamera;
  const u=this.depthCopy.uniforms;
  u.depthMap.value=frame.depthTexture;u.texel.value.set(1/frame.width,1/frame.height);
  u.near.value=clip.near;u.far.value=clip.far;u.ortho.value=(camera as THREE.OrthographicCamera).isOrthographicCamera?1:0;
  u.logDepth.value=gl.capabilities.logarithmicDepthBuffer?1:0;u.radius.value=radius;
  scene.updateMatrixWorld(true);
  try{
   // Shared shadows must see all casters. Never rebuild shadows from an
   // isolated phone or it would erase the neighbouring phone's shadow.
   const shadowKey=String(gl.shadowMap.type);
   if(gl.shadowMap.enabled&&(shadowNeeds||shadowAuto&&this.shadows.needs(scene,shadowKey))){
    gl.shadowMap.needsUpdate=true;
    gl.setRenderTarget(this.shadowFrame);gl.clear();gl.render(scene,camera);
    this.shadows.commit(scene,shadowKey);
    shadowUpdated=true;
   }
   gl.shadowMap.autoUpdate=false;gl.shadowMap.needsUpdate=false;
   for(let index=0;index<layers.length;index++){
    const layer=layers[index];objects.forEach(o=>o.visible=false);layer.objects.forEach(o=>o.visible=true);
    gl.setRenderTarget(frame);gl.clear();gl.render(scene,camera);
    if(!layer.overlay)blur();
    this.copy.uniforms.map.value=layer.overlay?frame.texture:result.texture;
    this.quad.material=this.copy;gl.setRenderTarget(this.color,index);this.quad.render(gl);
    const center=new THREE.Box3();for(const o of layer.objects)center.expandByObject(o);
    u.fallback.value=Math.max(.02,-center.getCenter(new THREE.Vector3()).applyMatrix4(camera.matrixWorldInverse).z);
    u.overlay.value=layer.overlay?1:0;
    this.quad.material=this.depthCopy;gl.setRenderTarget(this.depth,index);this.quad.render(gl);
   }
   this.quad.material=this.composite!;gl.setRenderTarget(result);this.quad.render(gl);
  }finally{
   objects.forEach((o,i)=>o.visible=visibility[i]);gl.shadowMap.autoUpdate=shadowAuto;gl.shadowMap.needsUpdate=shadowNeeds&&!shadowUpdated;
  }
 }
 release(){this.color?.dispose();this.depth?.dispose();this.composite?.dispose();this.color=null;this.depth=null;this.composite=null;this.count=0;this.shadows.reset();}
 dispose(){this.release();this.shadowFrame.dispose();this.shadowRenderer?.domElement.removeEventListener('webglcontextrestored',this.restoreShadows);this.shadowRenderer=null;this.copy.dispose();this.depthCopy.dispose();this.quad.dispose();}
}
