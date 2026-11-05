import type {SavedProject} from '../types';
import {usesLocalWorkspace} from './publicAssets';
export const hasLocalWorkspace=()=>usesLocalWorkspace(location.protocol,location.hostname);
export interface WorkspaceEntry {id:string;name:string;timestamp:number;revision:string}
async function request(path='',options:RequestInit={}) {
  const response=await fetch(`/api/workspace${path}`,{...options,headers:{'content-type':'application/json','x-mockup-client':'editor',...options.headers}});
  let result:any;
  try{result=await response.json();}catch{throw new Error('本地保存服务尚未启动，请重新运行桌面启动脚本（不要关闭未保存的页面）。');}
  if(!response.ok)throw new Error(result.error || '本地项目服务访问失败');
  return result;
}
export const listWorkspace=():Promise<{projects:WorkspaceEntry[];directory:string;warnings:string[]}>=>!hasLocalWorkspace()?Promise.resolve({projects:[],directory:'浏览器本地存档',warnings:[]}):request();
export const readWorkspace=(id:string):Promise<WorkspaceEntry & {project:SavedProject}>=>request(`/${encodeURIComponent(id)}`);
export const saveWorkspace=(id:string,project:SavedProject,expectedRevision?:string):Promise<WorkspaceEntry>=>request(`/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify({project,expectedRevision})});
