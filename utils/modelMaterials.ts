// Verified body finishes only: never recolor displays, optics or printed markings.
const finishes:Record<string,string[]>={
 'huawei-user-33889335':['HuaweiBody','HuaweiMetal'],
 'iphone17-':['nwfiSfJrPZRLBAj','hiWLrxfkqoGxruc','YQFhPSFSryEqJMp','sJxAokqqlZYuwzy','SLmJkLdkhbbuEfG','iAKEWdNafBldSCV','ybSvSfarxzoBKlb','SMUhrjUPCjJkPUK','ooxVuxObmmqIeuh','PJgHvfOhNXkxvzq','VXTclbUnoLmmPoD','yPEFElLJTRhfWfw','awYxKfiOpRgQIxD'],
 'iphone18-':['vUgmkmbQjXTaqEc','VHayjpcemEFwuHx','vmHtEpzvjsKvWzR','NTEUvFZCGwiAbXI','crYYDRbonRWlXIT','hGSiEINnkluBUrq','ZKYcumThEAllgKc','yPeTOPaiWwFMSdb','bKCxnOaKtDpUlmo','nuwSyerWvJfhsMd','mEyfsugDbInWtmQ','WElbLmMkunjUugH','IxiedJEUxrDhLIX','DodbyqhrrBLNbcB'],
 'iphone-duo':['pOHYMArkYgGMSvE','eNDiNFhhBNyrPgP','bnbUHmVcBNyhFgl','kUUqfCXsMaJHyje','yakTRrHfzYtGymu','hpXWDkYkMocrDql','nfSKIKcFQpPcaTk','isnmyjbXNQZlHGY','TJvImvzeubEEDzE','MyBIzTBvbXlVjff','lncqqAffdcKCPyc','qMQBeWGUCGfErnO','qsaDpVIHURYREdD','djGRseSgLsvgsjU','oEGeLQAOjZgdIFG'],
};
export function modelFileName(source:string|undefined){return source?.split(/[\\/]/).at(-1)?.split(/[?#]/)[0]??'';}
export const isAppleModel=(source:string|undefined)=>/^iphone(?:17-|18-|-duo\.)/i.test(modelFileName(source));
export function isBodyFinish(source:string|undefined,name:string){
 const entry=Object.entries(finishes).find(([prefix])=>modelFileName(source).startsWith(prefix));
 return !!entry?.[1].includes(name.replace(/\.\d+$/,''));
}
