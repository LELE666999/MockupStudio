export function exportSizing(width:number,height:number,quality:'1080p'|'4k'){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('画布尺寸无效');
 const maxLong=quality==='4k'?3840:1920,maxShort=quality==='4k'?2160:1080;
 const dpr=Math.min(maxLong/Math.max(width,height),maxShort/Math.min(width,height));
 return {dpr,longEdge:Math.max(width,height)*dpr};
}
