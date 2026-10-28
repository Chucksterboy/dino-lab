import { hitsToKill } from './calculations';

export const COMBAT_MUTATION_IDS = ['accelerated-prey-drive','hemomania','hypermetabolic-inanition','congenital-hypoalgesia'] as const;
export type CombatMutationId = typeof COMBAT_MUTATION_IDS[number];
export type ListedStrength = 0|1|2|3;
export type MutationStacking = 'additive'|'multiplicative';
export type CombatDiet = 'carnivore'|'herbivore'|'omnivore'|'wildlife';
export interface CombatMutationRule { id:CombatMutationId;name:string;bonuses:readonly[number,number,number,number];diet:'carnivore'|'all';effect:'damage'|'defense';condition:string }

/** Listed community-guide percentages, not inferred hunger or stacking curves.
 * https://www.evrimaquickguide.com/gameplay/health-statuses/mutations
 * Strength indices deliberately do not assert an Entombment-count mapping.
 */
export const combatMutationRules:CombatMutationRule[]=[
 {id:'accelerated-prey-drive',name:'Accelerated Prey Drive',bonuses:[.10,.15,.20,.20],diet:'carnivore',effect:'damage',condition:'Only while the recipient is below 35% health.'},
 {id:'hemomania',name:'Hemomania',bonuses:[.05,.07,.10,.10],diet:'carnivore',effect:'damage',condition:'Only against a bleeding recipient.'},
 {id:'hypermetabolic-inanition',name:'Hypermetabolic Inanition',bonuses:[.15,.20,.25,.25],diet:'carnivore',effect:'damage',condition:'Hunger curve unpublished. Use a range or a known effective bonus.'},
 {id:'congenital-hypoalgesia',name:'Congenital Hypoalgesia',bonuses:[.15,.20,.25,.25],diet:'all',effect:'defense',condition:'Only when the attacker is a larger species.'},
];
export const combatMutationById=Object.fromEntries(combatMutationRules.map(rule=>[rule.id,rule])) as Record<CombatMutationId,CombatMutationRule>;

export interface CombatMutationLoadout {
 strength:ListedStrength;
 selected:CombatMutationId[];
 healthPercent:number;
 bleeding:boolean;
 largerSpeciesOpponent:boolean;
 hyperMode:'range'|'manual';
 hyperBonusPercent:number;
}
export interface Combatant {kind:'playable'|'wildlife';diet:CombatDiet;loadout:CombatMutationLoadout;speciesId?:string}
export interface NumericRange {min:number;max:number}
export interface SteppedHits {hits:number|null;normalHits:number|null;lowHealthHits:number|null}
export interface MutationCombatResult {
 firstDamage:NumericRange|null;
 lowHealthDamage:NumericRange|null;
 hits:NumericRange|null;
 baselineHits:number|null;
 startingHp:number|null;
 preyDriveActive:boolean;
 unresolvedHyper:boolean;
 applied:string[];
}

export function createCombatLoadout():CombatMutationLoadout {
 return {strength:0,selected:[],healthPercent:100,bleeding:false,largerSpeciesOpponent:false,hyperMode:'range',hyperBonusPercent:0};
}
/** Supplied-guide eligibility. All choices remain visible; disabled controls
 * explain diet restrictions instead of concealing the available combat effects.
 */
export function mutationEligible(id:CombatMutationId,actor:Pick<Combatant,'kind'|'diet'>):boolean {
 return actor.kind==='playable'&&(combatMutationById[id].diet==='all'||actor.diet==='carnivore');
}
export function mutationSelected(id:CombatMutationId,actor:Combatant):boolean {
 return mutationEligible(id,actor)&&actor.loadout.selected.includes(id);
}
export function mutationBonus(id:CombatMutationId,strength:ListedStrength):number {
 const index=Number.isInteger(strength)?Math.max(0,Math.min(3,strength)):0;
 return combatMutationById[id].bonuses[index];
}
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const positive=(value:unknown):value is number=>finite(value)&&value>0;
const clamp=(value:number,low:number,high:number)=>Math.max(low,Math.min(high,value));

/** This model checks APD against remaining HP BEFORE each event, strictly below35%.
 * Count the ordinary events required to cross that boundary, then finish with
 * low-health damage. No loop or constant full-fight APD discount is used.
 */
export function steppedHits(maxHp:number|null|undefined,healthPercent:number,normalDamage:number|null|undefined,lowHealthDamage:number|null|undefined):SteppedHits {
 const unknown={hits:null,normalHits:null,lowHealthHits:null};
 if(!positive(maxHp)||!finite(healthPercent)||!positive(normalDamage)||!positive(lowHealthDamage))return unknown;
 const starting=maxHp*(clamp(healthPercent,0,100)/100);
 if(starting===0)return {hits:0,normalHits:0,lowHealthHits:0};
 const withoutThreshold=hitsToKill(starting,normalDamage);
 if(withoutThreshold==null)return unknown;
 if(normalDamage===lowHealthDamage)return {hits:withoutThreshold,normalHits:withoutThreshold,lowHealthHits:0};
 const threshold=maxHp*.35;
 if(healthPercent<35){
  const hits=hitsToKill(starting,lowHealthDamage);
  return {hits,normalHits:hits==null?null:0,lowHealthHits:hits};
 }
 const quotient=(starting-threshold)/normalDamage;
 if(!Number.isFinite(quotient))return unknown;
 const nearest=Math.round(quotient);
 const stable=Math.abs(quotient-nearest)<=4*Number.EPSILON*Math.max(1,quotient)?nearest:quotient;
 const toCross=Math.floor(stable)+1;
 if(toCross>=withoutThreshold)return {hits:withoutThreshold,normalHits:withoutThreshold,lowHealthHits:0};
 const remaining=Math.max(0,starting-toCross*normalDamage);
 const lowHits=remaining===0?0:hitsToKill(remaining,lowHealthDamage);
 if(lowHits==null||!Number.isSafeInteger(toCross+lowHits))return unknown;
 return {hits:toCross+lowHits,normalHits:toCross,lowHealthHits:lowHits};
}

function combineBonuses(bonuses:number[],stacking:MutationStacking):number {
 return stacking==='multiplicative'?bonuses.reduce((factor,bonus)=>factor*(1+bonus),1):1+bonuses.reduce((total,bonus)=>total+bonus,0);
}

/** A transparent percentage scenario. Multiple outgoing bonuses use the chosen
 * assumption; conditional defense is applied afterward. Unknown hunger scaling
 * becomes a bounded range. Tactile is intentionally not HP resistance.
 */
export function mutationCombat(baseDamage:number|null|undefined,maxHp:number|null|undefined,attacker:Combatant,recipient:Combatant,stacking:MutationStacking='additive'):MutationCombatResult {
 const health=recipient.loadout.healthPercent;
 const startingHp=positive(maxHp)&&finite(health)?maxHp*(clamp(health,0,100)/100):null;
 const baselineHits=startingHp===0?0:hitsToKill(startingHp,baseDamage);
 const apd=mutationSelected('accelerated-prey-drive',attacker)?mutationBonus('accelerated-prey-drive',attacker.loadout.strength):0;
 const hemo=mutationSelected('hemomania',attacker)&&recipient.loadout.bleeding?mutationBonus('hemomania',attacker.loadout.strength):0;
 const hyperSelected=mutationSelected('hypermetabolic-inanition',attacker);
 const hyperMax=hyperSelected?mutationBonus('hypermetabolic-inanition',attacker.loadout.strength):0;
 const manualHyper=hyperSelected&&attacker.loadout.hyperMode==='manual'&&finite(attacker.loadout.hyperBonusPercent);
 const hyper:NumericRange=manualHyper?{min:clamp(attacker.loadout.hyperBonusPercent/100,0,hyperMax),max:clamp(attacker.loadout.hyperBonusPercent/100,0,hyperMax)}:{min:0,max:hyperMax};
 const sameSpecies=attacker.speciesId!=null&&attacker.speciesId===recipient.speciesId;
 const reduction=mutationSelected('congenital-hypoalgesia',recipient)&&recipient.loadout.largerSpeciesOpponent&&!sameSpecies?mutationBonus('congenital-hypoalgesia',recipient.loadout.strength):0;
 const percentage=(bonus:number)=>Number((bonus*100).toFixed(4));
 const applied:string[]=[];
 if(hemo)applied.push(`Hemomania +${percentage(hemo)}%`);
 if(apd)applied.push(`Prey Drive +${percentage(apd)}% below 35% HP`);
 if(hyperSelected)applied.push(manualHyper?`Hypermetabolic +${percentage(hyper.max)}% scenario`:`Hypermetabolic 0–${percentage(hyper.max)}% range`);
 if(reduction)applied.push(`Hypoalgesia −${percentage(reduction)}%`);
 const unknown:MutationCombatResult={firstDamage:null,lowHealthDamage:null,hits:null,baselineHits,startingHp,preyDriveActive:apd>0,unresolvedHyper:hyperSelected&&!manualHyper,applied};
 if(!positive(baseDamage))return unknown;
 const damage=(bonus:number,low:boolean)=>baseDamage*combineBonuses([hemo,bonus,...(low?[apd]:[])],stacking)*(1-reduction);
 const normal:NumericRange={min:damage(hyper.min,false),max:damage(hyper.max,false)};
 const low:NumericRange={min:damage(hyper.min,true),max:damage(hyper.max,true)};
 if(![normal.min,normal.max,low.min,low.max].every(Number.isFinite))return unknown;
 const initiallyLow=finite(health)&&health<35;
 const firstDamage=initiallyLow?low:normal;
 const minEvents=steppedHits(maxHp,health,normal.max,low.max).hits;
 const maxEvents=steppedHits(maxHp,health,normal.min,low.min).hits;
 return {...unknown,firstDamage,lowHealthDamage:low,hits:minEvents==null||maxEvents==null?null:{min:minEvents,max:maxEvents}};
}
