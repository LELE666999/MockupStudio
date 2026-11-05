import * as THREE from 'three';
/** Per-material tone mapping leaves screens, text and background colors alone. */
export function studioMaterials(){
  const cache=new Map<THREE.Material,THREE.Material>();
  const versions=new WeakMap<THREE.Material,number>();
  return {
    apply(scene:THREE.Scene){
      const changed:{mesh:THREE.Mesh;material:THREE.Material|THREE.Material[]}[]=[];
      scene.traverse(object=>{
        const mesh=object as THREE.Mesh;
        if(!mesh.isMesh||mesh.userData.studioColorCritical)return;
        const remap=(original:THREE.Material)=>{
          if(!original.toneMapped||(!(original as any).isMeshStandardMaterial&&!(original as any).isMeshPhysicalMaterial))return original;
          let clone=cache.get(original);
          if(!clone){
            clone=original.clone();const compile=original.onBeforeCompile.bind(original),key=original.customProgramCacheKey();
            clone.onBeforeCompile=(shader,renderer)=>{
              compile(shader,renderer);
              shader.uniforms.toneMappingExposure={value:1};
              shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n#include <tonemapping_pars_fragment>').replace('#include <tonemapping_fragment>','gl_FragColor.rgb = NeutralToneMapping(gl_FragColor.rgb);');
            };
            clone.customProgramCacheKey=()=>`${key}:mockup-studio-neutral`;
            cache.set(original,clone);
          }
          clone.copy(original);
          // This wrapper modifies colour only; retain conservative handling
          // for an unknown original vertex/depth shader.
          clone.userData.shadowStatic=original.userData.shadowStatic??original.onBeforeCompile===THREE.Material.prototype.onBeforeCompile;
          if(versions.get(original)!==original.version){clone.needsUpdate=true;versions.set(original,original.version);}
          return clone;
        };
        changed.push({mesh,material:mesh.material});mesh.material=Array.isArray(mesh.material)?mesh.material.map(remap):remap(mesh.material);
      });
      return ()=>{
        changed.forEach(({mesh,material})=>mesh.material=material);
        const active=new Set(changed.flatMap(({material})=>Array.isArray(material)?material:[material]));
        for(const [original,clone] of cache)if(!active.has(original)){clone.dispose();cache.delete(original);}
      };
    },
    dispose(){cache.forEach(material=>material.dispose());cache.clear();},
  };
}
