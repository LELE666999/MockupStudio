import type {AppState,StageObject} from '../types';
import {HDR_DEFAULTS} from './studioEnvironment.ts';
export const STAGE_PRESETS=[{id:'bricks',name:'炭黑粗砖',hint:'扫描置换 · 立体砖缝'},{id:'grooved',name:'蓝紫凹槽展台',hint:'细密压纹 · 缎面褶皱'},{id:'chrome',name:'镀铬网架',hint:'实拍 HDR · 远景虚化'},{id:'midnight',name:'深蓝斜台',hint:'冷光渐层 · 黑色悬边'},{id:'gallery',name:'银灰玻璃展厅',hint:'柔光竖纹 · 玻璃倒影'},{id:'silk',name:'蓝白柔光棚',hint:'蓝白渐层 · 微光投影'},{id:'knit',name:'羊毛针织',hint:'立体针脚 · 毛线交错'},{id:'cable',name:'绞花毛衣',hint:'厚织绞花 · 真实纱线'},{id:'linen',name:'亚麻布景',hint:'织纹褶皱 · 软接触压陷'},{id:'velvet',name:'丝绒软台',hint:'细腻绒光 · 弧面软垫'},{id:'fur',name:'毛绒布景',hint:'立体纤维 · 手机接触压绒'},{id:'rocks',name:'自然岩台',hint:'凹凸岩面 · 错落切面'},{id:'lattice',name:'金属格栅',hint:'圆丝交织 · 不锈钢柔光'},{id:'fluted',name:'细纹石台',hint:'置换洞石 · 圆润凹槽'},{id:'single',name:'方形展台',hint:'立体洞石 · 金属底座'},{id:'terrace',name:'错层石台',hint:'石英骨料 · 高低错落'},{id:'glass',name:'玻璃组合',hint:'磨边厚玻璃 · 拉丝金属'},{id:'stairs',name:'阶梯陈列',hint:'层理板岩 · 暖冷对比'}];
const item=(id:string,name:string,position:StageObject['position'],size:StageObject['size'],material:StageObject['material']='stone',color='#ded8cd',shape:StageObject['shape']='box'):StageObject=>({id,name,position,size,material,color,shape,rotation:[0,0,0],roughness:material==='glass'?.12:material==='metal'?.25:.8});
export function makeStage(preset:string):NonNullable<AppState['stage']>{
 const main=item('primary','主展台',[0,-4,0],[6,2,5]);main.surface='travertine';
 let items:StageObject[]=[];
 if(preset==='bricks'){
  Object.assign(main,{shape:'brick-court',size:[21,1.8,15],brickRows:6,brickColumns:7,moss:.32,rain:{enabled:true,intensity:.4,wind:.12,dropSize:1,wetness:.72,preview:true},position:[0,-3.9,0],material:'stone',surface:'concrete',color:'#5a5c60',roughness:.88,reliefDepth:.13,textureScale:1,detailStrength:.84,bevelRadius:.055});
 }
 if(preset==='grooved'){
  Object.assign(main,{shape:'grooved-tray',size:[8.1,.52,6.2],position:[0,-3.4,0],material:'metal',surface:'smooth',color:'#74819a',roughness:.5,reliefDepth:0,textureScale:4,detailStrength:.45});
  items=[{...item('satin-ground','紫色缎面布景',[0,-3.11,0],[36,2.4,34],'satin','#42334f','satin-sheet'),surface:'smooth',role:'backdrop',roughness:.43,detailStrength:.025}];
 }
 if(preset==='chrome'){
  Object.assign(main,{shape:'chrome-rack',size:[32,.24,32],position:[0,-3.4,0],rotation:[0,.5,0],material:'metal',surface:'smooth',color:'#e4e7ed',roughness:.07,reliefDepth:0,textureScale:1});
  items=[];
 }
 if(preset==='midnight')Object.assign(main,{size:[23,.35,21],position:[0,-3.19,7],rotation:[0,-.45,0],material:'stone',surface:'smooth',color:'#03070c',roughness:.91,bevelRadius:.018,reliefDepth:0});
 if(preset==='gallery'){
  Object.assign(main,{size:[13,1.5,7],position:[2,-3.75,1.5],material:'metal',surface:'smooth',color:'#aeb3ba',roughness:.24,bevelRadius:.32,reflectivity:.5,reliefDepth:0});
  items=[{...item('rib-wall','竖纹背景墙',[-5.6,1,-8],[11,11,.3],'stone','#d4d8dc','ribbed-wall'),role:'backdrop',surface:'smooth',roughness:.65},
   ...[0,1,2,3].map(i=>({...item('gallery-step-'+i,`背景阶梯 ${i+1}`,[4.6+i*1.05,-4.2+i*.36,-6.2],[1.1,.7+i*.72,3],'stone','#d0d4d9'),role:'backdrop' as const,surface:'smooth' as const,bevelRadius:.05})),
   {...item('sculpture','圆环雕塑',[5.5,-.9,-7],[1.8,1.8,.75],'stone','#dce0e4','ring'),role:'backdrop',surface:'smooth',roughness:.3,rotation:[.15,-.4,.35]}];
 }
 if(preset==='silk')Object.assign(main,{size:[60,.3,60],position:[0,-3.16,0],shape:'cyclorama',surface:'smooth',material:'stone',color:'#9caecb',roughness:.78,reliefDepth:0,bevelRadius:.06});
 if(preset==='single'){Object.assign(main,{color:'#e5d9c4',roughness:.83});items=[item('base','拉丝底座',[0,-5.035,0],[6.06,.07,5.06],'metal','#999b99')];}
 if(preset==='terrace'){
  main.surface='terrazzo';main.color='#e9e4d9';items=[{...item('left','低石台',[-5,-4.7,.5],[3.5,.6,4]),surface:'travertine'},{...item('back','高石台',[4.3,-3.6,-2.2],[3,2.8,3],'stone','#969b9d'),surface:'slate'}];
 }
 if(preset==='glass'){Object.assign(main,{material:'glass',surface:'smooth',color:'#eaf4f3',roughness:.035,size:[5.6,1.4,5.2]});items=[item('metal','金属圆台',[4,-4.2,-1.8],[3,1.6,3],'metal','#a6aab0','cylinder'),item('glass-back','烟色玻璃台',[-4,-3.8,-2.8],[2.7,2.4,3],'glass','#adc5c8'),{...item('under-glass','玻璃下方石座',[0,-4.77,0],[5.8,.14,5.4],'stone','#cec5b5'),surface:'travertine'}];}
 if(preset==='stairs'){Object.assign(main,{size:[5,2,4],color:'#a4adb1',surface:'slate'});items=[{...item('step-low','一级阶梯',[0,-4.65,3.2],[5,.7,2.4],'stone','#e1d0b6'),surface:'travertine'},{...item('step-high','三级阶梯',[0,-3.3,-3.2],[5,3.4,2.4],'stone','#8f999b'),surface:'slate'}];}
 if(preset==='rocks'){
  Object.assign(main,{shape:'rock',size:[8,1.8,9],position:[0,-3.9,0],color:'#d4d0c7',surface:'mineral',roughness:.88});
  items=[item('rock-left','侧方岩石',[-5.1,-4.2,-1.8],[2.4,1.2,3],'stone','#96958e','rock'),item('rock-back','后方岩石',[3.3,-3.8,-5.2],[3.1,2,2.2],'stone','#bbb5ab','rock')];
 }
 if(preset==='lattice'){
  Object.assign(main,{shape:'lattice',size:[7.5,1.4,8.5],position:[0,-3.7,0],material:'metal',color:'#c3c8cc',roughness:.26,surface:'smooth'});
  items=[item('grid-low','低格栅台',[5,-4.35,-1.8],[2.8,.1,5],'metal','#a9afb5','lattice')];
 }
 if(preset==='fluted'){
  Object.assign(main,{shape:'fluted',size:[6.5,1.8,8],position:[0,-3.9,0],color:'#e4dbc8',surface:'travertine'});
  items=[{...item('stone-round','圆形石台',[4.5,-4.3,-3],[2.4,1,2.4],'stone','#d0c2a9','cylinder'),surface:'terrazzo'}];
 }
 if(['linen','velvet','fur'].includes(preset)){
  Object.assign(main,{material:preset==='linen'?'fabric':preset,shape:preset==='linen'?'drape':'cushion',size:[8.5,.7,9.5],position:[0,-3.35,0],color:preset==='linen'?'#d6c6ae':preset==='velvet'?'#40576d':'#d8c8b7',surface:'smooth',roughness:preset==='linen'?.9:.95,softness:.85,pileLength:.26,fiberDensity:1});
  items=preset==='linen'?[{...item('linen-back','后方亚麻软垫',[2,-3.55,-5.4],[5,.45,3.8],'fabric','#b6aaa0','cushion'),softness:.75}]:preset==='velvet'?[{...item('velvet-back','后方丝绒软垫',[-4.7,-3.55,-3.5],[3.2,.6,4],'velvet','#6b6b78','cushion'),softness:.8}]:[];
 }
 if(preset==='knit'||preset==='cable'){
  Object.assign(main,{material:'knit',shape:'drape',size:[8.5,.75,9.5],position:[0,-3.375,0],color:preset==='cable'?'#c7b9a2':'#cab5a0',surface:'smooth',roughness:.93,softness:.85,knitPattern:preset==='cable'?'cable':'stockinette',reliefDepth:preset==='cable'?.28:.24});
  items=[{...item('knit-fold','后方折叠毛衣',[2.5,-3.7,-5.25],[4,.65,3.2],'knit','#a69b8a','cushion'),knitPattern:'stockinette',reliefDepth:.22,softness:.8}];
 }
 for(const object of [main,...items]){
  object.surface??=object.material==='stone'?(object.shape==='rock'?'mineral':'concrete'):'smooth';
  object.textureScale??=1;object.detailStrength??=object.shape==='rock'?.65:.3;
  object.reliefDepth??=object.material==='stone'?(object.shape==='rock'?.18:.09):object.material==='fabric'?.1:object.material==='velvet'?.06:0;
 }
 const {id,name,...primary}=main;return {...primary,enabled:true,preset,items,...(preset==='grooved'?{studioLighting:{mode:'multicolor' as const,colors:['#079ef5','#265aff','#b958e6'] as [string,string,string]}}:{}),...(preset==='chrome'?{studioEnvironment:{...HDR_DEFAULTS}}:{})};
}
export function stageObjects(stage:AppState['stage']):StageObject[]{return stage?.enabled?[{...stage,id:'primary',name:'主展台'},...(stage.items||[])]:[];}
export function patchStage(stage:NonNullable<AppState['stage']>,id:string,patch:Partial<StageObject>){
 return id==='primary'?{...stage,...patch}:{...stage,items:(stage.items||[]).map(o=>o.id===id?{...o,...patch}:o)};
}
