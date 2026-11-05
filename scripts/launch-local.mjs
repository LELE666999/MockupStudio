import {spawn} from 'node:child_process';
import {openSync,closeSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.MOCKUP_LOCAL_PORT||3337);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('无效端口');
const url=`http://127.0.0.1:${port}/`;
async function ready(){
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(1500)});
  if(!response.ok||!(await response.text()).includes('<title>3D 样机大师</title>'))throw Error('端口已被其他程序占用');
  return true;
 }catch(error){if(error.message==='端口已被其他程序占用')throw error;return false;}
}
if(!await ready()){
 mkdirSync(path.join(root,'logs'),{recursive:true});
 const fd=openSync(path.join(root,'logs','local-server.log'),'a');
 const child=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,detached:true,stdio:['ignore',fd,fd]});
 closeSync(fd);
 let launchError;child.on('error',error=>{launchError=error;});child.unref();
 let started=false;
 for(let attempt=0;attempt<60;attempt++){
  if(launchError)throw launchError;
  if(await ready()){started=true;break;}
  await delay(250);
 }
 if(!started)throw Error('启动失败，请查看项目 logs/local-server.log');
}
console.log(`样机大师已在后台运行：${url}，可以关闭终端窗口。`);
if(!process.argv.includes('--no-open')){
 const browser=spawn('/usr/bin/open',[url],{stdio:'ignore'});
 browser.on('error',error=>console.error('请在浏览器打开以上地址：',error.message));
}
