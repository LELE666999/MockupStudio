import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,symlink,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {workspaceApi} from '../server/workspace.mjs';
import {getInitialState} from '../types.ts';
import {packProject} from '../utils/projectFiles.ts';
import {adjacentKeyframe} from '../utils/keyframeNavigation.ts';

test('J/K navigation uses strict previous/next timestamps regardless of array order',()=>{
  const frames:any[]=[{id:'b',time:2},{id:'a',time:0},{id:'c',time:4}];
  assert.equal(adjacentKeyframe(frames,2,-1)?.time,0);
  assert.equal(adjacentKeyframe(frames,2,1)?.time,4);
  assert.equal(adjacentKeyframe(frames,3,-1)?.time,2);
  assert.equal(adjacentKeyframe(frames,4,1),undefined);
});
test('workspace API writes durable files, retains previous revision and rejects stale/foreign requests',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'mockup-workspace-test-'));
  const api=workspaceApi(root);
  const server=http.createServer((req,res)=>{api(req,res,()=>{res.statusCode=404;res.end();});});
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
  const origin=`http://127.0.0.1:${(server.address() as any).port}`;
  const call=(p:string,method='GET',body?:unknown,foreign=false)=>fetch(`${origin}/api/workspace${p}`,{method,headers:{origin:foreign?'https://untrusted.example':origin,'content-type':'application/json','x-mockup-client':'editor'},body:body?JSON.stringify(body):undefined});
  try {
    const document=await packProject(getInitialState(),'test project');
    const id=crypto.randomUUID();
    const first=await call(`/${id}`,'PUT',{project:document});assert.equal(first.status,200);
    const meta=await first.json();
    assert.equal(JSON.parse(await readFile(path.join(root,'saved-projects',`${id}.mockup3d`),'utf8')).name,'test project');
    document.name='updated';
    assert.equal((await call(`/${id}`,'PUT',{project:document,expectedRevision:meta.revision},true)).status,403);
    assert.equal((await call(`/${id}`,'PUT',{project:document,expectedRevision:meta.revision})).status,200);
    assert.equal((await call(`/${id}`,'PUT',{project:document,expectedRevision:meta.revision})).status,409);
    assert.equal(JSON.parse(await readFile(path.join(root,'saved-projects',`${id}.mockup3d.bak`),'utf8')).name,'test project');
    const list=await (await call('')).json();assert.equal(list.projects.length,1);assert.equal(list.projects[0].name,'updated');
    assert.equal((await call('/invalid/path','PUT',{project:document})).status,400);
    assert.equal((await (await call(`/${id}`)).json()).project.name,'updated');
    assert.equal((await readdir(path.join(root,'saved-projects'))).filter(f=>f.endsWith('.tmp')).length,0);
  } finally {await new Promise<void>(r=>server.close(()=>r()));}
});
