import React,{useEffect,useRef,useState} from 'react';
import type {AppState,SavedProject} from '../../types';
import {getInitialState} from '../../types';
import {listWorkspace,readWorkspace,saveWorkspace,hasLocalWorkspace} from '../../utils/workspaceClient';
import type {WorkspaceEntry} from '../../utils/workspaceClient';
import {packProject,unpackProject,validateProject,writeProjectFile,readLocal,writeLocal,writeLocalDraft} from '../../utils/projectFiles';

export function ProjectStorage({state,updateState,visible}:{state:AppState;updateState:(s:Partial<AppState>)=>void;visible:boolean}) {
  const [name,setName]=useState('我的样机动画');
  const projectId=useRef<string>(crypto.randomUUID());
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [draftStatus,setDraftStatus]=useState('正在读取本地恢复记录…');
  const [ready,setReady]=useState(false);
  const [recovery,setRecovery]=useState<SavedProject>();
  const [pendingRecovery,setPendingRecovery]=useState(false);
  const [diskProjects,setDiskProjects]=useState<WorkspaceEntry[]>([]);
  const [showProjects,setShowProjects]=useState(false);
  const [workspaceError,setWorkspaceError]=useState('');
  const [currentDisk,setCurrentDisk]=useState<{id:string;revision:string}>();
  const diskRef=useRef(currentDisk);diskRef.current=currentDisk;
  const savingRef=useRef(false);
  const input=useRef<HTMLInputElement>(null);
  const localHandle=useRef<any>();
  // Static hosts keep Ctrl+S local; never send an API write to GitHub Pages.
  const fileMode=!hasLocalWorkspace();
  const latest=useRef({state,updateState,name});latest.current={state,updateState,name};
  const dirty=useRef(false);
  const queue=useRef(Promise.resolve());
  const generation=useRef(0);
  const errorMessage=(e:unknown)=>e instanceof Error?e.message:String(e);
  const refreshProjects=async()=>{
    try {const result=await listWorkspace();setDiskProjects(result.projects);setWorkspaceError(result.warnings.length?'部分文件无法读取，请检查 saved-projects 中的备份。':'');}
    catch(e){setWorkspaceError(errorMessage(e));}
  };
  useEffect(()=>{void refreshProjects();},[]);

  useEffect(()=>{
    let active=true;
    let interacted=false;
    const markInteraction=()=>{interacted=true;};
    window.addEventListener('pointerdown',markInteraction);
    window.addEventListener('keydown',markInteraction);
    (async()=>{
      try {
        const [projects,draft]=await Promise.all([readLocal<SavedProject[]>('archives'),readLocal<SavedProject>('draft')]);
        if(!active) return;
        if(projects) latest.current.updateState({savedProjects:projects});
        if(draft) {
          validateProject(draft);setRecovery(draft);setPendingRecovery(true);
          const restored=await unpackProject(draft);
          if(!active)return;
          if(!interacted){
            ++generation.current;
            latest.current.updateState({...restored,savedProjects:projects||latest.current.state.savedProjects});
            projectId.current=draft.id;setName(draft.name||'我的样机动画');setCurrentDisk(draft.workspace);diskRef.current=draft.workspace;
            setRecovery(undefined);setPendingRecovery(false);setDraftStatus('已自动续接上次项目');
            setNotice('已自动恢复上次的模型、媒体、环境和动画，无需重新打开项目。');
          }else setDraftStatus('检测到上次草稿；当前已开始操作，可手动恢复，避免覆盖新编辑');
        }
        else setDraftStatus('编辑后会自动保存恢复草稿');
      } catch(e) {if(active){setPendingRecovery(true);setDraftStatus(`自动恢复不可用：${errorMessage(e)}。原草稿保留，未覆盖。`);}}
      finally {if(active)setReady(true);}
    })();
    return ()=>{active=false;window.removeEventListener('pointerdown',markInteraction);window.removeEventListener('keydown',markInteraction);};
  },[]);

  // Archive-list refreshes must not trigger another autosave.
  const contentKey=JSON.stringify({...state,savedProjects:undefined});
  useEffect(()=>{
    if(!ready || state.isPlaying || state.isExporting) return;
    dirty.current=true;
    if(pendingRecovery) return;
    const revision=++generation.current;
    setDraftStatus('有未保存更改，准备保存草稿…');
    const timer=setTimeout(()=>{
      const snapshot=latest.current.state;
      queue.current=queue.current.catch(()=>{}).then(async()=>{
        if(revision!==generation.current) return;
        try {
          const document=await packProject(snapshot,latest.current.name);
          document.id=projectId.current;
          document.workspace=diskRef.current;
          if(revision!==generation.current) return;
          const projects=await writeLocalDraft(document);
          if(revision!==generation.current) return;
          latest.current.updateState({savedProjects:projects});
          dirty.current=false;
          setDraftStatus(`「${document.name}」已自动保存 · ${new Date().toLocaleTimeString('zh-CN')}`);
        } catch(e) {if(revision===generation.current) setDraftStatus(`草稿保存失败：${errorMessage(e)}`);}
      });
    },1500);
    return ()=>clearTimeout(timer);
  },[contentKey,ready,pendingRecovery,currentDisk,name]);

  useEffect(()=>{
    const prevent=(e:BeforeUnloadEvent)=>{if(dirty.current){e.preventDefault();e.returnValue='';}};
    window.addEventListener('beforeunload',prevent);return ()=>window.removeEventListener('beforeunload',prevent);
  },[]);

  const saveFile=async(project?:SavedProject)=>{
    if(busy || state.isExporting) return;
    setBusy(true);setNotice('');
    try {
      const picker=(window as any).showSaveFilePicker;
      // Open the native picker before asynchronous packing consumes user activation.
      const handle=fileMode&&!project&&localHandle.current?localHandle.current:picker ? await picker.call(window,{suggestedName:`${project?.name || name || '样机动画'}.mockup3d`,types:[{description:'完整样机项目',accept:{'application/json':['.mockup3d']}}]}) : undefined;
      setNotice('正在打包模型、贴图、视频和动画…');
      const document=project ? project.version===2?project:await packProject(await unpackProject(project),project.name) : await packProject(latest.current.state,name);
      if(!project)document.id=projectId.current;
      await writeProjectFile(document,handle);
      if(fileMode&&!project)localHandle.current=handle;
      setNotice(handle?`本地文件已保存 · ${new Date().toLocaleTimeString('zh-CN')}`:'完整项目已交给浏览器下载，请在下载文件夹确认。');
    } catch(e) {
      if((e as any)?.name==='AbortError') setNotice('已取消保存，当前编辑内容未改变。');
      else setNotice(`保存失败：${errorMessage(e)}。当前内容仍保留在页面中。`);
    } finally {setBusy(false);}
  };
  const saveDiskCurrent=async()=>{
    if(savingRef.current || busy || state.isExporting)return;

    const projectName=currentDisk?name:prompt('项目名称（将保存在网页项目的 saved-projects 文件夹）',name);
    if(!projectName?.trim())return;
    savingRef.current=true;setBusy(true);setNotice('正在保存到项目文件夹…');
    const snapshot=latest.current.state;
    const target=currentDisk;
    try {
      const project=await packProject(snapshot,projectName);
      const entry=await saveWorkspace(target?.id || crypto.randomUUID(),project,target?.revision);
      setCurrentDisk({id:entry.id,revision:entry.revision});diskRef.current={id:entry.id,revision:entry.revision};setName(entry.name);
      setNotice(`已保存到 saved-projects · ${new Date(entry.timestamp).toLocaleTimeString('zh-CN')}`);
      await refreshProjects();
      // Disk identity changes trigger the guarded autosave above with the latest
      // edits. Never replace its draft with this older disk-save snapshot.
    } catch(e){setNotice(`保存失败：${errorMessage(e)}。当前内容没有丢失。`);}
    finally{savingRef.current=false;setBusy(false);}
  };
  const saveCurrent=async()=>{
    if(savingRef.current||busy||!ready||state.isExporting)return;
    savingRef.current=true;setBusy(true);
    const revision=++generation.current;
    const snapshot=latest.current.state, title=latest.current.name;
    try{
      const task=queue.current.catch(()=>{}).then(async()=>{
      const document=await packProject(snapshot,title);document.id=projectId.current;document.workspace=diskRef.current;
      const projects=await writeLocalDraft(document);
      latest.current.updateState({savedProjects:projects});
      if(revision===generation.current)dirty.current=false;
      setDraftStatus(`「${document.name}」已保存 · ${new Date().toLocaleTimeString('zh-CN')}`);
      setNotice('已更新本地存稿，同一项目不会重复新建。');
      });
      queue.current=task;await task;
    }catch(e){setNotice(`保存失败：${errorMessage(e)}`);}
    finally{savingRef.current=false;setBusy(false);}
    if(!fileMode)await saveDiskCurrent();
  };
  const saveRef=useRef(saveCurrent);saveRef.current=saveCurrent;
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();void saveRef.current();}};
    window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key);
  },[]);

  const saveArchive=async(id?:string)=>{
    if(busy)return;
    if(id && !confirm('用当前项目覆盖此存档？原存档将被替换。'))return;
    setBusy(true);
    try {
      const existing=state.savedProjects.find(p=>p.id===id);
      const doc=await packProject(state,existing?.name || name);
      if(id)doc.id=id;
      const projects=id?state.savedProjects.map(p=>p.id===id?doc:p):[doc,...state.savedProjects];
      await writeLocal('archives',projects);
      updateState({savedProjects:projects});setNotice('完整存档已保存到此浏览器。建议再保存一份本地文件。');
    } catch(e) {setNotice(`存档失败：${errorMessage(e)}`);} finally {setBusy(false);}
  };
  const load=async(project:SavedProject,workspace?:{id:string;revision:string})=>{
    const restored=await unpackProject(project);
    localHandle.current=undefined;
    projectId.current=project.id;
    ++generation.current;
    updateState({...restored,savedProjects:latest.current.state.savedProjects});
    setCurrentDisk(workspace);diskRef.current=workspace;
    setName(project.name || '我的样机动画');setRecovery(undefined);setPendingRecovery(false);setNotice('完整项目已恢复：模型与媒体、环境灯光、背景、画幅比例、镜头和关键帧。');
  };
  const backupBeforeReplace=async()=>{
    await queue.current.catch(()=>{});
    const doc=await packProject(latest.current.state,latest.current.name);doc.id=projectId.current;
    const archives=await writeLocalDraft(doc);
    latest.current.updateState({savedProjects:archives});
    return archives;
  };
  const newProject=()=>{
    if(busy)return;
    // Starting a blank document must not depend on loading/packing old media.
    // Invalidate pending autosaves; keep all successfully saved projects intact.
    ++generation.current;
    localHandle.current=undefined;projectId.current=crypto.randomUUID();
    setCurrentDisk(undefined);diskRef.current=undefined;
    setName(`新项目 ${new Date().toLocaleString('zh-CN')}`);
    setRecovery(undefined);setPendingRecovery(false);
    updateState({...getInitialState(),savedProjects:latest.current.state.savedProjects});
    setNotice('已新建空白项目。已有存档保留，旧项目尚未保存的更改不包含在内。');
  };
  const openDisk=async(entry:WorkspaceEntry)=>{
    if(busy || !confirm(`打开「${entry.name}」？当前编辑会先保留为浏览器存档。`))return;
    setBusy(true);
    try {
      const loaded=await readWorkspace(entry.id);validateProject(loaded.project);
      const archives=await backupBeforeReplace();
      // Avoid losing the just-written backup to a stale React render.
      latest.current.state={...latest.current.state,savedProjects:archives};
      await load(loaded.project,{id:loaded.id,revision:loaded.revision});setShowProjects(false);
    }catch(e){setNotice(`打开失败：${errorMessage(e)}`);}finally{setBusy(false);}
  };
  const importFile=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    setBusy(true);
    try {
      const project=JSON.parse(await file.text());
      validateProject(project);
      await load(project);
    } catch(error) {setNotice(`打开失败：${errorMessage(error)}。当前项目未被替换。`);} finally {setBusy(false);}
  };
  const remove=async(id:string)=>{
    if(!confirm('删除此浏览器中的这份存档？已导出的本地文件不会删除。'))return;
    setBusy(true);
    try {const projects=state.savedProjects.filter(p=>p.id!==id);await writeLocal('archives',projects);updateState({savedProjects:projects});}
    catch(e){setNotice(`删除未完成：${errorMessage(e)}`);}finally{setBusy(false);}
  };

  return <section className={`${visible?'flex-1 overflow-y-auto':''} p-3 border-b border-white/10 text-white`} aria-label="项目保存">
    <input aria-label="项目名称" value={name} onChange={e=>setName(e.target.value)} placeholder="给项目起个名字" className="w-full rounded-lg bg-white/5 border border-white/20 px-3 py-2 text-xs mb-2"/>
    <div className="flex gap-2 mb-2">
      <button disabled={busy} onClick={()=>void saveCurrent()} className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 px-2 py-2 text-xs disabled:opacity-40">保存项目</button>
      <button disabled={busy} onClick={()=>void newProject()} className="rounded-xl bg-white/10 px-3 text-xs">新建</button>
      <button onClick={()=>{if(fileMode){input.current?.click();return;}setShowProjects(v=>!v);void refreshProjects();}} className="rounded-xl bg-white/10 px-3 text-xs">{fileMode?'打开本地文件':'项目列表'}</button>
    </div>
    {showProjects && <div aria-label="磁盘项目列表" className="max-h-52 overflow-y-auto mb-3 rounded-xl border border-white/10 p-2">
      <p className="text-[10px] text-gray-400 mb-2">网页项目 / saved-projects</p>
      {workspaceError && <p className="text-xs text-amber-200">{workspaceError}</p>}
      {!diskProjects.length && !workspaceError && <p className="text-xs text-gray-400">还没有磁盘项目，按 点击保存项目保存第一份。</p>}
      {diskProjects.map(p=><button key={p.id} disabled={busy} onClick={()=>void openDisk(p)} className="w-full text-left rounded-lg hover:bg-white/10 p-2 text-xs"><span>{p.name}</span><span className="block text-[9px] text-gray-400 mt-1">{new Date(p.timestamp).toLocaleString('zh-CN')}</span></button>)}
    </div>}
    <div className="flex gap-2">
      <button disabled={busy} onClick={()=>void saveFile()} className="flex-1 rounded-xl bg-white/10 hover:bg-white/20 px-2 py-2 text-xs disabled:opacity-40">{busy?'处理中…':'导出项目文件'}</button>
      <button disabled={busy} onClick={()=>input.current?.click()} className="rounded-xl bg-white/10 hover:bg-white/20 px-3 text-xs disabled:opacity-40">打开项目</button>
      <input ref={input} type="file" accept=".mockup3d,.json" hidden onChange={importFile}/>
    </div>
    <p className="text-[10px] text-gray-400 mt-2 leading-relaxed" role="status">{draftStatus}</p>
    {notice && <p role="status" className="text-[11px] text-blue-200 mt-2 break-words">{notice}</p>}
    {pendingRecovery && recovery && <div className="mt-3 rounded-xl bg-amber-400/10 border border-amber-400/30 p-3">
      <p className="text-xs text-amber-100 mb-2">{recovery.name} · {new Date(recovery.timestamp).toLocaleString('zh-CN')}</p>
      <button disabled={busy} className="text-xs text-amber-200 underline mr-3" onClick={async()=>{setBusy(true);try{await load(recovery,recovery.workspace);}catch(e){setNotice(`恢复失败：${errorMessage(e)}`);}finally{setBusy(false);}}}>恢复上次草稿</button>
      <button className="text-xs text-gray-400" onClick={()=>{if(confirm('继续当前编辑？上次草稿将保留为一份浏览器存档。')){void (async()=>{try{const projects=[{...recovery,id:crypto.randomUUID()},...state.savedProjects];await writeLocal('archives',projects);updateState({savedProjects:projects});setPendingRecovery(false);setRecovery(undefined);}catch(e){setNotice(`保留旧草稿失败：${errorMessage(e)}`);}})();}}}>继续当前编辑</button>
    </div>}
    {visible && <>
      <p className="text-[11px] leading-relaxed text-gray-400 my-3">本地文件包含模型、媒体、路径、曲线和时间。浏览器草稿不能代替文件备份；清理浏览器数据会删除草稿和下方存档。</p>
      <button disabled={busy||!ready} onClick={()=>void saveArchive()} className="w-full rounded-lg bg-white/10 py-2 text-xs disabled:opacity-40">另存浏览器存档</button>
      <div className="space-y-2 mt-4">{state.savedProjects.map(project=><article key={project.id} className="rounded-xl border border-white/10 p-3 bg-white/5">
        <button disabled={busy} className="text-left text-xs font-semibold w-full" onClick={async()=>{if(!confirm('载入此存档替换当前画面？建议先保存当前项目。'))return;setBusy(true);try{await load(project);}catch(e){setNotice(`载入失败：${errorMessage(e)}`);}finally{setBusy(false);}}}>{project.name}</button>
        <p className="text-[10px] text-gray-400 mt-1">{new Date(project.timestamp).toLocaleString('zh-CN')} · {project.data.keyframes?.length || 0} 帧</p>
        <div className="flex gap-3 mt-3 text-[11px]"><button disabled={busy} onClick={()=>void saveFile(project)} className="text-blue-300">导出文件</button><button disabled={busy} onClick={()=>void saveArchive(project.id)}>覆盖</button><button disabled={busy} onClick={()=>void remove(project.id)} className="text-red-300">删除</button></div>
      </article>)}</div>
    </>}
  </section>;
}
