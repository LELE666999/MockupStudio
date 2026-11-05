import {selectModel} from '../../utils/modelSelection';

import React, { Component, ReactNode, Suspense, useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useThree, events as pointerEvents } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, TransformControls, Html, OrbitControls } from '@react-three/drei';
import { AppState, ModelConfig, TextConfig } from '../../types';
import { SimpleMockup } from './SimpleMockup';
import { FBXViewer } from './FBXViewer';
import { SceneText } from './SceneText';
import * as THREE from 'three';
import { rotateModel } from '../../utils/modelGeometry';
import {continuousRotation} from '../../utils/continuousRotation';
import {configureProjection,pixelWorldSize,cameraPositionFromView,projectionDistanceScale} from '../../utils/cameraProjection';
import {isKeyboardControl} from '../../utils/keyboard';
import {LensEffects} from './LensEffects';
import {FocusPicker} from './FocusPicker';
import {SceneBackground} from './SceneBackground';
import {Stage} from './Stage';
import {RainWeather} from './RainWeather';
import {StudioEnvironment} from './StudioEnvironment';
import {SceneGizmo} from './SceneGizmo';
import {suppressSceneClick} from '../../utils/sceneInteraction';
import {studioId,studioLightColors} from '../../utils/studioScenes';

interface Props {
  state: AppState;
  onMeshSelect: (name: string) => void;
  updateState?: (updates: Partial<AppState>|((current:AppState)=>Partial<AppState>)) => void;
  saveHistory?: () => void;
}

interface SceneErrorBoundaryProps {
    children?: ReactNode;
    resetKey: any;
}

interface SceneErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

// Fix: Explicitly use React.Component to ensure props, state, and setState are correctly inherited and recognized by TS
class SceneErrorBoundary extends React.Component<SceneErrorBoundaryProps, SceneErrorBoundaryState> {
  state: SceneErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }

  // Fix: Correct usage of this.props and this.setState from React.Component
  componentDidUpdate(prevProps: SceneErrorBoundaryProps) {
      if (this.props.resetKey !== prevProps.resetKey) {
        this.setState({ hasError: false, error: null });
      }
  }

  render() {
    if (this.state.hasError) {
      return (
        <group>
            <mesh><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="red" wireframe /></mesh>
            <Html position={[0, 1.5, 0]} center className="pointer-events-none">
                <div className="bg-red-900/90 text-red-100 px-4 py-3 rounded-xl backdrop-blur-md border border-red-500/50 shadow-2xl flex flex-col items-center gap-1 text-center min-w-[200px]">
                    <div className="font-bold text-sm">模型加载失败</div>
                    <div className="text-[10px] opacity-80 font-mono break-all max-w-[200px]">{this.state.error?.message || '未知错误'}</div>
                </div>
            </Html>
        </group>
      );
    }
    // Fix: Correct usage of this.props.children from React.Component
    return this.props.children;
  }
}

// Fix: Explicitly use React.Component to ensure props and state are correctly inherited and recognized by TS
class SafeEnvironment extends React.Component<{children?: ReactNode}, {hasError: boolean}> {
    state = { hasError: false };
    static getDerivedStateFromError() { return { hasError: true }; }
    // Fix: Correct usage of this.props.children from React.Component
    render() { return this.state.hasError ? null : this.props.children; }
}

const Loading = () => (
    <group>
        <Html center>
            <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <div className="text-xs text-blue-300 font-bold tracking-widest uppercase">Loading</div>
            </div>
        </Html>
    </group>
);

const CameraHandler: React.FC<{ state: AppState;updateState?:Props['updateState'];saveHistory?:Props['saveHistory'] }> = ({ state,updateState,saveHistory }) => {
    const { camera, gl, size, set } = useThree();
    const perspective=React.useMemo(()=>new THREE.PerspectiveCamera(),[]);
    const orthographic=React.useMemo(()=>new THREE.OrthographicCamera(),[]);
    const controlsRef = useRef<any>(null);
    const applying=useRef(false);

    React.useLayoutEffect(() => {
        applying.current=true;
        const mode=state.projectionMode || 'perspective';
        const active=mode==='orthographic'?orthographic:perspective;
        // Projection is sized here, including export aspect changes, not by R3F.
        (active as any).manual=true;
        configureProjection(active,mode,state.cameraPosition,state.cameraTarget,size.width/Math.max(1,size.height));
        if(camera!==active)set({camera:active});
        if (controlsRef.current) {
            controlsRef.current.target.set(state.cameraTarget[0], state.cameraTarget[1], state.cameraTarget[2]);
            controlsRef.current.update();
        }
        applying.current=false;
    }, [state.cameraPosition, state.cameraTarget, state.projectionMode, camera, perspective, orthographic, size.width, size.height, set]);

    const mode=state.projectionMode||'perspective',distanceScale=projectionDistanceScale(mode);
    return <OrbitControls ref={controlsRef} args={[camera, gl.domElement]} enabled={!!state.stage?.enabled&&!state.isPlaying&&!state.isExporting&&!state.isSelectingScreen&&!state.isSelectingFocus} enableDamping={false} minDistance={2*distanceScale} maxDistance={1000*distanceScale} onStart={saveHistory} onChange={()=>{
      if(applying.current||!state.stage?.enabled||state.isPlaying||state.isExporting||!controlsRef.current)return;
      const target=controlsRef.current.target.toArray() as [number,number,number];
      const position=cameraPositionFromView(camera.position.toArray(),target,mode,camera.zoom);
      if(position.some((v,i)=>Math.abs(v-state.cameraPosition[i])>1e-6)||target.some((v,i)=>Math.abs(v-state.cameraTarget[i])>1e-6)||(mode==='orthographic'&&Math.abs(camera.zoom-1)>1e-6))updateState?.({cameraPosition:position,cameraTarget:target});
    }} makeDefault />;
}

const GlobalRotator: React.FC<{
    state: AppState;
    updateState?: (updates: Partial<AppState>) => void;
    saveHistory?: () => void;
    setDragHandlers: (handlers: any) => void;
}> = ({ state, updateState, saveHistory, setDragHandlers }) => {
    const { camera, gl } = useThree();
    const isDragging = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });

    // 使用 refs 保持最新状态，避免在事件处理器中出现闭包旧值
    const activeModelIdRef = useRef(state.activeModelId);
    const modelsRef = useRef(state.models);
    const frameRef = useRef<number | null>(null);
    const latest = useRef({state,updateState,saveHistory});
    latest.current = {state,updateState,saveHistory};
    const cleanupDrag = useRef(() => {});
    const spaceHeld = useRef(false);
    useEffect(() => {
      const keydown = (e: KeyboardEvent) => {
        if (e.code === 'Space' && !e.isComposing && !e.ctrlKey && !e.metaKey && !e.altKey && !isKeyboardControl(e.target)) {e.preventDefault();spaceHeld.current = true;}
      };
      const keyup = (e: KeyboardEvent) => {if(e.code==='Space') spaceHeld.current=false;};
      const blur = () => {spaceHeld.current=false;cleanupDrag.current();};
      const wheel = (e: WheelEvent) => {
        const {state,updateState} = latest.current;
        if(state.stage?.enabled||state.models.length>1)return;
        if(state.isPlaying || state.isExporting || state.isSelectingScreen || state.isSelectingFocus) return;
        const model=modelsRef.current.find(m=>m.id===activeModelIdRef.current);
        if(!model) return;
        e.preventDefault();
        const direction = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
        const pos=new THREE.Vector3(...model.position).addScaledVector(direction,-e.deltaY*0.003);
        if(pos.distanceTo(camera.position)<1) return;
        modelsRef.current=modelsRef.current.map(m=>m.id===model.id?{...m,position:pos.toArray() as [number,number,number]}:m);
        if(frameRef.current===null) frameRef.current=requestAnimationFrame(()=>{frameRef.current=null;latest.current.updateState?.({models:modelsRef.current});});
      };
      window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);
      gl.domElement.addEventListener('wheel',wheel,{passive:false});
      return ()=>{window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);gl.domElement.removeEventListener('wheel',wheel);};
    },[camera,gl]);
    useEffect(() => () => { cleanupDrag.current(); if (frameRef.current !== null) cancelAnimationFrame(frameRef.current); }, []);

    useEffect(() => { activeModelIdRef.current = state.activeModelId; }, [state.activeModelId]);
    useEffect(() => { modelsRef.current = state.models; }, [state.models]);

    useEffect(() => {
        const handleDown = (e: any) => {
            if(latest.current.state.stage?.enabled||latest.current.state.models.length>1)return;
            // 只有左键拖拽能触发旋转 (或者在移动端是 touch)
            if ((e.button !== undefined && e.button !== 0) || latest.current.state.isPlaying || latest.current.state.isExporting || latest.current.state.isSelectingScreen || latest.current.state.isSelectingFocus || !activeModelIdRef.current) return;
            cleanupDrag.current();
            const panning = spaceHeld.current;

            isDragging.current = true;
            lastMousePos.current = { x: e.clientX, y: e.clientY };

            // 记录一次历史记录用于撤销
            latest.current.saveHistory?.();

            const handleWindowMove = (we: MouseEvent) => {
                if (!isDragging.current || !latest.current.updateState || !activeModelIdRef.current) return;

                const deltaX = we.clientX - lastMousePos.current.x;
                const deltaY = we.clientY - lastMousePos.current.y;
                lastMousePos.current = { x: we.clientX, y: we.clientY };

                const activeModel = modelsRef.current.find(m => m.id === activeModelIdRef.current);
                if (!activeModel) return;

                // 更新状态：这将同步 HUD 上的数值
                const updatedModels = modelsRef.current.map(m =>
                    m.id === activeModel.id ? { ...m, rotation: rotateModel(activeModel.rotation, deltaX, deltaY, camera.quaternion) } : m
                );
                if(panning) {
                  const ratio=pixelWorldSize(camera as THREE.PerspectiveCamera|THREE.OrthographicCamera,new THREE.Vector3(...activeModel.position),gl.domElement.clientHeight);
                  const pos=new THREE.Vector3(...activeModel.position)
                    .addScaledVector(new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),deltaX*ratio)
                    .addScaledVector(new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion),-deltaY*ratio);
                  const index=updatedModels.findIndex(m=>m.id===activeModel.id);
                  updatedModels[index]={...activeModel,position:pos.toArray() as [number,number,number]};
                }

                modelsRef.current = updatedModels;
                if (frameRef.current === null) frameRef.current = requestAnimationFrame(() => {
                    frameRef.current = null;
                    latest.current.updateState?.({models:modelsRef.current});
                });
            };

            const handleWindowUp = () => {
                isDragging.current = false;
                window.removeEventListener('mousemove', handleWindowMove);
                window.removeEventListener('mouseup', handleWindowUp);
            };

            window.addEventListener('mousemove', handleWindowMove);
            window.addEventListener('mouseup', handleWindowUp);
            cleanupDrag.current = handleWindowUp;
        };

        setDragHandlers({ handleDown });
    }, [camera, setDragHandlers]);

    return null;
}

const ModelInstance = ({ model, isSelected, state, onMeshSelect, updateState, setGroupRef, onPointerDown }: any) => {
    const groupRef = useRef<THREE.Group>(null);
    useEffect(() => { if (isSelected && groupRef.current) setGroupRef(groupRef.current); }, [isSelected, setGroupRef]);

    const updateThisModel = (changes: Partial<ModelConfig>) => {
        if (!updateState) return;
        // Model-load metadata must merge into the latest UI state, not the
        // R3F render snapshot, which may predate a newly imported video/colour.
        updateState((current:AppState)=>({models:current.models.map(m=>m.id===model.id&&m.fbxFile===model.fbxFile?{...m,...changes}:m)}));
    };

    return (
        <group
            ref={groupRef}
            userData={{mockupModelId:model.id}}
            visible={model.visible !== false}
            position={model.position}
            rotation={model.rotation}
            scale={model.scale || 1}
            castShadow receiveShadow
            onClick={(e) => { e.stopPropagation(); if (updateState&&!suppressSceneClick()) updateState(selectModel(state,model.id,e.shiftKey||e.ctrlKey||e.metaKey)); }}
            onPointerDown={(e) => {
                // 点击样机本体触发旋转逻辑
                e.stopPropagation();
                if (onPointerDown) onPointerDown(e);
            }}
        >
            {model.mode === 'simple' ? (
                <SimpleMockup config={model} lightingMode={state.lightingMode} isSelected={isSelected} appState={state} />
            ) : model.fbxFile && (
                <SceneErrorBoundary resetKey={model.fbxFile}>
                    <Suspense fallback={<Loading />}>
                        <FBXViewer key={model.fbxFile} config={model} appState={state} onMeshSelect={onMeshSelect} updateModel={updateThisModel} isSelected={isSelected} />
                    </Suspense>
                </SceneErrorBoundary>
            )}
        </group>
    );
};

const SceneContent: React.FC<Props> = ({ state, onMeshSelect, updateState, saveHistory }) => {
    const [selectedGroup, setSelectedGroup] = useState<THREE.Group | null>(null);
    const [selectedTextGroup, setSelectedTextGroup] = useState<THREE.Object3D | null>(null);
    const [dragHandlers, setDragHandlers] = useState<{ handleDown: (e: any) => void } | null>(null);

    const isFlat = state.lightingMode === 'flat';
    const designedStudio=studioId(state.stage);
    const studioColors=designedStudio==='midnight'||designedStudio==='grooved'?studioLightColors(state.stage):['#ffffff','#ffffff','#ffffff'];
    const stageHasMetal=!!state.stage?.enabled&&(state.stage.material==='metal'||state.stage.items?.some(item=>item.material==='metal'));
    const showGizmo = !state.isPlaying && !state.isExporting && !state.isSelectingScreen && !state.isSelectingFocus && (state.stage?.enabled||state.showGizmo||state.models.length>1);
    const activeModel = state.activeModelId ? state.models.find(m => m.id === state.activeModelId) : null;
    const activeText = state.activeTextId ? state.texts.find(t => t.id === state.activeTextId) : null;

    const handleTransform = useCallback(() => {
         if (!updateState) return;
         if (state.activeModelId && selectedGroup) {
            updateState({ models: state.models.map(m => m.id === state.activeModelId ? {
                ...m, position: [selectedGroup.position.x, selectedGroup.position.y, selectedGroup.position.z],
                rotation: continuousRotation(selectedGroup.quaternion,m.rotation),
                scale: selectedGroup.scale.x
            } : m) });
         }
         if (state.activeTextId && selectedTextGroup) {
            updateState({ texts: state.texts.map(t => t.id === state.activeTextId ? {
                ...t, position: [selectedTextGroup.position.x, selectedTextGroup.position.y, selectedTextGroup.position.z],
                rotation: continuousRotation(selectedTextGroup.quaternion,t.rotation),
                scale: selectedTextGroup.scale.x
            } : t) });
         }
    }, [updateState, state.activeModelId, selectedGroup, state.activeTextId, selectedTextGroup, state.models, state.texts]);

    return (
        <>
            <SceneBackground state={state} />
            <Stage state={state} updateState={updateState}/>
            {state.stage?.enabled&&state.stage.shape==='brick-court'&&state.stage.rain?.enabled&&<RainWeather state={state} object={{...state.stage,id:'primary',name:'主展台'}}/>}
            <CameraHandler state={state} updateState={updateState} saveHistory={saveHistory}/>
            <LensEffects state={state}/>
            <FocusPicker state={state} updateState={updateState} saveHistory={saveHistory}/>
            <GlobalRotator state={state} updateState={updateState} saveHistory={saveHistory} setDragHandlers={setDragHandlers} />

            {/* 背景点击层：确保点击空白区域也能进行交互，但会被样机阻挡 */}
            <mesh position={[0, 0, -5]} onPointerDown={(e) => dragHandlers?.handleDown(e)}>
                <planeGeometry args={[100, 100]} /><meshBasicMaterial visible={false} />
            </mesh>

            <ambientLight intensity={state.ambientIntensity * (designedStudio==='bricks'?.35:designedStudio==='grooved'?.32:state.renderStyle==='studio'&&!isFlat?Math.PI:1)} color={state.lightColor} />
            {state.renderStyle==='studio'&&!isFlat&&<hemisphereLight intensity={state.ambientIntensity*(designedStudio==='bricks'?.55:designedStudio==='grooved'?.65:designedStudio==='chrome'?.55:2)} color={state.lightColor} groundColor="#e5e5e5"/>}
            {/* Changing mapSize alone does not resize an allocated Three shadow
                target. Recreate it on scene-mode changes to avoid ghost shadows. */}
            <directionalLight key={state.stage?.enabled?'stage-key-light':'model-key-light'} position={designedStudio==='bricks'?[-8,9,-4]:designedStudio?[-9,10,6]:state.stage?.enabled?[10,14,10]:[10,10,10]} intensity={designedStudio==='bricks'?3.1:designedStudio==='chrome'?3.5:designedStudio==='grooved'?.18:designedStudio==='midnight'?.35:designedStudio?.65:1} color={state.lightColor} castShadow shadow-mapSize={state.stage?.enabled?[2048,2048]:[512,512]} shadow-camera-left={state.stage?.enabled?-18:-5} shadow-camera-right={state.stage?.enabled?18:5} shadow-camera-top={state.stage?.enabled?18:5} shadow-camera-bottom={state.stage?.enabled?-18:-5} shadow-camera-near={state.stage?.enabled?1:.5} shadow-camera-far={state.stage?.enabled?60:500} shadow-normalBias={state.stage?.enabled?.025:0} shadow-bias={state.stage?.enabled?(stageHasMetal?-.0005:-.0001):0} shadow-intensity={designedStudio==='bricks'?.85:designedStudio==='chrome'?.85:designedStudio?.25:stageHasMetal?.45:1}/>
            <spotLight position={[5, 10, 5]} intensity={state.spotIntensity} color={state.lightColor} castShadow shadowBias={-0.0005} />
            <pointLight position={[-8, 0, 5]} intensity={state.ambientIntensity * 0.5} color={state.lightColor} />
            <SafeEnvironment><Suspense fallback={null}>{designedStudio==='chrome'?<StudioEnvironment state={state}/>:state.renderStyle==='studio'?<Environment key={'studio-'+(designedStudio||'plain')+'-'+studioColors.join('-')} frames={1} resolution={256} environmentIntensity={isFlat?.2:state.ambientIntensity*(designedStudio==='grooved'?6:1.6)}>
              {designedStudio==='grooved'&&<>
                <Lightformer color={studioColors[0]} intensity={8} position={[-4,5,-5]} scale={[4,9,1]}/>
                <Lightformer color={studioColors[1]} intensity={6} position={[4,5,-5]} scale={[4,9,1]}/>
              </>}
              <Lightformer color={studioColors[0]} intensity={4} position={[-4,3,5]} rotation={[0,.6,0]} scale={[3,7,1]}/>
              <Lightformer color={studioColors[1]} intensity={2} position={[4,1,3]} rotation={[0,-.8,0]} scale={[1.5,6,1]}/>
              <Lightformer color={studioColors[2]} intensity={designedStudio==='grooved'?.65:3} position={[0,6,-2]} rotation={[Math.PI/2,0,0]} scale={[7,3,1]}/>
              <Lightformer color={studioColors[0]} intensity={1.5} position={[0,1,-5]} rotation={[0,Math.PI,0]} scale={[5,6,1]}/>
            </Environment>:<Environment key="legacy" files="/potsdamer_platz_1k.hdr" environmentIntensity={isFlat ? 0.2 : state.ambientIntensity} />}</Suspense></SafeEnvironment>

            {state.models.map(model => (
                <ModelInstance key={model.id} model={model} isSelected={model.id === state.activeModelId} state={state} onMeshSelect={onMeshSelect} updateState={updateState} setGroupRef={setSelectedGroup} onPointerDown={dragHandlers?.handleDown} />
            ))}

            {state.texts.map(text => (
                <group key={text.id} userData={{mockupTextId:text.id}} ref={(node) => { if (text.id === state.activeTextId && node) setSelectedTextGroup(node); }}>
                    <Suspense fallback={null}><SceneText config={text} isSelected={text.id === state.activeTextId} onSelect={(id) => updateState?.({ activeTextId: id, activeModelId: null })} onDoubleClick={(id) => updateState?.({ activeTextId: id, activeModelId: null })} /></Suspense>
                </group>
            ))}

            {showGizmo&&<SceneGizmo state={state} updateState={updateState} saveHistory={saveHistory}/>}
            {showGizmo && !state.stage?.enabled && (
                <>
                    {activeText && selectedTextGroup && activeText.visible !== false && (
                        <TransformControls object={selectedTextGroup} mode={state.transformMode === 'universal' ? 'translate' : state.transformMode} space={state.transformSpace} size={1.5} onDraggingChanged={(e) => e.value && saveHistory?.()} onChange={handleTransform} />
                    )}
                </>
            )}

            {!isFlat && !designedStudio && state.shadowConfig.type !== 'none' && (
                <ContactShadows opacity={state.shadowConfig.opacity} scale={50} blur={state.shadowConfig.blur} far={50} resolution={1024} color={state.shadowConfig.color} rotation={state.shadowConfig.type === 'wall' ? [Math.PI/2,0,0] : [0,0,0]} position={[0, state.shadowConfig.type === 'floor' ? -3.5 + state.shadowConfig.offset : 0, state.shadowConfig.type === 'wall' ? -1 + state.shadowConfig.offset : 0]} />
            )}
        </>
    );
};

export const MainScene: React.FC<Props> = (props) => {
  const dpr = (props.state.isExporting && props.state.exportDpr) ? props.state.exportDpr : [1, 1.5];
  return (
    <Canvas events={store=>({...pointerEvents(store),filter:items=>{
      const gizmo=(object:THREE.Object3D):number=>{for(let o:THREE.Object3D|null=object;o;o=o.parent)if(o.userData.sceneGizmo)return 1;return 0;};
      return [...items].sort((a,b)=>gizmo(b.object)-gizmo(a.object));
    }})} shadows camera={{ position: [0, 0, 8], fov: 45 }} dpr={dpr as any} gl={{ preserveDrawingBuffer: true, alpha: true, logarithmicDepthBuffer: true, toneMapping: THREE.NoToneMapping }}>
      <Suspense fallback={<Loading />}><SceneContent {...props} /></Suspense>
    </Canvas>
  );
};
