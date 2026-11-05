import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { AppState, getInitialState } from './types';
import { ControlPanel } from './components/UI/ControlPanel';
import { MainScene } from './components/Scene/MainScene';
import { Timeline } from './components/UI/Timeline';
import { ViewportControls } from './components/UI/ViewportControls';
import { ProjectPanel } from './components/UI/ProjectPanel';
import {historySnapshot,restoreHistory} from './utils/history';

const App: React.FC = () => {
  // Initialize state, trying to load saved projects from localStorage immediately
  const [state, setState] = useState<AppState>(() => {
      let savedProjects = [];
      try {
          const stored = localStorage.getItem('mockup3d_projects');
          if (stored) {
              savedProjects = JSON.parse(stored);
          }
      } catch (e) {
          console.error("Failed to load projects", e);
      }
      // Use getInitialState() to ensure a fresh, unpolluted state object
      const initial = getInitialState();
      return { ...initial, savedProjects };
  });

  // --- History Management (Undo/Redo) ---
  const historyRef = useRef<AppState[]>([]);
  const futureRef = useRef<AppState[]>([]);
  const isUndoingRef = useRef(false);

  // Save current state to history
  const saveHistory = useCallback(() => {
      if (isUndoingRef.current) return;

      // Limit history size to 50 steps
      if (historyRef.current.length >= 50) {
          historyRef.current.shift();
      }

      // Keep embedded archive media out of the undo history.
      const stateSnapshot = historySnapshot(state);
      historyRef.current.push(stateSnapshot);

      // Clear future stack on new action
      futureRef.current = [];
      // console.log("History Saved. Steps:", historyRef.current.length);
  }, [state]);

  const undo = useCallback(() => {
      if (historyRef.current.length === 0) return;

      const previousStateStr = historyRef.current.pop();
      if (previousStateStr) {
          // Save current state to future before restoring old state
          futureRef.current.push(historySnapshot(state));

          isUndoingRef.current = true;
          setState(restoreHistory(previousStateStr,state));
          // Reset flag after render cycle
          setTimeout(() => { isUndoingRef.current = false; }, 0);
      }
  }, [state]);

  const redo = useCallback(() => {
      if (futureRef.current.length === 0) return;

      const nextStateStr = futureRef.current.pop();
      if (nextStateStr) {
          // Save current state to history before restoring next state
          historyRef.current.push(historySnapshot(state));

          isUndoingRef.current = true;
          setState(restoreHistory(nextStateStr,state));
          setTimeout(() => { isUndoingRef.current = false; }, 0);
      }
  }, [state]);

  // Keyboard Shortcuts for Undo/Redo
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if(e.key==='Escape')setState(prev=>prev.isSelectingFocus?{...prev,isSelectingFocus:false}:prev);
          // Check for Ctrl (or Cmd on Mac)
          if (e.ctrlKey || e.metaKey) {
              const key = e.key.toLowerCase();
              if (key === 'z') {
                  e.preventDefault();
                  if (e.shiftKey) {
                      redo();
                  } else {
                      undo();
                  }
              } else if (key === 'y') {
                  e.preventDefault();
                  redo();
              }
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);


  const canvasRef = useRef<HTMLCanvasElement>(null); // For capturing

  const updateState = (input: Partial<AppState>|((current:AppState)=>Partial<AppState>)) => {
    setState(prev=>{
      let updates=typeof input==='function'?input(prev):input;
      if(updates.activeModelId||updates.activeTextId)updates={...updates,activeStageId:null};
      if('activeModelId' in updates&&updates.selectedModelIds===undefined)updates={...updates,selectedModelIds:updates.activeModelId?[updates.activeModelId]:[]};
      if(updates.activeStageId||updates.activeTextId)updates={...updates,selectedModelIds:[]};
      return {...prev,...updates,...(updates.isSelectingScreen?{isSelectingFocus:false}:{})};
    });
  };

  const handleMeshSelect = (meshName: string) => {
    if (state.activeModelId) {
        saveHistory(); // Save before changing selection/mesh
        const updatedModels = state.models.map(m =>
            m.id === state.activeModelId ? { ...m, selectedScreenMesh: meshName } : m
        );
        updateState({
            models: updatedModels,
            isSelectingScreen: false
        });
    } else {
        updateState({ isSelectingScreen: false });
    }
  };

  // Calculate canvas style based on aspect ratio
  const canvasContainerStyle: React.CSSProperties = useMemo(() => {
    if (state.canvasAspectRatio === 'auto') {
        return {
            width: '100%',
            height: '100%'
        };
    }
    const ratio = state.canvasAspectRatio as number;
    return {
        aspectRatio: `${ratio}`,
        width: 'auto',
        height: 'auto',
        maxWidth: '100%',
        maxHeight: '100%',
        boxShadow: '0 0 50px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.1)'
    };
  }, [state.canvasAspectRatio]);

  return (
    <div
      className="app-shell flex h-screen w-screen overflow-hidden bg-black text-white font-sans selection:bg-blue-500 selection:text-white transition-colors duration-500"
      style={{
           backgroundImage: `
             linear-gradient(45deg, #151515 25%, transparent 25%),
             linear-gradient(-45deg, #151515 25%, transparent 25%),
             linear-gradient(45deg, transparent 75%, #151515 75%),
             linear-gradient(-45deg, transparent 75%, #151515 75%)
           `,
           backgroundSize: '20px 20px',
           backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
           backgroundColor: '#0a0a0a'
      }}
    >

      {/* Left Column: Control Panel */}
      <ControlPanel state={state} updateState={updateState} saveHistory={saveHistory} />

      {/* Middle Column: Canvas + Timeline */}
      <div className="editor-center flex-1 flex flex-col h-full min-w-0">

          {/* Top: Canvas Area - Reduced padding to p-2 to maximize space */}
          <div className="editor-viewport flex-1 relative flex items-center justify-center min-h-0 p-2 overflow-hidden">

              {/* Transform HUD (Top Right) */}
              <div className="transform-dock absolute top-4 right-6 z-30">
                 <ViewportControls state={state} updateState={updateState} saveHistory={saveHistory} />
              </div>

              {/* Overlay Hint */}
              <div className="absolute top-10 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-2">
                {state.isSelectingScreen ? (
                    <div className="bg-blue-600/90 backdrop-blur-md text-white px-6 py-2 rounded-full shadow-lg border border-blue-400 animate-bounce">
                      <span className="text-sm font-bold">请点击 3D 模型屏幕区域</span>
                    </div>
                ) : (
                  !state.isPlaying && (
                      <div className="bg-black/20 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 opacity-60 hover:opacity-100 transition-opacity">
                        <span className="text-[10px] text-gray-300 font-mono tracking-wider">{state.stage?.enabled?'拖动环绕视角 · 右键平移 · 滚轮缩放 · 选中物体显示控制轴':state.models.length>1?'点击选中 · Shift / ⌘ / Ctrl 多选 · 控制轴移动 / 旋转':'拖动旋转 · Space + 拖动平移 · 滚轮推近 / 拉远'}</span>
                      </div>
                  )
                )}
              </div>

              {/* 3D Canvas Container */}
              <div
                  className={`transition-all duration-300 relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 ${state.isSelectingScreen ? 'cursor-crosshair' : 'cursor-default'}`}
                  style={canvasContainerStyle}
              >
                  <MainScene
                    state={state}
                    onMeshSelect={handleMeshSelect}
                    updateState={updateState}
                    saveHistory={saveHistory}
                  />
              </div>
          </div>

          {/* Bottom: Timeline */}
          <Timeline state={state} updateState={updateState} canvasRef={canvasRef} />

      </div>

      {/* Right Column: Project Archives */}
      <ProjectPanel state={state} updateState={updateState} />

    </div>
  );
};

export default App;
