// Optional maintenance script. The application uses checked-in, offline maps.
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
for(const id of process.argv.slice(2).length?process.argv.slice(2):['rock_01','concrete_floor_01','rough_linen']){
 const response=await fetch(`https://api.polyhaven.com/files/${id}`);
 if(!response.ok)throw Error(`Poly Haven metadata: ${response.status}`);
 const files=await response.json();
 await mkdir(`public/materials/${id}`,{recursive:true});
 for(const [channel,name] of [['Diffuse','color'],['nor_gl','normal'],['Rough','roughness']]){
  const source=files[channel]['1k'].jpg;
  const response=await fetch(source.url);if(!response.ok)throw Error(`${source.url}: ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(createHash('md5').update(bytes).digest('hex')!==source.md5)throw Error('Texture checksum mismatch');
  await writeFile(`public/materials/${id}/${name}.jpg`,bytes);
  console.log(`${id}/${name}.jpg ${bytes.length} bytes — checksum verified`);
 }
}
