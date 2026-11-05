import {selectModel,selectedModels,rightOfModels,frameModels} from '../../utils/modelSelection';
import {replaceScreen,replaceCoverScreen} from '../../utils/replaceScreen';

import React, { useRef, useState, useEffect } from 'react';
import { MODEL_PRESETS } from '../../utils/modelPresets';
import {isAppleDuo,APPLE_DUO_INNER} from '../../utils/appleDuoFold';
import {isAppleModel} from '../../utils/modelMaterials';
import {StagePanel} from './StagePanel';
import {TimelineVideoPreview} from './TimelineVideoPreview';
import {SegmentedControl} from './SegmentedControl';
import {ToggleSwitch} from './ToggleSwitch';
import {ThemeToggle} from './ThemeToggle';
import {CameraDial} from './CameraDial';
import {DEFAULT_LENS,editLens,modelSource} from '../../utils/focus';
import {waitForSceneFrame} from '../../utils/renderReady';
import {exportSizing} from '../../utils/exportSizing';
import { AppState, ModelConfig, TextConfig, DEFAULT_SIMPLE_MODEL, DEFAULT_PURA_MODEL, DEFAULT_DDDD_MODEL, DEFAULT_FONT_URL, ShadowType, getInitialState, FBXSubMesh } from '../../types';
import { Box, Layers, Image as ImageIcon, CheckCircle2, Download, Monitor, Smartphone, Tablet, RotateCw, FlipHorizontal, FlipVertical, Move, Rotate3d, Maximize, Zap, ZapOff, RefreshCcw, Eraser, Spline, ArrowDownToLine, ArrowRightToLine, Settings2, Video, Camera, UploadCloud, Library, Plus, Copy, Trash2, Layout, ChevronDown, RotateCcw, Palette, Sun, Mountain, Sparkles, Type, Globe, BoxSelect, Orbit, Ratio, Eye, EyeOff, ChevronsDown, ChevronsUp, FolderTree, StretchHorizontal, Wand2 } from 'lucide-react';

interface ControlPanelProps {
  state: AppState;
  updateState: (updates: Partial<AppState>|((current:AppState)=>Partial<AppState>)) => void;
  saveHistory?: () => void;
}

function LensPanel({state,updateState,save}:{state:AppState;updateState:(s:Partial<AppState>)=>void;save:()=>void}){
  const lens=state.lens||DEFAULT_LENS;
  const [warning,setWarning]=useState('');
  useEffect(()=>{const onWarning=(e:Event)=>setWarning((e as CustomEvent).detail);window.addEventListener('mockup-render-warning',onWarning);return ()=>window.removeEventListener('mockup-render-warning',onWarning);},[]);
  const focused=state.models.find(m=>m.id===lens.focus?.modelId&&m.visible!==false&&(!lens.focus?.modelSource||modelSource(m)===lens.focus.modelSource));
  const change=(patch:Partial<typeof lens>)=>{save();updateState(editLens(state,patch));};
  return <fieldset disabled={state.isExporting} className="camera-panel mb-4 text-xs">
    <label className={`flex items-center justify-between ${lens.enabled?'mb-3':''}`}><span>镜头景深</span><ToggleSwitch label="镜头景深" checked={lens.enabled} onChange={enabled=>{change({enabled});if(!enabled)updateState({isSelectingFocus:false});}}/></label>
    {lens.enabled&&<>
      <button type="button" aria-pressed={!!state.isSelectingFocus} onClick={()=>updateState({isSelectingFocus:!state.isSelectingFocus,isSelectingScreen:false,isPlaying:false})} className="w-full bg-blue-600 text-white rounded-lg py-2 mb-2">{state.isSelectingFocus?'点击模型表面 · Esc 取消':'选择焦点'}</button>
      <p className="text-gray-400 mb-2">{lens.focus?(focused?`焦点跟随：${focused.name}`:'焦点模型已变化，使用原世界位置；请重新选点。'):'自动对焦：跟随当前样机中心，可点选屏幕细节'}</p>
      <CameraDial label="光圈" value={lens.aperture} values={[1,1.4,2,2.8,4,5.6,8,11,16,22]} format={n=>`f/${Number(n.toFixed(1))}`} disabled={state.isExporting} onChange={aperture=>change({aperture,maxBlur:12})}/>
      <p className="camera-panel__note">f/1 散焦更明显 · f/22 更清晰 · 点击模型决定清晰位置</p>
    </>}
    <label className="flex items-center justify-between mt-3"><span>自动曝光</span><ToggleSwitch label="自动曝光" checked={lens.exposureMode!=='manual'} onChange={enabled=>change({exposureMode:enabled?'auto':'manual'})}/></label>
    {lens.exposureMode==='manual'&&<>
      {!lens.enabled&&<CameraDial label="光圈" value={lens.aperture} values={[1,1.4,2,2.8,4,5.6,8,11,16,22]} format={n=>`f/${Number(n.toFixed(1))}`} disabled={state.isExporting} onChange={aperture=>change({aperture})}/>}
      <CameraDial label="快门" value={lens.shutter??1/60} values={[1/8000,1/4000,1/2000,1/1000,1/500,1/250,1/125,1/60,1/30,1/15,1/8,1/4,1/2,1]} format={n=>n>=1?'1s':`1/${Math.round(1/n)}`} disabled={state.isExporting} onChange={shutter=>change({shutter})}/>
      <CameraDial label="ISO" value={lens.iso??100} values={[25,50,100,200,400,800,1600,3200,6400,12800,25600]} format={n=>`${Math.round(n)}`} disabled={state.isExporting} onChange={iso=>change({iso})}/>
      <p className="camera-panel__note">快门与 ISO 控制曝光；暂不模拟运动拖影或感光噪点。</p>
    </>}
    <p className="camera-panel__note">拖动拨轮或用方向键调整 · 参数随关键帧保存{lens.enabled?' · 实时景深':''}{state.projectionMode==='orthographic'?' · 正交为模拟景深':''}</p>
    {warning&&<p role="alert" className="text-amber-500 mt-2">{warning}</p>}
  </fieldset>;
}

const PanelSection = ({ title, children, expanded = true }: { title: string; children?: React.ReactNode; expanded?: boolean }) => (
  <div className="mb-5 animate-fade-in group">
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-1.5 shadow-sm transition-all hover:border-white/20">
        <div className="relative overflow-hidden bg-white/10 rounded-xl py-1.5 px-3 border border-white/5 flex items-center justify-between shrink-0 transition-colors group-hover:bg-white/15">
            <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent pointer-events-none" />
            <h3 className="relative text-[11px] font-bold text-gray-200 uppercase tracking-widest flex items-center gap-2 z-10">
                <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                {title}
            </h3>
            <div className="flex gap-0.5 opacity-40">
                <div className="w-1 h-1 bg-white rounded-full" />
                <div className="w-1 h-1 bg-white rounded-full" />
                <div className="w-6 h-1 bg-white rounded-full" />
            </div>
        </div>
        <div className="px-2 pt-3 pb-1 space-y-3">
            {children}
        </div>
    </div>
  </div>
);

const GlassInputRange = ({ label, value, min, max, step = 0.1, onChange, onPointerDown }: any) => {
  const drag=useRef<{x:number;value:number;width:number}|null>(null);
  const rotation=min===-180&&max===180;
  const safeValue = typeof value === 'number' ? value : 0;
  const percentage = Math.min(100, Math.max(0, ((safeValue - min) / (max - min)) * 100));
  return (
    <div className="group mb-4 last:mb-0">
      <div className="flex justify-between text-[10px] mb-2 text-gray-400 group-hover:text-gray-200 transition-colors font-medium tracking-wide">
        <span>{label}</span>
        <span className="font-mono text-gray-500 bg-white/5 px-1.5 py-0.5 rounded text-[9px]">{safeValue.toFixed(2)}</span>
      </div>
      <div className="relative h-5 w-full flex items-center">
        <div className="absolute w-full h-1.5 rounded-full bg-black/40 border border-white/5 shadow-inner overflow-hidden">
             <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)' }} />
        </div>
        <div
          className="absolute h-1.5 rounded-full bg-gradient-to-r from-blue-900 to-blue-500 transition-all duration-75 ease-out shadow-[0_0_8px_rgba(59,130,246,0.3)]"
          style={{ width: `${percentage}%` }}
        />
        <div
            className="absolute h-4 w-4 bg-white rounded-full shadow-[0_2px_5px_rgba(0,0,0,0.5)] border-2 border-blue-500 z-10 pointer-events-none transition-all duration-75 ease-out flex items-center justify-center"
            style={{ left: `calc(${percentage}% - 8px)` }}
        >
            <div className="w-1 h-1 bg-blue-500 rounded-full opacity-50" />
        </div>
        {rotation?<div role="slider" tabIndex={0} aria-label={label} aria-valuenow={safeValue} aria-valuetext={`${safeValue} 度`}
          onPointerDown={e=>{if(e.button!==0)return;onPointerDown?.();e.preventDefault();e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,value:safeValue,width:Math.max(1,e.currentTarget.getBoundingClientRect().width)};}}
          onPointerMove={e=>{const start=drag.current;if(start)onChange(start.value+Math.round((e.clientX-start.x)/start.width*360/step)*step);}}
          onPointerUp={e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
          onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}
          onKeyDown={e=>{const delta=({ArrowRight:1,ArrowUp:1,ArrowLeft:-1,ArrowDown:-1,PageUp:10,PageDown:-10} as Record<string,number>)[e.key];if(delta!==undefined){e.preventDefault();e.stopPropagation();onPointerDown?.();onChange(safeValue+delta*step*(e.shiftKey?10:1));}}}
          className="absolute inset-0 w-full h-full cursor-ew-resize z-20 touch-none rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        />:<input
          type="range"
          aria-label={`${label} 滑块`}
          min={min} max={max} step={step} value={safeValue}
          onPointerDown={onPointerDown}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
        />}
      </div>
    </div>
  );
};

const GlassButton = ({ active, children, onClick, className = '' }: any) => (
  <button
    onClick={onClick}
    className={`relative overflow-hidden px-3 py-2.5 rounded-xl text-[11px] font-medium transition-all duration-300 flex items-center justify-center gap-2 border backdrop-blur-md ${active ? 'bg-blue-600/80 text-white border-blue-500/50 shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-gray-200 hover:border-white/30'} ${className}`}
  >
    {children}
  </button>
);

const RatioButton = ({ label, ratio, icon: Icon, onClick, active }: any) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1.5 py-2 rounded-xl border text-[10px] transition-all backdrop-blur-sm ${active ? 'bg-blue-500/20 border-blue-500/50 text-blue-100' : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10 hover:text-gray-300 hover:border-white/20'}`}>
        {Icon && <Icon size={14} strokeWidth={1.5} />} <span>{label}</span>
    </button>
);

const ColorOption = ({ color, active, onClick }: any) => (
  <button onClick={() => onClick(color)} className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 ${active ? 'border-white shadow-lg scale-110' : 'border-white/10'}`} style={{ backgroundColor: color }} />
);

export const ControlPanel: React.FC<ControlPanelProps> = ({ state, updateState, saveHistory }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fbxInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const bgVideoInputRef = useRef<HTMLInputElement>(null);
  const bgColorInputRef = useRef<HTMLInputElement>(null);
  const customEdgeColorInputRef = useRef<HTMLInputElement>(null);
  const customBodyColorInputRef = useRef<HTMLInputElement>(null);
  const textColorInputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const shadowColorRef = useRef<HTMLInputElement>(null);
  const globalBgColorRef = useRef<HTMLInputElement>(null);

  const [showCustomRatio, setShowCustomRatio] = useState(false);
  const [activeTab, setActiveTab] = useState<'model' | 'text' | 'env'>('model');
  const [lastModelId, setLastModelId] = useState(state.activeModelId);
  useEffect(() => {
      if (state.models.some(m => m.id === state.activeModelId)) setLastModelId(state.activeModelId);
  }, [state.activeModelId, state.models]);
  useEffect(() => {
      const id = state.phoneViewBeforeScene?.activeModelId;
      if (!state.models.some(m => m.id === state.activeModelId) && state.models.some(m => m.id === id)) setLastModelId(id!);
  }, [state.phoneViewBeforeScene]);
  // The inspected phone remains available while a pedestal or text is selected.
  // Object selection controls the gizmo, not whether the entire model page exists.
  const activeModel = state.models.find(m => m.id === state.activeModelId)
      || state.models.find(m => m.id === lastModelId)
      || state.models.find(m => m.id === state.phoneViewBeforeScene?.activeModelId)
      || state.models.find(m => m.visible !== false)
      || state.models[0];
  const updateModelState = (input: Partial<AppState>|((current:AppState)=>Partial<AppState>)) => {
      if (!activeModel) return;
      updateState(current=>{
          const selection=current.activeModelId!==activeModel.id||current.activeStageId||current.activeTextId?selectModel(current,activeModel.id):{};
          return {...selection,...(typeof input==='function'?input(current):input)};
      });
  };
  const openModelTab = () => {
      setActiveTab('model');
      if (activeModel && (state.activeModelId !== activeModel.id || state.activeStageId || state.activeTextId || !selectedModels(state).length)) {
          updateState(selectModel(state, activeModel.id));
      }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        const key = e.key.toLowerCase();
        switch(key) {
            case 'w': case 'g': updateState({ transformMode: 'translate' }); break;
            case 'e': case 'r': updateState({ transformMode: 'rotate' }); break;
            case 's': updateState({ transformMode: 'scale' }); break;
            case 'u': updateState({ transformMode: 'universal' }); break;
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [updateState]);

  const save = () => { if (saveHistory) saveHistory(); }

  const updateActiveModel = (updates: Partial<ModelConfig>) => {
      if (!activeModel) return;
      updateModelState(current=>({models:current.models.map(m=>m.id===activeModel.id?{...m,...updates}:m)}));
  };

  const updateActiveText = (updates: Partial<TextConfig>) => {
      if (!state.activeTextId) return;
      const updatedTexts = state.texts.map(t =>
          t.id === state.activeTextId ? { ...t, ...updates } : t
      );
      updateState({ texts: updatedTexts });
  };

  const updateTextTransform = (axis: number, val: number, type: 'position' | 'rotation') => {
      if (!activeText) return;
      const arr = [...activeText[type]] as [number, number, number];
      arr[axis] = val;
      updateActiveText({ [type]: arr });
  };

  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const activeText = state.texts.find(t => t.id === state.activeTextId);

  // Helper for persistence: File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
      });
  };

  const handleResetProject = () => { if (confirm('确定要重置整个项目吗？这将清空所有模型、文字、图片，恢复到初始状态。')) { save(); const resetState = getInitialState(); const newModelId = `model_${Date.now()}`; resetState.models[0].id = newModelId; resetState.activeModelId = newModelId; resetState.savedProjects = state.savedProjects; updateState(resetState); } };
  const handleDuplicateModel = () => {
    if(!activeModel)return;save();
    const next:ModelConfig={...activeModel,id:crypto.randomUUID(),name:`${activeModel.name} (副本)`,rotation:[...activeModel.rotation]};
    next.position=rightOfModels(state.models,next,activeModel.id);
    next.initialTransform={position:[...next.position],rotation:[...next.rotation],scale:next.scale};
    const models=[...state.models,next],rect=document.querySelector('canvas')?.getBoundingClientRect();
    updateState({models,...selectModel({...state,models},next.id),...frameModels(state,models,rect?rect.width/rect.height:1)});
  };
  const handleDeleteModel = () => { if (!activeModel || state.models.length <= 1) { alert("至少需要保留一个模型"); return; } if (!confirm(`确定要删除 ${activeModel.name} 吗？`)) return; save(); const filtered = state.models.filter(m => m.id !== activeModel.id); updateState({ models: filtered, activeModelId: filtered[0].id }); };
  const handleAddText = () => { save(); const newText: TextConfig = { id: `text_${Date.now()}`, content: '双击编辑文字', visible: true, font: DEFAULT_FONT_URL, fontSize: 1, position: [0, 0, 0.1], rotation: [0, 0, 0], scale: 1, color: '#ffffff', opacity: 1, blur: 0, glow: 0 }; updateState({ texts: [...state.texts, newText], activeTextId: newText.id, activeModelId: null }); setActiveTab('text'); };
  const handleDeleteText = () => { if (!activeText) return; if (!confirm('确定删除此文字吗？')) return; save(); updateState({ texts: state.texts.filter(t => t.id !== activeText.id), activeTextId: null }); };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'screenshot' | 'fbx' | 'bg' | 'font') => {
      const file = e.target.files?.[0];
      e.target.value='';
      if (file) {
          save();
          if (type === 'screenshot' || type === 'bg') {
              try {
                  const isVideo = file.type.startsWith('video/');
                  const urlOrBase64 = isVideo ? URL.createObjectURL(file) : await fileToBase64(file);
                  if (type === 'screenshot') {
                      if (!activeModel) return;
                      updateModelState(current=>replaceScreen(current,activeModel.id,{
                          screenshot: urlOrBase64,
                          screenshotType: isVideo ? 'video' : 'image',
                          textureRotation: 0,
                          textureFlipX: false,
                          textureFlipY: false
                      }));
                  } else {
                      updateState({ bgImage: urlOrBase64,bgMediaType:isVideo?'video':'image' });
                  }
              } catch (err) {
                  alert("文件加载失败，请重试");
              }
          } else if(type==='font') {
              try {
                  if(!/\.(ttf|otf|woff)$/i.test(file.name))throw new Error('请选择 TTF、OTF 或 WOFF 字体，暂不支持 WOFF2。');
                  const bytes=await file.arrayBuffer();
                  await new FontFace('mockup-font-check',bytes).load();
                  updateActiveText({font:await fileToBase64(file)});
              } catch(error) {
                  alert(error instanceof Error?error.message:'字体读取失败，请选择有效的字体文件');
              }
          } else {
              const url = URL.createObjectURL(file);
              if (type === 'fbx') {
                  const isStl = file.name.toLowerCase().endsWith('.stl');
                  updateActiveModel({ fbxFile: url, sourceFile:file.name, mode: isStl ? 'stl' : 'fbx', modelFormat: file.name.toLowerCase().endsWith('.glb') ? 'glb' : isStl ? 'stl' : 'fbx', selectedScreenMesh: null, subMeshes: [],position:activeModel?.position||[0,0,0],rotation:[0,0,0],scale:1 });
              }
          }
      }
  };

  const handlePresetSelect = (path: string) => {
      const preset = MODEL_PRESETS.find(p=>p.file===path);
      if (!preset) return;
      save();
      const bodyColor=path.includes('iphone18')?'#543a3e':path.includes('iphone-duo')?'#f3ede5':path.includes('iphone17')?'#d9723d':'#e0e0e0';
      updateActiveModel({fbxFile:path,sourceFile:path,mode:'fbx',modelFormat:preset.format,selectedScreenMesh:preset.screen,name:preset.name,position:activeModel?.position||[0,0,0],rotation:[0,0,0],scale:1,subMeshes:[],bodyColor,bodyColorOverride:false,foldAngle:isAppleDuo(path)?180:undefined,textureRotation:0,textureFlipX:false,textureFlipY:false});
      updateState({isSelectingScreen:false});
  };
  const handleCanvasRatio = (ratio: number | 'auto') => { setShowCustomRatio(false); updateState({ canvasAspectRatio: ratio }); save(); };
  const handleExportImage = async () => {
    const canvas=document.querySelector('canvas');if(!canvas||state.isExporting)return;
    const rect=canvas.getBoundingClientRect(),sizing=exportSizing(rect.width,rect.height,'4k');
    updateState({isExporting:true,isPlaying:false,isSelectingFocus:false,exportDpr:sizing.dpr});
    try{
      // Wait for a frame at the export DPR, not a completed preview-size frame.
      const started=performance.now();
      do{
        await waitForSceneFrame(canvas,state.currentTime);
        if(Math.abs(Math.max(canvas.width,canvas.height)-sizing.longEdge)<=3)break;
        if(performance.now()-started>10000)throw Error('导出画布尺寸未就绪，请重试');
      }while(true);
      const link=document.createElement('a');link.download=`mockup-render-${Date.now()}.png`;link.href=canvas.toDataURL('image/png');link.click();
    }catch(e){alert(`图片导出失败：${e instanceof Error?e.message:String(e)}`);}
    finally{updateState({isExporting:false,exportDpr:undefined});}
  };
  const updateShadow = (updates: Partial<typeof state.shadowConfig>) => { updateState({ shadowConfig: { ...state.shadowConfig, ...updates } }); };

  const handleSmartAlign = () => {
      if (!activeModel || !activeModel.screenshot) return;
      save();
      updateActiveModel({textureRotation:0,textureFlipX:false,textureFlipY:false});
  };

  return (
    <div className="editor-controls w-[340px] m-4 mr-0 rounded-3xl z-40 flex flex-col transition-all duration-300 pointer-events-auto bg-black/60 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden ring-1 ring-white/5 h-[calc(100vh-32px)] shrink-0">

      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-50" />
      <div className="p-6 pb-2 border-b border-white/5 bg-white/5">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-xl font-black italic tracking-tighter text-gray-100 flex items-center gap-2">Mockup<span className="text-blue-500">3D</span></h1>
              <a href="https://github.com/LELE666999/MockupStudio" target="_blank" rel="noreferrer" title="查看开源代码与使用说明" className="text-[10px] whitespace-nowrap px-2 py-1 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500/20 transition-colors">GitHub</a>
            </div>
            <div className="flex gap-2">
                <ThemeToggle/>
                <button onClick={handleResetProject} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors border border-white/5" title="完全重置 (清除所有内容)">
                    <RotateCcw size={14} />
                </button>
            </div>
        </div>

        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 relative">
            <button onClick={openModelTab} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all duration-300 relative z-10 ${activeTab === 'model' ? 'text-black' : 'text-gray-400 hover:text-gray-200'}`}><Box size={14} strokeWidth={2.5} /> 模型</button>
            <button onClick={() => setActiveTab('text')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all duration-300 relative z-10 ${activeTab === 'text' ? 'text-black' : 'text-gray-400 hover:text-gray-200'}`}><Type size={14} strokeWidth={2.5} /> 文字</button>
            <button onClick={() => setActiveTab('env')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all duration-300 relative z-10 ${activeTab === 'env' ? 'text-black' : 'text-gray-400 hover:text-gray-200'}`}><Sun size={14} strokeWidth={2.5} /> 环境</button>
            <div className={`absolute top-1 bottom-1 w-[calc(33.33%-4px)] bg-orange-500 rounded-lg shadow-lg transition-all duration-300 ease-out ${activeTab === 'model' ? 'left-1' : activeTab === 'text' ? 'left-[calc(33.33%+2px)]' : 'left-[calc(66.66%+2px)]'}`} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 scrollbar-hide space-y-8">
        {activeTab === 'model' && activeModel && (
            <div className="animate-slide-in-right">
                <PanelSection title={`当前编辑: ${activeModel.name}`}>
                    <div className="flex gap-2 mb-2">
                        <button onClick={handleDuplicateModel} className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white flex items-center justify-center gap-1" title="复制当前模型"><Copy size={12} /> 复制</button>
                        <button onClick={handleDeleteModel} className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-xs text-red-300 flex items-center justify-center gap-1" title="删除当前模型"><Trash2 size={12} /> 删除</button>
                    </div>
                    <div className="flex flex-wrap gap-2 pb-1 mb-3">
                        {state.models.map(m => (
                            <button key={m.id} onClick={e => updateState(selectModel(state,m.id,e.shiftKey||e.ctrlKey||e.metaKey))} aria-pressed={selectedModels(state).some(o=>o.id===m.id)} className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] border transition-all ${selectedModels(state).some(o=>o.id===m.id) ? 'bg-blue-600 border-blue-500 text-white' : 'bg-black/30 border-white/10 text-gray-500 hover:text-white'}`}>{m.name}</button>
                        ))}
                        <div className="relative shrink-0">
                            <button aria-label="添加模型" title="在右侧添加同款模型，可在机型库更换" onClick={handleDuplicateModel} className={`w-8 h-8 rounded-lg border border-dashed flex items-center justify-center transition-all bg-blue-500 text-white border-blue-500`}><Plus size={14}/></button>
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-3">点击选中 · Shift / ⌘ / Ctrl 多选 · 拖动轴移动或旋转</p><div className="grid grid-cols-2 gap-1 p-1 bg-black/40 rounded-2xl border border-white/5 shadow-inner">
                        <button onClick={() => { save(); updateActiveModel({ mode: 'simple' }); }} className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all ${activeModel.mode === 'simple' ? 'bg-white/10 text-white shadow-sm border border-white/10' : 'text-gray-500 hover:text-gray-300'}`}><Box size={14} /> 简单</button>
                        <button onClick={() => { save(); updateActiveModel({ mode: 'fbx' }); }} className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all ${activeModel.mode === 'fbx' || activeModel.mode === 'stl' ? 'bg-white/10 text-white shadow-sm border border-white/10' : 'text-gray-500 hover:text-gray-300'}`}><Library size={14} /> 高级</button>
                    </div>
                </PanelSection>

                {activeModel.mode==='simple'&&<PanelSection title="简单样机类型">
                    <SegmentedControl label="简单样机类型" value={activeModel.simpleStyle||'slab'} options={[{value:'slab',label:'直板样机'},{value:'fold',label:'阔折叠样机'}]} onChange={simpleStyle=>{
                        save();updateActiveModel({simpleStyle,foldAngle:simpleStyle==='fold'?(activeModel.foldAngle??135):activeModel.foldAngle,name:simpleStyle==='fold'?'阔折叠样机':'直板样机',...(simpleStyle==='fold'?{width:6,height:4.324,depth:.19,radius:.18,bezelWidth:.055}:{width:3,height:6,depth:.2,radius:.15,bezelWidth:.15})});
                    }}/>
                </PanelSection>}

                {((activeModel.mode==='simple'&&activeModel.simpleStyle==='fold')||(activeModel.mode==='fbx'&&isAppleDuo(activeModel.sourceFile||activeModel.fbxFile)))&&<PanelSection title="折叠开合">
                    <div className="space-y-3">
                        <GlassInputRange label="展开角度" value={activeModel.foldAngle??(activeModel.mode==='fbx'?0:180)} min={0} max={180} step={1} onPointerDown={save} onChange={(foldAngle:number)=>updateActiveModel({foldAngle})}/>
                        <div className="grid grid-cols-3 gap-2">{[{angle:0,label:'合拢'},{angle:90,label:'半开'},{angle:180,label:'完全展开'}].map(p=><button key={p.angle} className="rounded-lg border border-white/10 bg-white/5 py-2 text-xs" onClick={()=>{save();updateActiveModel({foldAngle:p.angle});}}>{p.label}</button>)}</div>
                        <p className="text-[10px] text-gray-400 leading-relaxed">0° 合拢 · 180° 平展。内屏自动连接下方图片或视频。调整角度后，在时间轴添加关键帧。</p>
                        {!state.keyframes.length&&<button className="w-full rounded-lg bg-blue-600 text-white py-2 text-xs" onClick={()=>{
                            save();const models=state.models.map(m=>m.id===activeModel.id?{...m,foldAngle:0}:m);
                            updateModelState({models,currentTime:0,totalDuration:3,isPlaying:false,keyframes:[{id:crypto.randomUUID(),time:0,easing:'ease-in-out',state:{models:structuredClone(models)}},{id:crypto.randomUUID(),time:3,easing:'ease-in-out',state:{models:models.map(m=>m.id===activeModel.id?{...m,foldAngle:180}:structuredClone(m))}}]});
                        }}>生成 3 秒展开动画</button>}
                    </div>
                </PanelSection>}

                {(activeModel.mode === 'fbx' || activeModel.mode === 'stl') && (
                <>
                    <PanelSection title="模型文件">
                        <div className="mb-4">
                            <span className="text-[9px] font-bold text-gray-500 mb-2 block uppercase tracking-wider pl-1">预设机型库</span>
                            <div className="grid grid-cols-1 gap-2">
                                {['HUAWEI','Apple'].filter(brand=>MODEL_PRESETS.some(preset=>preset.name.startsWith(brand))).map(brand=><section key={brand} aria-label={brand==='HUAWEI'?'华为模型':'苹果模型'} className="space-y-2"><h4 className="text-xs font-bold text-gray-300 pt-2">{brand==='HUAWEI'?'华为 HUAWEI':'苹果 Apple'}</h4>{MODEL_PRESETS.filter(preset=>preset.name.startsWith(brand)).map(preset => <button key={preset.id} onClick={()=>handlePresetSelect(preset.file)} className={`w-full p-3 rounded-xl border text-left flex items-center gap-3 transition-colors ${activeModel.fbxFile===preset.file?'bg-blue-500/15 border-blue-500/50':'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                                  <Smartphone size={18} className="text-blue-400 shrink-0"/>
                                  <div><div className="text-xs font-bold text-gray-200">{preset.name}</div><div className="text-[10px] text-gray-400 mt-1">{preset.description}</div></div>
                                </button>)}</section>)}
                            </div>
                        </div>
                        <button onClick={() => fbxInputRef.current?.click()} className="w-full h-10 border border-dashed rounded-xl flex items-center justify-center gap-2 text-xs mb-3 bg-white/5 border-white/10 text-gray-400 hover:bg-white/10">
                            <input type="file" ref={fbxInputRef} hidden accept=".fbx,.stl,.glb" onChange={(e) => handleFileUpload(e, 'fbx')} />
                            <span className="flex items-center gap-2"><UploadCloud size={14}/> 导入 FBX / STL / GLB</span>
                        </button>
                    </PanelSection>

                    <PanelSection title="屏幕映射">
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-gray-400">选取屏幕区域</span>
                                {activeModel.selectedScreenMesh && <span className="text-[9px] text-green-400 bg-green-900/20 px-1.5 py-0.5 rounded border border-green-500/20">已连接: {activeModel.selectedScreenMesh}</span>}
                            </div>
                            <button onClick={() => updateModelState({ isSelectingScreen: !state.isSelectingScreen })} className={`w-full py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 transition-all ${state.isSelectingScreen ? 'bg-blue-600 text-white animate-pulse' : activeModel.selectedScreenMesh ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-blue-600/80 text-white hover:bg-blue-500'}`}>
                                {state.isSelectingScreen ? '请点击模型屏幕区域...' : (activeModel.selectedScreenMesh ? '重新拾取屏幕' : `点击拾取 ${activeModel.name} 屏幕`)}
                            </button>
                        </div>
                    </PanelSection>
                </>
                )}

                {(activeModel.mode === 'simple' || activeModel.selectedScreenMesh) && (
                <PanelSection title={(activeModel.mode==='simple'&&activeModel.simpleStyle==='fold')||activeModel.selectedScreenMesh===APPLE_DUO_INNER?'内屏 · 大屏幕':'屏幕贴图'}>
                    <button onClick={() => fileInputRef.current?.click()} className={`w-full aspect-[21/9] rounded-xl border border-dashed overflow-hidden relative group transition-all mb-2 shadow-lg ${activeModel.screenshot ? 'bg-black/40 border-white/10 hover:border-white/30' : 'bg-green-900/10 border-green-500/40 hover:bg-green-900/20 hover:border-green-400 hover:shadow-[0_0_15px_rgba(34,197,94,0.2)]'}`}>
                    <input type="file" ref={fileInputRef} hidden accept="image/*,video/*" onChange={(e) => handleFileUpload(e, 'screenshot')} />
                    {activeModel.screenshot ? (
                        <>
                        {activeModel.screenshotType === 'video' ? (
                            <TimelineVideoPreview src={activeModel.screenshot} state={state}/>
                        ) : (
                            <img src={activeModel.screenshot} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"><span className="text-xs text-white font-medium flex items-center gap-2"><ImageIcon size={14}/> 更换文件</span></div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full gap-2"><div className="p-2 rounded-full bg-green-500/10 text-green-500 animate-pulse group-hover:scale-110 transition-transform"><ImageIcon size={24} /></div><span className="text-[11px] font-bold text-green-400 tracking-wide">点击上传屏幕截图或视频</span></div>
                    )}
                    </button>
                    {activeModel.screenshot && (
                        <>
                            <div className="flex items-center gap-2 mb-3">
                                <button onClick={handleSmartAlign} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-[10px] text-white font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"><Wand2 size={12} /> 恢复贴图方向</button>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5 mb-3">
                                <button onClick={() => { save(); updateActiveModel({ textureRotation: (activeModel.textureRotation - 90) % 360 }); }} className="flex items-center justify-center gap-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] text-gray-300 transition-colors border border-white/5"><RotateCw size={12} className="-scale-x-100" /> 旋转</button>
                                <button onClick={() => { save(); updateActiveModel({ textureFlipX: !activeModel.textureFlipX }); }} className={`flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] transition-colors border ${activeModel.textureFlipX ? 'bg-blue-600/30 text-blue-200 border-blue-500/30' : 'bg-white/5 text-gray-300 border-white/5 hover:bg-white/10'}`}><FlipHorizontal size={12} /> 水平</button>
                                <button onClick={() => { save(); updateActiveModel({ textureFlipY: !activeModel.textureFlipY }); }} className={`flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] transition-colors border ${activeModel.textureFlipY ? 'bg-blue-600/30 text-blue-200 border-blue-500/30' : 'bg-white/5 text-gray-300 border-white/5 hover:bg-white/10'}`}><FlipVertical size={12} /> 垂直</button>
                                <button onClick={() => { save(); updateActiveModel({ textureStretch: !activeModel.textureStretch }); }} className={`flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] transition-colors border ${activeModel.textureStretch ? 'bg-blue-600/30 text-blue-200 border-blue-500/30' : 'bg-white/5 text-gray-300 border-white/5 hover:bg-white/10'}`} title="拉伸图片填满屏幕"><Maximize size={12} className={activeModel.textureStretch ? "" : "rotate-45"} /> {activeModel.textureStretch ? "已拉伸" : "填充"}</button>
                            </div>
                            <div className="pt-2 border-t border-white/5 space-y-4">
                                <span className="text-[10px] font-bold text-gray-400 mb-2 block">屏幕质感与过渡</span>
                                <GlassInputRange label="图片过渡时长 (秒)" value={activeModel.imageTransitionDuration ?? 0.5} min={0} max={2} step={0.1} onPointerDown={save} onChange={(v: number) => updateActiveModel({ imageTransitionDuration: v })} />
                                <GlassInputRange label="屏幕亮度 (自发光)" value={activeModel.screenEmissive ?? 1.0} min={0} max={2} step={0.01} onPointerDown={save} onChange={(v: number) => updateActiveModel({ screenEmissive: v })} />
                            </div>
                        </>
                    )}
                </PanelSection>
                )}

                {((activeModel.mode==='simple'&&activeModel.simpleStyle==='fold')||(activeModel.mode==='fbx'&&isAppleDuo(activeModel.sourceFile||activeModel.fbxFile)))&&<PanelSection title="外屏 · 小屏幕">
                    <button className="w-full rounded-lg bg-white/5 border border-white/10 py-2 mb-2 text-xs" onClick={()=>{save();updateActiveModel({rotation:[0,Math.PI-(180-(activeModel.foldAngle??180))*Math.PI/360,0]});updateState({isPlaying:false});}}>查看外屏</button>
                    <label className="block cursor-pointer rounded-xl border border-dashed border-white/20 bg-white/5 overflow-hidden">
                        <input aria-label="导入外屏图片或视频" type="file" hidden accept="image/*,video/*" onChange={e=>{
                            const file=e.target.files?.[0];e.target.value='';if(!file)return;
                            const url=URL.createObjectURL(file);save();updateModelState(current=>replaceCoverScreen(current,activeModel.id,url,file.type.startsWith('video/')?'video':'image'));
                        }}/>
                        {activeModel.coverScreenshot?<div className="h-28 overflow-hidden">
                            {activeModel.coverScreenshotType==='video'?<TimelineVideoPreview src={activeModel.coverScreenshot} state={state}/>:<img src={activeModel.coverScreenshot} className="w-full h-full object-contain"/>}
                        </div>:<div className="h-24 flex items-center justify-center gap-2 text-xs text-gray-400"><Video size={18}/> 导入外屏图片或视频</div>}
                        {activeModel.coverScreenshot&&<span className="block text-center text-xs py-2 text-blue-400">更换外屏文件</span>}
                    </label>
                    <p className="text-[10px] text-gray-400 leading-relaxed mt-2">外屏位于机背的一半，旋转模型即可看到。内外屏分别从第 0 秒跟随时间轴播放，短视频播完停在最后一帧。</p>
                    {activeModel.coverScreenshot&&<button className="mt-2 text-xs text-gray-400" onClick={()=>{save();updateModelState(replaceCoverScreen(state,activeModel.id,null));}}>清除外屏媒体</button>}
                </PanelSection>}

                {activeModel.mode === 'fbx' && (
                <PanelSection title="高级材质">
                    <div className="grid grid-cols-5 gap-1 mb-3">
                        {[{ id: 'matte', name: '磨砂' }, { id: 'aluminum', name: '铝' }, { id: 'titanium', name: '钛' }, { id: 'gold', name: '金' }, { id: 'plastic', name: '光面' }].map((m) => (
                        <button key={m.id} onClick={() => {
                            save();
                            const presets: any = {
                                matte: { m: 0.1, r: 0.8, c: 0.1, s: 0.0 },
                                aluminum: { m: 0.8, r: 0.3, c: 0.5, s: 0.2 },
                                titanium: { m: 1.0, r: 0.2, c: 0.8, s: 0.3 },
                                gold: { m: 1.0, r: 0.1, c: 1.0, s: 0.5 },
                                plastic: { m: 0.0, r: 0.05, c: 1.0, s: 0.1 }
                            };
                            const p = presets[m.id];
                            updateActiveModel({ bodyMaterial: m.id as any, metalness: p.m, roughness: p.r, clearcoat: p.c, sheen: p.s });
                        }} className={`text-[9px] py-1.5 rounded border transition-all ${activeModel.bodyMaterial === m.id ? 'bg-white text-black border-white' : 'bg-transparent text-gray-500 border-white/10 hover:border-white/30'}`}>{m.name}</button>
                        ))}
                    </div>
                    {state.lightingMode !== 'flat' && (
                        <>
                            <GlassInputRange label="粗糙度" onPointerDown={save} value={activeModel.roughness} min={0} max={1} onChange={(v:number) => updateActiveModel({ roughness: v })} />
                            <GlassInputRange label="金属度" onPointerDown={save} value={activeModel.metalness} min={0} max={1} onChange={(v:number) => updateActiveModel({ metalness: v })} />
                            <GlassInputRange label="清漆强度 (Clearcoat)" onPointerDown={save} value={activeModel.clearcoat ?? 1.0} min={0} max={1} onChange={(v:number) => updateActiveModel({ clearcoat: v })} />
                            <GlassInputRange label="丝绒感 (Sheen)" onPointerDown={save} value={activeModel.sheen ?? 0.5} min={0} max={1} onChange={(v:number) => updateActiveModel({ sheen: v })} />
                        </>
                    )}
                    <div className="mt-3 flex justify-between items-center bg-white/5 p-2 rounded-lg">
                        <span className="text-[11px] text-gray-400">机身 / 外框颜色</span>
                        <div className="flex items-center gap-2">
                            {isAppleModel(activeModel.sourceFile||activeModel.fbxFile)&&<button className="text-[10px] text-gray-400" aria-pressed={!activeModel.bodyColorOverride} onClick={()=>{save();updateActiveModel({bodyColorOverride:false});}}>原始配色</button>}
                            <div className="relative group w-8 h-6 overflow-hidden rounded-md border border-white/20 cursor-pointer hover:border-white/50 transition-colors">
                                <div className="absolute inset-0" style={{backgroundColor: activeModel.bodyColor}} />
                                <input aria-label="机身颜色" ref={customBodyColorInputRef} type="color" value={activeModel.bodyColor} onInput={save} onChange={(e) => updateActiveModel({ bodyColor: e.target.value,bodyColorOverride:true })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            </div>
                        </div>
                    </div>
                    <label className="mt-2 flex items-center justify-between px-2 text-[11px] text-gray-300">
                      机身颜色不跟随关键帧
                      <ToggleSwitch label="机身颜色不跟随关键帧" checked={!!activeModel.bodyColorLocked} onChange={bodyColorLocked=>{save();updateActiveModel({bodyColorLocked});}}/>
                    </label>
                </PanelSection>
                )}

                {activeModel.mode === 'simple' && (
                <PanelSection title="样机参数">
                    <GlassInputRange label="宽度" onPointerDown={save} value={activeModel.width} min={1} max={10} onChange={(v:number) => updateActiveModel({ width: v })} />
                    <GlassInputRange label="高度" onPointerDown={save} value={activeModel.height} min={1} max={12} onChange={(v:number) => updateActiveModel({ height: v })} />
                    <GlassInputRange label="机身厚度" onPointerDown={save} value={activeModel.depth} min={0.05} max={1.5} onChange={(v:number) => updateActiveModel({ depth: v })} />
                    <GlassInputRange label="R角半径" onPointerDown={save} value={activeModel.radius} min={0} max={2} step={0.01} onChange={(v:number) => updateActiveModel({ radius: v })} />
                    <GlassInputRange label="边框宽度" onPointerDown={save} value={activeModel.bezelWidth} min={0} max={1.0} step={0.01} onChange={(v:number) => updateActiveModel({ bezelWidth: v })} />
                    <div className="mt-3 flex items-center justify-between"><span className="text-[11px] text-gray-400">边框颜色</span><div className="flex gap-1.5 flex-wrap">{['#111111', '#333333', '#888888', '#e5e5e5', '#d4af37'].map(c => (<ColorOption key={c} color={c} active={activeModel.edgeColor === c} onClick={(v:string) => { save(); updateActiveModel({ edgeColor: v }); }} />))}<div className="relative group w-6 h-6"><div className={`absolute inset-0 rounded-full border border-dashed border-white/30 flex items-center justify-center pointer-events-none ${!['#111111', '#333333', '#888888', '#e5e5e5', '#d4af37'].includes(activeModel.edgeColor) ? 'border-blue-500' : ''}`}><div className="w-4 h-4 rounded-full" style={{ backgroundColor: activeModel.edgeColor }} /></div><input ref={customEdgeColorInputRef} type="color" value={activeModel.edgeColor} onInput={save} onChange={(e) => updateActiveModel({ edgeColor: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" /></div></div></div>
                </PanelSection>
                )}
            </div>
        )}

        {activeTab === 'text' && (
             <div className="animate-slide-in-right">
                <PanelSection title="文字列表 (水印/标题)">
                    <button onClick={handleAddText} className="w-full py-2.5 bg-blue-600/20 border border-blue-500/50 hover:bg-blue-600/40 text-blue-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 mb-3"><Plus size={14} /> 添加新文字</button>
                    <div className="space-y-1 max-h-[150px] overflow-y-auto mb-2">
                        {state.texts.length === 0 && <div className="text-[10px] text-gray-500 text-center py-2">暂无文字，请添加</div>}
                        {state.texts.map(t => (
                            <button key={t.id} onClick={() => updateState({ activeTextId: t.id, activeModelId: null })} className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between border ${t.id === state.activeTextId ? 'bg-blue-900/40 border-blue-500/50 text-white' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'}`}><span className="truncate max-w-[150px]">{t.content || '未命名文字'}</span>{t.id === state.activeTextId && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}</button>
                        ))}
                    </div>
                </PanelSection>
                {activeText ? (
                    <>
                        <PanelSection title="文字内容"><input type="text" value={activeText.content} onChange={(e) => updateActiveText({ content: e.target.value })} onFocus={save} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-blue-500 focus:outline-none mb-3" /><div className="flex gap-2"><div className="flex-1 flex items-center justify-between bg-white/5 p-2 rounded-lg"><span className="text-[11px] text-gray-400">文字颜色</span><div className="relative group w-6 h-6"><div className="absolute inset-0 rounded-full border border-white/20" style={{backgroundColor: activeText.color}} /><input ref={textColorInputRef} type="color" value={activeText.color} onInput={save} onChange={(e) => updateActiveText({ color: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" /></div></div><button onClick={() => fontInputRef.current?.click()} className="flex-1 bg-white/5 p-2 rounded-lg border border-white/5 hover:bg-white/10 flex items-center justify-center gap-1 text-[10px] text-gray-300"><Type size={12} /> {activeText.font ? '自定义字体' : '系统默认'}<input type="file" ref={fontInputRef} hidden accept=".ttf,.otf,.woff" onChange={(e) => handleFileUpload(e, 'font')} /></button></div></PanelSection>
                        <PanelSection title="位置 (Position)"><GlassInputRange label="X (水平)" onPointerDown={save} value={activeText.position[0]} min={-5} max={5} onChange={(v:number) => updateTextTransform(0, v, 'position')} /><GlassInputRange label="Y (垂直)" onPointerDown={save} value={activeText.position[1]} min={-5} max={5} onChange={(v:number) => updateTextTransform(1, v, 'position')} /><GlassInputRange label="Z (前后)" onPointerDown={save} value={activeText.position[2]} min={-5} max={5} onChange={(v:number) => updateTextTransform(2, v, 'position')} /></PanelSection>
                        <PanelSection title="旋转 (Rotation)"><GlassInputRange label="X (翻转)" onPointerDown={save} value={toDeg(activeText.rotation[0])} min={-180} max={180} step={1} onChange={(v:number) => updateTextTransform(0, toRad(v), 'rotation')} /><GlassInputRange label="Y (自转)" onPointerDown={save} value={toDeg(activeText.rotation[1])} min={-180} max={180} step={1} onChange={(v:number) => updateTextTransform(1, toRad(v), 'rotation')} /><GlassInputRange label="Z (倾斜)" onPointerDown={save} value={toDeg(activeText.rotation[2])} min={-180} max={180} step={1} onChange={(v:number) => updateTextTransform(2, toRad(v), 'rotation')} /></PanelSection>
                        <PanelSection title="外观 & 特效"><GlassInputRange label="字号大小 (Scale)" onPointerDown={save} value={activeText.scale} min={0.1} max={10} step={0.1} onChange={(v:number) => updateActiveText({ scale: v })} /><GlassInputRange label="透明度" onPointerDown={save} value={activeText.opacity} min={0} max={1} onChange={(v:number) => updateActiveText({ opacity: v })} /><div className="h-px bg-white/10 my-3" /><GlassInputRange label="高斯模糊 (Blur)" onPointerDown={save} value={activeText.blur} min={0} max={2} step={0.01} onChange={(v:number) => updateActiveText({ blur: v })} /><GlassInputRange label="发光强度 (Glow)" onPointerDown={save} value={activeText.glow} min={0} max={2} onChange={(v:number) => updateActiveText({ glow: v })} /><p className="text-[9px] text-gray-500 mt-2">* 模糊和发光效果颜色自动跟随文字颜色</p></PanelSection>
                        <button onClick={handleDeleteText} className="w-full py-3 bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 rounded-xl text-xs font-bold flex items-center justify-center gap-2 mt-4"><Trash2 size={14} /> 删除此文字</button>
                    </>
                ) : (
                    <div className="text-center text-[10px] text-gray-500 py-4 border border-dashed border-white/10 rounded-xl">请选择或添加文字进行编辑</div>
                )}
             </div>
        )}

        {activeTab === 'env' && (
            <div className="animate-slide-in-right">
                <PanelSection title="场景"><StagePanel state={state} updateState={updateState} save={save}/></PanelSection>
                <PanelSection title="画布设置">
                    <div className="grid grid-cols-4 gap-1.5 mb-2">
                        <RatioButton label="3:4" onClick={() => handleCanvasRatio(3/4)} active={state.canvasAspectRatio === 3/4} />
                        <RatioButton label="4:3" onClick={() => handleCanvasRatio(4/3)} active={state.canvasAspectRatio === 4/3} />
                        <RatioButton label="9:16" onClick={() => handleCanvasRatio(9/16)} active={state.canvasAspectRatio === 9/16} />
                        <RatioButton label="16:9" onClick={() => handleCanvasRatio(16/9)} active={state.canvasAspectRatio === 16/9} />
                        <button onClick={() => handleCanvasRatio('auto')} className="col-span-2 py-2 rounded-xl border border-white/10 text-[10px]" aria-pressed={state.canvasAspectRatio==='auto'}>自适应</button>
                        <button onClick={() => {save();setShowCustomRatio(true);updateState({canvasAspectRatio:(state.customCanvasWidth||1080)/(state.customCanvasHeight||1920)});}} className="col-span-2 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-white/10 text-[10px]"><Settings2 size={12} /> 自定义比例</button>
                    </div>
                    {showCustomRatio && (
                        <div className="flex gap-2 p-2 bg-white/5 rounded-xl border border-white/5 animate-fade-in">{(['width','height'] as const).map(axis=><label key={axis} className="flex-1 text-[9px] text-gray-500">{axis==='width'?'宽度':'高度'}<input aria-label={axis==='width'?'自定义画布宽度':'自定义画布高度'} type="number" min={1} max={16384} value={axis==='width'?state.customCanvasWidth:state.customCanvasHeight} onFocus={save} onChange={e=>{const value=Number(e.target.value);if(!Number.isFinite(value)||value<1||value>16384)return;const w=axis==='width'?value:state.customCanvasWidth;const h=axis==='height'?value:state.customCanvasHeight;updateState({customCanvasWidth:w,customCanvasHeight:h,canvasAspectRatio:w/h});}} className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"/></label>)}</div>
                    )}
                </PanelSection>
                <PanelSection title="光影设置 (全局)">
                    <div className="mb-3"><SegmentedControl label="渲染质感" value={state.renderStyle||'legacy'} options={[{value:'legacy',label:'原始'},{value:'studio',label:'棚拍'}]} disabled={state.isExporting} onChange={renderStyle=>{save();updateState({renderStyle});}}/></div>
                    <div className="block mb-3 text-xs text-gray-400">
                      相机投影
                      <div className="mt-2"><SegmentedControl label="相机投影" value={state.projectionMode || 'perspective'} options={[{value:'perspective',label:'透视'},{value:'weak',label:'弱透视'},{value:'orthographic',label:'正交'}]} disabled={state.isExporting} onChange={projectionMode=>{save();updateState({projectionMode});}}/></div>
                      <span className="block mt-1">{state.projectionMode==='orthographic'?'滚轮仍调整深度，但不改变大小；大小请用模型缩放。':'切换不改变模型姿态；以相机目标平面匹配画面大小。'}</span>
                    </div>
                    <LensPanel state={state} updateState={updateState} save={save}/>
                    <label className="flex items-center justify-between mb-3 px-1 text-xs">
                        <span className="flex items-center gap-2"><Zap size={12}/>真实光影</span>
                        <ToggleSwitch label="真实光影" checked={state.lightingMode==='realistic'} disabled={state.isExporting} onChange={enabled=>{save();updateState({lightingMode:enabled?'realistic':'flat'});}}/>
                    </label>
                    {state.lightingMode === 'realistic' && (
                        <>
                            <div className="flex items-center justify-between mb-3 px-1">
                                <span className="text-[11px] text-gray-400 font-medium tracking-wide">光照颜色</span>
                                <div className="relative group w-6 h-6">
                                    <div className="absolute inset-0 rounded-full border border-white/20 shadow-lg" style={{backgroundColor: state.lightColor}} />
                                    <input
                                        type="color"
                                        value={state.lightColor}
                                        onInput={save}
                                        onChange={(e) => updateState({ lightColor: e.target.value })}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                </div>
                            </div>
                            <GlassInputRange label="环境光强度" onPointerDown={save} value={state.ambientIntensity} min={0} max={3} onChange={(v:number) => updateState({ ambientIntensity: v })} />
                            <GlassInputRange label="主光强度" onPointerDown={save} value={state.spotIntensity} min={0} max={10} onChange={(v:number) => updateState({ spotIntensity: v })} />
                        </>
                    )}
                    <div className="mt-3 pt-3 border-t border-white/5">
                        <div className="flex items-center gap-2 mb-2 text-blue-400 font-bold text-[10px] uppercase tracking-wider">
                            <Sparkles size={12} /> 屏幕全局反光控制
                        </div>
                        <GlassInputRange label="反光强度 (叠加)" onPointerDown={save} value={state.reflectionIntensity ?? 0} min={0} max={1} step={0.01} onChange={(v:number) => updateState({ reflectionIntensity: v })} />
                    </div>
                </PanelSection>
                <PanelSection title="高级阴影 (全局)"><div className="flex gap-1.5 mb-3 p-1 bg-white/5 rounded-xl border border-white/5">{[{ id: 'none', label: '无', icon: ZapOff }, { id: 'floor', label: '底部阴影', icon: ArrowDownToLine }, { id: 'wall', label: '背部阴影', icon: ArrowRightToLine }].map((item: any) => (<button key={item.id} onClick={() => { save(); updateShadow({ type: item.id as ShadowType }); }} className={`flex-1 py-2 text-[10px] rounded-lg flex items-center justify-center gap-1 transition-colors ${state.shadowConfig.type === item.id ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}><item.icon size={10} /> {item.label}</button>))}</div>{state.shadowConfig.type !== 'none' && (<div className="space-y-2 animate-fade-in"><div className="flex items-center justify-between mb-2"><span className="text-[11px] text-gray-400 font-medium tracking-wide">阴影颜色</span><div className="relative group w-5 h-5"><div className="absolute inset-0 rounded-full border border-white/20" style={{backgroundColor: state.shadowConfig.color}} /><input ref={shadowColorRef} type="color" value={state.shadowConfig.color} onInput={save} onChange={(e) => updateShadow({ color: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/></div></div><GlassInputRange label="透明度" onPointerDown={save} value={state.shadowConfig.opacity} min={0} max={1} onChange={(v:number) => updateShadow({ opacity: v })} /><GlassInputRange label="柔化程度" onPointerDown={save} value={state.shadowConfig.blur} min={0} max={10} onChange={(v:number) => updateShadow({ blur: v })} />{state.shadowConfig.type === 'floor' && (<GlassInputRange label="距离模型底部 (Y轴)" onPointerDown={save} value={state.shadowConfig.offset} min={-5} max={5} step={0.05} onChange={(v:number) => updateShadow({ offset: v })} />)}{state.shadowConfig.type === 'wall' && (<GlassInputRange label="距离模型背部 (Z轴)" onPointerDown={save} value={state.shadowConfig.offset} min={-5} max={5} step={0.05} onChange={(v:number) => updateShadow({ offset: v })} />)}</div>)}</PanelSection>
                <PanelSection title="背景设置 (全局)">
                    <div className="flex gap-1.5 mb-3">
                        <button onClick={() => { save(); updateState({ bgImage: null, bgColor: 'transparent', bgBlur: 0 }); }} className={`flex-1 py-2 text-xs rounded-xl border transition-all ${state.bgColor === 'transparent' && !state.bgImage ? 'bg-white/10 border-white/20 text-white' : 'border-transparent text-gray-500 hover:bg-white/5'}`}>透明</button>
                        <button onClick={() => { save(); updateState({ bgImage: null, bgColor: '#1a1a1a', bgBlur: 0 }); }} className={`flex-1 py-2 text-xs rounded-xl border transition-all ${state.bgColor !== 'transparent' && !state.bgImage ? 'bg-white/10 border-white/20 text-white' : 'border-transparent text-gray-500 hover:bg-white/5'}`}>纯色</button>
                        <button onClick={() => bgInputRef.current?.click()} className={`flex-1 py-2 text-xs rounded-xl border transition-all ${state.bgImage && state.bgMediaType!=='video' ? 'bg-white/10 border-white/20 text-white' : 'border-transparent text-gray-500 hover:bg-white/5'}`}>图片</button>
                        <button onClick={() => bgVideoInputRef.current?.click()} className={`flex-1 py-2 text-xs rounded-xl border transition-all ${state.bgImage && state.bgMediaType==='video' ? 'bg-white/10 border-white/20 text-white' : 'border-transparent text-gray-500 hover:bg-white/5'}`}>视频</button>
                        <input aria-label="上传背景图片" type="file" ref={bgInputRef} hidden accept="image/*" onChange={(e) => {void handleFileUpload(e, 'bg');e.target.value='';}} />
                        <input aria-label="上传背景视频" type="file" ref={bgVideoInputRef} hidden accept="video/*" onChange={(e) => {void handleFileUpload(e, 'bg');e.target.value='';}} />
                    </div>
                    {/* 修正：当没有背景图且不是透明背景时，显示背景颜色选择器 */}
                    {!state.bgImage && state.bgColor !== 'transparent' && (
                        <div className="mb-3 flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5 animate-fade-in">
                            <span className="text-[11px] text-gray-400 font-medium">背景颜色</span>
                            <div className="relative group w-8 h-8 rounded-full border border-white/20 shadow-lg cursor-pointer overflow-hidden transition-all hover:scale-105">
                                <div className="absolute inset-0" style={{ backgroundColor: state.bgColor }} />
                                <input aria-label="背景颜色" ref={globalBgColorRef} type="color" value={state.bgColor} onChange={(e) => { save(); updateState({ bgColor: e.target.value }); }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            </div>
                        </div>
                    )}
                    <label className="mb-3 flex items-center justify-between px-2 text-[11px] text-gray-300">
                      背景颜色不跟随关键帧
                      <ToggleSwitch label="背景颜色不跟随关键帧" checked={!!state.bgColorLocked} onChange={bgColorLocked=>{save();updateState({bgColorLocked});}}/>
                    </label>
                    {state.bgImage && (
                        <div className="mb-3 p-3 bg-white/5 rounded-xl border border-white/5 animate-fade-in">
                            <GlassInputRange label="背景模糊" onPointerDown={save} value={state.bgBlur} min={0} max={50} step={1} onChange={(v: number) => updateState({ bgBlur: v })} />
                            {state.bgMediaType==='video'&&<p className="text-[10px] text-gray-400 mt-2">跟随时间轴 · 静音 · 末帧停住，不循环</p>}
                        </div>
                    )}
                </PanelSection>
                <PanelSection title={`变换控制 (快捷键: W/E/R)`}><div className="flex items-center justify-between mb-3 px-1"><span className="text-[10px] text-gray-400">显示控制轴 (Gizmo)</span><button onClick={() => updateState({ showGizmo: !state.showGizmo })} className={`w-9 h-5 rounded-full relative transition-all duration-300 border ${state.showGizmo ? 'bg-blue-600 border-blue-500' : 'bg-black/40 border-white/10'}`}><div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-all duration-300 ${state.showGizmo ? 'left-[18px]' : 'left-0.5'}`} /></button></div><div className="flex items-center justify-between mb-3 px-1"><span className="text-[10px] text-gray-400">坐标系空间</span><div className="flex bg-white/5 rounded-lg border border-white/5 p-0.5"><button onClick={() => updateState({ transformSpace: 'world' })} className={`px-2 py-1 text-[9px] rounded-md transition-all ${state.transformSpace === 'world' ? 'bg-white/10 text-white' : 'text-gray-500'}`}><Globe size={10} className="inline mr-1"/> 世界</button><button onClick={() => updateState({ transformSpace: 'local' })} className={`px-2 py-1 text-[9px] rounded-md transition-all ${state.transformSpace === 'local' ? 'bg-white/10 text-white' : 'text-gray-500'}`}><BoxSelect size={10} className="inline mr-1"/> 本地</button></div></div><div className="grid grid-cols-2 gap-1.5 mb-2"><GlassButton active={state.transformMode === 'universal'} onClick={() => updateState({ transformMode: 'universal' })} className="col-span-2 bg-blue-500/10 border-blue-500/20 text-blue-200"><Orbit size={14} /> 通用 (移动+旋转)</GlassButton><GlassButton active={state.transformMode === 'translate'} onClick={() => updateState({ transformMode: 'translate' })}><Move size={14} /> 移动 (W)</GlassButton><GlassButton active={state.transformMode === 'rotate'} onClick={() => updateState({ transformMode: 'rotate' })}><Rotate3d size={14} /> 旋转 (E)</GlassButton><GlassButton active={state.transformMode === 'scale'} onClick={() => updateState({ transformMode: 'scale' })} className="col-span-2"><Maximize size={14} /> 缩放 (S)</GlassButton></div></PanelSection>
            </div>
        )}
      </div>

      <div className="p-4 border-t border-white/5 bg-white/5 backdrop-blur-md">
        <button onClick={handleExportImage} className="w-full bg-white text-black py-3 rounded-xl font-bold text-sm shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-[1.02] transition-all flex items-center justify-center gap-2"><Download size={16} /> 导出 4K 渲染图</button>
      </div>
    </div>
  );
};
