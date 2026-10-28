import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
// @ts-expect-error Node runs this build utility directly; it is intentionally JavaScript.
import {inspectDist,stageDesktopAssets} from '../tools/stage-desktop.mjs';

test('desktop staging rejects missing entry and dangling script references',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'dino-stage-test-'));
 try{
  await assert.rejects(inspectDist(root),/index.html/);
  await fs.writeFile(path.join(root,'index.html'),'<html><script src="/assets/missing.js"></script></html>');
  await assert.rejects(inspectDist(root),/missing or empty asset/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('desktop staging keeps a complete independent snapshot',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'dino-stage-test-'));
 try{
  await fs.mkdir(path.join(root,'dist','assets'),{recursive:true});
  await fs.writeFile(path.join(root,'dist','index.html'),'<html><script src="/assets/app.js"></script></html>');
  await fs.writeFile(path.join(root,'dist','assets','app.js'),'console.log("ready")');
  const result=await stageDesktopAssets(root);assert.equal(result.files,2);
  await fs.writeFile(path.join(root,'dist','assets','app.js'),'changed browser build');
  assert.equal(await fs.readFile(path.join(root,'desktop-dist','assets','app.js'),'utf8'),'console.log("ready")');
  assert.equal((JSON.parse(await fs.readFile(path.join(root,'desktop-dist','.dino-desktop-assets.json'),'utf8'))).files.length,2);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
