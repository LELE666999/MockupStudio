import * as THREE from 'three';
import {BlendFunction, DepthOfFieldEffect, EffectPass, MaskFunction, ShaderPass} from 'postprocessing';
import {FullScreenQuad} from 'three/examples/jsm/postprocessing/Pass.js';
import {lensRadius} from './thinLens.ts';
import {CoCDilation} from './CoCDilation.ts';
import {LensLayers,lensLayers} from './LensLayers.ts';

type LensOptions = {enabled:boolean;focus:number;aperture:number;exposure:number;revision:unknown;exporting:boolean;playing:boolean};

class ProductDepthOfFieldEffect extends DepthOfFieldEffect {
 private dilation=new CoCDilation();
 constructor(camera:THREE.Camera){
  super(camera,{blendFunction:BlendFunction.SRC,bokehScale:24,resolutionScale:.5});
  // CoC is a continuous radius, not an 8-bit colour. Quantizing it creates
  // contour bands in the far mask which leak the background through a dark
  // opaque screen as the mask is blurred and recombined.
  for(const name of ['nearCoCBuffer','farCoCBuffer']){
   (this.uniforms.get(name)!.value as THREE.Texture).type=THREE.HalfFloatType;
  }
  this.blurPass.render=(renderer,input,output)=>this.dilation.render(renderer,input,output,this.bokehScale);
  // Remove the defocused source, rather than leaving its sharp silhouette
  // underneath its blurred copy. Work on transparent object coverage; the
  // background is composited afterwards to fill newly exposed edge pixels.
  this.setFragmentShader(`uniform sampler2D nearColorBuffer,farColorBuffer,nearCoCBuffer,farCoCBuffer;
   uniform float scale;
   void mainImage(const in vec4 inputColor,const in vec2 uv,const in float depth,out vec4 outputColor){
    float farCoverage=clamp(texture2D(nearCoCBuffer,uv).g*scale,0.,1.);
    float nearCoverage=clamp(texture2D(nearCoCBuffer,uv).r*scale,0.,1.);
    vec4 colorNear=texture2D(nearColorBuffer,uv),colorFar=texture2D(farColorBuffer,uv);
    vec4 farResult=mix(inputColor,colorFar,farCoverage);
    outputColor=mix(farResult,colorNear,nearCoverage);
   }`);
 }
 dispose(){this.dilation.dispose();super.dispose();}
}

// One colour/depth render per subject; hidden rear subjects are retained for
// occlusion-correct bokeh. Pointer movement never changes rendering quality.
export class RealtimeLensRenderer {
 private layers=new LensLayers();
 private frame = new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});
 private result = new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
 private background = new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
 private backgroundScene = new THREE.Scene();
 private dof:DepthOfFieldEffect|null=null;
 private pass:EffectPass|null=null;
 private camera:THREE.Camera|null=null;
 private size = new THREE.Vector2();
 private output = new THREE.ShaderMaterial({
  uniforms:{map:{value:null},backgroundMap:{value:null},exposure:{value:1}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`uniform sampler2D map,backgroundMap;uniform float exposure;varying vec2 vUv;
   void main(){vec4 c=texture2D(map,vUv);c+=texture2D(backgroundMap,vUv)*(1.-clamp(c.a,0.,1.));float a=clamp(c.a,0.,1.);vec3 rgb=a>0.00001?c.rgb/a:vec3(0.);
   gl_FragColor=linearToOutputTexel(vec4(rgb*exposure,a));gl_FragColor.rgb*=a;}`,
  depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false
 });
 private quad=new FullScreenQuad(this.output);

 constructor(private gl:THREE.WebGLRenderer){
  this.frame.samples=Math.min(4,gl.capabilities.maxSamples);
  this.frame.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
  this.frame.texture.generateMipmaps=true;
  this.frame.texture.minFilter=THREE.LinearMipmapLinearFilter;
 }
 private setup(camera:THREE.Camera){
  if(this.camera===camera)return;
  this.pass?.dispose();
  const dof=this.dof=new ProductDepthOfFieldEffect(camera);
  dof.maskFunction=MaskFunction.MULTIPLY;
  // The default highlight-fill pass uses a component-wise maximum, which
  // expands bright rims. Product previews need energy-preserving coverage.
  const passes=dof as unknown as {maskPass:ShaderPass;bokehNearFillPass:ShaderPass;bokehFarFillPass:ShaderPass;bokehFarBasePass:ShaderPass;bokehNearBasePass:ShaderPass;renderTargetMasked:THREE.WebGLRenderTarget};
  // Filter colour and its actual object alpha together. The library's far
  // mask premultiplies by CoC before filtering, then subtracts the *unfiltered*
  // CoC during composition. On tilted opaque surfaces those weights disagree,
  // creating transparent contour lines even without any lighting or texture.
  // Use one complementary mix weight for both colour and alpha instead.
  (passes.maskPass.fullscreenMaterial as THREE.ShaderMaterial).fragmentShader='uniform sampler2D inputBuffer;varying vec2 vUv;void main(){gl_FragColor=texture2D(inputBuffer,vUv);}';
  for(const pass of [passes.bokehNearFillPass,passes.bokehFarFillPass]){
   (pass.fullscreenMaterial as THREE.ShaderMaterial).fragmentShader='uniform sampler2D inputBuffer;varying vec2 vUv;void main(){gl_FragColor=texture2D(inputBuffer,vUv);}';
  }
  (passes.bokehFarBasePass.fullscreenMaterial as THREE.ShaderMaterial).uniforms.cocBuffer.value=dof.uniforms.get('nearCoCBuffer')!.value;
  passes.renderTargetMasked.texture.generateMipmaps=true;
  passes.renderTargetMasked.texture.minFilter=THREE.LinearMipmapLinearFilter;
  for(const pass of [passes.bokehNearBasePass,passes.bokehFarBasePass]){
   const material=pass.fullscreenMaterial as THREE.ShaderMaterial;
   // Match each aperture tap's footprint to its spacing. Point-like sampling
   // of a thin bright rim otherwise creates dotted/ring-shaped aliasing.
   material.fragmentShader=material.fragmentShader.replaceAll('acc+=texture2D(inputBuffer,uv);','acc+=textureLod(inputBuffer,uv,max(0.0,log2(max(1.0,coc*0.25))));');
  }
  const coc=dof.cocMaterial;
  coc.uniforms.lensFocus=new THREE.Uniform(8);
  coc.uniforms.radiusScale=new THREE.Uniform(1);
  coc.uniforms.radiusLimit=new THREE.Uniform(24);
  coc.uniforms.orthographic=new THREE.Uniform(0);
  // Match the previous thin-lens size calibration (25 mm / scene unit),
  // but compute each pixel's circle of confusion from its actual view depth.
  coc.fragmentShader=`#include <packing>
   uniform sampler2D depthBuffer;uniform float cameraNear,cameraFar,lensFocus,radiusScale,radiusLimit,orthographic;
   varying vec2 vUv;
   void main(){float d=texture2D(depthBuffer,vUv).r;
    if(d>=.999999){gl_FragColor=vec4(0.);return;}
    float z;
    #ifdef LOG_DEPTH
     z=orthographic>.5?mix(cameraNear,cameraFar,d):exp2(d*log2(cameraFar+1.))-1.;
    #else
     z=orthographic>.5?mix(cameraNear,cameraFar,d):-perspectiveDepthToViewZ(d,cameraNear,cameraFar);
    #endif
    float radius=orthographic>.5?radiusScale*(z/lensFocus-1.):radiusScale*(1./lensFocus-1./z);
    float magnitude=clamp(abs(radius)/radiusLimit,0.,1.);
    gl_FragColor=vec4(radius<0.?magnitude:0.,radius>=0.?magnitude:0.,0.,1.);
   }`;
  this.pass=new EffectPass(camera,dof);
  this.pass.encodeOutput=false;
  this.pass.initialize(this.gl,true,THREE.HalfFloatType);
  this.pass.setDepthTexture(this.frame.depthTexture!);
  this.pass.setSize(this.frame.width,this.frame.height);
  this.camera=camera;
 }
 render(scene:THREE.Scene,camera:THREE.Camera,options:LensOptions){
  const gl=this.gl;
  this.setup(camera);
  gl.getDrawingBufferSize(this.size);
  if(this.frame.width!==this.size.x||this.frame.height!==this.size.y){
   this.frame.setSize(this.size.x,this.size.y);this.result.setSize(this.size.x,this.size.y);this.background.setSize(this.size.x,this.size.y);
   this.pass!.setSize(this.size.x,this.size.y);
  }
  const dof=this.dof!,coc=dof.cocMaterial;
  const clipCamera=camera as THREE.PerspectiveCamera|THREE.OrthographicCamera;
  coc.uniforms.cameraNear.value=clipCamera.near;coc.uniforms.cameraFar.value=clipCamera.far;
  const perspective=(camera as THREE.PerspectiveCamera).isPerspectiveCamera;
  const fov=perspective?(camera as THREE.PerspectiveCamera).getEffectiveFOV():45;
  coc.uniforms.lensFocus.value=Math.max(.02,options.focus);
  coc.uniforms.orthographic.value=perspective?0:1;
  dof.bokehScale=24*this.size.y/512;
  coc.uniforms.radiusLimit.value=dof.bokehScale;
  coc.uniforms.radiusScale.value=lensRadius(24/(2*Math.tan(THREE.MathUtils.degToRad(fov/2))),options.aperture)*Math.abs(camera.projectionMatrix.elements[5])*this.size.y/2;
  const target=gl.getRenderTarget(),tone=gl.toneMapping,auto=gl.autoClear,bg=scene.background;
  const clear=gl.getClearColor(new THREE.Color()),alpha=gl.getClearAlpha();
  try{
   gl.toneMapping=THREE.NoToneMapping;gl.autoClear=true;
   this.backgroundScene.background=bg;
   this.backgroundScene.backgroundIntensity=scene.backgroundIntensity;
   this.backgroundScene.backgroundBlurriness=scene.backgroundBlurriness;
   this.backgroundScene.backgroundRotation.copy(scene.backgroundRotation);
   gl.setRenderTarget(this.background);gl.clear();gl.render(this.backgroundScene,camera);
   scene.background=null;gl.setClearColor(0,0);
   const layers=options.enabled?lensLayers(scene,camera):[];
   if(layers.length>1){
    this.layers.render(gl,scene,camera,layers,this.frame,this.result,dof.bokehScale,()=>this.pass!.render(gl,this.frame,this.result,0,false));
   }else{
    this.layers.release();
    gl.setRenderTarget(this.frame);gl.clear();gl.render(scene,camera);
    if(options.enabled)this.pass!.render(gl,this.frame,this.result,0,false);
   }
   this.output.uniforms.map.value=options.enabled?this.result.texture:this.frame.texture;
   this.output.uniforms.backgroundMap.value=this.background.texture;
   this.output.uniforms.exposure.value=options.exposure;
   gl.setRenderTarget(target);gl.clear();this.quad.render(gl);
   gl.domElement.dataset.lensRenderer='realtime';
   gl.domElement.dataset.lensLayers=String(Math.max(1,layers.length));
  }finally{scene.background=bg;gl.setClearColor(clear,alpha);gl.setRenderTarget(target);gl.toneMapping=tone;gl.autoClear=auto;}
 }
 dispose(){this.layers.dispose();this.pass?.dispose();this.frame.depthTexture?.dispose();this.frame.dispose();this.result.dispose();this.background.dispose();this.output.dispose();this.quad.dispose();}
}
