import React, { useMemo, useLayoutEffect, useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { ModelConfig, LightingMode, AppState } from '../../types';
import {useTimelineVideo} from './useTimelineVideo';
import {FoldableBody} from './FoldableBody';
import {foldScreen,foldPoint} from '../../utils/foldGeometry';

interface Props {
  config: ModelConfig;
  lightingMode: LightingMode;
  isSelected: boolean;
  appState: AppState;
}

export const SimpleMockup: React.FC<Props> = ({ config, lightingMode, isSelected, appState }) => {
  const {
    width, height, depth, radius, edgeColor, screenshot, screenshotPrev, screenshotMix,
    bezelWidth, screenRoughness, screenEmissive, textureStretch, clearcoat, sheen
  } = config;
  const screenContentMeshRef = useRef<THREE.Mesh>(null);
  const [screenTexture, setScreenTexture] = useState<THREE.Texture | null>(null);
  const [screenTexturePrev, setScreenTexturePrev] = useState<THREE.Texture | null>(null);
  useTimelineVideo(screenTexture?.image?.tagName==='VIDEO'?screenTexture.image:null,appState);
  useTimelineVideo(screenTexturePrev?.image?.tagName==='VIDEO'?screenTexturePrev.image:null,appState);

  const isFlat = lightingMode === 'flat';
  const folding=config.simpleStyle==='fold';
  const foldedScreen=useMemo(()=>folding?foldScreen(Math.max(.2,width-2*bezelWidth),Math.max(.2,height-2*bezelWidth),Math.max(0,radius-bezelWidth/2),config.foldAngle??180,depth/2+.03):null,[folding,width,height,bezelWidth,radius,config.foldAngle,depth]);
  useEffect(()=>()=>{foldedScreen?.dispose();},[foldedScreen]);

  // 1. Base Shape
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const r = Math.min(radius, width / 2, height / 2);
    const w = width / 2;
    const h = height / 2;
    s.moveTo(-w + r, -h); s.lineTo(w - r, -h); s.quadraticCurveTo(w, -h, w, -h + r);
    s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h);
    s.lineTo(-w + r, h); s.quadraticCurveTo(-w, h, -w, h - r);
    s.lineTo(-w, -h + r); s.quadraticCurveTo(-w, -h, -w + r, -h);
    return s;
  }, [width, height, radius]);

  // 2. Screen Shape
  const screenShape = useMemo(() => {
    const s = new THREE.Shape();
    const b = bezelWidth;
    const w = Math.max(0.01, width / 2 - b);
    const h = Math.max(0.01, height / 2 - b);
    const r = Math.max(0, Math.min(radius - b/2, w, h));
    s.moveTo(-w + r, -h); s.lineTo(w - r, -h); s.quadraticCurveTo(w, -h, w, -h + r);
    s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h);
    s.lineTo(-w + r, h); s.quadraticCurveTo(-w, h, -w, h - r);
    s.lineTo(-w, -h + r); s.quadraticCurveTo(-w, -h, -w + r, -h);
    return s;
  }, [width, height, radius, bezelWidth]);

  // Texture Logic
  const updateTextureFit = (tex: THREE.Texture, imgW: number, imgH: number, screenW: number, screenH: number) => {
      if (!imgW || !imgH || !screenW || !screenH) return;

      tex.center.set(0.5, 0.5);
      tex.rotation=-config.textureRotation*Math.PI/180;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;

      if (textureStretch) {
        tex.repeat.set(1, 1);
      } else {
        const imageAspect = Math.abs(Math.round(config.textureRotation/90))%2?imgH/imgW:imgW/imgH;
        const screenAspect = screenW / screenH;
        if (screenAspect > imageAspect) {
            tex.repeat.set(1, imageAspect / screenAspect);
        } else {
            tex.repeat.set(screenAspect / imageAspect, 1);
        }
      }
      if(config.textureFlipX)tex.repeat.x*=-1;
      if(config.textureFlipY)tex.repeat.y*=-1;
      tex.needsUpdate = true;
  };

  useEffect(() => {
    const fit=()=>{
    const screenW = Math.max(0.1, width - bezelWidth * 2);
    const screenH = Math.max(0.1, height - bezelWidth * 2);
    if (screenTexture && screenTexture.image) {
         const imgW = screenTexture.image.videoWidth || screenTexture.image.width;
         const imgH = screenTexture.image.videoHeight || screenTexture.image.height;
         updateTextureFit(screenTexture, imgW, imgH, screenW, screenH);
    }
    if (screenTexturePrev && screenTexturePrev.image) {
         const imgW = screenTexturePrev.image.videoWidth || screenTexturePrev.image.width;
         const imgH = screenTexturePrev.image.videoHeight || screenTexturePrev.image.height;
         updateTextureFit(screenTexturePrev, imgW, imgH, screenW, screenH);
    }
    };
    fit();
    const videos=[screenTexture?.image,screenTexturePrev?.image].filter(v=>v instanceof HTMLVideoElement);
    videos.forEach(v=>{v.addEventListener('loadedmetadata',fit);v.addEventListener('resize',fit);});
    return ()=>videos.forEach(v=>{v.removeEventListener('loadedmetadata',fit);v.removeEventListener('resize',fit);});
  }, [screenTexture, screenTexturePrev, width, height, bezelWidth, textureStretch,config.textureRotation,config.textureFlipX,config.textureFlipY]);

  useEffect(() => {
    if (!screenshot) { setScreenTexture(null); return; }
    let isMounted = true;

    if (config.screenshotType === 'video') {
        const video = document.createElement('video');
        video.src = screenshot;
        video.crossOrigin = 'anonymous';
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;

        const videoTex = new THREE.VideoTexture(video);
        videoTex.colorSpace = THREE.SRGBColorSpace;
        videoTex.minFilter = THREE.LinearFilter;
        videoTex.magFilter = THREE.LinearFilter;
        setScreenTexture(videoTex);

        return () => {
            isMounted = false;
            video.pause();
            video.removeAttribute('src');
            video.load();
            videoTex.dispose();
        };
    } else {
        const loader = new THREE.TextureLoader();
        loader.load(screenshot, (loadedTex) => {
            if (!isMounted) return;
            loadedTex.colorSpace = THREE.SRGBColorSpace;
            loadedTex.minFilter = THREE.LinearFilter;
            loadedTex.magFilter = THREE.LinearFilter;
            setScreenTexture(loadedTex);
        });
        return () => { isMounted = false; };
    }
  }, [screenshot, config.screenshotType]);

  useEffect(() => {
    if (!screenshotPrev) { setScreenTexturePrev(null); return; }
    let isMounted = true;

    if (config.screenshotPrevType === 'video') {
        const video = document.createElement('video');
        video.src = screenshotPrev;
        video.crossOrigin = 'anonymous';
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;

        const videoTex = new THREE.VideoTexture(video);
        videoTex.colorSpace = THREE.SRGBColorSpace;
        videoTex.minFilter = THREE.LinearFilter;
        videoTex.magFilter = THREE.LinearFilter;
        setScreenTexturePrev(videoTex);

        return () => {
            isMounted = false;
            video.pause();
            video.removeAttribute('src');
            video.load();
            videoTex.dispose();
        };
    } else {
        const loader = new THREE.TextureLoader();
        loader.load(screenshotPrev, (loadedTex) => {
            if (!isMounted) return;
            loadedTex.colorSpace = THREE.SRGBColorSpace;
            loadedTex.minFilter = THREE.LinearFilter;
            loadedTex.magFilter = THREE.LinearFilter;
            setScreenTexturePrev(loadedTex);
        });
        return () => { isMounted = false; };
    }
  }, [screenshotPrev, config.screenshotPrevType]);

  // UV Fix
  useLayoutEffect(() => {
    if(folding)return;
    if (screenContentMeshRef.current) {
      const geo = screenContentMeshRef.current.geometry;
      geo.computeBoundingBox();
      const max = geo.boundingBox!.max;
      const min = geo.boundingBox!.min;
      const uvAttribute = geo.attributes.uv;
      const posAttribute = geo.attributes.position;
      if (max && min) {
          const w = max.x - min.x;
          const h = max.y - min.y;
          for (let i = 0; i < posAttribute.count; i++) {
            const x = posAttribute.getX(i);
            const y = posAttribute.getY(i);
            uvAttribute.setXY(i, (x - min.x) / w, (y - min.y) / h);
          }
          uvAttribute.needsUpdate = true;
      }
    }
  }, [screenShape, width, height, bezelWidth,folding]);

  const extrudeSettings = useMemo(() => ({
    depth: depth,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: 0.02,
    bevelThickness: 0.02
  }), [depth]);

  const screenUniforms = useRef({
    emissiveMapPrev: { value: null as THREE.Texture | null },
    previousIsVideo: { value: false },
    mixFactor: { value: 1.0 }
  });

  useEffect(() => {
    screenUniforms.current.emissiveMapPrev.value = screenTexturePrev;
    screenUniforms.current.previousIsVideo.value = !!(screenTexturePrev as THREE.VideoTexture)?.isVideoTexture;
    screenUniforms.current.mixFactor.value = screenshotMix ?? 1.0;
  }, [screenTexturePrev, screenshotMix]);

  // MATERIAL SELECTION LOGIC
  // If Flat: Screen is Basic (Unlit), Body is Standard (Lit).
  // If Realistic: Screen is Standard (Lit). Body is Standard.
  const BodyMaterial = 'meshStandardMaterial';

  // --- Z-FIGHTING FIX ---
  // Increased offsets from 0.001 to 0.01/0.02 to allow depth buffer to resolve layers correctly
  const LAYER_GAP = 0.015;

  return (
    <group position={[0,0,folding?-foldPoint(width/2,config.foldAngle??180)[1]/2:0]}>
      {/* 1. Body - Always uses Physical Material for shading, even in 'flat' mode */}
      {folding?<FoldableBody config={config} state={appState}/>:<mesh position={[0, 0, -depth / 2]} castShadow receiveShadow>
        <extrudeGeometry args={[shape, extrudeSettings]} />
        <meshPhysicalMaterial
          color={edgeColor}
          roughness={appState.renderStyle==='studio'?Math.max(.18,config.roughness):.1}
          metalness={appState.renderStyle==='studio'?config.metalness:.9}
          clearcoat={clearcoat ?? 1.0}
          clearcoatRoughness={0.05}
          envMapIntensity={appState.renderStyle==='studio'?1.0:2.0}
          sheen={sheen ?? 0.5}
          sheenRoughness={0.2}
          specularIntensity={1.0}
        />
      </mesh>}

      {/* 2. Black Backing */}
      {!folding&&<mesh position={[0, 0, depth / 2 + LAYER_GAP]}>
        <shapeGeometry args={[screenShape]} />
        <meshStandardMaterial color="#000000" roughness={0.1} />
      </mesh>}

      {/* 3. Screen Content */}
      <mesh ref={screenContentMeshRef} userData={{studioColorCritical:true}} position={[0, 0, folding?0:depth / 2 + LAYER_GAP * 2]}>
        {foldedScreen?<primitive object={foldedScreen} attach="geometry"/>:<shapeGeometry args={[screenShape]} />}
        {screenTexture ? (
             isFlat ? (
                 // FLAT MODE: Unlit Screen
                 <meshBasicMaterial
                    map={screenTexture}
                    color="#ffffff"
                 />
             ) : (
                 // REALISTIC MODE: Lit Screen with correct white balance
                 <meshPhysicalMaterial
                    color="#000000"
                    emissiveMap={screenTexture}
                    emissive="#ffffff"
                    emissiveIntensity={screenEmissive ?? 1.0}
                    roughness={1}
                    metalness={0}
                    specularIntensity={0}
                    envMapIntensity={0}
                    clearcoat={0}
                    toneMapped={false}
                    userData={{shadowStatic:true}}
                    onBeforeCompile={(shader) => {
                        shader.uniforms.emissiveMapPrev = screenUniforms.current.emissiveMapPrev;
                        shader.uniforms.previousIsVideo = screenUniforms.current.previousIsVideo;
                        shader.uniforms.mixFactor = screenUniforms.current.mixFactor;
                        shader.fragmentShader = shader.fragmentShader.replace(
                            '#include <emissivemap_pars_fragment>',
                            `
                            #include <emissivemap_pars_fragment>
                            uniform sampler2D emissiveMapPrev;
                            uniform bool previousIsVideo;
                            uniform float mixFactor;
                            `
                        );
                        shader.fragmentShader = shader.fragmentShader.replace(
                            '#include <emissivemap_fragment>',
                            `
                            #ifdef USE_EMISSIVEMAP
                                vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
                                vec4 emissiveColorPrev = texture2D( emissiveMapPrev, vEmissiveMapUv );
                                #ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
                                    emissiveColor = sRGBTransferEOTF(emissiveColor);
                                #endif
                                if(previousIsVideo)emissiveColorPrev = sRGBTransferEOTF(emissiveColorPrev);
                                totalEmissiveRadiance *= mix(emissiveColorPrev.rgb, emissiveColor.rgb, mixFactor);
                            #endif
                            `
                        );
                    }}
                 />
             )
        ) : (
            <meshStandardMaterial color="#111" />
        )}
      </mesh>

       {/* Screen content stays glare-free; physical reflections belong to the body. */}
    </group>
  );
};
