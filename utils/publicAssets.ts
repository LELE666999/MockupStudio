/** Keep portable source names in state; add the hosting prefix at transport. */
export function publicAsset(url:string,base:string){
 if(!/^\/(?:models\/|materials\/|scenes\/|environments\/|fonts\/|favicon\.svg|potsdamer_platz_1k\.hdr)/.test(url))return url;
 return new URL(url.slice(1),base).href;
}
export function usesLocalWorkspace(protocol:string,hostname:string){
 return protocol!=='file:'&&['localhost','127.0.0.1','[::1]'].includes(hostname);
}
