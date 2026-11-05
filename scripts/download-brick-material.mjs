// Refresh this one CC0 asset only. No runtime internet dependency.
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const id='rough_concrete',directory=`public/materials/${id}`;
const metadata=await fetch(`https://api.polyhaven.com/files/${id}`);
if(!metadata.ok)throw Error(`Poly Haven metadata: ${metadata.status}`);
const files=await metadata.json();await mkdir(directory,{recursive:true});
let height;
for(const [channel,name,resolution,format] of [['Diffuse','color','1k','jpg'],['nor_gl','normal','2k','jpg'],['Rough','roughness','1k','jpg'],['AO','ao','1k','jpg'],['Displacement','height','1k','png']]){
 const source=files[channel][resolution][format],response=await fetch(source.url);
 if(!response.ok)throw Error(`${source.url}: ${response.status}`);
 const bytes=Buffer.from(await response.arrayBuffer());
 if(createHash('md5').update(bytes).digest('hex')!==source.md5)throw Error('Texture checksum mismatch');
 await writeFile(`${directory}/${name}.${format}`,bytes);
 if(channel==='Displacement')height=bytes;
 console.log(`${name}.${format}: ${bytes.length} bytes, verified ${source.md5}`);
}
// A small, filtered height field is sufficient for real silhouette relief.
// The original 16-bit PNG is retained; fine detail uses the full 2K normal.
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 const pixels=await page.evaluate(async data=>{
  const image=new Image();image.src=data;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const context=canvas.getContext('2d');context.drawImage(image,0,0,256,256);
  const rgba=context.getImageData(0,0,256,256).data;
  return Array.from({length:256*256},(_,i)=>rgba[i*4]);
 },`data:image/png;base64,${height.toString('base64')}`);
 await writeFile(`${directory}/height.bin`,Buffer.from(pixels));
 console.log('Filtered 256 × 256 displacement field generated.');
}finally{await browser.close();}
