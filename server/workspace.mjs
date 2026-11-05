import path from 'node:path';
import {mkdir,lstat,readFile,readdir,writeFile,rename,unlink} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {validateProject} from '../utils/projectFiles.ts';

const fail=(status,message)=>Object.assign(new Error(message),{status});
const digest=text=>createHash('sha256').update(text).digest('hex');
const validId=id=>/^[a-f0-9-]{36}$/.test(id);
async function regularFile(file) {
  try {const stat=await lstat(file);if(!stat.isFile() || stat.isSymbolicLink())throw fail(400,'项目文件不是普通文件');return true;}
  catch(e){if(e.code==='ENOENT')return false;throw e;}
}
async function bodyJSON(req) {
  const chunks=[];let bytes=0;
  for await(const chunk of req){bytes+=chunk.length;if(bytes>256*1024*1024)throw fail(413,'项目超过 256 MB，请使用导出文件');chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fail(400,'项目数据无法解析');}
}
function checkDocument(doc) {
  try{validateProject(doc);}catch(e){throw fail(400,e.message);}
  if(doc.version!==2 || doc.format!=='mockup3d' || !doc.name?.trim())throw fail(400,'需要完整项目文件与项目名称');
  const check=url=>{if(url && (typeof url!=='string' || !url.startsWith('asset:') || typeof doc.assets?.[url]!=='string' || !doc.assets[url].startsWith('data:')))throw fail(400,'项目缺少内嵌资源');};
  for(const scene of [doc.data,...doc.data.keyframes.map(f=>f.state)]) {
    check(scene.bgImage);
    for(const m of scene.models || [])for(const key of ['fbxFile','screenshot','screenshotPrev'])check(m[key]);
    for(const t of scene.texts || [])check(t.font);
  }
}

/** Loopback-only, same-origin endpoint. Never accepts a filesystem path from the client. */
export function workspaceApi(root) {
  const directory=path.resolve(root,'saved-projects');
  let writes=Promise.resolve();
  const ensure=async()=>{
    await mkdir(directory,{recursive:true});
    const stat=await lstat(directory);if(stat.isSymbolicLink() || !stat.isDirectory())throw fail(400,'保存目录不能是符号链接');
  };
  const metadata=(id,text)=>{const p=JSON.parse(text);return {id,name:p.name,timestamp:p.timestamp,revision:digest(text)};};
  return async(req,res,next)=>{
    const url=new URL(req.url || '/', 'http://localhost');
    if(!url.pathname.startsWith('/api/workspace'))return next();
    const send=(status,value)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(value));};
    try {
      const host=req.headers.host || '';
      if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host) || (req.headers.origin && req.headers.origin!==`http://${host}`) || req.headers['sec-fetch-site']==='cross-site')throw fail(403,'只允许本机编辑器访问项目');
      const suffix=url.pathname.slice('/api/workspace'.length);
      const id=suffix.slice(1);
      if(suffix && !validId(id))throw fail(400,'项目编号无效');
      await ensure();
      if(req.method==='GET') {
        if(!suffix) {
          const projects=[],warnings=[];
          for(const file of await readdir(directory)) {
            const key=file.replace(/\.mockup3d$/,'');if(file===key || !validId(key))continue;
            try{await regularFile(path.join(directory,file));projects.push(metadata(key,await readFile(path.join(directory,file),'utf8')));}catch{warnings.push(file);}
          }
          return send(200,{directory,projects:projects.sort((a,b)=>b.timestamp-a.timestamp),warnings});
        }
        const file=path.join(directory,`${id}.mockup3d`);
        if(!await regularFile(file))throw fail(404,'项目文件不存在');
        const text=await readFile(file,'utf8');return send(200,{...metadata(id,text),project:JSON.parse(text)});
      }
      if(req.method!=='PUT' || !id)throw fail(405,'不支持此操作');
      if(req.headers['x-mockup-client']!=='editor' || !req.headers['content-type']?.startsWith('application/json'))throw fail(403,'保存请求来源无效');
      const {project,expectedRevision}=await bodyJSON(req);checkDocument(project);
      const operation=writes.catch(()=>{}).then(async()=>{
        const file=path.join(directory,`${id}.mockup3d`);
        const exists=await regularFile(file);
        const old=exists?await readFile(file,'utf8'):null;
        if((old && digest(old)!==expectedRevision) || (!old && expectedRevision))throw fail(409,'磁盘项目已被其他页面修改。请重新打开，或另存新项目，避免覆盖新内容。');
        const document={...project,id,timestamp:Date.now()};delete document.workspace;
        const text=JSON.stringify(document);
        const temp=path.join(directory,`${id}.${randomUUID()}.tmp`);
        const backupTemp=`${temp}.bak`;
        try {
          await writeFile(temp,text,{flag:'wx',mode:0o600});
          if(old!==null){await writeFile(backupTemp,old,{flag:'wx',mode:0o600});await rename(backupTemp,`${file}.bak`);}
          await rename(temp,file);
        } finally {await unlink(temp).catch(()=>{});await unlink(backupTemp).catch(()=>{});}
        return {...metadata(id,text),directory};
      });
      writes=operation;
      return send(200,await operation);
    } catch(e){send(e.status || 500,{error:e.status?e.message:'磁盘读写失败，请检查保存目录权限与剩余空间。'});}
  };
}

export function workspacePlugin(root) {
  const install=server=>{server.middlewares.use(workspaceApi(root));};
  return {name:'local-project-workspace',configureServer:install,configurePreviewServer:install};
}
