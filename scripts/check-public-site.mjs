import {chromium,expect} from '@playwright/test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const target=process.argv.find(a=>/^https?:/.test(a))||'https://preview.mockup.test/MockupStudio/';
const local=target.includes('preview.mockup.test'),screenshots=process.argv.includes('--screenshots');
const out=path.resolve('docs/screenshots');if(screenshots)await mkdir(out,{recursive:true});
const screen=(wide=false)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${wide?900:600}" height="${wide?650:1280}" viewBox="0 0 ${wide?900:600} ${wide?650:1280}"><defs><linearGradient id="g" x2=".8" y2="1"><stop stop-color="#07152d"/><stop offset=".5" stop-color="#232753"/><stop offset="1" stop-color="#6e55af"/></linearGradient><radialGradient id="a"><stop stop-color="#53cde3"/><stop offset="1" stop-color="#53cde3" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="490" cy="500" r="370" fill="url(#a)" opacity=".28"/><g font-family="Arial,sans-serif" fill="white"><text x="44" y="56" font-size="22">9:41</text><text x="44" y="${wide?135:200}" font-size="17" letter-spacing="5" opacity=".65">MOCKUP STUDIO</text><text x="44" y="${wide?200:282}" font-size="${wide?48:58}" font-weight="600">Make room</text><text x="44" y="${wide?265:350}" font-size="${wide?48:58}" font-weight="600">for your ideas.</text><text x="44" y="${wide?315:408}" font-size="20" opacity=".7">Create · Explore · Make it yours</text></g><rect x="36" y="${wide?370:510}" width="${wide?828:528}" height="${wide?210:230}" rx="30" fill="white" fill-opacity=".09"/><g font-family="Arial,sans-serif" fill="white"><text x="66" y="${wide?420:566}" font-size="16" opacity=".65">YOUR CREATIVE SPACE</text><text x="66" y="${wide?468:624}" font-size="35">Every detail matters.</text><text x="66" y="${wide?530:688}" font-size="18" opacity=".65">Shape. Light. Motion.</text></g>${wide?'':`<rect x="36" y="780" width="252" height="252" rx="28" fill="white" fill-opacity=".08"/><rect x="312" y="780" width="252" height="252" rx="28" fill="white" fill-opacity=".08"/><circle cx="162" cy="874" r="46" fill="none" stroke="#74d6ed" stroke-width="10"/><path d="M398 918L438 834L478 918Z" fill="none" stroke="#c4a4ff" stroke-width="9" stroke-linejoin="round"/><g fill="white" font-family="Arial,sans-serif" font-size="22"><text x="82" y="984">Explore</text><text x="380" y="984">Imagine</text></g><rect x="36" y="1112" width="528" height="88" rx="44" fill="white" fill-opacity=".12"/><text x="88" y="1165" font-family="Arial,sans-serif" font-size="21" fill="white">＋ Start something new</text><rect x="218" y="1240" width="164" height="6" rx="3" fill="white" opacity=".7"/>`}</svg>`;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1720,height:1080},deviceScaleFactor:1}),errors=[],failed=[],external=[];
 page.setDefaultTimeout(40000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`);});
 page.on('dialog',d=>d.accept());
 await page.addInitScript(()=>{window.showSaveFilePicker=undefined;});
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(!/^https?:/.test(url.protocol))return route.continue();
  if(url.origin!==new URL(target).origin){external.push(url.href);return route.abort();}
  if(!local)return route.continue();
  try{
   const rel=decodeURIComponent(url.pathname).replace(/^\/MockupStudio\//,'')||'index.html',file=path.resolve('dist',rel);
   if(!file.startsWith(path.resolve('dist')+path.sep))throw Error('outside dist');
   const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.ttf':'font/ttf','.txt':'text/plain'}[path.extname(file)]||'application/octet-stream';
   await route.fulfill({body:await readFile(file),contentType:mime});
  }catch{await route.fulfill({status:404,body:'Not found'});}
 });
 await page.goto(target);const controls=page.locator('.editor-controls');
 const read=()=>controls.evaluate(el=>{let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))],root=f;while(root.return)root=root.return;if(root.stateNode.current!==root)f=f.alternate||f;for(;f;f=f.return)if(f.memoizedProps?.state?.models)return f.memoizedProps.state;throw Error('state missing');});
 const patch=update=>controls.evaluate((el,p)=>{let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))],root=f;while(root.return)root=root.return;if(root.stateNode.current!==root)f=f.alternate||f;for(;f;f=f.return)if(f.memoizedProps?.state?.models){f.memoizedProps.updateState(p);return;}throw Error('state missing');},update);
 const phone=async values=>{const s=await read();await patch({models:s.models.map((m,i)=>i?m:{...m,...values})});};
 await expect(controls.getByRole('heading',{name:'Mockup 3D'})).toBeVisible();
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.lensRenderer==='realtime');
 await controls.locator('input[accept="image/*,video/*"]').first().setInputFiles({name:'studio-screen.svg',mimeType:'image/svg+xml',buffer:Buffer.from(screen())});
 await phone({bodyColor:'#293344',edgeColor:'#263142',bezelWidth:.045,radius:.19,depth:.23,screenRoughness:.08});
 await controls.getByRole('button',{name:'环境',exact:true}).click();await controls.getByRole('button',{name:'有场景',exact:true}).click();
 const scene=async label=>{await controls.getByRole('button',{name:label,exact:false}).first().click();await page.waitForTimeout(1100);};
 if(process.argv.includes('--thumbnails')){
  for(const [id,label] of [['midnight','深蓝斜台'],['gallery','银灰玻璃展厅'],['silk','蓝白柔光棚'],['chrome','镀铬网架'],['grooved','蓝紫凹槽展台'],['bricks','炭黑粗砖']]){
   await scene(label);await patch({showGizmo:false});await page.waitForTimeout(250);
   const data=await page.locator('canvas').first().evaluate(canvas=>{const c=document.createElement('canvas');c.width=384;c.height=264;const ctx=c.getContext('2d'),ratio=Math.min(384/canvas.width,264/canvas.height),w=canvas.width*ratio,h=canvas.height*ratio;ctx.fillStyle='#e9ebef';ctx.fillRect(0,0,384,264);ctx.drawImage(canvas,(384-w)/2,(264-h)/2,w,h);return c.toDataURL('image/png');});
   await writeFile(`public/scenes/${id}.png`,Buffer.from(data.split(',')[1],'base64'));
  }
 }
 await scene('蓝紫凹槽展台');await patch({showGizmo:false});
 if(screenshots){await page.locator('canvas').first().screenshot({path:path.join(out,'grooved.png')});await page.screenshot({path:path.join(out,'editor.png')});}
 await page.keyboard.press('Control+s');await expect(page.getByText('已更新本地存稿，同一项目不会重复新建。',{exact:true})).toBeVisible();
 expect(failed.filter(u=>u.includes('/api/'))).toEqual([]);
 const before=await read();await page.reload();await expect.poll(async()=>(await read()).stage?.preset,{timeout:30000}).toBe(before.stage.preset);
 expect((await read()).models[0].screenshot).toMatch(/^(blob:|data:)/);
 await controls.getByRole('button',{name:'高级',exact:true}).click();await controls.getByRole('button',{name:'HUAWEI Mate 70 Pro',exact:false}).click();
 await expect.poll(async()=>(await read()).models[0].subMeshes.length).toBeGreaterThan(0);
 await controls.getByRole('button',{name:'简单',exact:true}).click();
 await controls.getByRole('button',{name:'阔折叠样机',exact:true}).click();
 await controls.locator('input[accept="image/*,video/*"]').first().setInputFiles({name:'inner-screen.svg',mimeType:'image/svg+xml',buffer:Buffer.from(screen(true))});
 await controls.getByLabel('导入外屏图片或视频',{exact:true}).setInputFiles({name:'outer-screen.svg',mimeType:'image/svg+xml',buffer:Buffer.from(screen())});
 await controls.getByRole('button',{name:'半开',exact:true}).click();
 await controls.getByRole('button',{name:'环境',exact:true}).click();await controls.getByRole('button',{name:'无场景',exact:true}).click();
 await phone({rotation:[.08,-.38,0],position:[0,0,0],bodyColor:'#a7b7c8',edgeColor:'#66798d'});await patch({bgColor:'#e6e9ef',showGizmo:false});await page.waitForTimeout(500);
 if(screenshots)await page.locator('canvas').first().screenshot({path:path.join(out,'foldable.png')});
 await controls.getByRole('button',{name:'模型',exact:true}).click();await controls.getByRole('button',{name:'直板样机',exact:true}).click();
 await controls.locator('input[accept="image/*,video/*"]').first().setInputFiles({name:'studio-screen.svg',mimeType:'image/svg+xml',buffer:Buffer.from(screen())});
 await phone({edgeColor:'#1d2532',bodyColor:'#202a39',bezelWidth:.045});
 await controls.getByRole('button',{name:'环境',exact:true}).click();await controls.getByRole('button',{name:'有场景',exact:true}).click();await scene('炭黑粗砖');await patch({showGizmo:false});
 await controls.getByLabel('下雨动画',{exact:true}).check();await page.waitForTimeout(500);
 if(screenshots)await page.locator('canvas').first().screenshot({path:path.join(out,'bricks.png')});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出项目文件',exact:true}).click();const doc=JSON.parse(await readFile(await(await download).path(),'utf8'));expect(doc.assets).toBeTruthy();expect(doc.data.stage.preset).toBe('bricks');
 await controls.getByRole('button',{name:'文字',exact:true}).click();await controls.getByRole('button',{name:'添加新文字',exact:true}).click();await page.waitForTimeout(2000);
 // Rendering Chinese must use the bundled OFL font, without external glyph CDN.
 expect(external).toEqual([]);
 if(process.argv.includes('--video')){
  const s=await read();await patch({totalDuration:.2,currentTime:0,texts:[],keyframes:[]});
  const video=page.waitForEvent('download',{timeout:180000});await page.getByRole('button',{name:'导出视频',exact:true}).click();const result=await video;await result.saveAs('/tmp/mockup-public-smoke.mp4');
  expect((await readFile('/tmp/mockup-public-smoke.mp4')).byteLength).toBeGreaterThan(1000);
 }
 expect(failed).toEqual([]);expect(errors).toEqual([]);
 console.log(`PASS ${target}: model, PBR/HDR assets, scenes, fold, independent media, Ctrl+S, reload, project export, Chinese font, no API/asset errors${process.argv.includes('--video')?', video export':''}`);
}catch(error){
 const page=browser.contexts()[0]?.pages()[0];
 console.log('Browser diagnostics:',await page?.locator('body').innerText().catch(()=>''));
 await page?.screenshot({path:'/tmp/mockup-public-failure.png'}).catch(()=>{});
 throw error;
}finally{await browser.close();}
