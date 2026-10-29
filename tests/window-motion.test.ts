import test from 'node:test';
import assert from 'node:assert/strict';
import { watchWindowMotion } from '../src/lib/window-motion.ts';
import type { MotionWindow, WindowMotionEnvironment } from '../src/lib/window-motion.ts';

const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return{promise,resolve};}
function fakeDocument(){
 const listeners=new Set<()=>void>();
 return{hidden:false,addEventListener(_type:string,listener:()=>void){listeners.add(listener);},removeEventListener(_type:string,listener:()=>void){listeners.delete(listener);},emit(){for(const listener of listeners)listener();},count:()=>listeners.size};
}
function nativeFixture(){
 const doc=fakeDocument(),resizes=new Set<()=>void>(),focuses=new Set<()=>void>();
 const state={minimized:false,visible:true,queryFails:false,subscribeFails:false};
 const native:MotionWindow={
  async isMinimized(){if(state.queryFails)throw Error('native read unavailable');return state.minimized;},
  async isVisible(){if(state.queryFails)throw Error('native read unavailable');return state.visible;},
  async onResized(handler){if(state.subscribeFails)throw Error('resize listener unavailable');resizes.add(handler);return()=>{resizes.delete(handler);};},
  async onFocusChanged(handler){if(state.subscribeFails)throw Error('focus listener unavailable');focuses.add(handler);return()=>{focuses.delete(handler);};},
 };
 const environment={document:doc,nativeWindow:native} as unknown as WindowMotionEnvironment;
 return{doc,state,native,environment,resize(){for(const handler of resizes)handler();},blur(){for(const handler of focuses)handler();},nativeListeners:()=>resizes.size+focuses.size};
}

test('browser visibility pauses only while the document is hidden and removes its listener',()=>{
 const doc=fakeDocument(),states:boolean[]=[];
 const cleanup=watchWindowMotion(paused=>states.push(paused),{document:doc} as unknown as WindowMotionEnvironment);
 assert.deepEqual(states,[false]);
 doc.emit();assert.deepEqual(states,[false]);
 doc.hidden=true;doc.emit();assert.deepEqual(states,[false,true]);
 doc.hidden=false;doc.emit();assert.deepEqual(states,[false,true,false]);
 cleanup();cleanup();assert.equal(doc.count(),0);
 doc.hidden=true;doc.emit();assert.deepEqual(states,[false,true,false]);
});

test('native focus loss leaves a visible window animated; minimize and tray hiding pause until restored',async()=>{
 const fixture=nativeFixture(),states:boolean[]=[];
 const cleanup=watchWindowMotion(paused=>states.push(paused),fixture.environment);
 try{
  await flush();assert.deepEqual(states,[false]);
  fixture.blur();await flush();assert.deepEqual(states,[false],'focus loss cannot pause a visible native window');
  fixture.state.minimized=true;fixture.resize();await flush();assert.deepEqual(states,[false,true]);
  fixture.state.minimized=false;fixture.resize();await flush();assert.deepEqual(states,[false,true,false]);
  fixture.state.visible=false;fixture.blur();await flush();assert.deepEqual(states,[false,true,false,true]);
  fixture.state.visible=true;fixture.blur();await flush();assert.deepEqual(states,[false,true,false,true,false]);
 }finally{cleanup();}
 assert.equal(fixture.nativeListeners(),0);assert.equal(fixture.doc.count(),0);
});

test('a stale native read cannot undo a newer minimized state',async()=>{
 const fixture=nativeFixture(),states:boolean[]=[];
 const cleanup=watchWindowMotion(paused=>states.push(paused),fixture.environment);
 try{
  await flush();
  const reads:{minimized:ReturnType<typeof deferred<boolean>>;visible:ReturnType<typeof deferred<boolean>>}[]=[];
  fixture.native.isMinimized=()=>{const read={minimized:deferred<boolean>(),visible:deferred<boolean>()};reads.push(read);return read.minimized.promise;};
  fixture.native.isVisible=()=>reads.at(-1)!.visible.promise;
  fixture.blur();fixture.resize();assert.equal(reads.length,2);
  reads[1].minimized.resolve(true);reads[1].visible.resolve(true);await flush();
  assert.deepEqual(states,[false,true]);
  reads[0].minimized.resolve(false);reads[0].visible.resolve(true);await flush();
  assert.deepEqual(states,[false,true]);
 }finally{cleanup();}
});

test('late subscriptions and native reads are cleaned up without callbacks after disposal',async()=>{
 const doc=fakeDocument(),states:boolean[]=[];
 const resize=deferred<()=>void>(),focus=deferred<()=>void>(),minimized=deferred<boolean>(),visible=deferred<boolean>();
 let removed=0;
 const native:MotionWindow={isMinimized:()=>minimized.promise,isVisible:()=>visible.promise,onResized:()=>resize.promise,onFocusChanged:()=>focus.promise};
 const cleanup=watchWindowMotion(paused=>states.push(paused),{document:doc,nativeWindow:native} as unknown as WindowMotionEnvironment);
 cleanup();cleanup();assert.equal(doc.count(),0);
 resize.resolve(()=>{removed++;});focus.resolve(()=>{removed++;});minimized.resolve(true);visible.resolve(false);
 await flush();assert.equal(removed,2);assert.deepEqual(states,[]);
});

test('failed native queries and subscriptions fall back to current document visibility without rejection',async()=>{
 const fixture=nativeFixture(),states:boolean[]=[];
 fixture.state.queryFails=true;fixture.state.subscribeFails=true;
 const cleanup=watchWindowMotion(paused=>states.push(paused),fixture.environment);
 try{
  await flush();assert.deepEqual(states,[false]);
  fixture.doc.hidden=true;fixture.doc.emit();await flush();assert.deepEqual(states,[false,true]);
  fixture.doc.hidden=false;fixture.doc.emit();await flush();assert.deepEqual(states,[false,true,false]);
 }finally{cleanup();}
 assert.equal(fixture.doc.count(),0);
});
