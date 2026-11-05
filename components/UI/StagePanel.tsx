import {useEffect,useState} from 'react';
import type {AppState,RainConfig,StudioLighting} from '../../types';
import {ToggleSwitch} from './ToggleSwitch';
import {rainSettings} from '../../utils/rainWeather';
import {SegmentedControl} from './SegmentedControl';
import {makeStage,patchStage,stageObjects,STAGE_PRESETS} from '../../utils/stagePresets';
import {switchSceneMode} from '../../utils/sceneMode';
import {offlineAsset} from '../../utils/offlineAssets';
import {isSoftStage} from '../../utils/stageSoftness';
import {studioId,studioDefaults,studioLighting,STUDIO_IDS,type StudioId} from '../../utils/studioScenes';
import {HDR_DEFAULTS} from '../../utils/studioEnvironment';
export function StagePanel({state,updateState,save}:{state:AppState;updateState:(p:Partial<AppState>)=>void;save:()=>void}){
 const [lastStage,setLastStage]=useState('primary'),[phoneId,setPhoneId]=useState(state.activeModelId||state.models[0]?.id||'');
 const [target,setTarget]=useState<'stage'|'floor'>('stage'),[message,setMessage]=useState('');
 useEffect(()=>{if(state.activeStageId)setLastStage(state.activeStageId);},[state.activeStageId]);
 useEffect(()=>{if(state.activeModelId)setPhoneId(state.activeModelId);},[state.activeModelId]);
 useEffect(()=>{const result=(event:Event)=>setMessage((event as CustomEvent).detail);window.addEventListener('mockup-placement-result',result);return()=>window.removeEventListener('mockup-placement-result',result);},[]);
 const config=state.stage||makeStage('single');
 const objects=stageObjects({...config,enabled:true});
 const stage=objects.find(o=>o.id===(state.activeStageId||lastStage))||objects[0];
 const relief=stage.reliefDepth??(stage.material==='knit'?.24:stage.material==='fabric'?.1:stage.material==='velvet'?.06:stage.shape==='rock'?.18:.09);
 const phone=state.models.find(m=>m.id===phoneId&&m.visible)||state.models.find(m=>m.visible);
 const change=(patch:Partial<typeof stage>)=>{save();updateState({stage:patchStage(config,stage.id,patch)});};
 const rain=rainSettings(stage),changeRain=(patch:Partial<RainConfig>)=>change({rain:{...rain,...patch}});
 const lighting=studioLighting(config);
 const changeLighting=(patch:Partial<StudioLighting>)=>{save();updateState({stage:{...config,studioLighting:{...lighting,...patch}}});};
 const fit=(next=config,id=stage.id,composition=false)=>window.dispatchEvent(new CustomEvent('mockup-fit-stage',{detail:{stage:next,id,composition}}));
 const view=()=>{save();updateState({isPlaying:false});window.dispatchEvent(new Event('mockup-frame-stage'));};
 return <fieldset disabled={state.isExporting} className="min-w-0 w-full max-w-full text-xs space-y-3">
  <SegmentedControl label="场景类型" value={state.stage?.enabled?'platform':'none'} options={[{value:'none',label:'无场景'},{value:'platform',label:'有场景'}]} onChange={value=>{
   const enabled=value==='platform';if(enabled===!!state.stage?.enabled)return;
   save();updateState(switchSceneMode(state,enabled));
   fit({...config,enabled},'primary',true);
  }}/>
  {state.stage?.enabled&&<>
   {studioId(state.stage)==='chrome'&&<section className="studio-lighting" aria-label="HDR 环境"><div className="studio-lighting-title">实拍摄影棚 HDR</div>
    {([{key:'rotation',label:'环境方向',min:-180,max:180,step:1},{key:'blur',label:'远景虚化',min:0,max:.8,step:.01},{key:'intensity',label:'环境光强度',min:.1,max:2,step:.05}] as const).map(control=><label key={control.key} className="block text-gray-400">{control.label}<input aria-label={control.label} className="w-full" type="range" min={control.min} max={control.max} step={control.step} value={control.key==='rotation'?(config.studioEnvironment?.rotation??HDR_DEFAULTS.rotation)*180/Math.PI:config.studioEnvironment?.[control.key]??HDR_DEFAULTS[control.key]} onChange={event=>{save();updateState({stage:{...config,studioEnvironment:{...HDR_DEFAULTS,...config.studioEnvironment,[control.key]:Number(event.target.value)*(control.key==='rotation'?Math.PI/180:1)}}});}}/></label>)}
    <button className="w-full py-2 rounded-lg bg-white/10" onClick={()=>{save();updateState({bgImage:null,bgColor:'#bca78e'});}}>恢复 HDR 背景</button><p>背景随视角转动，金属反射来自同一套环境；支持离线使用。</p>
   </section>}
   {(studioId(state.stage)==='midnight'||studioId(state.stage)==='grooved')&&<section className="studio-lighting" aria-label="棚景灯光">
    <div className="studio-lighting-title">棚景灯光</div>
    <SegmentedControl<StudioLighting['mode']> label="棚景光色模式" value={lighting.mode} options={[{value:'single',label:'纯色'},{value:'multicolor',label:'多色'}]} onChange={mode=>changeLighting({mode})}/>
    <div className="studio-lighting-colors">{(lighting.mode==='single'?[0]:[0,1,2]).map(index=><label key={index}>
     <span>{lighting.mode==='single'?'灯光颜色':['主光','轮廓光','补光'][index]}</span>
     <input aria-label={lighting.mode==='single'?'棚景灯光颜色':`棚景${['主光','轮廓光','补光'][index]}颜色`} type="color" value={lighting.colors[index]} onChange={event=>{const colors=[...lighting.colors] as StudioLighting['colors'];colors[index]=event.target.value;changeLighting({colors});}}/>
    </label>)}</div>
    <div className="studio-lighting-palette" role="group" aria-label="棚景配色预设">{([{name:'冷蓝',mode:'single',colors:['#507ddc','#c174dd','#f1a065']},{name:'极光',mode:'multicolor',colors:['#497bff','#bb57df','#49dcc9']},{name:'落日',mode:'multicolor',colors:['#515cf5','#dd6ab5','#ffb16a']}] as const).map(palette=><button key={palette.name} onClick={()=>changeLighting({mode:palette.mode,colors:[...palette.colors]})}>
     <i aria-hidden="true" style={{background:palette.mode==='single'?palette.colors[0]:`linear-gradient(110deg,${palette.colors.join(',')})`}}/><span>{palette.name}</span>
    </button>)}</div>
    <p>{studioId(state.stage)==='grooved'?'展台反光与机身轮廓光联动':'背景渐层与机身轮廓光联动'} · 屏幕内容保持原色</p>
   </section>}
   {studioId(state.stage)==='grooved'&&<section className="studio-lighting" aria-label="棚景取景"><div className="studio-lighting-title">棚景取景</div><div className="studio-lighting-palette">{([{id:'angled',label:'斜俯视'},{id:'overhead',label:'正俯视'},{id:'close',label:'近景'}] as const).map(view=><button key={view.id} onClick={()=>{save();updateState({isPlaying:false});window.dispatchEvent(new CustomEvent('mockup-studio-view',{detail:view.id}));}}>{view.label}</button>)}</div></section>}
   {stage.shape==='brick-court'&&<section className="studio-lighting" aria-label="砖景细节">
    <div className="studio-lighting-title">砖场与雨水</div>
    <div className="grid grid-cols-2 gap-2">{([{key:'brickRows',label:'砖行数'},{key:'brickColumns',label:'每行砖数'}] as const).map(control=><label key={control.key} className="min-w-0 text-gray-400">{control.label}<input aria-label={control.label} className="w-full mt-1 rounded-lg bg-white/5 border border-white/10 px-2 py-2" type="number" min="2" max="10" step="1" value={stage[control.key]??3} onChange={event=>{const value=Number(event.target.value);if(!Number.isInteger(value)||value<2||value>10)return;const rows=control.key==='brickRows'?value:stage.brickRows??3,columns=control.key==='brickColumns'?value:stage.brickColumns??3;change({[control.key]:value,size:[columns*3,stage.size[1],rows*2.5]});}}/></label>)}</div>
    <label className="block text-gray-400">砖缝青苔<input aria-label="砖缝青苔" className="w-full" type="range" min="0" max="1" step=".01" value={stage.moss??0} onChange={event=>change({moss:Number(event.target.value)})}/></label>
    <div className="flex justify-between items-center"><span>下雨动画</span><ToggleSwitch label="下雨动画" checked={rain.enabled} onChange={enabled=>changeRain({enabled})}/></div>
    {rain.enabled&&<>
     {([{key:'intensity',label:'雨量',min:.05,max:1,step:.01},{key:'dropSize',label:'雨滴大小',min:.5,max:2,step:.05},{key:'wind',label:'风向与倾斜',min:-1,max:1,step:.01},{key:'wetness',label:'表面湿润',min:0,max:1,step:.01}] as const).map(control=><label key={control.key} className="block text-gray-400">{control.label}<input aria-label={control.label} className="w-full" type="range" min={control.min} max={control.max} step={control.step} value={rain[control.key]} onChange={event=>changeRain({[control.key]:Number(event.target.value)})}/></label>)}
     <div className="flex justify-between items-center"><span>静止时预览雨景</span><ToggleSwitch label="静止时预览雨景" checked={rain.preview} onChange={preview=>changeRain({preview})}/></div>
     <p>湿砖保持粗糙，凹槽小水洼承接雨滴和水纹。湿润度控制湿斑与积水水位；关闭静止预览可检查单帧。</p>
    </>}
   </section>}
   <div aria-label="场景预设" className="stage-presets">{STAGE_PRESETS.map(preset=><button key={preset.id} aria-pressed={(config.preset||'single')===preset.id} onClick={()=>{save();setMessage('');const next=makeStage(preset.id),designed=STUDIO_IDS.includes(preset.id as StudioId);updateState({stage:next,activeStageId:designed?null:'primary',activeModelId:null,activeTextId:null,showGizmo:true,isPlaying:false,...(designed?studioDefaults(preset.id as StudioId,state):{})});if(designed)window.dispatchEvent(new CustomEvent('mockup-compose-studio',{detail:preset.id}));else fit(next,'primary',true);}} className="stage-preset">
    <img src={offlineAsset(`/scenes/${preset.id}.png`)} alt="" width="256" height="176" draggable={false}/>
    <span className="block text-gray-200 font-medium">{preset.name}</span><span className="block text-[9px] text-gray-400 mt-1">{preset.hint}</span>
   </button>)}</div>
   <p className="text-[10px] text-gray-400">拖动环绕视角 · 右键拖动平移 · 滚轮缩放<br/>点击手机或展台，用箭头移动、圆弧旋转。</p>
   {studioId(state.stage)&&<button className="w-full py-2 rounded-lg bg-white/10" onClick={()=>{save();updateState({isPlaying:false});window.dispatchEvent(new CustomEvent('mockup-compose-studio',{detail:studioId(state.stage)}));}}>恢复棚景构图</button>}
   <section className="stage-placement" aria-label="手机摆放">
    <div className="flex items-center justify-between gap-2 mb-2"><span className="font-medium">手机摆放</span>{state.models.length>1&&<select aria-label="摆放手机" className="stage-phone-select" value={phone?.id||''} onChange={e=>setPhoneId(e.target.value)}>{state.models.filter(m=>m.visible).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>}</div>
    <SegmentedControl<'stage'|'floor'> label="摆放位置" value={target} options={[{value:'stage',label:'当前展台'},{value:'floor',label:'地面'}]} onChange={setTarget}/>
    <div className="stage-poses">{([{id:'upright',label:'竖立'},{id:'flat',label:'平躺'},{id:'side',label:'侧放'}] as const).map(pose=><button key={pose.id} disabled={!phone} onClick={()=>{
     if(!phone)return;save();setMessage('正在贴合…');updateState({isPlaying:false});
     window.dispatchEvent(new CustomEvent('mockup-place-phone',{detail:{modelId:phone.id,stageId:stage.id,pose:pose.id,target}}));
    }}><svg width="30" height="26" viewBox="0 0 30 26" aria-hidden="true"><path d="M2 23H28" stroke="currentColor" opacity=".35"/><rect x={pose.id==='upright'?10:4} y={pose.id==='upright'?3:pose.id==='flat'?19:11} width={pose.id==='upright'?10:22} height={pose.id==='upright'?19:pose.id==='flat'?3:11} rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg><span>{pose.label}</span></button>)}</div>
    <p role="status" className="stage-placement-note">{message||`屏幕朝外 · 贴合${target==='stage'?stage.name:'地面'} · 不改变手机大小`}</p>
   </section>
   <div aria-label="选择展台" className="flex gap-1 flex-wrap">{objects.map(o=><button key={o.id} aria-pressed={state.activeStageId===o.id} onClick={()=>updateState({activeStageId:o.id,activeModelId:null,activeTextId:null})} className={`px-2 py-1 rounded-lg ${state.activeStageId===o.id?'bg-blue-500/15 text-blue-400':'bg-white/5 text-gray-400'}`}>{o.name}</button>)}</div>
   <div className="flex gap-2"><button onClick={()=>{save();fit();}} className="flex-1 py-2 rounded-lg bg-white/10">贴合手机底部</button><button onClick={view} className="flex-1 py-2 rounded-lg bg-white/10">展台视角</button></div>
   {(['position','rotation','size'] as const).map(field=><div key={field}><p className="text-gray-400 mb-1">{{position:'展台位置',rotation:'展台旋转（°）',size:'展台尺寸'}[field]}</p><div className="grid grid-cols-3 gap-2">
    {stage[field].map((value,index)=><label key={index} className="min-w-0 text-[10px] text-gray-400">{['X','Y','Z'][index]}<input aria-label={`${{position:'展台位置',rotation:'展台旋转',size:'展台尺寸'}[field]} ${['X','Y','Z'][index]}`} type="number" step={field==='rotation'?5:.1} min={field==='size'?.1:undefined} max={field==='size'?100:undefined} value={Number((field==='rotation'?value*180/Math.PI:value).toFixed(2))} onChange={event=>{
     const n=Number(event.target.value);if(!event.target.value||!Number.isFinite(n)||(field==='size'&&(n<.1||n>100)))return;const values=[...stage[field]] as [number,number,number];values[index]=field==='rotation'?n*Math.PI/180:n;change({[field]:values});
    }} className="w-full mt-1 rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-gray-200"/></label>)}
   </div></div>)}
   <label className="flex justify-between items-center text-gray-300">展台颜色<input aria-label="展台颜色" type="color" value={stage.color} onChange={e=>change({color:e.target.value})}/></label>
   {stage.shape!=='brick-court'&&<div role="group" aria-label="展台材质" className="stage-materials">{([{value:'stone',label:'石材'},{value:'glass',label:'玻璃'},{value:'metal',label:'金属'},{value:'knit',label:'毛衣'},{value:'fabric',label:'亚麻'},{value:'velvet',label:'丝绒'},{value:'fur',label:'毛绒'},...(stage.shape==='satin-sheet'?[{value:'satin' as const,label:'缎面'}]:[])] as const).map(material=><button key={material.value} aria-pressed={(stage.material||'stone')===material.value} onClick={()=>change({material:material.value,roughness:material.value==='glass'?.05:material.value==='metal'?.25:material.value==='satin'?.48:material.value==='stone'?.82:.92,reliefDepth:material.value==='knit'?.24:material.value==='stone'?.09:material.value==='fabric'?.1:material.value==='velvet'?.06:stage.reliefDepth})}>{material.label}</button>)}</div>}
   {stage.shape==='brick-court'&&<p className="text-[10px] text-gray-400">扫描粗砖 · 下方可调整纹理密度、颗粒起伏与真实置换。</p>}
   {(stage.shape==='grooved-tray'||stage.shape==='satin-sheet')&&<><label className="block text-gray-400">压纹密度<input aria-label="压纹密度" className="w-full" type="range" min=".5" max="6" step=".05" value={stage.textureScale??1} onChange={e=>change({textureScale:Number(e.target.value)})}/></label><label className="block text-gray-400">微纹理起伏<input aria-label="微纹理起伏" className="w-full" type="range" min="0" max="1" step=".01" value={stage.detailStrength??.5} onChange={e=>change({detailStrength:Number(e.target.value)})}/></label></>}
   {(!stage.material||stage.material==='stone')&&<>
    {stage.shape!=='brick-court'&&<div role="group" aria-label="石材表面" className="stage-materials">{([{value:'smooth',label:'素面'},{value:'concrete',label:'混凝土'},{value:'mineral',label:'岩石'},{value:'travertine',label:'洞石'},{value:'slate',label:'板岩'},{value:'terrazzo',label:'水磨石'}] as const).map(surface=><button key={surface.value} aria-pressed={(stage.surface||'concrete')===surface.value} onClick={()=>change({surface:surface.value})}>{surface.label}</button>)}</div>}
    {stage.surface!=='smooth'&&<><label className="block text-gray-400">纹理密度<input aria-label="纹理密度" className="w-full" type="range" min=".25" max="4" step=".05" value={stage.textureScale??1} onChange={e=>change({textureScale:Number(e.target.value)})}/></label><label className="block text-gray-400">表面起伏<input aria-label="表面起伏" className="w-full" type="range" min="0" max="1" step=".01" value={stage.detailStrength??.3} onChange={e=>change({detailStrength:Number(e.target.value)})}/></label></>}
   </>}
   {((!stage.material||stage.material==='stone')&&stage.surface!=='smooth'||isSoftStage(stage)&&stage.material!=='fur')&&<label className="block text-gray-400">纹理置换<span className="float-right tabular-nums">{relief.toFixed(2)}</span><input aria-label="纹理置换" className="w-full" type="range" min="0" max=".35" step=".01" value={relief} onChange={e=>change({reliefDepth:Number(e.target.value)})}/></label>}
   {stage.material==='knit'&&<div role="group" aria-label="针织纹样" className="stage-materials">{([{value:'stockinette',label:'平针毛衣'},{value:'cable',label:'绞花毛衣'}] as const).map(pattern=><button key={pattern.value} aria-pressed={(stage.knitPattern||'stockinette')===pattern.value} onClick={()=>change({knitPattern:pattern.value})}>{pattern.label}</button>)}</div>}
   {isSoftStage(stage)&&<section className="stage-soft-settings" aria-label="柔软材质设置">
    <label>织纹密度<input aria-label="织纹密度" type="range" min=".25" max="4" step=".05" value={stage.textureScale??1} onChange={e=>change({textureScale:Number(e.target.value)})}/></label>
    <label>接触压陷<input aria-label="接触压陷" type="range" min="0" max="1" step=".01" value={stage.softness??.75} onChange={e=>change({softness:Number(e.target.value)})}/></label>
    {stage.material==='fur'&&<><label>绒毛长度<input aria-label="绒毛长度" type="range" min=".04" max=".6" step=".01" value={stage.pileLength??.24} onChange={e=>change({pileLength:Number(e.target.value)})}/></label><label>绒毛密度<input aria-label="绒毛密度" type="range" min=".35" max="1.5" step=".05" value={stage.fiberDensity??1} onChange={e=>change({fiberDensity:Number(e.target.value)})}/></label></>}
    <p>手机接触处自动压陷，移开后恢复；竖立、平躺和侧放均可使用。</p>
   </section>}
   <label className="block text-gray-400">展台粗糙度<input aria-label="展台粗糙度" className="w-full" type="range" min="0" max="1" step=".01" value={stage.roughness} onChange={e=>change({roughness:Number(e.target.value)})}/></label>
   {stage.reflectivity!==undefined&&<label className="block text-gray-400">玻璃倒影<input aria-label="玻璃倒影" className="w-full" type="range" min="0" max=".8" step=".01" value={stage.reflectivity} onChange={e=>change({reflectivity:Number(e.target.value)})}/></label>}
  </>}
 </fieldset>;
}
