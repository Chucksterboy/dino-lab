import test from 'node:test';
import assert from 'node:assert/strict';
import { drawFossilBlueprint } from '../src/lib/fossil-blueprint.ts';

type Command=readonly unknown[];

/** Canvas protocol checks only: no rasterization, browser or native UI input. */
function frame(width:number,height:number,time:number){
 const commands:Command[]=[],stack:Map<string,unknown>[]=[];
 const initial=new Map<string,unknown>([['globalAlpha',.4],['lineWidth',3],['globalCompositeOperation','xor']]);
 const state=new Map(initial);
 const methods=new Set(['beginPath','rect','clip','moveTo','lineTo','stroke','fillRect','fillText']);
 const record=(name:string,args:unknown[])=>{
  for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),`${name} uses finite coordinates`);
  commands.push([name,...args]);assert.ok(commands.length<850,'fixed bounded drawing work');
 };
 const context=new Proxy({}, {
  get(_target,key){
   const name=String(key);
   if(name==='save')return()=>{record(name,[]);stack.push(new Map(state));};
   if(name==='restore')return()=>{
    record(name,[]);const saved=stack.pop();assert.ok(saved,'balanced restore');
    state.clear();for(const [key,value] of saved)state.set(key,value);
   };
   if(methods.has(name))return(...args:unknown[])=>record(name,args);
   if(name==='createLinearGradient')return(...args:unknown[])=>{
    record(name,args);return {addColorStop(offset:number,color:string){
     assert.ok(offset>=0&&offset<=1);record('addColorStop',[offset,color]);
    }};
   };
   throw new Error(`Unexpected Canvas2D member ${name}`);
  },
  set(_target,key,value){
   const name=String(key);
   if(name==='globalAlpha')assert.ok(Number.isFinite(value)&&value>=0&&value<=1);
   if(name==='lineWidth')assert.ok(Number.isFinite(value)&&value>0);
   if(typeof value==='string')assert.doesNotMatch(value,/NaN|Infinity/);
   record('set',[name,typeof value==='object'?'gradient':value]);state.set(name,value);return true;
  },
 }) as CanvasRenderingContext2D;
 drawFossilBlueprint(context,width,height,time);
 assert.equal(stack.length,0);assert.deepEqual(state,initial,'preserves caller canvas state');
 return commands;
}

test('fossil scanner paints safe bounded frames from tiny through 4K viewports',()=>{
 for(const [width,height] of [[1,1],[772,716],[1440,960],[2560,1440],[3840,2160]]){
  for(const time of [0,.125,12.5,60,1800,Number.MAX_VALUE]){
   const commands=frame(width,height,time);assert.ok(commands.length>100,'complete static instrument layer');
   const clips=commands.filter(command=>command[0]==='rect');
   assert.equal(clips.length,1,'one central illustration clip');
   for(const [index,expected] of [width*.165,height*.025,width*.69,height*.95].entries()){
    assert.ok(Math.abs(Number(clips[0][index+1])-expected)<1e-9,'clip fills the central field and leaves both side motifs intact');
   }
  }
 }
});

test('fossil scanner stays deterministic and moves the scan plane while updating readings',()=>{
 const random=Math.random,now=Date.now;
 Math.random=()=>{throw new Error('no renderer randomness');};Date.now=()=>{throw new Error('only caller clock');};
 try{
  const still=frame(1440,960,0),moving=frame(1440,960,11.5);
  assert.deepEqual(frame(1440,960,0),still);assert.deepEqual(frame(1440,960,11.5),moving);
  assert.notDeepEqual(still.filter(command=>command[0]==='createLinearGradient'),moving.filter(command=>command[0]==='createLinearGradient'),'scan plane traverses central scene');
  assert.notDeepEqual(still.filter(command=>command[0]==='fillText'),moving.filter(command=>command[0]==='fillText'),'decorative coordinates evolve');
 }finally{Math.random=random;Date.now=now;}
});

test('fossil scanner rejects unusable sizes and normalizes unusable clocks to static',()=>{
 for(const invalid of [0,-1,NaN,Infinity,-Infinity]){
  assert.deepEqual(frame(invalid,960,1),[]);assert.deepEqual(frame(1440,invalid,1),[]);
 }
 const still=frame(1440,960,0);
 for(const time of [NaN,Infinity,-Infinity,-1,-Number.MAX_VALUE])assert.deepEqual(frame(1440,960,time),still);
});
