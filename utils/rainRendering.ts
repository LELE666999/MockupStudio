import * as T from 'three';
import {rainRandom,type RainHit,type RainCollisionField} from './rainWeather.ts';
import {rainPuddleMaterial} from './rainRipples.ts';
import type {RainPuddles} from './rainPuddles.ts';

export function rainUniforms(){return {rainTime:{value:0},rainIntensity:{value:.4},rainWind:{value:.12},rainSize:{value:1}};}
export type RainUniforms=ReturnType<typeof rainUniforms>;
const common=`uniform float rainTime,rainIntensity,rainWind,rainSize;
 attribute vec3 rainImpact;attribute vec3 rainNormal;attribute vec4 rainSeed;
 float rainAge(){float cycle=7.0/rainSeed.y+.85;return mod(rainTime+rainSeed.x,cycle);}
 float rainFlight(){return 7.0/rainSeed.y;}`;

function instances(base:T.BufferGeometry,hits:RainHit[],copies=1){
 const g=new T.InstancedBufferGeometry();g.index=base.index;for(const key of Object.keys(base.attributes))g.setAttribute(key,base.getAttribute(key));
 const points:number[]=[],normals:number[]=[],seeds:number[]=[];
 hits.forEach((hit,i)=>{for(let j=0;j<copies;j++){
  points.push(...hit.point.toArray());normals.push(...hit.normal.toArray());
  seeds.push(rainRandom(i+17)*8,8+rainRandom(i+18)*6,(i+.5)/hits.length,j/copies+rainRandom(i+19)*.35);
 }});
 g.setAttribute('rainImpact',new T.InstancedBufferAttribute(new Float32Array(points),3));g.setAttribute('rainNormal',new T.InstancedBufferAttribute(new Float32Array(normals),3));g.setAttribute('rainSeed',new T.InstancedBufferAttribute(new Float32Array(seeds),4));g.instanceCount=hits.length*copies;
 const box=new T.Box3();hits.forEach(h=>box.expandByPoint(h.point));if(!box.isEmpty()){box.max.y+=8;box.expandByScalar(2);g.boundingBox=box;g.boundingSphere=box.getBoundingSphere(new T.Sphere());}
 return g;
}
export function rainAir(hits:RainHit[],u:RainUniforms){
 const fallingGeometry=instances(new T.PlaneGeometry(1,1),hits);
 const fallingMaterial=new T.ShaderMaterial({uniforms:u,transparent:true,depthWrite:true,side:T.DoubleSide,
  vertexShader:`#include <common>
   #include <logdepthbuf_pars_vertex>
   ${common} varying vec2 vUv;varying float visibility;
   void main(){vUv=uv;float age=rainAge(),flight=rainFlight();float above=max(0.,7.-rainSeed.y*age);
    visibility=step(rainSeed.z,rainIntensity)*step(age,flight);
    vec3 center=rainImpact+vec3(-rainWind*above*.14,above,-rainWind*above*.045);
    vec4 mvPosition=modelViewMatrix*vec4(center,1.);
    vec2 axis=normalize((viewMatrix*vec4(vec3(rainWind*.14,-1.,rainWind*.045),0.)).xy+vec2(0.,.0001));
    vec2 right=vec2(-axis.y,axis.x);float width=(.005+rainSeed.w*.008)*rainSize;
    float length=(.065+rainSeed.w*.14)*rainSize;
    mvPosition.xy+=right*position.x*width+axis*position.y*length;
    gl_Position=projectionMatrix*mvPosition;
    #include <logdepthbuf_vertex>
   }`,
  fragmentShader:`#include <common>
   #include <logdepthbuf_pars_fragment>
   varying vec2 vUv;varying float visibility;
   void main(){float edge=1.-smoothstep(.08,.5,abs(vUv.x-.5));float end=smoothstep(0.,.2,vUv.y)*(1.-smoothstep(.72,1.,vUv.y));
    float alpha=edge*end*visibility*.26;if(alpha<.004)discard;
    gl_FragColor=vec4(vec3(.63,.7,.76),alpha);
    #include <logdepthbuf_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
 fallingMaterial.name='rain-falling-water';
 const falling=new T.Mesh(fallingGeometry,fallingMaterial);falling.name='rain-falling-drops';falling.frustumCulled=false;falling.raycast=()=>{};
 const splashGeometry=instances(new T.IcosahedronGeometry(1,0),hits,3);
 const splashMaterial=new T.MeshPhysicalMaterial({color:'#d7e3e7',transparent:true,opacity:.58,roughness:.07,metalness:0,clearcoat:1,clearcoatRoughness:.025,ior:1.333,envMapIntensity:1.4});
 splashMaterial.name='rain-ballistic-water';
 splashMaterial.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,u);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+common).replace('#include <begin_vertex>',`
   float age=rainAge()-rainFlight();float splashVisible=step(0.,age)*(1.-step(.34,age))*step(rainSeed.z,rainIntensity);
   float angle=rainSeed.w*6.2831853;vec3 tangent=normalize(cross(rainNormal,vec3(.001,0.,1.)));
   vec3 bitangent=cross(rainNormal,tangent);vec3 velocity=rainNormal*(.8+rainSeed.w*.8)+(tangent*cos(angle)+bitangent*sin(angle))*(.35+rainSeed.w*.65);
   vec3 offset=velocity*max(age,0.)+vec3(0.,-4.9*max(age,0.)*max(age,0.),0.);
   vec3 transformed=position*(.01+rainSeed.w*.014)*rainSize*splashVisible+rainImpact+rainNormal*.018+offset;
  `);
 };
 splashMaterial.customProgramCacheKey=()=> 'rain-ballistic-v1';
 const splash=new T.Mesh(splashGeometry,splashMaterial);splash.name='rain-impact-splashes';splash.frustumCulled=false;splash.raycast=()=>{};
 const group=new T.Group();group.name='rain-air';group.userData={weatherEffect:true,lensGroupId:'rain-air'};group.add(falling,splash);
 return {group,dispose(){fallingGeometry.dispose();splashGeometry.dispose();fallingMaterial.dispose();splashMaterial.dispose();group.removeFromParent();}};
}

/** Surface water joins its owner's lens layer. Rendering droplets in a
 * detached overlay would erase/refraction-blur the screen or draw water
 * through a foreground handset when depth of field is enabled. */
export function rainSurfaceWater(field:RainCollisionField,hits:RainHit[],u:RainUniforms,wetness:number,puddles:RainPuddles={patches:[],lookup:new Int16Array(0),surfaces:[]}){
 const sphere=new T.SphereGeometry(1,10,6),plane=new T.PlaneGeometry(1,1);
 const water=new T.MeshPhysicalMaterial({color:'#ffffff',roughness:.025,metalness:0,clearcoat:1,clearcoatRoughness:.02,transmission:.92,thickness:.04,ior:1.333,envMapIntensity:1.4});water.name='rain-screen-beads';
 const groups:T.Group[]=[],ownedGeometries:T.BufferGeometry[]=[],ownedMaterials:T.Material[]=[],beads:{mesh:T.InstancedMesh;matrices:T.Matrix4[];seeds:number[]}[]=[];
 for(let owner=0;owner<field.roots.length;owner++){
  const root=field.roots[owner],phone=field.phones[owner],inverse=root.matrixWorld.clone().invert(),points:RainHit[]=[];
  if(!phone){
   const surface=puddles.surfaces.find(p=>p.owner===owner);if(!surface)continue;
   const group=new T.Group();group.name='rain-brick-water';group.userData.weatherEffect=true;root.add(group);groups.push(group);
   const material=rainPuddleMaterial(u,hits,root,owner),mesh=new T.Mesh(surface.geometry,material);mesh.name='rain-basin-puddles';mesh.raycast=()=>{};mesh.renderOrder=1;group.add(mesh);ownedGeometries.push(surface.geometry);ownedMaterials.push(material);continue;
  }
  for(let i=0;i<field.owners.length;i++)if(field.owners[i]===owner&&field.normals[i*3+1]>.3)points.push(field.hit(i)!);
  if(!points.length)continue;
  const group=new T.Group();group.name=phone?'rain-phone-water':'rain-brick-water';group.userData.weatherEffect=true;root.add(group);groups.push(group);
  const count=Math.round((phone?150:160)*wetness),mesh=new T.InstancedMesh(sphere,water,count),dummy=new T.Object3D(),matrices:T.Matrix4[]=[],seeds:number[]=[];
  for(let i=0;i<count;i++){
   const hit=points[Math.floor(rainRandom(i+731)*points.length)],radius=(.012+Math.pow(rainRandom(i+107),3)*.048)*(phone?1:.7);
   dummy.position.copy(hit.point).addScaledVector(hit.normal,.0015);dummy.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),hit.normal);dummy.scale.set(radius,radius*.48,radius);
   dummy.updateMatrix();const matrix=inverse.clone().multiply(dummy.matrix);matrices.push(matrix);seeds.push(rainRandom(i+91)*12);mesh.setMatrixAt(i,matrix);
  }
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.name=phone?'rain-glass-beads':'rain-stone-beads';mesh.frustumCulled=false;mesh.raycast=()=>{};group.add(mesh);beads.push({mesh,matrices,seeds});
  const impacts=hits.map((h,i)=>({h,i})).filter(({h})=>h.owner===owner),ringGeometry=new T.InstancedBufferGeometry();ringGeometry.index=plane.index;
  for(const key of Object.keys(plane.attributes))ringGeometry.setAttribute(key,plane.getAttribute(key));
  const matricesArray=new Float32Array(impacts.length*16),seedArray=new Float32Array(impacts.length*4),surfaceArray=new Float32Array(impacts.length*2);
  impacts.forEach(({h,i},j)=>{
   dummy.position.copy(h.point).addScaledVector(h.normal,.009);dummy.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),h.normal);dummy.scale.set(1,1,1);dummy.updateMatrix();inverse.clone().multiply(dummy.matrix).toArray(matricesArray,j*16);
   seedArray.set([rainRandom(i+17)*8,8+rainRandom(i+18)*6,(i+.5)/hits.length,phone?1:0],j*4);
   surfaceArray.set([1,.027],j*2);
  });
  for(let i=0;i<4;i++){const column=new Float32Array(impacts.length*4);for(let j=0;j<impacts.length;j++)column.set(matricesArray.subarray(j*16+i*4,j*16+i*4+4),j*4);ringGeometry.setAttribute('rainMatrix'+i,new T.InstancedBufferAttribute(column,4));}
  ringGeometry.setAttribute('rainSeed',new T.InstancedBufferAttribute(seedArray,4));ringGeometry.setAttribute('rainSurface',new T.InstancedBufferAttribute(surfaceArray,2));ringGeometry.instanceCount=impacts.length;ownedGeometries.push(ringGeometry);
  const rings=new T.ShaderMaterial({uniforms:u,transparent:true,depthWrite:true,side:T.DoubleSide,
   vertexShader:`#include <common>
    #include <logdepthbuf_pars_vertex>
    ${common} attribute vec4 rainMatrix0,rainMatrix1,rainMatrix2,rainMatrix3;
    varying vec2 vUv;varying float age;varying float visibility;varying float phone;
    void main(){vUv=uv;age=rainAge()-rainFlight();phone=rainSeed.w;
     visibility=step(0.,age)*(1.-step(mix(.55,.18,phone),age))*step(rainSeed.z,rainIntensity);
     float radius=mix(.018+max(0.,age)*.19,.007+max(0.,age)*.1,phone)*rainSize;
     vec4 mvPosition=modelViewMatrix*mat4(rainMatrix0,rainMatrix1,rainMatrix2,rainMatrix3)*vec4(position.xy*radius*2.,position.z,1.);
     gl_Position=projectionMatrix*mvPosition;
     #include <logdepthbuf_vertex>
    }`,
   fragmentShader:`#include <common>
    #include <logdepthbuf_pars_fragment>
    varying vec2 vUv;varying float age,visibility,phone;
    void main(){float r=length(vUv-.5)*2.;float ring=exp(-pow((r-.77)/.06,2.))+exp(-pow((r-.43)/.05,2.))*.28;
     float fade=pow(max(0.,1.-age/mix(.55,.18,phone)),2.);float alpha=ring*visibility*fade*mix(.10,.055,phone);
     if(alpha<.005)discard;gl_FragColor=vec4(vec3(.66,.74,.77),alpha);
     #include <logdepthbuf_fragment>
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
   }`});rings.name='rain-expanding-ripples';ownedMaterials.push(rings);
  const rippleMesh=new T.Mesh(ringGeometry,rings);rippleMesh.name='rain-contact-ripples';rippleMesh.frustumCulled=false;rippleMesh.raycast=()=>{};group.add(rippleMesh);
 }
 const matrix=new T.Matrix4(),scale=new T.Vector3();
 return {groups,update(time:number){for(const {mesh,matrices,seeds} of beads){for(let i=0;i<matrices.length;i++){
  const growth=.7+.3*T.MathUtils.smoothstep((time+seeds[i])%5,0,4);scale.setScalar(growth);matrix.copy(matrices[i]).scale(scale);mesh.setMatrixAt(i,matrix);
 }mesh.instanceMatrix.needsUpdate=true;}},dispose(){groups.forEach(group=>{group.traverse(o=>{if((o as T.InstancedMesh).isInstancedMesh)(o as T.InstancedMesh).dispose();});group.removeFromParent();});sphere.dispose();plane.dispose();water.dispose();ownedGeometries.forEach(g=>g.dispose());ownedMaterials.forEach(m=>m.dispose());}};
}
