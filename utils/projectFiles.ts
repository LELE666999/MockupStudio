import {getInitialState, DEFAULT_SIMPLE_MODEL} from '../types.ts';
import type {AppState, SavedProject, ModelConfig} from '../types';
import {makeStage} from './stagePresets.ts';

const resourceCache=new Map<string,Promise<string>>();
const resourceSizes=new Map<string,number>();
const MAX_RESOURCE_CACHE=32*1024*1024;
function trimResourceCache(url:string,value:string){
  resourceSizes.set(url,value.length*2);
  let total=Array.from(resourceSizes.values()).reduce((a,b)=>a+b,0);
  for(const [key,size] of resourceSizes){
    if(total<=MAX_RESOURCE_CACHE)break;
    resourceCache.delete(key);resourceSizes.delete(key);total-=size;
  }
  return value;
}
async function readResource(url:string):Promise<string> {
  if(url.startsWith('data:')) return url;
  if(!resourceCache.has(url)) {
    if(resourceCache.size>64){resourceCache.clear();resourceSizes.clear();}
    const task=(async()=>{
      const response=await fetch(url);
      if(!response.ok || response.headers.get('content-type')?.includes('text/html')) throw new Error('资源不存在');
      const blob=await response.blob();
      if(typeof FileReader!=='undefined'){
        return await new Promise<string>((resolve,reject)=>{
          const reader=new FileReader();reader.onload=()=>resolve(reader.result as string);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);
        });
      }
      const bytes=new Uint8Array(await blob.arrayBuffer());
      let binary='';
      for(let i=0;i<bytes.length;i+=32768) binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
      return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
    })().then(value=>trimResourceCache(url,value)).catch(()=>{resourceCache.delete(url);resourceSizes.delete(url);throw new Error('资源读取失败，请重新选择缺失的模型、贴图、视频或字体后保存。');});
    resourceCache.set(url,task);
  }
  return resourceCache.get(url)!;
}

async function mapResources(data:any, map:(url:string,field:string)=>Promise<string>) {
  const field=async(obj:any,key:string)=>{
    if(typeof obj[key]==='string' && obj[key]) obj[key]=await map(obj[key],key);
  };
  const scene=async(s:any)=>{
    await field(s,'bgImage');
    for(const model of s.models || []) {
      if(model.fbxFile && !model.sourceFile) model.sourceFile=model.fbxFile;
      if(!model.modelFormat && model.fbxFile) model.modelFormat=model.fbxFile.toLowerCase().endsWith('.glb')?'glb':model.mode==='stl'?'stl':'fbx';
      for(const key of ['fbxFile','screenshot','screenshotPrev','coverScreenshot']) await field(model,key);
    }
    for(const text of s.texts || []) await field(text,'font');
  };
  await scene(data);
  for(const frame of data.keyframes || []) await scene(frame.state);
}

export async function packProject(state:AppState, name:string):Promise<SavedProject> {
  const {savedProjects,isPlaying,isExporting,isSelectingFocus,...snapshot}=state;
  const data=structuredClone(snapshot);
  const assets:Record<string,string>={};
  const ids=new Map<string,string>();
  await mapResources(data,async url=>{
    if(!ids.has(url)) {
      const id=`asset:${ids.size}`;
      assets[id]=await readResource(url);ids.set(url,id);
    }
    return ids.get(url)!;
  });
  return {format:'mockup3d',version:2,id:crypto.randomUUID(),name:name.trim() || '未命名项目',timestamp:Date.now(),data,assets};
}

export function validateProject(input:any):asserts input is SavedProject {
  if(!input || typeof input!=='object' || !input.data || (input.version!==undefined && input.version!==2)) throw new Error('无法识别或不支持此项目版本');
  const data=input.data;
  if(data.renderStyle!==undefined&&!['legacy','studio'].includes(data.renderStyle))throw new Error('渲染方式不支持');
  if(data.projectionMode!==undefined && !['perspective','weak','orthographic'].includes(data.projectionMode))throw new Error('投影方式不支持');
  if(data.motionMode!==undefined && !['segments','continuous'].includes(data.motionMode))throw new Error('运动方式不支持');
  if(input.name!==undefined && typeof input.name!=='string') throw new Error('项目名称损坏');
  if(!Array.isArray(data.models) || !data.models.length || !Array.isArray(data.keyframes) || !Number.isFinite(data.totalDuration) || data.totalDuration<=0) throw new Error('项目结构不完整');
  const vector=(v:any)=>Array.isArray(v) && v.length===3 && v.every(Number.isFinite);
  const resource=(v:any)=>v===undefined || v===null || typeof v==='string';
  const models=(ms:any)=>{
    if(!Array.isArray(ms)) throw new Error('模型列表损坏');
    for(const m of ms) {
      if(m?.simpleStyle!==undefined&&!['slab','fold'].includes(m.simpleStyle))throw new Error('简单样机类型不支持');
      if(m?.foldAngle!==undefined&&(!Number.isFinite(m.foldAngle)||m.foldAngle<0||m.foldAngle>180))throw new Error('展开角度必须在 0–180° 之间');
      if(!m || typeof m.id!=='string' || !['simple','fbx','stl'].includes(m.mode) || !vector(m.position) || !vector(m.rotation) || !Number.isFinite(m.scale) || m.scale<=0) throw new Error('模型参数损坏');
      if(['fbxFile','screenshot','screenshotPrev','coverScreenshot','sourceFile'].some(k=>!resource(m[k]))) throw new Error('模型资源参数损坏');
      if(m.coverScreenshotType!==undefined&&!['image','video'].includes(m.coverScreenshotType))throw new Error('外屏媒体类型损坏');
    }
  };
  const scene=(s:any)=>{
    if(s.selectedModelIds!==undefined&&(!Array.isArray(s.selectedModelIds)||s.selectedModelIds.some((id:any)=>typeof id!=='string')))throw new Error('模型选择记录损坏');
    if(s.phoneViewBeforeScene!==undefined){const v=s.phoneViewBeforeScene;if(!v||!vector(v.cameraPosition)||!vector(v.cameraTarget)||typeof v.showGizmo!=='boolean'||(v.activeModelId!==null&&typeof v.activeModelId!=='string')||(v.projectionMode!==undefined&&!['perspective','weak','orthographic'].includes(v.projectionMode)))throw new Error('场景前视角记录损坏');}
    if(s.stage!==undefined){
      const range=(n:any,min:number,max:number)=>n===undefined||Number.isFinite(n)&&n>=min&&n<=max;
      const valid=(p:any)=>p&&vector(p.position)&&vector(p.rotation)&&vector(p.size)&&p.size.every((n:number)=>n>0&&n<=100)&&/^#[\da-f]{6}$/i.test(p.color)&&range(p.roughness,0,1)&&p.roughness!==undefined
       &&(p.material===undefined||['stone','glass','metal','fabric','velvet','fur','knit','satin'].includes(p.material))&&(p.shape===undefined||['box','cylinder','rock','lattice','fluted','drape','cushion','ribbed-wall','ring','cyclorama','grooved-tray','satin-sheet','chrome-rack','brick-court','hand-grip'].includes(p.shape))
       &&(p.surface===undefined||['smooth','mineral','concrete','travertine','slate','terrazzo'].includes(p.surface))&&(p.role===undefined||['backdrop','prop'].includes(p.role))
       &&range(p.textureScale,.25,['grooved-tray','satin-sheet'].includes(p.shape)?6:4)&&range(p.detailStrength,0,1)&&range(p.softness,0,1)&&range(p.pileLength,.04,.6)&&range(p.fiberDensity,.35,1.5)&&range(p.reliefDepth,0,.35)&&range(p.bevelRadius,0,2)&&range(p.reflectivity,0,.8)
       &&(p.knitPattern===undefined||['stockinette','cable'].includes(p.knitPattern))&&range(p.moss,0,1)
       &&[p.brickRows,p.brickColumns].every(n=>n===undefined||Number.isInteger(n)&&n>=2&&n<=10)
       &&(p.rain===undefined||p.rain&&typeof p.rain.enabled==='boolean'&&typeof p.rain.preview==='boolean'&&Number.isFinite(p.rain.intensity)&&range(p.rain.intensity,.05,1)&&Number.isFinite(p.rain.wind)&&range(p.rain.wind,-1,1)&&Number.isFinite(p.rain.dropSize)&&range(p.rain.dropSize,.5,2)&&Number.isFinite(p.rain.wetness)&&range(p.rain.wetness,0,1));
      const p=s.stage;if(!valid(p)||typeof p.enabled!=='boolean')throw new Error('场景展台参数损坏');
      if(p.studioLighting!==undefined){const light=p.studioLighting;if(!light||!['single','multicolor'].includes(light.mode)||!Array.isArray(light.colors)||light.colors.length!==3||light.colors.some((c:any)=>typeof c!=='string'||!/^#[\da-f]{6}$/i.test(c)))throw new Error('棚景灯光颜色损坏');}
      if(p.studioEnvironment!==undefined){const env=p.studioEnvironment;if(!env||!Number.isFinite(env.rotation)||Math.abs(env.rotation)>Math.PI||!Number.isFinite(env.blur)||env.blur<0||env.blur>.8||!Number.isFinite(env.intensity)||env.intensity<.1||env.intensity>2)throw new Error('HDR 环境参数损坏');}
      if(p.items!==undefined){const ids=new Set(['primary']);if(!Array.isArray(p.items)||p.items.length>20||p.items.some((item:any)=>{if(!valid(item)||typeof item.id!=='string'||typeof item.name!=='string'||ids.has(item.id))return true;ids.add(item.id);return false;}))throw new Error('场景组合参数损坏');}
    }
    if(s.lens!==undefined){
      const l=s.lens;
      if(l?.shutter!==undefined&&(!Number.isFinite(l.shutter)||l.shutter<1/8000||l.shutter>1))throw new Error('快门参数损坏');
      if(l?.iso!==undefined&&(!Number.isFinite(l.iso)||l.iso<25||l.iso>25600))throw new Error('ISO 参数损坏');
      if(l?.exposureMode!==undefined&&!['auto','manual'].includes(l.exposureMode))throw new Error('曝光模式损坏');
      if(!l||typeof l.enabled!=='boolean'||!Number.isFinite(l.aperture)||l.aperture<1||l.aperture>22||!Number.isFinite(l.maxBlur)||l.maxBlur<0||l.maxBlur>24)throw new Error('镜头参数损坏');
      if(l.focus!==null&&(!l.focus||typeof l.focus.modelId!=='string'||!vector(l.focus.localPoint)||!vector(l.focus.fallbackWorldPoint)||(l.focus.modelSource!==undefined&&typeof l.focus.modelSource!=='string')))throw new Error('焦点参数损坏');
    }
    for(const key of ['cameraPosition','cameraTarget']) if(s[key]!==undefined && !vector(s[key])) throw new Error('相机参数损坏');
    if(!resource(s.bgImage)) throw new Error('背景资源损坏');
    if(s.bgMediaType!==undefined&&!['image','video'].includes(s.bgMediaType))throw new Error('背景媒体类型损坏');
    if(s.texts!==undefined && (!Array.isArray(s.texts) || s.texts.some((t:any)=>!t || typeof t.content!=='string' || !vector(t.position) || !vector(t.rotation) || !resource(t.font)))) throw new Error('文字参数损坏');
  };
  scene(data);
  models(data.models);
  const ids=new Set();
  for(const f of data.keyframes) {
    if(!f || typeof f.id!=='string' || ids.has(f.id) || !Number.isFinite(f.time) || f.time<0 || !f.state || typeof f.state!=='object') throw new Error('关键帧损坏');
    ids.add(f.id);
    if(f.state.models) models(f.state.models);
    scene(f.state);
    if(f.easing!==undefined && !['linear','ease-in','ease-out','ease-in-out','custom'].includes(f.easing)) throw new Error('曲线类型不支持');
    if(f.easing==='custom' && (!Array.isArray(f.bezier) || f.bezier.length!==4 || f.bezier.some((v:any)=>!Number.isFinite(v)||v<0||v>1))) throw new Error('自定义曲线参数损坏');
  }
}

export async function unpackProject(input:unknown):Promise<AppState> {
  validateProject(input);
  const data=structuredClone(input.data);
  // Accept the retired shape only for reading old archives. Removing the
  // rejected scene must never discard a user's phones, media or keyframes.
  const retireScene=(s:any)=>{
    if(s.stage?.preset==='handheld'||s.stage?.shape==='hand-grip'){s.stage={...makeStage('single'),enabled:false};s.activeStageId=null;}
    if(s.stage?.preset==='chrome')s.stage.items=s.stage.items?.filter((o:any)=>o.id!=='warm-floor');
  };
  retireScene(data);data.keyframes.forEach(f=>retireScene(f.state));
  const urls=new Map<string,string>();
  try {
    await mapResources(data,async (url,field)=>{
      if(!url.startsWith('asset:')) {
        if(url.startsWith('blob:')) throw new Error('旧存档只包含临时资源地址，无法完整恢复；请重新上传资源并另存完整项目。');
        return url;
      }
      const encoded=input.assets?.[url];
      if(typeof encoded!=='string' || !encoded.startsWith('data:')) throw new Error('项目缺少内嵌资源');
      // Troika's worker cannot read page-created blob:null URLs under file://.
      if(field==='font')return encoded;
      if(!urls.has(url)) {
        urls.set(url,URL.createObjectURL(await (await fetch(encoded)).blob()));
      }
      return urls.get(url)!;
    });
    const fill=(m:ModelConfig)=>({...DEFAULT_SIMPLE_MODEL,...m});
    data.models=data.models.map(fill);
    data.keyframes=data.keyframes.map(f=>({...f,easing:f.easing ?? (input.version===2?'ease-in':'ease-in-out'),state:{...f.state,...(f.state.models?{models:f.state.models.map(fill)}:{})}}));
    return {...getInitialState(),...data,renderStyle:data.renderStyle||'legacy',isPlaying:false,isExporting:false,isSelectingScreen:false,isSelectingFocus:false};
  } catch(error) {
    urls.forEach(url=>URL.revokeObjectURL(url));throw error;
  }
}

export async function writeProjectFile(project:SavedProject, handle?:any) {
  const blob=new Blob([JSON.stringify(project)],{type:'application/json'});
  if(handle) {
    const stream=await handle.createWritable();
    try {await stream.write(blob);await stream.close();} catch(error) {await stream.abort().catch(()=>{});throw error;}
  } else {
    const url=URL.createObjectURL(blob);const a=document.createElement('a');
    a.href=url;a.download=`${project.name.replace(/[\\/:*?"<>|]/g,'_')}.mockup3d`;
    a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
}

let database:Promise<IDBDatabase> | undefined;
function openDB() {
  if(!database) database=new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open('mockup3d-projects',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('documents');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('本地存储被其他页面占用，请关闭旧页面后重试'));
  }).catch(e=>{database=undefined;throw e;});
  return database;
}
export async function readLocal<T>(key:string):Promise<T | undefined> {
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('documents','readonly');const req=tx.objectStore('documents').get(key);
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
export async function writeLocal(key:string,value:unknown) {
  const db=await openDB();
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction('documents','readwrite');
    if(value===undefined) tx.objectStore('documents').delete(key); else tx.objectStore('documents').put(value,key);
    tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error || new Error('本地空间不足，保存未完成'));tx.onerror=()=>reject(tx.error);
  });
}

// Draft and named archive are committed together: one stable ID, one latest copy.
export async function writeLocalDraft(project:SavedProject):Promise<SavedProject[]> {
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('documents','readwrite'),store=tx.objectStore('documents');
  let projects:SavedProject[]=[];
  const request=store.get('archives');
  request.onsuccess=()=>{
   projects=[project,...(request.result||[]).filter((p:SavedProject)=>p.id!==project.id)];
   store.put(projects,'archives');store.put(project,'draft');
  };
  tx.oncomplete=()=>resolve(projects);
  tx.onabort=()=>reject(tx.error||new Error('本地空间不足，存稿未完成'));
  tx.onerror=()=>reject(tx.error);
 });
}
