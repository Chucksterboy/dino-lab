import test from 'node:test';
import assert from 'node:assert/strict';
import { byIdMap, mutationCatalog } from '../src/data/mutations.ts';
import { sourceDataset } from '../src/data/index.ts';
import { attackDamage, hitsToKill } from '../src/lib/calculations.ts';
import { combatMutationRules, createCombatLoadout, mutationCombat, mutationEligible, steppedHits } from '../src/lib/mutations.ts';
import type { Combatant, CombatDiet, CombatMutationId, CombatMutationLoadout, ListedStrength } from '../src/lib/mutations.ts';

function actor(diet:CombatDiet='carnivore',selected:CombatMutationId[]=[],patch:Partial<CombatMutationLoadout>={}):Combatant{
 return {kind:diet==='wildlife'?'wildlife':'playable',diet,loadout:{...createCombatLoadout(),selected,...patch}};
}
const near=(actual:number|undefined,expected:number)=>assert.ok(actual!=null&&Math.abs(actual-expected)<1e-9,`${actual} ≠ ${expected}`);

test('combat tier percentages agree with the independent source catalogue and species diets',()=>{
 for(const rule of combatMutationRules){
  const catalog=byIdMap[rule.id];assert.ok(catalog,rule.id);
  assert.deepEqual(rule.bonuses,catalog.tiers.map(value=>Number(value.replace('%',''))/100),rule.id);
  assert.equal(mutationEligible(rule.id,actor('wildlife')),false);
  assert.equal(mutationEligible(rule.id,actor('carnivore')),true);
  assert.equal(mutationEligible(rule.id,actor('herbivore')),rule.diet==='all');
  assert.equal(mutationEligible(rule.id,actor('omnivore')),rule.diet==='all');
 }
});

test('every documented active direct-damage mutation is supported and removed history is excluded',()=>{
 const active=mutationCatalog.filter(m=>m.status==='current'&&m.combatRole==='damage').map(m=>m.id).sort();
 const supported=combatMutationRules.filter(rule=>rule.effect==='damage').map(rule=>rule.id).sort();
 assert.deepEqual(supported,active);
 assert.deepEqual(active,['accelerated-prey-drive','hemomania','hypermetabolic-inanition']);
 assert.equal(byIdMap['tactile-endurance'].status,'current','catalogue keeps the requested reference');
 assert.equal(byIdMap['tactile-endurance'].combatRole,'stamina');
 assert.equal(byIdMap['intraspecific-aggression'].status,'removed');
});

test('all source attack records preserve the unmodified baseline without mutation selections',()=>{
 const targets=sourceDataset.species.flatMap(s=>s.samples.filter(p=>p.growth===25||p.growth===75||p.growth===100).slice(0,4).map(p=>s.kind==='wildlife'?p.values.hp:p.values.weight));
 let cases=0;
 for(const specimen of sourceDataset.species)for(const sample of specimen.samples){
  const attacks=[sample.values.bite,...specimen.mechanics.filter(m=>m.minGrowth<=sample.growth&&((m.chart==='bite'&&m.mode==='multiplier')||m.mode==='absolute')).map(m=>m.mode==='absolute'?m.value:attackDamage(sample.values.bite,m.value))];
  for(const damage of attacks)for(const hp of targets){
   const result=mutationCombat(damage,hp,actor(),actor('herbivore'));
   assert.equal(result.baselineHits,hitsToKill(hp,damage));
   assert.deepEqual(result.hits,result.baselineHits==null?null:{min:result.baselineHits,max:result.baselineHits});
   assert.deepEqual(result.firstDamage,damage==null||damage<=0?null:{min:damage,max:damage});
   cases++;
  }
 }
 assert.equal(cases,1_807_936,'every captured source attack state ×106 representative HP records');
});

test('Hemomania acts only on the bleeding recipient at each listed strength',()=>{
 for(const strength of [0,1,2,3] as ListedStrength[]){
  const attacker=actor('carnivore',['hemomania'],{strength,bleeding:true});
  const recipient=actor('herbivore');
  assert.equal(mutationCombat(100,1000,attacker,recipient).firstDamage?.min,100,'attacker bleeding does not activate its own bonus');
  recipient.loadout.bleeding=true;
  near(mutationCombat(100,1000,attacker,recipient).firstDamage?.min,[105,107,110,110][strength]);
 }
});

test('Congenital is recipient-specific, conditional on a larger species, and available to each playable diet',()=>{
 for(const diet of ['carnivore','herbivore','omnivore'] as CombatDiet[])for(const strength of [0,1,2,3] as ListedStrength[]){
  const defender=actor(diet,['congenital-hypoalgesia'],{strength});
  assert.equal(mutationCombat(100,1000,actor(),defender).firstDamage?.min,100);
  defender.loadout.largerSpeciesOpponent=true;
  near(mutationCombat(100,1000,actor(),defender).firstDamage?.min,[85,80,75,75][strength]);
  assert.equal(mutationCombat(100,1000,defender,actor()).firstDamage?.min,100,'defensive mutation does not boost outgoing damage');
 }
 const same=actor('carnivore',['congenital-hypoalgesia'],{largerSpeciesOpponent:true});
 same.speciesId='allosaurus';
 assert.deepEqual(mutationCombat(100,1000,{...actor(),speciesId:'allosaurus'},same).firstDamage,{min:100,max:100},'another individual of the same species cannot satisfy larger species');
});

test('APD switches strictly below 35% before each event rather than discounting the whole fight',()=>{
 const attacker=actor('carnivore',['accelerated-prey-drive'],{strength:2});
 const full=mutationCombat(6,100,attacker,actor('herbivore'));
 assert.equal(full.firstDamage?.min,6);
 near(full.lowHealthDamage?.min,7.2);
 assert.deepEqual(full.hits,{min:16,max:16});
 assert.equal(full.baselineHits,17);
 const exact=mutationCombat(6,100,attacker,actor('herbivore',[],{healthPercent:35}));
 assert.equal(exact.firstDamage?.min,6);assert.deepEqual(exact.hits,{min:6,max:6});
 const below=mutationCombat(6,100,attacker,actor('herbivore',[],{healthPercent:34.9}));
 near(below.firstDamage?.min,7.2);assert.deepEqual(below.hits,{min:5,max:5});
 assert.deepEqual(steppedHits(1000,34.99999999999999,100,120),{hits:3,normalHits:0,lowHealthHits:3},'strict floating-point boundary stays consistent with first damage');
});

test('Hypermetabolic remains a bounded range until a manual effective bonus is entered',()=>{
 const attacker=actor('carnivore',['hypermetabolic-inanition'],{strength:2});
 const ranged=mutationCombat(100,500,attacker,actor());
 assert.deepEqual(ranged.firstDamage,{min:100,max:125});assert.deepEqual(ranged.hits,{min:4,max:5});assert.equal(ranged.unresolvedHyper,true);
 attacker.loadout.hyperMode='manual';attacker.loadout.hyperBonusPercent=10;
 const manual=mutationCombat(100,500,attacker,actor());
 near(manual.firstDamage?.min,110);assert.equal(manual.firstDamage?.min,manual.firstDamage?.max);assert.equal(manual.unresolvedHyper,false);
 attacker.loadout.hyperBonusPercent=100;
 assert.deepEqual(mutationCombat(100,500,attacker,actor()).firstDamage,{min:125,max:125},'manual values cannot exceed the selected listed maximum');
 attacker.loadout.hyperBonusPercent=-10;
 assert.deepEqual(mutationCombat(100,500,attacker,actor()).firstDamage,{min:100,max:100});
 attacker.loadout.hyperBonusPercent=NaN;
 assert.equal(mutationCombat(100,500,attacker,actor()).unresolvedHyper,true,'invalid manual value does not fabricate a bonus');
});

test('combined bonus assumption is explicit and defense applies after outgoing bonuses',()=>{
 const attacker=actor('carnivore',['hemomania','accelerated-prey-drive','hypermetabolic-inanition'],{strength:2,hyperMode:'manual',hyperBonusPercent:25});
 const defender=actor('herbivore',['congenital-hypoalgesia'],{strength:2,bleeding:true,largerSpeciesOpponent:true,healthPercent:30});
 const additive=mutationCombat(100,1000,attacker,defender,'additive');
 const product=mutationCombat(100,1000,attacker,defender,'multiplicative');
 near(additive.firstDamage?.min,116.25);near(product.firstDamage?.min,123.75);
 assert.deepEqual(additive.hits,{min:3,max:3});assert.deepEqual(product.hits,{min:3,max:3});
 const reverse=mutationCombat(100,1000,defender,attacker,'additive');
 assert.deepEqual(reverse.firstDamage,{min:100,max:100},'the same loadouts reverse roles correctly');
});

test('disabled diet/wildlife selections cannot change HP damage; invalid source values stay unknown',()=>{
 for(const diet of ['herbivore','omnivore','wildlife'] as CombatDiet[]){
  const invalid=actor(diet,['accelerated-prey-drive','hemomania','hypermetabolic-inanition'],{strength:3,hyperMode:'manual',hyperBonusPercent:25});
  assert.deepEqual(mutationCombat(100,1000,invalid,actor('herbivore',[],{bleeding:true,healthPercent:20})).firstDamage,{min:100,max:100});
 }
 for(const damage of [null,undefined,0,-1,NaN,Infinity])assert.equal(mutationCombat(damage,100,actor(),actor()).hits,null);
 for(const hp of [null,undefined,0,-1,NaN,Infinity])assert.equal(mutationCombat(100,hp,actor(),actor()).hits,null);
 assert.equal(mutationCombat(100,100,actor(),actor('herbivore',[],{healthPercent:NaN})).hits,null);
 assert.deepEqual(steppedHits(100,0,10,12),{hits:0,normalHits:0,lowHealthHits:0});
 assert.equal(steppedHits(Number.MAX_VALUE,100,Number.MIN_VALUE,Number.MIN_VALUE).hits,null);
});

test('closed-form APD counts agree with an independent exact decimal per-event simulator',()=>{
 const scale=1_000_000_000_000n;
 const units=(number:number)=>{
  const [whole,fraction='']=String(number).split('.');
  return BigInt(whole+fraction)*(scale/(10n**BigInt(fraction.length)));
 };
 let cases=0;
 for(const maxHp of [1,7,25.2,100,153,350,3672])for(const health of [1,25,34.9,35,35.1,50,75,100])for(const normal of [.1,.3,1,2.5,6,10.2,175,249.999925])for(const boost of [10,15,20]){
  const maximum=units(maxHp),ordinary=units(normal),boosted=ordinary*BigInt(100+boost)/100n;
  let remaining=maximum*units(health)/(100n*scale),expected=0;
  while(remaining>0n){remaining-=remaining*100n<maximum*35n?boosted:ordinary;expected++;}
  const actual=steppedHits(maxHp,health,normal,normal*(1+boost/100));
  assert.equal(actual.hits,expected,`maxHP${maxHp}/health${health}/damage${normal}/APD${boost}%`);
  cases++;
 }
 assert.equal(cases,1344);
});
