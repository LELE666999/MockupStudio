import * as THREE from 'three';
import {aperturePoint,lensRadius,offsetLensCamera} from './thinLens.ts';
const vertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
export class ThinLensRenderer{
 private frame:THREE.WebGLRenderTarget;
 private sum=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
 private quadScene=new THREE.Scene();private quadCamera=new THREE.Camera();private geometry=new THREE.PlaneGeometry(2,2);
 private add=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:'uniform sampler2D map;varying vec2 vUv;void main(){gl_FragColor=texture2D(map,vUv)/128.0;}',uniforms:{map:{value:null}},depthTest:false,depthWrite:false,transparent:true,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,blendEquation:THREE.AddEquation,toneMapped:false});
 private output=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:`uniform sampler2D map;uniform float multiplier,exposure;varying vec2 vUv;
 void main(){vec4 c=texture2D(map,vUv)*multiplier;float a=clamp(c.a,0.,1.);vec3 rgb=a>0.00001?c.rgb/a:vec3(0.);gl_FragColor=linearToOutputTexel(vec4(rgb*exposure,a));gl_FragColor.rgb*=a;}`,uniforms:{map:{value:null},multiplier:{value:1},exposure:{value:1}},depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false});
 private quad=new THREE.Mesh(this.geometry,this.add);private sampleCamera:THREE.Camera|null=null;
 private count=0;private signature='';private revision:unknown=null;
 constructor(private gl:THREE.WebGLRenderer){this.frame=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});this.frame.samples=Math.min(4,gl.capabilities.maxSamples);this.quadScene.add(this.quad);}
 render(scene:THREE.Scene,camera:THREE.Camera,options:{enabled:boolean;focus:number;aperture:number;exposure:number;revision:unknown;exporting:boolean;playing:boolean}){
  const gl=this.gl,dimensions=gl.getDrawingBufferSize(new THREE.Vector2()),w=Math.round(dimensions.x),h=Math.round(dimensions.y);
  if(this.frame.width!==w||this.frame.height!==h){this.frame.setSize(w,h);this.sum.setSize(w,h);this.signature='';}
  camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);
  let assets=0;scene.traverseVisible(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;assets+=m.id+(m.geometry?.id||0);for(const mat of Array.isArray(m.material)?m.material:[m.material])assets+=mat.version+((mat as THREE.MeshBasicMaterial).map?.version||0);});
  const signature=[...camera.matrixWorld.elements,...camera.projectionMatrix.elements,options.focus,options.aperture,options.enabled,assets].join(',');
  const reset=this.revision!==options.revision||this.signature!==signature;
  const oldTarget=gl.getRenderTarget(),oldTone=gl.toneMapping,oldClear=gl.getClearColor(new THREE.Color()),oldAlpha=gl.getClearAlpha(),oldAuto=gl.autoClear,oldShadow=gl.shadowMap.autoUpdate;
  try{
   gl.toneMapping=THREE.NoToneMapping;
   if(reset){this.count=0;this.revision=options.revision;this.signature=signature;gl.setRenderTarget(this.sum);gl.setClearColor(0,0);gl.clear();gl.setClearColor(oldClear,oldAlpha);}
   const total=options.enabled?512:1,end=options.exporting?total:Math.min(total,this.count+32);
   if(!this.sampleCamera||this.sampleCamera.type!==camera.type)this.sampleCamera=camera.clone();
   const fov=(camera as THREE.PerspectiveCamera).isPerspectiveCamera?(camera as THREE.PerspectiveCamera).getEffectiveFOV():45;
   const radius=options.enabled?lensRadius(24/(2*Math.tan(THREE.MathUtils.degToRad(fov/2))),options.aperture):0;
   for(;this.count<end;this.count++){
    const [x,y]=aperturePoint(this.count);offsetLensCamera(camera,this.sampleCamera,options.focus,x*radius,y*radius);
    gl.autoClear=true;gl.setClearColor(oldClear,oldAlpha);gl.setRenderTarget(this.frame);gl.clear();gl.render(scene,this.sampleCamera);gl.shadowMap.autoUpdate=false;
    this.quad.material=this.add;this.add.uniforms.map.value=this.frame.texture;gl.autoClear=false;gl.setRenderTarget(this.sum);gl.render(this.quadScene,this.quadCamera);
   }
   gl.domElement.dataset.lensSamples=String(this.count);
   this.quad.material=this.output;this.output.uniforms.map.value=this.sum.texture;this.output.uniforms.multiplier.value=128/Math.max(1,this.count);this.output.uniforms.exposure.value=options.exposure;
   gl.autoClear=true;gl.setRenderTarget(oldTarget);gl.setClearColor(oldClear,oldAlpha);gl.clear();gl.render(this.quadScene,this.quadCamera);
  }finally{gl.setRenderTarget(oldTarget);gl.setClearColor(oldClear,oldAlpha);gl.toneMapping=oldTone;gl.autoClear=oldAuto;gl.shadowMap.autoUpdate=oldShadow;}
 }
 dispose(){this.frame.dispose();this.sum.dispose();this.geometry.dispose();this.add.dispose();this.output.dispose();}
}
