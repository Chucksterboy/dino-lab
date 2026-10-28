import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const names=['allosaurus','austroraptor','beipiaosaurus','carnotaurus','ceratosaurus','deinosuchus','diabloceratops','dilophosaurus','dryosaurus','gallimimus','herrerasaurus','hypsilophodon','kentrosaurus','maiasaura','omniraptor','pachycephalosaurus','pteranodon','stegosaurus','tenontosaurus','triceratops','troodon','tyrannosaurus'];
await mkdir(path.join(root,'public','art'),{recursive:true});
const manifest=[];
for(const id of names){
 const pageUrl=`https://efg.io.vn/playables/${id}?lang=en`;
 const response=await fetch(pageUrl);
 if(!response.ok) throw new Error(`${id} page ${response.status}`);
 const html=await response.text();
 const tags=[...html.matchAll(/<img\b[^>]*>/g)].map(x=>x[0]);
 const tag=tags.find(x=>x.includes('dino-art-fullbody')&&x.includes(`/individual/${id}.`));
 const src=tag?.match(/src="([^"]+)"/)?.[1];
 if(!src) throw new Error(`No verified picture for ${id}`);
 const url=new URL(src,pageUrl).href;
 const img=await fetch(url);if(!img.ok) throw new Error(`${id} art ${img.status}`);
 await writeFile(path.join(root,'public','art',`${id}.webp`),new Uint8Array(await img.arrayBuffer()));
 manifest.push({id,path:`/art/${id}.webp`,source:pageUrl,imageUrl:url,credit:'Evrima Field Guide · EVRIMA species artwork',retrievedAt:new Date().toISOString()});
 console.log(id);
}
await writeFile(path.join(root,'src','art-manifest.json'),JSON.stringify(manifest,null,2));
