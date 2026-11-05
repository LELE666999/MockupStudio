import {MODEL_PRESETS} from './modelPresets.ts';
import type {ModelPreset} from './modelPresets.ts';
import {readLocal,writeLocal} from './projectFiles.ts';

export type ModelLibrarySources = Record<string,string>;
interface StoredModel {version:1;fileName:string;blob:Blob}
const sources:ModelLibrarySources = {};
let loading:Promise<ModelLibrarySources> | undefined;
const key=(id:string)=>`model-library:${id}`;
export const presetFileName=(preset:ModelPreset)=>preset.file.split('/').at(-1)!;

export function presetForFile(name:string) {
  const base=name.split(/[\\/]/).at(-1)?.toLowerCase();
  return MODEL_PRESETS.find(p=>!p.bundled&&presetFileName(p).toLowerCase()===base);
}

export async function validatePresetFile(preset:ModelPreset,blob:Blob) {
  const header=await blob.slice(0,32).arrayBuffer(),bytes=new Uint8Array(header);
  const text=new TextDecoder().decode(bytes);
  if(preset.format==='glb') {
    const data=new DataView(header);
    if(bytes.length<20||text.slice(0,4)!=='glTF'||data.getUint32(4,true)!==2||data.getUint32(8,true)!==blob.size)
      throw new Error(`${presetFileName(preset)} 不是完整的 GLB 2 模型，请重新选择原文件。`);
  } else if(!text.startsWith('Kaydara FBX Binary  \0')&&!/^;\s*FBX\s+\d/i.test(text)) {
    throw new Error(`${presetFileName(preset)} 不是有效的 FBX 模型。`);
  }
}

export function loadModelLibrary():Promise<ModelLibrarySources> {
  if(!loading)loading=(async()=>{
    const local=MODEL_PRESETS.filter(p=>!p.bundled);
    const records=await Promise.all(local.map(p=>readLocal<StoredModel>(key(p.id))));
    records.forEach((record,i)=>{
      if(record?.version===1&&record.blob instanceof Blob&&record.blob.size>0)
        sources[local[i].id]=URL.createObjectURL(record.blob);
    });
    return {...sources};
  })().catch(error=>{loading=undefined;throw error;});
  return loading.then(()=>({...sources}));
}

export async function installLibraryModels(files:Iterable<File>,progress?:(name:string)=>void) {
  const installed:string[]=[],errors:string[]=[];
  for(const file of files) {
    const preset=presetForFile(file.name);
    if(!preset)continue;
    progress?.(preset.name);
    try {
      await validatePresetFile(preset,file);
      await writeLocal(key(preset.id),{version:1,fileName:presetFileName(preset),blob:file} satisfies StoredModel);
      // Earlier URLs may still be referenced by the undo history or project.
      // Keep them alive until the document closes, as with ordinary imports.
      sources[preset.id]=URL.createObjectURL(file);
      installed.push(preset.id);
    } catch(error) {
      errors.push(error instanceof Error?error.message:`${file.name} 保存失败`);
    }
  }
  return {installed,errors,sources:{...sources}};
}
