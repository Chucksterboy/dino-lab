import test from 'node:test';
import assert from 'node:assert/strict';
import { Children, createElement, isValidElement } from 'react';
import type { ChangeEvent, ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CombatArena as Attacks, CombatantCard } from '../src/components/CombatArena.tsx';
import { CombatHealth, CombatMutations } from '../src/components/CombatMutations.tsx';
import { getSample, getSpecies, species } from '../src/data/index.ts';
import type { Mechanic, Species, State } from '../src/data/index.ts';
import { readValue } from '../src/lib/ui.ts';

type Action={aria?:string;id?:string;value?:string;checked?:boolean;click?:boolean};
function renderScenario(actions:Action[]=[],name='Allosaurus',growth=75,state:State='Prime',mechanics?:Mechanic[],specimenOverride?:Species){
 const specimen=specimenOverride??getSpecies(name)!;let step=0;
 function find(element:ReactElement,action:Action):ReactElement<Record<string,unknown>>|undefined{
  const props=element.props as Record<string,unknown>;
  if(action.aria&&props['aria-label']===action.aria||action.id&&props.id===action.id)return element as ReactElement<Record<string,unknown>>;
  if(element.type===CombatMutations){const nested=CombatMutations(element.props as Parameters<typeof CombatMutations>[0]);const found=find(nested,action);if(found)return found;}
  if(element.type===CombatantCard){const nested=CombatantCard(element.props as Parameters<typeof CombatantCard>[0]);const found=find(nested,action);if(found)return found;}
  if(element.type===CombatHealth){const nested=CombatHealth(element.props as Parameters<typeof CombatHealth>[0]);const found=find(nested,action);if(found)return found;}
  for(const child of Children.toArray(props.children as ReactNode))if(isValidElement(child)){const found=find(child,action);if(found)return found;}
  return undefined;
 }
 function Probe(){
  const tree=Attacks({specimen,growth,state,mechanics:mechanics??specimen.mechanics});
  if(step<actions.length){
   const action=actions[step++],control=find(tree,action);
   assert.ok(control,`Actual combat control exists: ${JSON.stringify(action)}`);
   if(action.click)(control.props.onClick as ()=>void)();
   else(control.props.onChange as (event:ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>void)({target:{value:action.value,checked:action.checked}} as ChangeEvent<HTMLInputElement|HTMLSelectElement>);
  }
  return tree;
 }
 const markup=renderToStaticMarkup(createElement(Probe));
 assert.equal(step,actions.length,'every requested actual handler executed');
 return markup;
}
const yourDamage=(markup:string)=>markup.match(/Your damage \/ (?:hit|tick|modeled event)<\/span><strong[^>]*>([^<]+)<\/strong>/)?.[1];
const incomingHits=(markup:string)=>markup.match(/Their selected hits to defeat you<\/span><strong[^>]*>([^<]+)<\/strong>/)?.[1];
const incomingDamage=(markup:string)=>markup.match(/First damage: ([\d.,]+)/)?.[1];
const outgoingHits=(markup:string)=>markup.match(/Hits to defeat [^<]+<\/span><strong[^>]*>([^<]+)<\/strong>/)?.[1];
const displayedNumber=(reading:string|undefined)=>Number(reading?.replaceAll(',',''));
const summaryReading=(markup:string,label:string)=>markup.match(new RegExp(`<strong\\b[^>]*aria-label="${label}"[^>]*>([^<]+)<\\/strong>`))?.[1];

test('actual outgoing selectors apply Hemomania only after the target bleeding condition is set',()=>{
 assert.equal(yourDamage(renderScenario()),'175');
 assert.equal(yourDamage(renderScenario([{aria:'Your Hemomania',checked:true}])),'175');
 const markup=renderScenario([{aria:'Your Hemomania',checked:true},{aria:'Target bleeding',checked:true}]);
 assert.equal(yourDamage(markup),'183.75');assert.ok(markup.includes('Without mutations:'));
});

test('both combatants have three named entombment levels with the matching damage bonuses',()=>{
 const initial=renderScenario([{id:'target',value:'allosaurus'}]);
 for(const side of ['Your','Target']){
  const select=[...initial.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)].find(match=>match[1].includes(`aria-label="${side} entombment level"`));
  assert.ok(select,`${side} mutation level selector`);
  const choices=[...select[2].matchAll(/<option\b[^>]*value="([^"]+)"[^>]*>([^<]+)<\/option>/g)].map(match=>[match[1],match[2]]);
  assert.deepEqual(choices,[['0','Default'],['1','Entombed 1'],['2','Entombed 2']]);
 }
 assert.doesNotMatch(initial,/Strength [1-4]|Listed strength/);
 for(const [level,damage,hits] of [['0','183.75','15'],['1','187.25','14'],['2','192.5','14']]){
  const markup=renderScenario([{id:'target',value:'allosaurus'},{aria:'Your entombment level',value:level},{aria:'Target entombment level',value:level},{aria:'Your Hemomania',checked:true},{aria:'Target Hemomania',checked:true},{aria:'Your bleeding',checked:true},{aria:'Target bleeding',checked:true}]);
  assert.equal(yourDamage(markup),damage,`outgoing level ${level}`);
  assert.ok(markup.includes(`First damage: ${damage}`),`incoming level ${level}`);
  assert.equal(incomingHits(markup),hits,`reverse hit count at level ${level}`);
 }
});

test('target mutation loadout affects incoming damage and reverse hit counts independently',()=>{
 const markup=renderScenario([{id:'target',value:'allosaurus'},{aria:'Target entombment level',value:'2'},{aria:'Target Hemomania',checked:true},{aria:'Your bleeding',checked:true}]);
 assert.equal(yourDamage(markup),'175');
 assert.equal(incomingHits(markup),'14');
 assert.ok(markup.includes('First damage: 192.5'));
 assert.ok(markup.includes('Without mutations: 15'));
});

test('larger-species defense changes the correct direction and is never inferred from mass',()=>{
 const selected=[{aria:'Target Congenital Hypoalgesia',checked:true}];
 assert.equal(yourDamage(renderScenario(selected)),'175');
 assert.equal(yourDamage(renderScenario([...selected,{aria:'Target opponent is a larger species',checked:true}])),'148.75');
 const same=renderScenario([{id:'target',value:'allosaurus'},{aria:'Target Congenital Hypoalgesia',checked:true}]);
 assert.match(same,/<input[^>]*aria-label="Target opponent is a larger species"[^>]*disabled/);
 assert.ok(same.includes('Same species; this condition cannot apply.'));
});

test('Prey Drive first damage follows target health while its count models both health stages',()=>{
 const selected=[{aria:'Your entombment level',value:'2'},{aria:'Your Accelerated Prey Drive',checked:true}];
 assert.equal(yourDamage(renderScenario(selected)),'175');
 assert.equal(yourDamage(renderScenario([...selected,{aria:'Target starting health percentage',value:'35'}])),'175');
 assert.equal(yourDamage(renderScenario([...selected,{aria:'Target starting health percentage',value:'34'}])),'210');
 const markup=renderScenario(selected);
 assert.ok(markup.includes('Below 35% HP: 210'));
 assert.ok(!markup.includes('Prey Drive counts the two health stages separately.'));
});

test('unknown Hypermetabolic curve renders a range and manual effective bonus gives a single scenario',()=>{
 const selected=[{aria:'Your Hypermetabolic Inanition',checked:true}];
 const range=renderScenario(selected);assert.equal(yourDamage(range),'175–201.25');
 const manual=renderScenario([...selected,{aria:'Your Hypermetabolic effect',value:'manual'},{aria:'Your Hypermetabolic effective bonus',value:'10'}]);
 assert.equal(yourDamage(manual),'192.5');assert.ok(!manual.includes('Ranges reflect Hypermetabolic'));
});

test('all choices stay visible with correct eligibility, while Tactile is absent from the calculator',()=>{
 const boar=renderScenario([],'Boar');
 for(const name of ['Accelerated Prey Drive','Hemomania','Hypermetabolic Inanition','Congenital Hypoalgesia'])assert.match(boar,new RegExp(`<input[^>]*aria-label="Your ${name}"[^>]*disabled`));
 assert.ok(boar.includes('Wildlife cannot equip mutations.'));
 const trike=renderScenario([],'Triceratops');
 for(const name of ['Accelerated Prey Drive','Hemomania','Hypermetabolic Inanition'])assert.match(trike,new RegExp(`<input[^>]*aria-label="Your ${name}"[^>]*disabled`));
 assert.ok(trike.includes('aria-label="Your Congenital Hypoalgesia"'));
 assert.ok(trike.includes('Carnivore only · unavailable for this species'));
 assert.ok(!trike.includes('Tactile Endurance'));
 assert.ok(!trike.includes('tactile-reference'));
 for(const baby of ['BabyBoar','BabyDeer','BabyGoat'])assert.ok(!trike.includes(`>${baby} · Wildlife</option>`));
});

test('both panes expose every active damage control, enabled only for eligible carnivores',()=>{
 const names=['Accelerated Prey Drive','Hemomania','Hypermetabolic Inanition'];
 const check=(markup:string,prefix:string,enabled:boolean)=>{
  for(const name of names){
   const tag=[...markup.matchAll(/<input\b[^>]*>/g)].map(m=>m[0]).find(input=>input.includes(`aria-label="${prefix} ${name}"`));
   assert.ok(tag,`${prefix} ${name} remains visible`);
   assert.equal(tag.includes('disabled'),!enabled,`${prefix} ${name} eligibility`);
  }
 };
 const mixed=renderScenario();check(mixed,'Your',true);check(mixed,'Target',false);
 const carnivores=renderScenario([{id:'target',value:'allosaurus'}]);check(carnivores,'Your',true);check(carnivores,'Target',true);
 const omnivores=renderScenario([{id:'target',value:'beipiosaurus'}],'Gallimimus');check(omnivores,'Your',false);check(omnivores,'Target',false);
 assert.equal((omnivores.match(/Carnivore only · unavailable for this species/g)??[]).length,6);
});

test('target Prey Drive and Hypermetabolic selectors update reverse damage and hit counts',()=>{
 const prey=renderScenario([{id:'target',value:'allosaurus'},{aria:'Target Accelerated Prey Drive',checked:true},{aria:'Your starting health percentage',value:'34'}]);
 assert.equal(yourDamage(prey),'140','target offensive selection does not boost your attacks; your 34% health scales your own bite');
 assert.ok(prey.includes('First damage: 192.5'));
 assert.equal(incomingHits(prey),'5');
 const hyper=renderScenario([{id:'target',value:'allosaurus'},{aria:'Target Hypermetabolic Inanition',checked:true}]);
 assert.equal(yourDamage(hyper),'175');
 assert.ok(hyper.includes('First damage: 175–201.25'));
 assert.equal(incomingHits(hyper),'13–15');
 const manual=renderScenario([{id:'target',value:'allosaurus'},{aria:'Target Hypermetabolic Inanition',checked:true},{aria:'Target Hypermetabolic effect',value:'manual'},{aria:'Target Hypermetabolic effective bonus',value:'10'}]);
 assert.ok(manual.includes('First damage: 192.5'));
 assert.equal(incomingHits(manual),'14');
});

test('reset clears only its combatant and the specified attack explanations and patch badge are absent',()=>{
 const markup=renderScenario([{aria:'Your Hemomania',checked:true},{aria:'Target bleeding',checked:true},{aria:'Target Congenital Hypoalgesia',checked:true},{aria:'Target opponent is a larger species',checked:true},{aria:'Reset your mutation scenario',click:true}]);
 assert.equal(yourDamage(markup),'148.75','target defense remains after resetting your loadout');
 const belowSource=renderScenario([],'Allosaurus',0);
 assert.ok(!belowSource.includes('The Source 1 matchup uses its nearest available record'));
 assert.ok(!belowSource.includes('Exact source keyframes and controls. These remain separate'));
 assert.ok(!belowSource.includes('Patch 0.21.748'));
 const hypsi=renderScenario([],'Hypsilophodon');
 assert.equal(yourDamage(hypsi),'2','the workbook-only playable now has a known primary matchup');
 assert.doesNotMatch(hypsi,/Source 1 has no matchup records|Source 1 attack modifiers|Source 2 attack reference|Primary damage at this growth/);
 assert.doesNotMatch(hypsi,/Stacking is a scenario assumption|conditional defense is applied after outgoing bonuses|Ranges reflect Hypermetabolic/);
 assert.equal(getSample('Allosaurus',75,'Prime')?.values.bite,175);
});

test('results precede controls once, and contradictory size conditions or a new opponent cannot silently retain defense',()=>{
 const initial=renderScenario();
 assert.ok(initial.indexOf('class="combat-results"')<initial.indexOf('class="mutation-model"'));
 assert.equal((initial.match(/class="combat-results"/g)??[]).length,1);
 const both=renderScenario([{aria:'Target Congenital Hypoalgesia',checked:true},{aria:'Target opponent is a larger species',checked:true},{aria:'Your Congenital Hypoalgesia',checked:true},{aria:'Your opponent is a larger species',checked:true}]);
 assert.equal(yourDamage(both),'175','last explicit size relation clears the opposite relation');
 assert.match(both,/<input[^>]*aria-label="Target opponent is a larger species"(?![^>]*checked)/);
 const changed=renderScenario([{aria:'Your Congenital Hypoalgesia',checked:true},{aria:'Your opponent is a larger species',checked:true},{id:'target',value:'carnotaurus'}]);
 assert.match(changed,/<input[^>]*aria-label="Your opponent is a larger species"(?![^>]*checked)/);
});

test('your actual health slider scales outgoing damage at every recorded checkpoint and preserves the lower cap',()=>{
 const ourHp=getSample('allosaurus',75,'Prime')!.values.weight!;
 for(const [health,multiplier] of [[100,1],[50,1],[49,.9875],[40,.875],[30,.75],[20,.625],[10,.5],[5,.5],[1,.5]]){
  const markup=renderScenario([{aria:'Your starting health percentage',value:String(health)}]);
  assert.ok(Math.abs(displayedNumber(yourDamage(markup))-175*multiplier)<=.00501,`${health}% health changes your displayed damage`);
  assert.ok(Math.abs(displayedNumber(summaryReading(markup,'Your health-adjusted bite force'))-175*multiplier)<=.00501,'the value beside the actual health slider also updates');
  assert.ok(Math.abs(Number(summaryReading(markup,'Your health damage reduction')?.replace('−','-').replace('%',''))+(1-multiplier)*100)<=.00501,'the displayed reduction follows the selected health');
  assert.equal(displayedNumber(outgoingHits(markup)),Math.ceil(9500/(175*multiplier)),`${health}% changes the outgoing hit count with unrounded damage`);
  assert.equal(displayedNumber(incomingDamage(markup)),900,'your health cannot lower the healthy target’s outgoing attack');
  assert.equal(displayedNumber(incomingHits(markup)),Math.ceil((ourHp*health/100)/900),'remaining HP still changes independently');
 }
});

test('target health slider scales reverse damage and hit count without reducing your healthy attack',()=>{
 const fullHp=getSample('allosaurus',75,'Prime')!.values.weight!;
 for(const [health,multiplier] of [[50,1],[49,.9875],[40,.875],[30,.75],[20,.625],[10,.5],[5,.5]]){
  const markup=renderScenario([{id:'target',value:'allosaurus'},{aria:'Target starting health percentage',value:String(health)}]);
  assert.equal(yourDamage(markup),'175','recipient health is independent of the healthy attacker’s damage');
  assert.ok(Math.abs(displayedNumber(incomingDamage(markup))-175*multiplier)<=.00501,`${health}% changes their outgoing damage`);
  assert.ok(Math.abs(displayedNumber(summaryReading(markup,'Target health-adjusted bite force'))-175*multiplier)<=.00501,'target slider feedback follows its own bite force');
  assert.equal(displayedNumber(incomingHits(markup)),Math.ceil(fullHp/(175*multiplier)),'reverse count uses health-adjusted damage');
  assert.equal(displayedNumber(outgoingHits(markup)),Math.ceil((fullHp*health/100)/175),'target remaining HP still changes the forward count');
 }
});

test('the health slider scales all 22 playable primaries in Prime and Frail using the available source profile',()=>{
 const known=species.filter(item=>item.kind==='playable');
 assert.equal(known.length,22);
 for(const specimen of known)for(const state of ['Prime','Frail'] as const){
  const base=specimen.samples.length?getSample(specimen,100,state)?.values.bite:readValue(specimen,100,state,'bite','sheet');
  assert.ok(base!=null,`${specimen.name} ${state} has a source primary`);
  const markup=renderScenario([{aria:'Your starting health percentage',value:'40'}],specimen.id,100,state);
  assert.ok(Math.abs(displayedNumber(yourDamage(markup))-base*.875)<=.00501,`${specimen.name} ${state} shares the empirical multiplier`);
  assert.ok(Math.abs(displayedNumber(summaryReading(markup,'Your health-adjusted bite force'))-base*.875)<=.00501,`${specimen.name} ${state} shows the same bite beside its health slider`);
 }
});

test('workbook-only Hypsi supports health-scaled damage and HP in either combatant position',()=>{
 const baseline=renderScenario([],'Hypsilophodon',100,'Frail');
 assert.equal(yourDamage(baseline),'1.4');
 const hypsi=renderScenario([{aria:'Your starting health percentage',value:'10'}],'Hypsilophodon',100,'Frail');
 assert.equal(yourDamage(hypsi),'0.7','the measured Frail elder primary uses its existing workbook value');
 assert.equal(summaryReading(hypsi,'Your health-adjusted bite force'),'0.7');
 assert.ok(hypsi.includes('10% · 2 HP'),'the same Frail workbook profile supplies the 20 HP baseline');
 assert.equal(displayedNumber(outgoingHits(hypsi)),Math.ceil(9500/.7));
 const target=renderScenario([{id:'target',value:'hypsilophodon'},{id:'target-state',value:'Frail'},{id:'target-growth',value:'100'},{aria:'Target starting health percentage',value:'10'}]);
 assert.ok(target.includes('>Hypsilophodon</option>'),'the workbook-only dinosaur is selectable as a target');
 assert.ok(target.includes('10% · 2 HP'),'the target uses the same workbook HP baseline');
 assert.equal(displayedNumber(incomingDamage(target)),.7);
 assert.equal(summaryReading(target,'Target health-adjusted bite force'),'0.7');
 assert.equal(displayedNumber(outgoingHits(target)),1,'target remaining HP uses the same workbook profile');
 assert.equal(displayedNumber(incomingHits(target)),Math.ceil(getSample('allosaurus',75,'Prime')!.values.weight!/.7));
});

test('an existing Source 1 profile with missing bite does not silently borrow a Source 2 field',()=>{
 const original=getSpecies('allosaurus')!;
 const missing:Species={...original,samples:original.samples.map(sample=>({...sample,values:{...sample.values,bite:null}}))};
 assert.equal(readValue(original,75,'Prime','bite','sheet'),175,'a tempting workbook fallback is present');
 const markup=renderScenario([{aria:'Your starting health percentage',value:'10'}],original.id,75,'Prime',undefined,missing);
 assert.equal(yourDamage(markup),'—','only a whole missing profile can select the workbook path');
});

test('selected absolute attack damage and mutation comparisons use the same health-adjusted baseline',()=>{
 const specimen=getSpecies('allosaurus')!;
 const flat:Mechanic={...specimen.mechanics[0],id:'test-flat-attack',name:'Constant test attack',mode:'absolute',chart:'bite',value:200,minGrowth:0};
 const absolute=renderScenario([{id:'attack',value:flat.id},{aria:'Your starting health percentage',value:'10'}],specimen.id,75,'Prime',[flat]);
 assert.equal(yourDamage(absolute),'100','constant source attacks share the health rule rather than falling back to primary bite');
 const mutated=renderScenario([{aria:'Your starting health percentage',value:'30'},{aria:'Your Hemomania',checked:true},{aria:'Target bleeding',checked:true}]);
 assert.equal(yourDamage(mutated),'137.81','the health-adjusted bite combines with eligible mutation bonuses');
 assert.equal(summaryReading(mutated,'Your health-adjusted bite force'),'131.25','the base-bite feedback does not apply mutation bonuses a second time');
 assert.ok(mutated.includes('Without mutations: 73'),'the comparison keeps the chosen health penalty while removing mutation bonuses');
});

test('wildlife health changes preserve known AI attack damage without inventing a dinosaur wounded penalty',()=>{
 const yourBoar=renderScenario([{aria:'Your starting health percentage',value:'10'}],'Boar');
 assert.equal(yourDamage(yourBoar),'40');
 const targetBoar=renderScenario([{id:'target',value:'boar'},{aria:'Target starting health percentage',value:'10'}]);
 assert.equal(displayedNumber(incomingDamage(targetBoar)),40);
});
