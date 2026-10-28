import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const marker='.dino-desktop-assets.json';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

function inside(root,target){
 const absolute=path.resolve(target),relative=path.relative(path.resolve(root),absolute);
 if(!relative||relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative))throw new Error(`Desktop staging path escapes the project: ${absolute}`);
 return absolute;
}

export async function inspectDist(directory){
 const root=path.resolve(directory),files=[];
 const visit=async folder=>{for(const entry of await fs.readdir(folder,{withFileTypes:true})){const absolute=path.join(folder,entry.name);if(entry.isSymbolicLink())throw new Error('Desktop assets must not contain symbolic links.');if(entry.isDirectory())await visit(absolute);else if(entry.isFile()){const bytes=await fs.readFile(absolute);files.push({path:path.relative(root,absolute).split(path.sep).join('/'),size:bytes.length,sha256:hash(bytes)});}}};
 await visit(root);
 const htmlEntry=files.find(file=>file.path==='index.html');
 if(!htmlEntry?.size)throw new Error('Desktop staging requires a nonempty index.html.');
 const html=await fs.readFile(path.join(root,'index.html'),'utf8');
 if(!/<script\b[^>]*\bsrc=/i.test(html))throw new Error('Desktop index.html has no JavaScript entry.');
 for(const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)){
  if(match[1].startsWith('#')||match[1].startsWith('data:'))continue;
  if(/^[a-z]+:/i.test(match[1])||match[1].startsWith('//'))throw new Error('Desktop index.html must use bundled local assets.');
  const relative=decodeURIComponent(match[1].split(/[?#]/)[0]).replace(/^\/+/,''),absolute=inside(root,path.resolve(root,relative));
  const file=files.find(file=>path.resolve(root,file.path)===absolute);
  if(!file?.size)throw new Error(`Desktop index.html references a missing or empty asset: ${relative}`);
 }
 return files.sort((a,b)=>a.path.localeCompare(b.path));
}

export async function stageDesktopAssets(root=projectRoot){
 root=path.resolve(root);
 const source=inside(root,path.join(root,'dist')),destination=inside(root,path.join(root,'desktop-dist'));
 const temporary=inside(root,path.join(root,`desktop-dist.staging-${randomUUID()}`));
 const manifest=await inspectDist(source);
 await fs.mkdir(temporary);
 try{
  for(const entry of manifest){const target=inside(temporary,path.join(temporary,entry.path));await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(path.join(source,entry.path),target);}
  const copied=await inspectDist(temporary),after=await inspectDist(source);
  if(JSON.stringify(copied)!==JSON.stringify(manifest)||JSON.stringify(after)!==JSON.stringify(manifest))throw new Error('Frontend output changed during desktop staging. Retry after the frontend build finishes.');
  // Some Windows filesystems reject directory renames even after handles
  // close. Copy the validated snapshot before Cargo starts, never from the
  // mutable browser dist; replace only a previously marked generated folder.
  const existing=await fs.stat(destination).catch(()=>null);
  if(existing){await fs.access(path.join(destination,marker)).catch(()=>{throw new Error('Refusing to replace a desktop-dist folder without the staging manifest.');});await fs.rm(inside(root,destination),{recursive:true,force:true});}
  await fs.cp(temporary,destination,{recursive:true,errorOnExist:true,force:false});
  const staged=await inspectDist(destination);
  if(JSON.stringify(staged)!==JSON.stringify(manifest))throw new Error('Desktop snapshot failed verification after copying.');
  await fs.writeFile(path.join(destination,marker),JSON.stringify({createdAt:new Date().toISOString(),files:manifest},null,2));
  await fs.rm(inside(root,temporary),{recursive:true,force:true});
  return {directory:destination,files:manifest.length,bytes:manifest.reduce((sum,file)=>sum+file.size,0)};
 }catch(error){await fs.rm(inside(root,temporary),{recursive:true,force:true});throw error;}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 stageDesktopAssets().then(result=>console.log(`Desktop assets staged: ${result.files} files, ${result.bytes} bytes.`)).catch(error=>{console.error(error.message);process.exitCode=1;});
}
