import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { UpdateActions, UpdateInstallReading } from '../src/components/UpdateStatus.tsx';
import type { UpdateInstallProgress } from '../src/lib/updates.ts';
import { APP_VERSION, canInstallUpdate, updateInstallCopy, updateStatusCopy } from '../src/lib/updates.ts';
import type { UpdateCheck, UpdateState } from '../src/lib/updates.ts';

const releaseUrl = 'https://github.com/Chucksterboy/dino-lab/releases/tag/v0.2.0';
function report(status: UpdateState, overrides: Partial<UpdateCheck> = {}): UpdateCheck {
  return { status, installerAvailable:false, currentVersion: APP_VERSION, latestVersion: null, releaseUrl: null, releaseName: null, publishedAt: null, message: null, checkedAtUnix: 1793145600, ...overrides };
}

let moduleId = 0;
async function freshModule() {
  const url = new URL('../src/lib/updates.ts', import.meta.url);
  url.searchParams.set('unit', String(++moduleId));
  return import(url.href) as Promise<typeof import('../src/lib/updates.ts')>;
}

async function withRuntime<T>(native: boolean, invoke: (command: string, arguments_: Record<string, unknown>) => unknown, action: () => Promise<T>) {
  const runtime = globalThis as unknown as { isTauri?: boolean; window?: unknown };
  const previousTauri = runtime.isTauri;
  const previousWindow = runtime.window;
  runtime.isTauri = native;
  runtime.window = { __TAURI_INTERNALS__: { invoke } };
  try { return await action(); }
  finally {
    if (previousTauri === undefined) delete runtime.isTauri; else runtime.isTauri = previousTauri;
    if (previousWindow === undefined) delete runtime.window; else runtime.window = previousWindow;
  }
}

test('installed-version label uses the application package version', () => {
  const metadata = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(APP_VERSION, metadata.version);
});

test('only a confirmed current report displays an up-to-date result', () => {
  const unavailableStates: UpdateState[] = ['unpublished', 'unavailable', 'offline', 'rate_limited'];
  for (const status of unavailableStates) {
    const copy = updateStatusCopy(report(status));
    assert.ok(!/up to date|no newer version/i.test(`${copy.heading} ${copy.description}`), status);
    assert.ok(copy.heading.length > 0 && copy.description.length > 0);
  }
  assert.equal(updateStatusCopy(report('current')).heading, 'You’re up to date');
  assert.equal(updateStatusCopy(null).heading, 'Updates');
});

test('available release is named and an in-progress check takes precedence over stale results', () => {
  const available = report('available', { latestVersion: '0.2.0', releaseUrl });
  const copy = updateStatusCopy(available);
  assert.equal(copy.heading, 'New version available');
  assert.ok(copy.description.includes('0.2.0'));
  assert.equal(updateStatusCopy(report('current'), true).heading, 'Checking for updates');
  assert.equal(updateStatusCopy(available, true).heading, 'Checking for updates');
});

test('an unexpected future status falls back to unavailable rather than up-to-date', () => {
  const unknown = report('unavailable');
  unknown.status = 'not-understood' as UpdateState;
  assert.equal(updateStatusCopy(unknown).heading, 'Unable to check for updates');
});

test('simultaneous checks share one native request, and a completed manual check can run again', async () => {
  let resolve!: (value: UpdateCheck) => void;
  const pending = new Promise<UpdateCheck>(complete => { resolve = complete; });
  const calls: string[] = [];
  await withRuntime(true, command => { calls.push(command); return pending; }, async () => {
    const updates = await freshModule();
    const first = updates.checkForUpdates();
    const second = updates.checkForUpdates();
    assert.equal(first, second);
    assert.deepEqual(calls, ['check_for_updates']);
    resolve(report('current', { latestVersion: APP_VERSION }));
    assert.equal((await first).status, 'current');
    await second;
    const next = updates.checkForUpdates();
    assert.notEqual(next, first);
    await next;
    assert.deepEqual(calls, ['check_for_updates', 'check_for_updates']);
  });
});

test('launch request remains cached across StrictMode-style remounts but manual checking remains available', async () => {
  const calls: string[] = [];
  await withRuntime(true, command => { calls.push(command); return Promise.resolve(report('unpublished')); }, async () => {
    const updates = await freshModule();
    const first = updates.checkForUpdatesOnLaunch();
    const replay = updates.checkForUpdatesOnLaunch();
    assert.equal(first, replay);
    await first;
    assert.equal(updates.checkForUpdatesOnLaunch(), first);
    assert.equal(calls.length, 1);
    await updates.checkForUpdates();
    assert.equal(calls.length, 2);
    assert.equal(updates.checkForUpdatesOnLaunch(), first);
  });
});

test('native invocation failure becomes unavailable and never triggers installation', async () => {
  const calls: string[] = [];
  await withRuntime(true, command => { calls.push(command); throw new Error('native command unavailable'); }, async () => {
    const updates = await freshModule();
    const result = await updates.checkForUpdates();
    assert.equal(result.status, 'unavailable');
    assert.equal(result.currentVersion, APP_VERSION);
    assert.ok(Number.isFinite(result.checkedAtUnix));
    assert.equal(updateStatusCopy(result).heading, 'Unable to check for updates');
    assert.deepEqual(calls, ['check_for_updates']);
  });
});

test('browser preview cannot falsely confirm a current release or silently launch a release page', async () => {
  const calls: string[] = [];
  await withRuntime(false, command => { calls.push(command); throw new Error('unexpected native call'); }, async () => {
    const updates = await freshModule();
    assert.equal((await updates.checkForUpdates()).status, 'unavailable');
    await assert.rejects(updates.openUpdateRelease(releaseUrl), /Windows application/);
    assert.deepEqual(calls, []);
  });
});

test('opening a release is a separate explicit command using the exact returned URL', async () => {
  const calls: { command: string; arguments_: Record<string, unknown> }[] = [];
  await withRuntime(true, (command, arguments_) => { calls.push({ command, arguments_ }); return Promise.resolve(); }, async () => {
    const updates = await freshModule();
    assert.deepEqual(calls, []);
    await updates.openUpdateRelease(releaseUrl);
    assert.deepEqual(calls, [{ command: 'open_update_release', arguments_: { url: releaseUrl } }]);
  });
});

interface InstallRuntime {
 calls:{command:string;arguments_:Record<string,unknown>}[];
 emit:(payload:unknown)=>void;
 complete:()=>void;
 fail:(error:unknown)=>void;
 unregisters:number[];
}
async function withInstallRuntime(action:(runtime:InstallRuntime)=>Promise<void>,listenError=false){
 const runtime=globalThis as unknown as {isTauri?:boolean;window?:unknown};
 const oldTauri=runtime.isTauri,oldWindow=runtime.window;
 const calls:InstallRuntime['calls']=[],unregisters:number[]=[];
 const callbacks=new Map<number,(event:unknown)=>void>();let callback=0,registered=0;
 const pending:{resolve:()=>void;reject:(error:unknown)=>void}[]=[];
 runtime.isTauri=true;
 runtime.window={
  __TAURI_INTERNALS__:{
   transformCallback:(handler:(event:unknown)=>void)=>{callbacks.set(++callback,handler);return callback;},
   invoke:(command:string,arguments_:Record<string,unknown>)=>{
    calls.push({command,arguments_});
    if(command==='plugin:event|listen'){
     if(listenError)return Promise.reject(new Error('Listener unavailable'));
     registered=Number(arguments_.handler);return Promise.resolve(71);
    }
    if(command==='plugin:event|unlisten')return Promise.resolve();
    if(command==='install_update')return new Promise<void>((resolve,reject)=>pending.push({resolve,reject}));
    throw new Error(`Unexpected native command: ${command}`);
   },
  },
  __TAURI_EVENT_PLUGIN_INTERNALS__:{unregisterListener:(_event:string,id:number)=>unregisters.push(id)},
 };
 try{
  await action({calls,unregisters,emit:payload=>callbacks.get(registered)?.({event:'update-install-progress',id:71,payload}),complete:()=>{const item=pending.shift();assert.ok(item);item.resolve();},fail:error=>{const item=pending.shift();assert.ok(item);item.reject(error);}});
 }finally{
  if(oldTauri===undefined)delete runtime.isTauri;else runtime.isTauri=oldTauri;
  if(oldWindow===undefined)delete runtime.window;else runtime.window=oldWindow;
 }
}
const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));

test('an available check exposes installation eligibility without triggering installation',async()=>{
 const calls:string[]=[];
 await withRuntime(true,command=>{calls.push(command);return Promise.resolve(report('available',{latestVersion:'0.2.0',releaseUrl,installerAvailable:true}));},async()=>{
  const updates=await freshModule();const result=await updates.checkForUpdates();
  assert.equal(canInstallUpdate(result),true);
  assert.deepEqual(calls,['check_for_updates']);
 });
});

test('explicit installation subscribes first, shares one operation and cleans up progress after handoff',async()=>{
 await withInstallRuntime(async runtime=>{
  const updates=await freshModule();const firstReadings:UpdateInstallProgress[]=[],secondReadings:UpdateInstallProgress[]=[];
  const first=updates.installUpdate('0.2.0',progress=>firstReadings.push(progress));
  await settle();
  assert.deepEqual(runtime.calls.map(item=>item.command),['plugin:event|listen','install_update']);
  assert.deepEqual(runtime.calls[1].arguments_,{expectedVersion:'0.2.0'});
  assert.equal(runtime.calls[0].arguments_.event,'update-install-progress');
  runtime.emit({phase:'downloading',downloadedBytes:4,totalBytes:10});
  const second=updates.installUpdate('0.2.0',progress=>secondReadings.push(progress));
  assert.equal(first,second);
  assert.deepEqual(secondReadings,firstReadings,'a second subscriber receives the current progress');
  for(const malformed of [null,{phase:'unknown',downloadedBytes:0,totalBytes:10},{phase:'downloading',downloadedBytes:-1,totalBytes:10},{phase:'downloading',downloadedBytes:NaN,totalBytes:10}])runtime.emit(malformed);
  assert.equal(firstReadings.length,1,'invalid progress cannot corrupt the display');
  runtime.emit({phase:'verifying',downloadedBytes:12,totalBytes:10});
  runtime.emit({phase:'launching',downloadedBytes:10,totalBytes:10});
  assert.deepEqual(firstReadings.map(item=>item.phase),['downloading','verifying','launching']);
  assert.equal(firstReadings[1].downloadedBytes,10);
  assert.deepEqual(secondReadings,firstReadings);
  assert.equal(runtime.calls.filter(item=>item.command==='install_update').length,1);
  runtime.complete();await first;
  assert.deepEqual(runtime.unregisters,[71]);
  assert.equal(runtime.calls.at(-1)?.command,'plugin:event|unlisten');
 });
});

test('failed preparation removes its listener and permits an explicit retry without closing the app',async()=>{
 await withInstallRuntime(async runtime=>{
  const updates=await freshModule();
  const first=updates.installUpdate('0.2.0');await settle();
  const rejected=assert.rejects(first,/Download failed/);runtime.fail(new Error('Download failed'));await rejected;
  assert.deepEqual(runtime.unregisters,[71]);
  const second=updates.installUpdate('0.2.0');assert.notEqual(first,second);await settle();
  runtime.complete();await second;
  assert.equal(runtime.calls.filter(item=>item.command==='install_update').length,2);
  assert.deepEqual(runtime.unregisters,[71,71]);
  assert.ok(runtime.calls.every(item=>!item.command.includes('close')&&!item.command.includes('exit')),'frontend never closes or minimizes the app');
 });
});

test('progress subscription failure prevents installation and competing versions cannot start together',async()=>{
 await withInstallRuntime(async runtime=>{
  const updates=await freshModule();await assert.rejects(updates.installUpdate('0.2.0'),/Listener unavailable/);
  assert.deepEqual(runtime.calls.map(item=>item.command),['plugin:event|listen']);
 },true);
 await withInstallRuntime(async runtime=>{
  const updates=await freshModule();const pending=updates.installUpdate('0.2.0');await settle();
  await assert.rejects(updates.installUpdate('0.3.0'),/already being prepared/);
  runtime.complete();await pending;
  assert.equal(runtime.calls.filter(item=>item.command==='install_update').length,1);
 });
});

test('browser and malformed-version calls cannot begin a download or native handoff',async()=>{
 await withRuntime(false,()=>{throw new Error('unexpected command');},async()=>{
  const updates=await freshModule();await assert.rejects(updates.installUpdate('0.2.0'),/Windows application/);
 });
 await withInstallRuntime(async runtime=>{
  const updates=await freshModule();
  for(const invalid of ['',releaseUrl,'../installer.exe','0.2','0.2.0 --exit','01.2.3','0.2.0-rc.1','0.2.0+','0.2.0+build..1','0.2.0+win_x64'])await assert.rejects(updates.installUpdate(invalid),/Check again/);
  assert.equal(runtime.calls.length,0);
  const stableBuild=updates.installUpdate('0.2.0+windows.010');await settle();
  assert.deepEqual(runtime.calls.find(item=>item.command==='install_update')?.arguments_,{expectedVersion:'0.2.0+windows.010'});
  runtime.complete();await stableBuild;
 });
});

test('Update now is offered only for a newer installable release and preparation disables conflicting controls',()=>{
 const callbacks={onCheck:()=>{},onInstall:()=>{},onViewRelease:()=>{}};
 const render=(result:UpdateCheck,installing=false)=>renderToStaticMarkup(createElement(UpdateActions,{result,checking:false,installing,opening:false,...callbacks}));
 const eligible=report('available',{latestVersion:'0.2.0',releaseUrl,installerAvailable:true});
 assert.equal(canInstallUpdate(eligible),true);
 assert.match(render(eligible),/>Update now<\/button>/);
 for(const state of ['current','unavailable','offline','unpublished','rate_limited'] as const){
  const result=report(state,{latestVersion:'0.2.0',releaseUrl,installerAvailable:true});
  assert.equal(canInstallUpdate(result),false,state);assert.doesNotMatch(render(result),/>Update now<\/button>/);
 }
 const noInstaller=report('available',{latestVersion:'0.2.0',releaseUrl,installerAvailable:false});
 assert.doesNotMatch(render(noInstaller),/>Update now<\/button>/);
 assert.match(render(noInstaller),/>View release</);
 assert.doesNotMatch(render(eligible,true),/<button(?![^>]*disabled)[^>]*>/,'all conflicting actions are disabled during preparation');
});

test('download, verification and handoff have distinct accessible progress states',()=>{
 const download:UpdateInstallProgress={phase:'downloading',downloadedBytes:5,totalBytes:10};
 const html=renderToStaticMarkup(createElement(UpdateInstallReading,{progress:download}));
 assert.match(html,/role="status"/);assert.match(html,/aria-live="polite"/);assert.match(html,/50%/);assert.match(html,/value="50"/);
 assert.equal(updateInstallCopy(download).heading,'Downloading update');
 assert.equal(updateInstallCopy({...download,phase:'verifying'}).heading,'Verifying installer');
 assert.equal(updateInstallCopy({...download,phase:'launching'}).heading,'Opening installer');
 const connecting=renderToStaticMarkup(createElement(UpdateInstallReading,{progress:{...download,totalBytes:0,downloadedBytes:0}}));
 assert.match(connecting,/Connecting/);assert.doesNotMatch(connecting,/value=/);
});
