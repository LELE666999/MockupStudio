import {selectModel,selectedModels} from '../../utils/modelSelection';
import React, { useState } from 'react';
import {ProjectStorage} from './ProjectStorage';
import {stageObjects} from '../../utils/stagePresets';
import { AppState, SavedProject, ModelConfig, TextConfig } from '../../types';
import { Save, FolderOpen, Trash2, Copy, Clock, FileBox, Archive, ArrowRight, UploadCloud, RefreshCw, Download, Upload, Layers, Eye, EyeOff, Box, Type, FolderTree, ChevronRight, ChevronDown } from 'lucide-react';

interface Props {
  state: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

export const ProjectPanel: React.FC<Props> = ({ state, updateState }) => {
  const [activeTab, setActiveTab] = useState<'layers' | 'archives'>('layers');
  const [expandedModelIds, setExpandedModelIds] = useState<Set<string>>(new Set());

  // --- LAYER ACTIONS ---
  const toggleModelVisibility = (id: string) => {
      const updated = state.models.map(m => {
          if (m.id === id) {
              const currentVis = m.visible !== false;
              return { ...m, visible: !currentVis };
          }
          return m;
      });
      updateState({ models: updated });
  };

  const toggleSubMeshVisibility = (modelId: string, meshName: string) => {
      const activeModel = state.models.find(m => m.id === modelId);
      if (!activeModel || !activeModel.subMeshes) return;

      const updatedSubMeshes = activeModel.subMeshes.map(sm =>
          sm.name === meshName ? { ...sm, visible: !sm.visible } : sm
      );

      const updatedModels = state.models.map(m =>
          m.id === modelId ? { ...m, subMeshes: updatedSubMeshes } : m
      );

      updateState({ models: updatedModels });
  };

  const toggleTextVisibility = (id: string) => {
      const updated = state.texts.map(t => {
          if (t.id === id) {
              const currentVis = t.visible !== false;
              return { ...t, visible: !currentVis };
          }
          return t;
      });
      updateState({ texts: updated });
  };

  const deleteModel = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (state.models.length <= 1) {
          alert("至少需要保留一个模型");
          return;
      }
      if (!confirm("确定要删除此模型图层吗？")) return;
      const updated = state.models.filter(m => m.id !== id);
      const activeId = id === state.activeModelId ? updated[0].id : state.activeModelId;
      updateState({ models: updated, activeModelId: activeId });
  };

  const deleteText = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm("确定要删除此文字图层吗？")) return;
      const updated = state.texts.filter(t => t.id !== id);
      updateState({ texts: updated, activeTextId: null });
  };

  const toggleModelExpand = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newSet = new Set(expandedModelIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setExpandedModelIds(newSet);
  }

  return (
    <div className="editor-projects w-[280px] m-4 ml-0 rounded-3xl z-40 flex flex-col transition-all duration-300 pointer-events-auto
                    bg-black/60 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden ring-1 ring-white/5
                    h-[calc(100vh-32px)] shrink-0">

       {/* Tab Switcher Header */}
       <div className="p-2 border-b border-white/5 bg-white/5">
         <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 relative">
            <button
                onClick={() => setActiveTab('layers')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all duration-300 relative z-10 ${activeTab === 'layers' ? 'text-black' : 'text-gray-400 hover:text-gray-200'}`}
            >
                <Layers size={14} strokeWidth={2.5} /> 图层
            </button>
            <button
                onClick={() => setActiveTab('archives')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all duration-300 relative z-10 ${activeTab === 'archives' ? 'text-black' : 'text-gray-400 hover:text-gray-200'}`}
            >
                <Archive size={14} strokeWidth={2.5} /> 存档
            </button>

            <div
                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-blue-500 rounded-lg shadow-lg transition-all duration-300 ease-out
                ${activeTab === 'layers' ? 'left-1' : 'left-[calc(50%+2px)]'}`}
            />
         </div>
       </div>

       <ProjectStorage state={state} updateState={updateState} visible={activeTab === 'archives'} />

       {/* ================= LAYERS TAB ================= */}
       {activeTab === 'layers' && (
           <div className="flex-1 overflow-y-auto p-3 scrollbar-hide animate-fade-in space-y-4">

               {/* Models */}
               {state.stage?.enabled&&<section aria-label="场景图层"><h3 className="text-[10px] font-bold text-gray-500 mb-2 pl-1">场景图层</h3>{stageObjects(state.stage).map(o=><button key={o.id} onClick={()=>updateState({activeStageId:o.id,activeModelId:null,activeTextId:null})} className={`w-full text-left p-2 rounded-lg text-xs mb-1 ${state.activeStageId===o.id?'bg-blue-500/15 text-blue-400':'text-gray-300 hover:bg-white/5'}`}><Box size={13} className="inline mr-2"/>{o.name}</button>)}</section>}
               <div>
                   <h3 className="text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-widest pl-1">模型图层</h3>
                   <div className="space-y-1">
                       {state.models.map(model => {
                           const isVisible = model.visible !== false;
                           const hasSubMeshes = model.subMeshes && model.subMeshes.length > 0;
                           const isExpanded = expandedModelIds.has(model.id);

                           return (
                               <div key={model.id} className="flex flex-col gap-1">
                                   <div
                                        className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer group
                                        ${selectedModels(state).some(m=>m.id===model.id) ? 'bg-blue-600/20 border-blue-500/50' : 'bg-white/5 border-transparent hover:bg-white/10'}
                                        ${!isVisible ? 'opacity-50 grayscale bg-black/40' : ''}`}
                                        onClick={e => updateState(selectModel(state,model.id,e.shiftKey||e.ctrlKey||e.metaKey))}
                                   >
                                       <div className="flex items-center gap-2 overflow-hidden flex-1">
                                           {hasSubMeshes && (
                                               <button onClick={(e) => toggleModelExpand(model.id, e)} className="text-gray-400 hover:text-white transition-colors">
                                                   {isExpanded ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                                               </button>
                                           )}
                                           <div className={`p-1.5 rounded-lg shrink-0 ${selectedModels(state).some(m=>m.id===model.id) ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-400'}`}>
                                               <Box size={12} />
                                           </div>
                                           <span className={`text-xs font-medium truncate ${isVisible ? 'text-gray-200' : 'text-gray-500 line-through decoration-gray-600'}`}>
                                               {model.name}
                                           </span>
                                       </div>
                                       <div className={`flex items-center gap-1 transition-opacity ${!isVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                           <button
                                                onClick={(e) => { e.stopPropagation(); toggleModelVisibility(model.id); }}
                                                className={`p-1.5 rounded-lg hover:text-white transition-colors ${isVisible ? 'text-gray-400 hover:bg-white/10' : 'text-blue-300 bg-blue-500/20'}`}
                                                title={isVisible ? "隐藏" : "显示"}
                                           >
                                               {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                                           </button>
                                           <button
                                                onClick={(e) => deleteModel(model.id, e)}
                                                className="p-1.5 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-300"
                                                title="删除图层"
                                           >
                                               <Trash2 size={12} />
                                           </button>
                                       </div>
                                   </div>

                                   {/* SubMesh List (Nested) */}
                                   {hasSubMeshes && isExpanded && (
                                       <div className="pl-6 space-y-0.5 border-l border-white/10 ml-3">
                                           {model.subMeshes.map((sm, idx) => (
                                               <div
                                                    key={idx}
                                                    className={`flex items-center justify-between p-1.5 rounded-lg text-[10px] group transition-colors hover:bg-white/5
                                                    ${sm.name === model.selectedScreenMesh ? 'bg-green-900/20 text-green-300' : 'text-gray-400'}`}
                                               >
                                                   <div className="flex items-center gap-2 overflow-hidden">
                                                        <div className={`w-1 h-1 rounded-full ${sm.visible ? 'bg-gray-500' : 'bg-gray-700'}`} />
                                                        <span className={`truncate ${sm.visible ? '' : 'line-through opacity-50'}`}>{sm.name}</span>
                                                   </div>
                                                   <button
                                                        onClick={(e) => { e.stopPropagation(); toggleSubMeshVisibility(model.id, sm.name); }}
                                                        className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                   >
                                                        {sm.visible ? <Eye size={10}/> : <EyeOff size={10}/>}
                                                   </button>
                                               </div>
                                           ))}
                                       </div>
                                   )}
                               </div>
                           );
                       })}
                   </div>
               </div>

               {/* Texts */}
               <div>
                   <h3 className="text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-widest pl-1">文字图层</h3>
                   {state.texts.length === 0 && <div className="text-[10px] text-gray-600 text-center py-4 border border-dashed border-white/5 rounded-xl">暂无文字图层</div>}
                   <div className="space-y-1">
                       {state.texts.map(text => {
                           const isVisible = text.visible !== false;
                           return (
                               <div
                                    key={text.id}
                                    className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer group
                                    ${text.id === state.activeTextId ? 'bg-blue-600/20 border-blue-500/50' : 'bg-white/5 border-transparent hover:bg-white/10'}
                                    ${!isVisible ? 'opacity-50 grayscale bg-black/40' : ''}`}
                                    onClick={() => updateState({ activeTextId: text.id, activeModelId: null })}
                               >
                                   <div className="flex items-center gap-2 overflow-hidden">
                                       <div className={`p-1.5 rounded-lg ${text.id === state.activeTextId ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-400'}`}>
                                           <Type size={12} />
                                       </div>
                                       <span className={`text-xs font-medium truncate max-w-[120px] ${isVisible ? 'text-gray-200' : 'text-gray-500 line-through decoration-gray-600'}`}>
                                           {text.content || '未命名'}
                                       </span>
                                   </div>
                                   <div className={`flex items-center gap-1 transition-opacity ${!isVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                       <button
                                            onClick={(e) => { e.stopPropagation(); toggleTextVisibility(text.id); }}
                                            className={`p-1.5 rounded-lg hover:text-white transition-colors ${isVisible ? 'text-gray-400 hover:bg-white/10' : 'text-blue-300 bg-blue-500/20'}`}
                                            title={isVisible ? "隐藏" : "显示"}
                                       >
                                           {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                                       </button>
                                       <button
                                            onClick={(e) => deleteText(text.id, e)}
                                            className="p-1.5 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-300"
                                            title="删除图层"
                                       >
                                           <Trash2 size={12} />
                                       </button>
                                   </div>
                               </div>
                           );
                       })}
                   </div>
               </div>
           </div>
       )}

    </div>
  );
};
