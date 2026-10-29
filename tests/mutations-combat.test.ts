import test from 'node:test';
import assert from 'node:assert/strict';
import { byIdMap, mutationCatalog } from '../src/data/mutations.ts';
import { playableSpecies, sourceDataset } from '../src/data/index.ts';
import { attackDamage, hitsToKill } from '../src/lib/calculations.ts';
import { combatMutationRules, createCombatLoadout, healthDamageMultiplier, mutationCombat, mutationEligible, steppedHits } from '../src/lib/mutations.ts';
import { dietOf } from '../src/lib/ui.ts';
import type { Combatant, CombatDiet, CombatMutationId, CombatMutationLoadout, ListedStrength } from '../src/lib/mutations.ts';

function actor(diet:CombatDiet='carnivore',selected:CombatMutationId[]=[],patch:Partial<CombatMutationLoadout>={}):Combatant{
 return {kind:diet==='wildlife'?'wildlife':'playable',diet,loadout:{...createCombatLoadout(),selected,...patch}};
}
const near=(actual:number|undefined,expected:number)=>assert.ok(actual!=null&&Math.abs(actual-expected)<1e-9,`${actual} ≠ ${expected}`);

test('health damage uses the measured checkpoints and caps at full and half damage',()=>{
 for(const [health,multiplier] of [[100,1],[75,1],[50,1],[49,.9875],[40,.875],[30,.75],[20,.625],[10,.5],[5,.5],[1,.5],[0,.5],[-20,.5],[120,1]]){
  near(healthDamageMultiplier(health)??undefined,multiplier);
 }
 near(healthDamageMultiplier(49.5)??undefined,.99375);
 for(const unknown of [null,undefined,NaN,Infinity,-Infinity])assert.equal(healthDamageMultiplier(unknown),null);
});

test('every playable dinosaur gets the health penalty without a mutation or diet requirement',()=>{
 assert.equal(playableSpecies.length,22);
 for(const specimen of playableSpecies){
  const attacker={...actor(dietOf(specimen).toLowerCase() as CombatDiet,[],{healthPercent:40}),speciesId:specimen.id};
  const result=mutationCombat(160,1000,attacker,actor());
  assert.equal(result.healthMultiplier,.875,specimen.name);
  assert.deepEqual(result.firstDamage,{min:140,max:140},specimen.name);
  assert.deepEqual(result.hits,{min:8,max:8},specimen.name);
  assert.equal(result.baselineHits,8,'without mutations still includes the selected health penalty');
 }
});

test('both directions use their own health and independently reduce the recipient HP',()=>{
 const yours=actor('carnivore',[],{healthPercent:40});
 const theirs=actor('herbivore',[],{healthPercent:20});
 const outgoing=mutationCombat(160,1000,yours,theirs);
 assert.deepEqual(outgoing.firstDamage,{min:140,max:140});
 assert.equal(outgoing.startingHp,200);assert.deepEqual(outgoing.hits,{min:2,max:2});
 const incoming=mutationCombat(160,1000,theirs,yours);
 assert.deepEqual(incoming.firstDamage,{min:100,max:100});
 assert.equal(incoming.startingHp,400);assert.deepEqual(incoming.hits,{min:4,max:4});
});

test('health scales known absolute damage without rounding and keeps wildlife attacks unchanged',()=>{
 const injured=actor('herbivore',[],{healthPercent:49});
 const absolute=mutationCombat(950,10000,injured,actor());
 near(absolute.firstDamage?.min,938.125);
 assert.equal(absolute.baselineHits,11);
 const wildlife=mutationCombat(35,1000,actor('wildlife',[],{healthPercent:1}),actor());
 assert.equal(wildlife.healthMultiplier,1);assert.deepEqual(wildlife.firstDamage,{min:35,max:35});
 for(const damage of [null,undefined,0,-1,NaN,Infinity]){
  const result=mutationCombat(damage,1000,injured,actor());
  assert.equal(result.firstDamage,null);assert.equal(result.hits,null);assert.equal(result.baselineHits,null);
 }
 for(const healthPercent of [NaN,Infinity,-Infinity,null,undefined]){
  const invalid=actor('carnivore',[],{healthPercent:healthPercent as number});
  const result=mutationCombat(100,1000,invalid,actor());
  assert.equal(result.healthMultiplier,null);assert.equal(result.firstDamage,null);assert.equal(result.hits,null);assert.equal(result.baselineHits,null);
 }
});

test('health penalty precedes mutation stacking and defense while the attacker condition remains fixed',()=>{
 const attacker=actor('carnivore',['hemomania','accelerated-prey-drive','hypermetabolic-inanition'],{healthPercent:20,strength:2,hyperMode:'manual',hyperBonusPercent:25});
 const defender=actor('herbivore',['congenital-hypoalgesia'],{strength:2,bleeding:true,largerSpeciesOpponent:true,healthPercent:30});
 near(mutationCombat(100,1000,attacker,defender,'additive').firstDamage?.min,72.65625);
 near(mutationCombat(100,1000,attacker,defender,'multiplicative').firstDamage?.min,77.34375);
 const ranged=mutationCombat(100,1000,actor('carnivore',['hypermetabolic-inanition'],{healthPercent:40,strength:2}),actor());
 assert.deepEqual(ranged.firstDamage,{min:87.5,max:109.375});
 assert.deepEqual(ranged.hits,{min:10,max:12});assert.equal(ranged.baselineHits,12);
 const apd=mutationCombat(9.6,100,actor('carnivore',['accelerated-prey-drive'],{healthPercent:20,strength:2}),actor());
 near(apd.firstDamage?.min,6);near(apd.lowHealthDamage?.min,7.2);
 assert.deepEqual(apd.hits,{min:16,max:16});assert.equal(apd.baselineHits,17);
 assert.equal(apd.healthMultiplier,.625,'attacker starting HP stays fixed through this one-direction series');
});

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
 assert.deepEqual(reverse.firstDamage,{min:75,max:75},'the same loadouts reverse roles with the new attacker health penalty');
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
