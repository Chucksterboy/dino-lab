import test from 'node:test';
import assert from 'node:assert/strict';
import { drawEmeraldBackground } from '../src/lib/emerald-background.ts';

type Command=readonly unknown[];
type FakeGradient={readonly gradientId:number;addColorStop:(offset:number,color:string)=>void};

function validateColor(color:string){
 assert.doesNotMatch(color,/NaN|Infinity/,'paint colors must not contain invalid arithmetic');
 const rgba=color.match(/^rgba\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.eE+-]+)\s*\)$/);
 if(!rgba)return;
 const channels=rgba.slice(1,4).map(Number),alpha=Number(rgba[4]);
 assert.ok(channels.every(value=>Number.isFinite(value)&&value>=0&&value<=255),'valid RGB channels');
 assert.ok(Number.isFinite(alpha)&&alpha>=0&&alpha<=1,'valid paint alpha');
}

/** A Canvas2D protocol recorder, without rasterization, DOM or a browser. */
function recordingContext(){
 const commands:Command[]=[];
 const initial=new Map<string,unknown>([['globalAlpha',.37],['lineWidth',7],['fillStyle','#123456'],['strokeStyle','#654321'],['globalCompositeOperation','xor']]);
 const state=new Map(initial),stack:Map<string,unknown>[]=[];
 let gradientCount=0,operations=0,maxDepth=0;
 const drawMethods=new Set(['beginPath','rect','clip','moveTo','lineTo','stroke','fillRect','arc','fill','translate','rotate','fillText','clearRect','setTransform']);
 const normalize=(value:unknown)=>typeof value==='object'&&value!==null&&'gradientId' in value?['gradient',(value as FakeGradient).gradientId]:value;
 const record=(name:string,args:unknown[])=>{
  for(const argument of args)if(typeof argument==='number')assert.ok(Number.isFinite(argument),`${name} received a finite numeric argument`);
  commands.push([name,...args.map(normalize)]);
  assert.ok(commands.length<12000,'a frame has a bounded command/paint allocation budget');
 };
 const makeGradient=(kind:string,args:number[]):FakeGradient=>{
  operations++;record(kind,args);
  if(kind==='createRadialGradient')assert.ok(args[2]>=0&&args[5]>=0,'nonnegative gradient radii');
  const gradientId=gradientCount++;
  return {gradientId,addColorStop(offset,color){
   assert.ok(Number.isFinite(offset)&&offset>=0&&offset<=1,'gradient stops stay in range');validateColor(color);
   record('addColorStop',[gradientId,offset,color]);
  }};
 };
 const context=new Proxy({}, {
  get(_target,property){
   const name=String(property);
   if(state.has(name))return state.get(name);
   if(name==='save')return()=>{operations++;record(name,[]);stack.push(new Map(state));maxDepth=Math.max(maxDepth,stack.length);};
   if(name==='restore')return()=>{
    operations++;record(name,[]);const saved=stack.pop();assert.ok(saved,'restore must have a matching save');
    state.clear();for(const [key,value] of saved)state.set(key,value);
   };
   if(name==='createLinearGradient'||name==='createRadialGradient')return(...args:number[])=>makeGradient(name,args);
   if(drawMethods.has(name))return(...args:unknown[])=>{
    operations++;record(name,args);
    if(name==='arc')assert.ok((args[2] as number)>=0,'nonnegative arc radius');
    if(name==='fillText')assert.doesNotMatch(String(args[0]),/NaN|Infinity/,'decorative text remains numeric-safe');
   };
   throw new Error(`Unsupported Canvas2D protocol member: ${name}`);
  },
  set(_target,property,value){
   const name=String(property);
   if(typeof value==='number')assert.ok(Number.isFinite(value),`${name} paint value is finite`);
   if(name==='globalAlpha')assert.ok(value>=0&&value<=1,'global alpha stays in range');
   if(name==='lineWidth')assert.ok(value>0,'positive line width');
   if((name==='fillStyle'||name==='strokeStyle')&&typeof value==='string')validateColor(value);
   record('set',[name,value]);state.set(name,value);return true;
  },
 }) as CanvasRenderingContext2D;
 return {context,commands,state,initial,stack,get operations(){return operations;},get maxDepth(){return maxDepth;}};
}

function render(width:number,height:number,time:number){
 const recording=recordingContext();drawEmeraldBackground(recording.context,width,height,time);
 assert.equal(recording.stack.length,0,'all saved drawing states are restored');
 assert.deepEqual(recording.state,recording.initial,'caller paint/compositing state survives a frame');
 return recording;
}

test('emerald frames use finite geometry, valid alpha and balanced context at desktop and narrow viewport sizes',()=>{
 for(const [width,height] of [[1100,760],[772,716],[1440,960],[2560,1440],[3840,2160],[1,1]]){
  for(const time of [0,.125,27.5,1800]){
   const frame=render(width,height,time);
   assert.ok(frame.operations>0,'a positive viewport paints a complete frame');
   assert.ok(frame.maxDepth<=8,'nested state remains shallow');
  }
 }
});

test('emerald rendering is deterministic from dimensions/time and animated geometry changes across time',()=>{
 const random=Math.random,now=Date.now;
 Math.random=()=>{throw new Error('renderer must use deterministic scene data');};
 Date.now=()=>{throw new Error('renderer must use only caller-provided time');};
 try{
  const still=render(1440,960,0).commands;
  assert.deepEqual(render(1440,960,0).commands,still,'static/reduced-motion draws are stable');
  const moving=render(1440,960,19.75).commands;
  assert.deepEqual(render(1440,960,19.75).commands,moving,'repeated moving frames are stable');
  const geometry=(commands:Command[])=>commands.filter(command=>['arc','lineTo','moveTo','translate','rotate'].includes(command[0] as string));
  assert.notDeepEqual(geometry(still),geometry(moving),'motion changes geometric positions as well as displayed telemetry');
 }finally{Math.random=random;Date.now=now;}
});

test('emerald invalid sizes do no canvas work and extreme clock inputs stay finite and bounded',()=>{
 for(const invalid of [0,-1,NaN,Infinity,-Infinity]){
  for(const [width,height] of [[invalid,760],[1100,invalid]]){
   const frame=render(width,height,1);assert.equal(frame.commands.length,0);
  }
 }
 const still=render(1100,760,0).commands;
 for(const time of [NaN,Infinity,-Infinity,-Number.MAX_VALUE])assert.deepEqual(render(1100,760,time).commands,still,'unusable/backwards clocks fall back to a static frame');
 for(const time of [Number.MAX_SAFE_INTEGER,Number.MAX_VALUE]){
  const frame=render(3840,2160,time);assert.ok(frame.operations<5000,'extreme clocks cannot expand scene work');
 }
});

test('emerald frame work stays within a fixed budget through 4K without clearing or rescaling the caller canvas',()=>{
 const sizes=[[772,716],[1100,760],[2560,1440],[3840,2160]];
 for(const [width,height] of sizes){
  const frame=render(width,height,34.5);
  assert.ok(frame.operations<5000,`${width}×${height} fits the fixed frame budget`);
  assert.ok(frame.commands.length<8000,'paint changes and gradients also stay bounded');
  assert.ok(!frame.commands.some(command=>command[0]==='clearRect'||command[0]==='setTransform'),'caller owns clear and DPR scaling');
 }
});
