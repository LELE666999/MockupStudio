// Optional private fixtures stay outside the repository. This exercises the
// public build under its Pages subpath, including actual browser persistence.
import {chromium,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

const args=process.argv.slice(2),source=args.find(arg=>!arg.startsWith('https://'));
if(!source)throw Error('Usage: node scripts/check-model-library.mjs /path/to/model-folder [https://your-site/]');
const live=args.find(arg=>arg.startsWith('https://'));
const target=live||'https://preview.mockup.test/MockupStudio/';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1720,height:1080}}),errors=[],failed=[];
  page.setDefaultTimeout(40000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`);});
  await page.addInitScript(()=>{window.showSaveFilePicker=undefined;});
  if(!live)await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(!/^https?:/.test(url.protocol))return route.continue();
    if(url.origin!==new URL(target).origin)return route.abort();
    try {
      const rel=decodeURIComponent(url.pathname).replace(/^\/MockupStudio\//,'')||'index.html',file=path.resolve('dist',rel);
      if(!file.startsWith(path.resolve('dist')+path.sep))throw Error('outside dist');
      const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.ttf':'font/ttf'}[path.extname(file)]||'application/octet-stream';
      await route.fulfill({body:await readFile(file),contentType:type});
    } catch {await route.fulfill({status:404,body:'Not found'});}
  });
  await page.goto(target);const controls=page.locator('.editor-controls');
  const read=()=>controls.evaluate(el=>{
    let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))],root=f;
    while(root.return)root=root.return;
    if(root.stateNode.current!==root)f=f.alternate||f;
    for(;f;f=f.return)if(f.memoizedProps?.state?.models)return f.memoizedProps.state;
    throw Error('state missing');
  });
  await controls.getByRole('button',{name:'高级',exact:true}).click();
  await expect.poll(async()=>(await read()).models[0].subMeshes.length).toBeGreaterThan(0);
  await expect(controls.getByRole('button',{name:'导入本地模型库',exact:true})).toBeEnabled();
  const apple=controls.getByRole('region',{name:'苹果模型'});
  await expect(apple.getByRole('button')).toHaveCount(5);
  await expect(controls.getByRole('region',{name:'华为模型'}).getByRole('button')).toHaveCount(5);

  // An unavailable entry opens a picker while retaining the current phone.
  const before=(await read()).models[0];
  const chooser=page.waitForEvent('filechooser');
  await apple.getByRole('button',{name:'Apple iPhone 18 Pro AR',exact:false}).click();
  await(await chooser).setFiles([]);
  expect((await read()).models[0].fbxFile).toBe(before.fbxFile);
  expect(failed).toEqual([]);

  // A mislabeled file must not replace either the model or cached library.
  await controls.getByLabel('导入单个预设模型',{exact:true}).setInputFiles({name:'iphone18-pro.glb',mimeType:'model/gltf-binary',buffer:Buffer.from('broken GLB')});
  await expect(controls.getByRole('status')).toContainText('不是完整的 GLB');
  expect((await read()).models[0].fbxFile).toBe(before.fbxFile);

  // Import the whole original folder, including its non-model files if present.
  await controls.getByRole('button',{name:'导入本地模型库',exact:true}).click({trial:true});
  // The previous picker was cancelled; the batch action clears its pending type.
  const folderChooser=page.waitForEvent('filechooser');
  await controls.getByRole('button',{name:'导入本地模型库',exact:true}).click();
  await(await folderChooser).setFiles(path.resolve(source));
  await expect(controls.getByRole('status')).toContainText('已导入 8 款模型');
  await expect(controls.getByText('本机已导入',{exact:true})).toHaveCount(8);

  const names=['HUAWEI 下载样机 · 33889335','HUAWEI 折叠样机 · 纯色','HUAWEI Pura 70 Pro','Apple iPhone 17 Pro','Apple iPhone 17 Pro Max','Apple iPhone 18 Pro','Apple iPhone 18 Pro Max','Apple iPhone Duo'];
  for(const name of names) {
    const region=controls.getByRole('region',{name:name.startsWith('Apple')?'苹果模型':'华为模型'});
    await region.getByRole('button').filter({has:page.getByText(name,{exact:true})}).click();
    await expect.poll(async()=>{
      const m=(await read()).models[0];
      return m.name===name&&m.fbxFile?.startsWith('blob:')&&m.subMeshes.length>0;
    },{timeout:60000}).toBe(true);
    const model=(await read()).models[0];
    expect(model.subMeshes.some(mesh=>mesh.name===model.selectedScreenMesh)).toBe(true);
    console.log(`PASS local preset: ${name}`);
  }
  await controls.getByRole('button',{name:'半开',exact:true}).click();
  expect((await read()).models[0].foldAngle).toBe(90);
  await controls.getByLabel('机身颜色',{exact:true}).fill('#76aabb');
  expect((await read()).models[0].bodyColor).toBe('#76aabb');
  expect((await read()).models[0].bodyColorOverride).toBe(true);

  // A failed replacement must keep the previous working library and model.
  const previousURL=(await read()).models[0].fbxFile;
  await page.evaluate(()=>{
    window.__originalLibraryPut=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(value,key){
      if(typeof key==='string'&&key.startsWith('model-library:'))throw new DOMException('可用空间不足','QuotaExceededError');
      return window.__originalLibraryPut.call(this,value,key);
    };
  });
  await controls.getByLabel('导入单个预设模型',{exact:true}).setInputFiles(path.join(path.resolve(source),'iphone-duo.glb'));
  await expect(controls.getByRole('status')).toContainText('可用空间不足');
  expect((await read()).models[0].fbxFile).toBe(previousURL);
  await expect(controls.getByText('本机已导入',{exact:true})).toHaveCount(8);
  await page.evaluate(()=>{IDBObjectStore.prototype.put=window.__originalLibraryPut;delete window.__originalLibraryPut;});
  await page.keyboard.press('Control+s');
  await expect(page.getByText('已更新本地存稿，同一项目不会重复新建。',{exact:true})).toBeVisible();
  await page.reload();
  await expect.poll(async()=>(await read()).models[0].foldAngle,{timeout:30000}).toBe(90);
  await expect(controls.getByText('本机已导入',{exact:true})).toHaveCount(8);
  await controls.getByRole('button',{name:'简单',exact:true}).click();
  await controls.getByRole('button',{name:'高级',exact:true}).click();
  await expect(controls.getByText('本机已导入',{exact:true})).toHaveCount(8);
  await controls.getByRole('region',{name:'苹果模型'}).getByRole('button').filter({has:page.getByText('Apple iPhone Duo',{exact:true})}).click();
  await expect.poll(async()=>(await read()).models[0].subMeshes.length).toBeGreaterThan(0);

  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'导出项目文件',exact:true}).click();
  const project=JSON.parse(await readFile(await(await download).path(),'utf8'));
  expect(project.data.models[0].sourceFile).toBe('/models/iphone-duo.glb');
  expect(Object.values(project.assets).some(data=>data.length>1000000)).toBe(true);
  await page.getByRole('button',{name:'新建',exact:true}).click();
  await controls.getByRole('button',{name:'高级',exact:true}).click();
  await expect(controls.getByText('本机已导入',{exact:true})).toHaveCount(8);
  await controls.getByRole('region',{name:'苹果模型'}).getByRole('button').filter({has:page.getByText('Apple iPhone 17 Pro',{exact:true})}).click();
  await expect.poll(async()=>{
    const model=(await read()).models[0];
    return model.sourceFile==='/models/iphone17-pro.glb'&&model.subMeshes.length>0;
  }).toBe(true);
  expect(failed).toEqual([]);expect(errors).toEqual([]);
  console.log(`PASS ${target}: 10 entries, unavailable picker, invalid file/quota rollback, 8 actual models, auto screen mapping, Apple colour/Duo fold, Ctrl+S, reload, remount, new project, complete export, no missing model requests`);
} catch(error) {
  await browser.contexts()[0]?.pages()[0]?.screenshot({path:'/tmp/mockup-library-failure.png'});
  throw error;
} finally {await browser.close();}
