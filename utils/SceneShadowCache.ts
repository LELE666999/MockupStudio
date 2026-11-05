import * as T from 'three';
/** Fixed-light shadow maps do not change when only the viewing camera moves.
 * Observe shadow-affecting data, not editor state identity or texture colour. */
export class SceneShadowCache{
 private signature='';
 key(scene:T.Scene,contextKey=''){
  const values:(string|number|boolean)[]=[scene.uuid,contextKey];let dynamic=false;
  const textureKey=(texture:T.Texture)=>{
   // Texture UV edits update the shader transform, not texture.version.
   // Include both ordinary transforms and manually supplied matrices.
   values.push(texture.uuid,texture.version,texture.source.uuid,texture.source.version,texture.matrixAutoUpdate,texture.offset.x,texture.offset.y,texture.repeat.x,texture.repeat.y,texture.center.x,texture.center.y,texture.rotation,...texture.matrix.elements,texture.wrapS,texture.wrapT,texture.minFilter,texture.magFilter,texture.flipY);
  };
  scene.traverseVisible(object=>{
   const mesh=object as T.Mesh,light=object as T.Light;
   if(mesh.isMesh&&mesh.castShadow){
    values.push(mesh.uuid,...mesh.matrixWorld.elements,mesh.geometry.uuid,mesh.geometry.drawRange.start,mesh.geometry.drawRange.count,mesh.geometry.index?.version??0);
    for(const attribute of Object.values(mesh.geometry.attributes))values.push((attribute as T.BufferAttribute).version??(attribute as T.InterleavedBufferAttribute).data.version);
    if(mesh.morphTargetInfluences)values.push(...mesh.morphTargetInfluences);
    if((mesh as T.SkinnedMesh).isSkinnedMesh)dynamic=true;
    const instanced=mesh as T.InstancedMesh;if(instanced.isInstancedMesh)values.push(instanced.instanceMatrix.version,instanced.count);
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    for(const m of [...materials,mesh.customDepthMaterial,mesh.customDistanceMaterial])if(m){
     const material=m as T.MeshStandardMaterial;
     values.push(m.uuid,m.version,m.visible,m.opacity,m.transparent,material.alphaTest,m.side,m.shadowSide??'default',m.userData.stageContactRevision??0,material.wireframe??false,material.wireframeLinewidth??1,m.clipShadows,m.clipIntersection);
     if(m.clippingPlanes){values.push(m.clippingPlanes.length);for(const plane of m.clippingPlanes)values.push(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);}else values.push('no-clip-planes');
     if((m as T.ShaderMaterial).isShaderMaterial||m.userData.dynamicShadow||m.onBeforeCompile!==T.Material.prototype.onBeforeCompile&&m.userData.shadowStatic!==true)dynamic=true;
     if(material.alphaMap)textureKey(material.alphaMap);
     if(material.alphaTest>0&&material.map)textureKey(material.map);
     if((material.alphaMap as T.VideoTexture)?.isVideoTexture||material.alphaTest>0&&(material.map as T.VideoTexture)?.isVideoTexture)dynamic=true;
     if(material.displacementMap){textureKey(material.displacementMap);values.push(material.displacementScale,material.displacementBias);if((material.displacementMap as T.VideoTexture).isVideoTexture)dynamic=true;}
    }
   }
   if(light.isLight&&light.castShadow){
    const shadow=(light as T.DirectionalLight).shadow,target=(light as T.DirectionalLight).target;
    values.push(light.uuid,...light.matrixWorld.elements,light.intensity);
    if((light as T.PointLight).isPointLight||(light as T.SpotLight).isSpotLight)values.push((light as T.PointLight).distance);
    if((light as T.SpotLight).isSpotLight)values.push((light as T.SpotLight).angle,(light as T.SpotLight).shadow.focus);
    if(target)values.push(...target.matrixWorld.elements);
    if(shadow){
     const camera=shadow.camera as T.PerspectiveCamera|T.OrthographicCamera;
     values.push(...camera.projectionMatrix.elements,camera.near,camera.far,camera.zoom,shadow.mapSize.x,shadow.mapSize.y,shadow.map?.texture.uuid??'',shadow.autoUpdate,shadow.bias,shadow.normalBias,shadow.radius,shadow.blurSamples);
     // SpotLightShadow updates fov / far only during the next shadow draw.
     // Compare the driving parameters as well as the previous matrix, so a
     // projection edit cannot remain hidden behind a valid static cache.
     if((camera as T.PerspectiveCamera).isPerspectiveCamera){const c=camera as T.PerspectiveCamera;values.push(c.fov,c.aspect,c.filmGauge,c.filmOffset);}
     if((camera as T.OrthographicCamera).isOrthographicCamera){const c=camera as T.OrthographicCamera;values.push(c.left,c.right,c.top,c.bottom);}
     if(camera.view){const view=camera.view;values.push(view.enabled,view.fullWidth,view.fullHeight,view.offsetX,view.offsetY,view.width,view.height);}else values.push('no-camera-view');
     // A caller may explicitly invalidate its own shadow, independent of
     // mesh changes. Keep that contract instead of swallowing the request.
     if(shadow.needsUpdate||shadow.autoUpdate&&!shadow.map)dynamic=true;
    }
   }
  });
  return {signature:values.join(','),dynamic};
 }
 needs(scene:T.Scene,contextKey=''){const key=this.key(scene,contextKey);return key.dynamic||key.signature!==this.signature;}
 commit(scene:T.Scene,contextKey=''){this.signature=this.key(scene,contextKey).signature;}
 reset(){this.signature='';}
}
