export interface ModelPreset {
  id: string;
  name: string;
  file: string;
  format: 'glb' | 'fbx';
  description: string;
  screen: string;
  bundled: boolean;
}

// Keep the original catalog and mapping metadata. Only the two original
// illustrative meshes ship publicly; other files can be installed locally.
export const MODEL_PRESETS: readonly ModelPreset[] = [
  {id:'huawei-user33889335',name:'HUAWEI 下载样机 · 33889335',file:'/models/huawei-user-33889335.glb',format:'glb',description:'原始模型 · 独立屏幕 · 支持机身换色',screen:'Screen',bundled:false},
  {id:'huawei-user246',name:'HUAWEI 折叠样机 · 纯色',file:'/models/huawei-user-24693859.glb',format:'glb',description:'源模型网格 · 展开姿态 · 统一换色',screen:'Screen',bundled:false},
  {id:'iphone18',name:'Apple iPhone 18 Pro',file:'/models/iphone18-pro.glb',format:'glb',description:'AR 网格 · 支持机身换色',screen:'EHjrGDHNHzgNjtE002',bundled:false},
  {id:'iphone18max',name:'Apple iPhone 18 Pro Max',file:'/models/iphone18-pro-max.glb',format:'glb',description:'AR 网格 · 支持机身换色',screen:'EHjrGDHNHzgNjtE002',bundled:false},
  {id:'iphoneduo',name:'Apple iPhone Duo',file:'/models/iphone-duo.glb',format:'glb',description:'折叠开合 · 独立内外屏 · 机身与外框换色',screen:'AppleDuoInnerScreen',bundled:false},
  {id:'pura',name:'HUAWEI Pura 70 Pro',file:'/Pura70pro.fbx',format:'fbx',description:'原项目 FBX 样机',screen:'物件_17',bundled:false},
  {id:'mate70',name:'HUAWEI Mate 70 Pro',file:'/models/huawei-mate70-pro.glb',format:'glb',description:'简化示意模型 · 非官方高精度',screen:'Screen',bundled:true},
  {id:'purax',name:'HUAWEI Pura X · 展开',file:'/models/huawei-pura-x-open.glb',format:'glb',description:'简化示意模型 · 非官方高精度',screen:'Screen',bundled:true},
  {id:'iphone17',name:'Apple iPhone 17 Pro',file:'/models/iphone17-pro.glb',format:'glb',description:'AR 网格 · 支持机身换色',screen:'HkNSnYzBPABcqwM002',bundled:false},
  {id:'iphone17max',name:'Apple iPhone 17 Pro Max',file:'/models/iphone17-pro-max.glb',format:'glb',description:'AR 网格 · 支持机身换色',screen:'HkNSnYzBPABcqwM002',bundled:false},
];
