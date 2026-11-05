import React,{useEffect,useRef,useState} from 'react';
import {FolderOpen,Smartphone,UploadCloud} from 'lucide-react';
import {MODEL_PRESETS} from '../../utils/modelPresets';
import type {ModelPreset} from '../../utils/modelPresets';
import {installLibraryModels,loadModelLibrary,presetFileName} from '../../utils/localModelLibrary';
import type {ModelLibrarySources} from '../../utils/localModelLibrary';

interface Props {
  activeSource?:string;
  onSelect:(preset:ModelPreset,source:string)=>void;
}

export function ModelLibrary({activeSource,onSelect}:Props) {
  const [sources,setSources]=useState<ModelLibrarySources>({});
  const [busy,setBusy]=useState(true);
  const [message,setMessage]=useState('');
  const folderInput=useRef<HTMLInputElement>(null);
  const singleInput=useRef<HTMLInputElement>(null);
  const pending=useRef<ModelPreset|null>(null);
  const onSelectRef=useRef(onSelect);onSelectRef.current=onSelect;

  useEffect(()=>{
    let alive=true;
    loadModelLibrary().then(result=>{if(alive)setSources(result);})
      .catch(()=>{if(alive)setMessage('本地模型库读取失败，请重新导入。');})
      .finally(()=>{if(alive)setBusy(false);});
    return ()=>{alive=false;};
  },[]);

  const select=(preset:ModelPreset)=>{
    const source=preset.bundled?preset.file:sources[preset.id];
    if(source){onSelect(preset,source);return;}
    pending.current=preset;
    setMessage(`请选择原文件 ${presetFileName(preset)}，导入后会保留在当前浏览器。`);
    singleInput.current?.click();
  };
  const importFiles=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const files=Array.from(e.target.files||[]),requested=pending.current;
    e.target.value='';pending.current=null;
    if(!files.length)return;
    if(requested&&!files.some(file=>file.name.toLowerCase()===presetFileName(requested).toLowerCase())){
      setMessage(`文件不匹配，请选择 ${presetFileName(requested)}。其他模型可用下方「导入 FBX / STL / GLB」。`);
      return;
    }
    setBusy(true);
    try {
      const result=await installLibraryModels(files,name=>setMessage(`正在导入：${name}…`));
      setSources(result.sources);
      const count=result.installed.length;
      setMessage([
        count?`已导入 ${count} 款模型，刷新或新建项目后仍可选用。`:result.errors.length?'模型未导入。':'没有找到匹配的模型文件，请选择原模型库文件夹。',
        ...result.errors,
      ].join(' '));
      if(requested&&result.installed.includes(requested.id))onSelectRef.current(requested,result.sources[requested.id]);
      if(count)void navigator.storage?.persist?.().catch(()=>{});
    } catch {
      setMessage('模型库导入失败，请检查浏览器可用空间后重试。');
    } finally {setBusy(false);}
  };
  const imported=Object.keys(sources).length;

  return <div className="mb-4 space-y-3">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-bold text-gray-500">预设机型库 · {MODEL_PRESETS.length} 款</span>
      <span className="text-[10px] text-gray-400">内置 2 · 本机 {imported}</span>
    </div>
    <button type="button" disabled={busy} onClick={()=>{pending.current=null;folderInput.current?.click();}}
      className="w-full rounded-xl border border-blue-500/30 bg-blue-500/10 py-2.5 text-xs text-blue-400 flex items-center justify-center gap-2 disabled:opacity-50">
      <FolderOpen size={14}/>{busy?'正在读取模型库…':'导入本地模型库'}
    </button>
    <input ref={folderInput} type="file" hidden multiple {...{webkitdirectory:'',directory:''}} aria-label="导入本地模型库文件夹" onChange={e=>{void importFiles(e);}}/>
    <input ref={singleInput} type="file" hidden accept=".glb,.fbx" aria-label="导入单个预设模型" onChange={e=>{void importFiles(e);}}/>
    <p className="text-[10px] text-gray-400 leading-relaxed">原模型库可整夹导入，自动匹配机型与屏幕。文件保存在本机浏览器，不上传。清理浏览器数据后需重新导入。</p>
    {message&&<p role="status" className="text-[11px] leading-relaxed text-blue-400 break-words">{message}</p>}
    <div className="grid grid-cols-1 gap-2">
      {['HUAWEI','Apple'].map(brand=><section key={brand} aria-label={brand==='HUAWEI'?'华为模型':'苹果模型'} className="space-y-2">
        <h4 className="text-xs font-bold text-gray-300 pt-2">{brand==='HUAWEI'?'华为 HUAWEI':'苹果 Apple'}</h4>
        {MODEL_PRESETS.filter(p=>p.name.startsWith(brand)).map(preset=>{
          const available=preset.bundled||!!sources[preset.id],active=activeSource===preset.file;
          return <button key={preset.id} type="button" disabled={busy} onClick={()=>select(preset)} aria-pressed={active}
            className={`w-full p-3 rounded-xl border text-left flex items-start gap-3 transition-colors disabled:opacity-50 ${active?'bg-blue-500/15 border-blue-500/50':'bg-white/5 border-white/10 hover:bg-white/10'}`}>
            {available?<Smartphone size={18} className="text-blue-400 shrink-0 mt-0.5"/>:<UploadCloud size={18} className="text-gray-400 shrink-0 mt-0.5"/>}
            <div className="min-w-0 flex-1"><div className="text-xs font-bold text-gray-200">{preset.name}</div><div className="text-[10px] text-gray-400 mt-1 leading-relaxed">{preset.description}</div>
              <div className={`text-[10px] mt-1 ${available?'text-blue-400':'text-gray-500'}`}>{preset.bundled?'已内置':available?'本机已导入':'点击导入原文件'}</div>
            </div>
          </button>;
        })}
      </section>)}
    </div>
  </div>;
}
