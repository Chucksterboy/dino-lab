import test from 'node:test';
import assert from 'node:assert/strict';
import { Children, createElement, isValidElement } from 'react';
import type { ChangeEvent, ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CombatArena, CombatantCard } from '../src/components/CombatArena.tsx';
import { CombatHealth, CombatMutations } from '../src/components/CombatMutations.tsx';
import { getSample, getSpecies, playableSpecies } from '../src/data/index.ts';
import { artFor } from '../src/lib/ui.ts';

type Action={aria?:string;id?:string;value?:string;checked?:boolean;blur?:boolean;normalized?:string};
type ArenaProps=Parameters<typeof CombatArena>[0];

// Exercise the real selection handlers and their React state updates. The
// portrait, health and mutation children are stateless control components.
function renderArena(actions:Action[]=[],props:ArenaProps={}){
 let step=0;
 function find(element:ReactElement,action:Action):ReactElement<Record<string,unknown>>|undefined{
  const elementProps=element.props as Record<string,unknown>;
  if(action.aria&&elementProps['aria-label']===action.aria||action.id&&elementProps.id===action.id)return element as ReactElement<Record<string,unknown>>;
  let nested:ReactElement|undefined;
  if(element.type===CombatantCard)nested=CombatantCard(element.props as Parameters<typeof CombatantCard>[0]);
  if(element.type===CombatHealth)nested=CombatHealth(element.props as Parameters<typeof CombatHealth>[0]);
  if(element.type===CombatMutations)nested=CombatMutations(element.props as Parameters<typeof CombatMutations>[0]);
  if(nested){const found=find(nested,action);if(found)return found;}
  for(const child of Children.toArray(elementProps.children as ReactNode))if(isValidElement(child)){
   const found=find(child,action);if(found)return found;
  }
  return undefined;
 }
 function Probe(){
  const tree=CombatArena(props);
  if(step<actions.length){
   const action=actions[step++],control=find(tree,action);
   assert.ok(control,`Actual arena control exists: ${action.aria??action.id}`);
   if(action.blur){
    assert.equal(control.props.onChange,undefined,'exact entry waits for blur so an unfinished number cannot be clamped per keystroke');
    const currentTarget={value:action.value??''};
    (control.props.onBlur as (event:{currentTarget:{value:string}})=>void)({currentTarget});
    if(action.normalized!==undefined)assert.equal(currentTarget.value,action.normalized,'blur also normalizes the displayed input');
   }else (control.props.onChange as (event:ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>void)({target:{value:action.value,checked:action.checked}} as ChangeEvent<HTMLInputElement|HTMLSelectElement>);
  }
  return tree;
 }
 const markup=renderToStaticMarkup(createElement(Probe));
 assert.equal(step,actions.length,'all requested control handlers ran');
 return markup;
}

function input(markup:string,label:string){
 const tag=[...markup.matchAll(/<input\b[^>]*>/g)].map(match=>match[0]).find(tag=>tag.includes(`aria-label="${label}"`));
 assert.ok(tag,`${label} input exists`);return tag;
}
function selected(markup:string,label:string){
 const select=[...markup.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)].find(match=>match[1].includes(`aria-label="${label}"`));
 assert.ok(select,`${label} select exists`);
 const option=select[2].match(/<option\b([^>]*\bselected=""[^>]*)>([^<]+)<\/option>/);
 assert.ok(option,`${label} has a selected option`);
 return option[1].match(/\bvalue="([^"]*)"/)?.[1]??option[2];
}
function reading(markup:string,label:string){
 const value=markup.match(new RegExp(`<strong\\b[^>]*aria-label="${label}"[^>]*>([^<]+)<\\/strong>`))?.[1];
 assert.ok(value,`${label} reading exists`);return Number(value.replaceAll(',',''));
}
const number=(value:string|undefined)=>Number(value?.replaceAll(',',''));
const yourDamage=(markup:string)=>number(markup.match(/Your damage \/ hit<\/span><strong[^>]*>([^<]+)<\/strong>/)?.[1]);
const theirDamage=(markup:string)=>number(markup.match(/First damage: ([\d.,]+)/)?.[1]);

test('the standalone arena starts with two complete portrait and health panels and every retained dinosaur',()=>{
 const markup=renderArena();
 assert.ok(markup.includes('<h1>Combat Arena'));
 assert.equal(selected(markup,'Your species'),'allosaurus');
 assert.equal(selected(markup,'Target species'),'triceratops');
 for(const side of ['Your','Target']){
  assert.equal(selected(markup,`${side} condition`),'Prime');
  assert.match(input(markup,`${side} growth percentage`),/value="75"/);
  assert.match(input(markup,`${side} starting health percentage`),/value="100"/);
  assert.equal((markup.match(new RegExp(`aria-label="${side} starting health percentage"`,'g'))??[]).length,1,'the health slider appears once per combatant');
  assert.ok(markup.indexOf(`aria-label="${side} starting health percentage"`)<markup.indexOf('<h2>Attack analysis</h2>'),'health controls precede attack results and mutation choices');
  const select=[...markup.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)].find(match=>match[1].includes(`aria-label="${side} species"`))!;
  for(const specimen of playableSpecies)assert.ok(select[2].includes(`value="${specimen.id}"`),`${side} can choose ${specimen.name}`);
  assert.doesNotMatch(select[2],/BabyBoar|BabyDeer|BabyGoat/);
 }
 assert.equal((markup.match(/ species artwork"/g)??[]).length,2,'both combatants have shared dinosaur artwork');
 assert.equal(yourDamage(markup),175);
 assert.equal(theirDamage(markup),900);
});

test('species, growth, condition, health and shared artwork update independently for both combatants',()=>{
 const actions:Action[]=[
  {aria:'Your species',value:'gallimimus'},
  {aria:'Your growth percentage',value:'88'},
  {aria:'Your condition',value:'Frail'},
  {aria:'Your starting health percentage',value:'49'},
 ];
 const yours=renderArena(actions);
 assert.equal(selected(yours,'Target species'),'triceratops');
 assert.equal(selected(yours,'Target condition'),'Prime');
 assert.match(input(yours,'Target growth percentage'),/value="75"/);
 assert.match(input(yours,'Target starting health percentage'),/value="100"/);

 const markup=renderArena([...actions,
  {aria:'Target species',value:'ceratosaurus'},
  {aria:'Target growth percentage',value:'40'},
  {aria:'Target condition',value:'Frail'},
  {aria:'Target starting health percentage',value:'20'},
 ]);
 assert.equal(selected(markup,'Your species'),'gallimimus');
 assert.equal(selected(markup,'Your condition'),'Frail');
 assert.match(input(markup,'Your growth percentage'),/value="88"/);
 assert.match(input(markup,'Your starting health percentage'),/value="49"/);
 assert.equal(selected(markup,'Target species'),'ceratosaurus');
 assert.equal(selected(markup,'Target condition'),'Frail');
 assert.match(input(markup,'Target growth percentage'),/value="40"/);
 assert.match(input(markup,'Target starting health percentage'),/value="20"/);
 for(const name of ['Gallimimus','Ceratosaurus']){
  const specimen=getSpecies(name)!;
  const portrait=[...markup.matchAll(/<img\b[^>]*>/g)].map(match=>match[0]).find(tag=>tag.includes(`alt="${name} species artwork"`));
  assert.ok(portrait?.includes(`src="${artFor(specimen)}"`),`${name} uses the same image resolver as the species library`);
 }
 assert.ok(!markup.includes('alt="Allosaurus species artwork"'));
 assert.ok(!markup.includes('alt="Triceratops species artwork"'));
 const yourSample=getSample('gallimimus',88,'Frail')!,targetSample=getSample('ceratosaurus',40,'Frail')!;
 const outgoing=yourSample.values.bite!*.9875,incoming=targetSample.values.bite!*.625;
 assert.ok(Math.abs(yourDamage(markup)-outgoing)<=.00501);
 assert.ok(Math.abs(theirDamage(markup)-incoming)<=.00501);
 assert.ok(Math.abs(reading(markup,'Your health-adjusted bite force')-outgoing)<=.00501);
 assert.ok(Math.abs(reading(markup,'Target health-adjusted bite force')-incoming)<=.00501);
 assert.equal(number(markup.match(/Hits to defeat Ceratosaurus<\/span><strong[^>]*>([^<]+)<\/strong>/)?.[1]),Math.ceil(targetSample.values.weight!*.2/outgoing));
 assert.equal(number(markup.match(/Their selected hits to defeat you<\/span><strong[^>]*>([^<]+)<\/strong>/)?.[1]),Math.ceil(yourSample.values.weight!*.49/incoming));
});

test('both growth inputs respect their own source limits while wildlife retains a fixed reference',()=>{
 const bounded=renderArena([
  {aria:'Your exact growth percentage',value:'-5',blur:true,normalized:'25'},
  {aria:'Target exact growth percentage',value:'105',blur:true,normalized:'100'},
 ]);
 assert.match(input(bounded,'Your growth percentage'),/value="25"/);
 assert.match(input(bounded,'Target growth percentage'),/value="100"/);
 const workbook=renderArena([
  {aria:'Your species',value:'hypsilophodon'},
  {aria:'Your exact growth percentage',value:'0',blur:true,normalized:'0'},
 ]);
 assert.match(input(workbook,'Your growth percentage'),/min="0"/);
 assert.match(input(workbook,'Your growth percentage'),/value="0"/);
 const changed=renderArena([
  {aria:'Your species',value:'hypsilophodon'},
  {aria:'Your exact growth percentage',value:'0',blur:true,normalized:'0'},
  {aria:'Your species',value:'allosaurus'},
  {aria:'Target species',value:'boar'},
 ]);
 assert.match(input(changed,'Your growth percentage'),/value="25"/);
 assert.equal(selected(changed,'Target species'),'boar');
 assert.ok(changed.includes('100% · Fixed reference'));
 assert.ok(!changed.includes('aria-label="Target growth percentage"'));
 assert.equal(theirDamage(changed),40,'wildlife retains its known flat attack');
});

test('exact growth commits complete numbers on blur, restores empty entries and preserves workbook fractions',()=>{
 for(const side of ['Your','Target']){
  const markup=renderArena([
   {aria:`${side} exact growth percentage`,value:'40',blur:true,normalized:'40'},
   {aria:`${side} exact growth percentage`,value:'',blur:true,normalized:'40'},
  ]);
  assert.match(input(markup,`${side} growth percentage`),/value="40"/);
  assert.match(input(markup,`${side} exact growth percentage`),/value="40"/);
  const other=side==='Your'?'Target':'Your';
  assert.match(input(markup,`${other} growth percentage`),/value="75"/,'the other combatant remains unchanged');
 }
 const fractional=renderArena([
  {aria:'Your species',value:'hypsilophodon'},
  {aria:'Your exact growth percentage',value:'87.51',blur:true,normalized:'87.51'},
 ]);
 assert.match(input(fractional,'Your exact growth percentage'),/value="87\.51"/);
 assert.match(input(fractional,'Your growth percentage'),/value="87\.51"/);
 assert.match(input(fractional,'Your growth percentage'),/step="any"/,'the workbook range does not round exact fractional keyframes');
});

test('changing either species clears its own mutations and health without leaving an opposing size defense',()=>{
 const yours=renderArena([
  {aria:'Your Hemomania',checked:true},
  {aria:'Your starting health percentage',value:'10'},
  {aria:'Target Congenital Hypoalgesia',checked:true},
  {aria:'Target opponent is a larger species',checked:true},
  {aria:'Target bleeding',checked:true},
  {aria:'Your species',value:'carnotaurus'},
 ]);
 assert.doesNotMatch(input(yours,'Your Hemomania'),/checked/);
 assert.match(input(yours,'Your starting health percentage'),/value="100"/);
 assert.match(input(yours,'Target Congenital Hypoalgesia'),/checked/,'the other combatant retains its mutation selection');
 assert.match(input(yours,'Target bleeding'),/checked/);
 assert.doesNotMatch(input(yours,'Target opponent is a larger species'),/checked/,'species-size assumptions are cleared when the opponent changes');
 assert.equal(yourDamage(yours),getSample('carnotaurus',75,'Prime')!.values.bite);

 const target=renderArena([
  {aria:'Target species',value:'ceratosaurus'},
  {aria:'Target Hemomania',checked:true},
  {aria:'Target starting health percentage',value:'10'},
  {aria:'Your Congenital Hypoalgesia',checked:true},
  {aria:'Your opponent is a larger species',checked:true},
  {aria:'Your bleeding',checked:true},
  {aria:'Target species',value:'carnotaurus'},
 ]);
 assert.doesNotMatch(input(target,'Target Hemomania'),/checked/);
 assert.match(input(target,'Target starting health percentage'),/value="100"/);
 assert.match(input(target,'Your Congenital Hypoalgesia'),/checked/);
 assert.match(input(target,'Your bleeding'),/checked/);
 assert.doesNotMatch(input(target,'Your opponent is a larger species'),/checked/);
 assert.equal(theirDamage(target),getSample('carnotaurus',75,'Prime')!.values.bite);
});

test('species changes clear selected special attacks independently and the arena honors mechanics overrides',()=>{
 const allo=getSpecies('allosaurus')!,trike=getSpecies('triceratops')!;
 const yours={...allo.mechanics[0],id:'arena-yours-flat',name:'Your test attack',mode:'absolute' as const,value:200,minGrowth:0};
 const theirs={...trike.mechanics[0],id:'arena-theirs-flat',name:'Target test attack',mode:'absolute' as const,value:300,minGrowth:0};
 const props={mechanicsOverrides:{[allo.id]:[yours],[trike.id]:[theirs]}};
 const actions:Action[]=[{id:'attack',value:yours.id},{id:'incoming-attack',value:theirs.id}];
 const selectedMarkup=renderArena(actions,props);
 assert.equal(yourDamage(selectedMarkup),200);
 assert.equal(theirDamage(selectedMarkup),300);
 const changeYours:Action={aria:'Your species',value:'troodon'};
 const yourChange=renderArena([...actions,changeYours],props);
 assert.equal(yourDamage(yourChange),getSample('troodon',75,'Prime')!.values.bite);
 assert.equal(theirDamage(yourChange),300,'the target retains its independently selected special attack');
 const changed=renderArena([...actions,changeYours,{aria:'Target species',value:'ceratosaurus'}],props);
 assert.equal(yourDamage(changed),getSample('troodon',75,'Prime')!.values.bite);
 assert.equal(theirDamage(changed),getSample('ceratosaurus',75,'Prime')!.values.bite);
 assert.ok(!changed.includes('Your test attack')&&!changed.includes('Target test attack'),'old species attack options cannot carry over');
});
