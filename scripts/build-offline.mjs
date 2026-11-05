import {build} from 'esbuild';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'offline');await mkdir(out,{recursive:true});
const assets={};
async function collect(dir,prefix=''){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const key=`${prefix}/${entry.name}`,file=path.join(dir,entry.name);
  if(entry.isDirectory())await collect(file,key);
  else {const mime=key.endsWith('.svg')?'image/svg+xml':key.endsWith('.png')?'image/png':key.endsWith('.jpg')?'image/jpeg':key.endsWith('.glb')?'model/gltf-binary':'application/octet-stream';assets[key]=`data:${mime};base64,${(await readFile(file)).toString('base64')}`;}
 }
}
await collect(path.join(root,'public'));
// Only the redistributable OFL font is embedded, never a system font.
assets['/offline-font.ttf']=assets['/fonts/NotoSansSC-VF.ttf'];
await writeFile(path.join(out,'assets.js'),`window.mockupOfflineAssets=${JSON.stringify(assets)};`);
await build({absWorkingDir:root,entryPoints:['index.tsx'],bundle:true,format:'iife',platform:'browser',target:'chrome100',minify:true,define:{'process.env.NODE_ENV':'"production"'},outfile:path.join(out,'app.js')});
const cssFiles=(await readdir(path.join(root,'dist/assets'))).filter(f=>f.endsWith('.css'));
await writeFile(path.join(out,'app.css'),(await Promise.all(cssFiles.map(f=>readFile(path.join(root,'dist/assets',f),'utf8')))).join('\n'));
const html=prefix=>`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>3D 样机大师 · 本地版</title><link rel="icon" href="${assets['/favicon.svg']}"><script>try{document.documentElement.dataset.theme=localStorage.getItem('mockup-ui-theme')==='dark'?'dark':'light'}catch{}</script><link rel="stylesheet" href="${prefix}app.css"></head><body><div id="root"></div><script src="${prefix}assets.js"></script><script src="${prefix}app.js"></script></body></html>`;
await writeFile(path.join(out,'index.html'),html(''));
if(process.argv.includes('--desktop'))await writeFile(path.join(path.dirname(root),'3D样机大师.html'),html(`${path.basename(root)}/offline/`));
console.log(`Offline HTML ready: ${out}/index.html (no server required)`);
