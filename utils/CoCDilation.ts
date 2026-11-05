import * as THREE from 'three';
import {FullScreenQuad} from 'three/examples/jsm/postprocessing/Pass.js';

/** Extend lens support across a silhouette before gathering its blurred colour.
 * Blurring the radius itself makes it shrink at precisely the edge that needs
 * to spread. Two maximum-filter passes retain that radius outside the source.
 */
export class CoCDilation {
 private target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
 private material=new THREE.ShaderMaterial({
  uniforms:{inputBuffer:{value:null},axis:{value:new THREE.Vector2()},radius:{value:24}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`uniform sampler2D inputBuffer;uniform vec2 axis;uniform float radius;varying vec2 vUv;
   void main(){vec2 support=texture2D(inputBuffer,vUv).rg;
    for(int i=-8;i<=8;i++){
     float distance=float(i)/8.;vec2 sampleCoC=texture2D(inputBuffer,clamp(vUv+axis*radius*distance,0.,1.)).rg;
     support=max(support,sampleCoC*step(vec2(abs(distance)),sampleCoC));
    }
    gl_FragColor=vec4(support,0.,1.);
   }`,
  depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.NoBlending
 });
 private quad=new FullScreenQuad(this.material);
 render(gl:THREE.WebGLRenderer,input:THREE.WebGLRenderTarget,output:THREE.WebGLRenderTarget,radius:number){
  if(this.target.width!==output.width||this.target.height!==output.height)this.target.setSize(output.width,output.height);
  const u=this.material.uniforms;u.radius.value=radius;u.inputBuffer.value=input.texture;u.axis.value.set(1/input.width,0);
  gl.setRenderTarget(this.target);this.quad.render(gl);
  u.inputBuffer.value=this.target.texture;u.axis.value.set(0,1/input.height);
  gl.setRenderTarget(output);this.quad.render(gl);
 }
 dispose(){this.target.dispose();this.material.dispose();this.quad.dispose();}
}
