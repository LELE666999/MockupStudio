import * as THREE from 'three';
import {configureTextBuilder} from 'troika-three-text';
import {publicAsset} from './publicAssets';
declare global {interface Window {mockupOfflineAssets?:Record<string,string>}}
const blobs=new Map<string,string>();
export function offlineAsset(url:string){
 const assets=window.mockupOfflineAssets;if(!assets)return publicAsset(url,document.baseURI);
 const key=Object.keys(assets).find(key=>url===key||url.endsWith(key));
 if(!key)return url;
 if(!blobs.has(key)){
  const data=assets[key],split=data.indexOf(','),bytes=atob(data.slice(split+1));
  const buffer=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)buffer[i]=bytes.charCodeAt(i);
  blobs.set(key,URL.createObjectURL(new Blob([buffer],{type:data.slice(5,data.indexOf(';'))})));
  assets[key]=''; // Release the decoded asset's base64 string; reuse its blob URL.
 }
 return blobs.get(key)!;
}
export function setupOffline(){
 THREE.DefaultLoadingManager.setURLModifier(offlineAsset);
 const original=window.fetch.bind(window);
 window.fetch=(input,init)=>original(typeof input==='string'?offlineAsset(input):input,init);
 // A file:// page and its blob worker have opaque origins. The worker cannot
 // XHR the page's blob:null font URL; a self-contained data URL works in both.
 const font=window.mockupOfflineAssets?.['/offline-font.ttf'];
 configureTextBuilder({defaultFontURL:font?.startsWith('data:')?font:offlineAsset('/fonts/NotoSansSC-VF.ttf')});
}
