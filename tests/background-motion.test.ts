import test from 'node:test';
import assert from 'node:assert/strict';
import { startBackgroundMotion } from '../src/lib/background-motion.ts';

function fakeRuntime({reduced=false,context=true,zero=false}:{reduced?:boolean;context?:boolean;zero?:boolean}={}){
 const events=()=>{const listeners=new Map<string,Set<()=>void>>();return {
  addEventListener(type:string,fn:()=>void){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type)!.add(fn);},
  removeEventListener(type:string,fn:()=>void){listeners.get(type)?.delete(fn);},
  emit(type:string){for(const fn of listeners.get(type)??[])fn();},
  count(){return [...listeners.values()].reduce((sum,set)=>sum+set.size,0);}
 };};
 const windowEvents=events(),documentEvents=events(),mediaEvents=events();
 const frames=new Map<number,(timestamp:number)=>void>();let id=0;
 const media={...mediaEvents,matches:reduced};
 const window_={...windowEvents,devicePixelRatio:1,matchMedia:()=>media,requestAnimationFrame(fn:(timestamp:number)=>void){frames.set(++id,fn);return id;},cancelAnimationFrame(handle:number){frames.delete(handle);}};
 const document_={...documentEvents,defaultView:window_,hidden:false,hasFocus:()=>true};
 let bounds={width:zero?0:1280,height:zero?0:720};
 const transforms:number[][]=[],clears:number[][]=[],dimensions:number[]=[];
 const ctx={setTransform(...args:number[]){transforms.push(args);},clearRect(...args:number[]){clears.push(args);}};
 let backingWidth=0,backingHeight=0,resize:()=>void=()=>{},disconnected=false;
 const canvas={ownerDocument:document_,dataset:{motionActive:''},getContext:()=>context?ctx:null,getBoundingClientRect:()=>bounds,
  get width(){return backingWidth;},set width(value:number){dimensions.push(value);backingWidth=value;},
  get height(){return backingHeight;},set height(value:number){dimensions.push(value);backingHeight=value;}
 };
 const runtime=globalThis as unknown as {ResizeObserver?:unknown};const previous=runtime.ResizeObserver;
 runtime.ResizeObserver=class {constructor(callback:()=>void){resize=callback;}observe(){}disconnect(){disconnected=true;}};
 return {canvas:canvas as unknown as HTMLCanvasElement,window_,document_,media,frames,transforms,clears,dimensions,
  setBounds(width:number,height:number){bounds={width,height};resize();},
  resize(){resize();},isDisconnected:()=>disconnected,
  tick(timestamp:number){const ready=[...frames.values()];frames.clear();for(const fn of ready)fn(timestamp);},
  restore(){if(previous===undefined)delete runtime.ResizeObserver;else runtime.ResizeObserver=previous;}
 };
}

test('background draws immediately and unchanged geometry does not reallocate its backing store',()=>{
 const runtime=fakeRuntime();const draws:number[][]=[];let cleanup=()=>{};
 try{
  cleanup=startBackgroundMotion(runtime.canvas,(_ctx,width,height,time)=>draws.push([width,height,time]),false);
  assert.deepEqual(draws,[[1280,720,0]]);assert.deepEqual(runtime.transforms[0],[1,0,0,1,0,0]);
  assert.equal(runtime.frames.size,1);assert.equal(runtime.canvas.dataset.motionActive,'true');
  const allocations=runtime.dimensions.length;runtime.resize();
  assert.equal(runtime.dimensions.length,allocations);assert.equal(draws.length,1);
 }finally{cleanup();runtime.restore();}
});

test('saved and system reduced motion render static scenery without an animation request',()=>{
 for(const saved of [true,false]){
  const runtime=fakeRuntime({reduced:!saved});const times:number[]=[];let cleanup=()=>{};
  try{
   cleanup=startBackgroundMotion(runtime.canvas,(_ctx,_width,_height,time)=>times.push(time),saved);
   assert.deepEqual(times,[0]);assert.equal(runtime.frames.size,0);assert.equal(runtime.canvas.dataset.motionActive,'false');
   runtime.media.matches=false;runtime.media.emit('change');
   assert.equal(runtime.frames.size,saved?0:1);
   if(!saved){runtime.tick(0);runtime.tick(40);assert.ok(times.some(time=>time>0));runtime.media.matches=true;runtime.media.emit('change');assert.equal(times.at(-1),0);assert.equal(runtime.frames.size,0);assert.equal(runtime.canvas.dataset.motionActive,'false');}
  }finally{cleanup();runtime.restore();}
 }
});

test('visible unfocused windows retain the loop and animation phase across blur and focus events',()=>{
 const runtime=fakeRuntime();const times:number[]=[];let cleanup=()=>{};
 try{
  runtime.document_.hasFocus=()=>false;
  cleanup=startBackgroundMotion(runtime.canvas,(_ctx,_width,_height,time)=>times.push(time),false);
  assert.equal(runtime.frames.size,1);assert.equal(runtime.canvas.dataset.motionActive,'true');
  runtime.tick(100);runtime.tick(140);assert.equal(times.at(-1),.04);
  const handle=[...runtime.frames.keys()][0],before=times.length;
  runtime.window_.emit('blur');assert.equal([...runtime.frames.keys()][0],handle);assert.equal(times.length,before);assert.equal(runtime.canvas.dataset.motionActive,'true');
  runtime.tick(180);assert.equal(times.at(-1),.08);
  const nextHandle=[...runtime.frames.keys()][0];runtime.window_.emit('focus');assert.equal([...runtime.frames.keys()][0],nextHandle);
  runtime.tick(220);assert.equal(times.at(-1),.12);
 }finally{cleanup();runtime.restore();}
});

test('hidden documents cancel the loop and resume without counting time spent hidden',()=>{
 const runtime=fakeRuntime();const times:number[]=[];let cleanup=()=>{};
 try{
  cleanup=startBackgroundMotion(runtime.canvas,(_ctx,_width,_height,time)=>times.push(time),false);
  runtime.tick(0);runtime.tick(40);assert.equal(times.at(-1),.04);
  runtime.document_.hidden=true;runtime.document_.emit('visibilitychange');assert.equal(runtime.frames.size,0);assert.equal(runtime.canvas.dataset.motionActive,'false');
  runtime.window_.emit('blur');runtime.window_.emit('focus');assert.equal(runtime.frames.size,0);
  runtime.document_.hidden=false;runtime.document_.emit('visibilitychange');assert.equal(runtime.frames.size,1);assert.equal(runtime.canvas.dataset.motionActive,'true');
  runtime.tick(1000);assert.equal(times.at(-1),.04);runtime.tick(1040);assert.equal(times.at(-1),.08);
  runtime.document_.hidden=true;runtime.document_.emit('visibilitychange');assert.equal(runtime.frames.size,0);
 }finally{cleanup();runtime.restore();}
});

test('high-frequency callbacks keep decorative draws below 30 frames per second',()=>{
 const runtime=fakeRuntime();const times:number[]=[];let cleanup=()=>{};
 try{
  cleanup=startBackgroundMotion(runtime.canvas,(_ctx,_width,_height,time)=>times.push(time),false);
  for(let timestamp=0;timestamp<=1000;timestamp+=5)runtime.tick(timestamp);
  assert.ok(times.length>20);assert.ok(times.length<=31);
  for(let index=1;index<times.length;index++)assert.ok(times[index]-times[index-1]>=1/30-1e-8);
  assert.equal(runtime.frames.size,1);
 }finally{cleanup();runtime.restore();}
});

test('zero and invalid sizes stay idle while large high-DPI surfaces have bounded finite allocation',()=>{
 const runtime=fakeRuntime({zero:true});let cleanup=()=>{};
 try{
  cleanup=startBackgroundMotion(runtime.canvas,()=>{},false);assert.equal(runtime.frames.size,0);assert.equal(runtime.canvas.dataset.motionActive,'false');
  runtime.setBounds(NaN,Infinity);assert.equal(runtime.frames.size,0);
  runtime.window_.devicePixelRatio=4;runtime.setBounds(5120,2880);
  assert.ok(runtime.canvas.width*runtime.canvas.height<=3_000_000);assert.ok(runtime.canvas.width<=8192&&runtime.canvas.height<=8192);
  assert.ok(runtime.transforms.at(-1)![0]<=1.5);assert.ok(Number.isFinite(runtime.transforms.at(-1)![0]));assert.equal(runtime.frames.size,1);
  const oldWidth=runtime.canvas.width;runtime.window_.devicePixelRatio=1;runtime.setBounds(1000,600);assert.notEqual(runtime.canvas.width,oldWidth);assert.equal(runtime.canvas.width,1000);
  runtime.window_.devicePixelRatio=Infinity;runtime.window_.emit('resize');assert.equal(runtime.canvas.width,1000);
  runtime.setBounds(0,600);assert.equal(runtime.frames.size,0);assert.equal(runtime.canvas.dataset.motionActive,'false');
 }finally{cleanup();runtime.restore();}
});

test('cleanup removes every listener, disconnects resize observation and is idempotent',()=>{
 const runtime=fakeRuntime();let draws=0;
 try{
  const cleanup=startBackgroundMotion(runtime.canvas,()=>draws++,false);
  cleanup();cleanup();assert.equal(runtime.frames.size,0);assert.equal(runtime.canvas.dataset.motionActive,'false');assert.equal(runtime.isDisconnected(),true);
  assert.equal(runtime.window_.count()+runtime.document_.count()+runtime.media.count(),0);
  const before=draws;runtime.tick(1000);runtime.resize();runtime.window_.emit('focus');runtime.document_.emit('visibilitychange');runtime.media.emit('change');assert.equal(draws,before);assert.equal(runtime.frames.size,0);
 }finally{runtime.restore();}
});

test('missing contexts and decorative painter errors never escape into the application',()=>{
 for(const missing of [true,false]){
  const runtime=fakeRuntime({context:!missing});let cleanup=()=>{};
  try{
   assert.doesNotThrow(()=>{cleanup=startBackgroundMotion(runtime.canvas,()=>{throw Error('decorative painter unavailable');},false);});
   assert.equal(runtime.frames.size,0);assert.equal(runtime.canvas.dataset.motionActive,'false');
   assert.doesNotThrow(()=>runtime.resize());
  }finally{cleanup();runtime.restore();}
 }
});
