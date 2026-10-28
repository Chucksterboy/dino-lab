import test from 'node:test';
import assert from 'node:assert/strict';
import { Children, createElement, isValidElement } from 'react';
import type { ChangeEvent, ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Attacks } from '../src/components/Attacks.tsx';
import { CombatMutations } from '../src/components/CombatMutations.tsx';
import { getSample, getSpecies } from '../src/data/index.ts';

type Action={aria?:string;id?:string;value?:string;checked?:boolean;click?:boolean};
function renderScenario(actions:Action[]=[],name='Allosaurus',growth=75){
 const specimen=getSpecies(name)!;let step=0;
 function find(element:ReactElement,action:Action):ReactElement<Record<string,unknown>>|undefined{
  const props=element.props as Record<string,unknown>;
  if(action.aria&&props['aria-label']===action.aria||action.id&&props.id===action.id)return element as ReactElement<Record<string,unknown>>;
  if(element.type===CombatMutations){const nested=CombatMutations(element.props as Parameters<typeof CombatMutations>[0]);const found=find(nested,action);if(found)return found;}
  for(const child of Children.toArray(props.children as ReactNode))if(isValidElement(child)){const found=find(child,action);if(found)return found;}
  return undefined;
 }
 function Probe(){
  const tree=Attacks({specimen,growth,state:'Prime',mechanics:specimen.mechanics});
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
const yourDamage=(markup:string)=>markup.match(/Your damage \/ hit<\/span><strong[^>]*>([^<]+)<\/strong>/)?.[1];
const incomingHits=(markup:string)=>markup.match(/Their selected hits to defeat you<\/span><strong[^>]*>([^<]+)<\/strong>/)?.[1];

test('actual outgoing selectors apply Hemomania only after the target bleeding condition is set',()=>{
 assert.equal(yourDamage(renderScenario()),'175');
 assert.equal(yourDamage(renderScenario([{aria:'Your Hemomania',checked:true}])),'175');
 const markup=renderScenario([{aria:'Your Hemomania',checked:true},{aria:'Target bleeding',checked:true}]);
 assert.equal(yourDamage(markup),'183.75');assert.ok(markup.includes('Without mutations:'));
});

test('target mutation loadout affects incoming damage and reverse hit counts independently',()=>{
 const markup=renderScenario([{id:'target',value:'allosaurus'},{aria:'Target listed mutation strength',value:'2'},{aria:'Target Hemomania',checked:true},{aria:'Your bleeding',checked:true}]);
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
 const selected=[{aria:'Your listed mutation strength',value:'2'},{aria:'Your Accelerated Prey Drive',checked:true}];
 assert.equal(yourDamage(renderScenario(selected)),'175');
 assert.equal(yourDamage(renderScenario([...selected,{aria:'Target starting health percentage',value:'35'}])),'175');
 assert.equal(yourDamage(renderScenario([...selected,{aria:'Target starting health percentage',value:'34'}])),'210');
 const markup=renderScenario(selected);
 assert.ok(markup.includes('Below 35% HP: 210'));
 assert.ok(markup.includes('Prey Drive counts the two health stages separately.'));
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
 assert.equal(yourDamage(prey),'175','target offensive selection does not boost your attacks');
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
 assert.ok(hypsi.includes('Source 1 has no matchup records for this species.'));
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
