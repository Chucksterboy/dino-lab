import { useState } from 'react';
import { Crosshair, Shield, Info, Swords, Dna } from 'lucide-react';
import { getSample, getSheetValue, species, formatMetric } from '../data';
import type { Species, State, Mechanic, Sample } from '../data';
import { dietOf, num } from '../lib/ui';
import { attackDamage } from '../lib/calculations';
import { createCombatLoadout, mutationCombat, mutationSelected, COMBAT_MUTATION_IDS } from '../lib/mutations';
import type { CombatDiet, CombatMutationLoadout, MutationStacking, NumericRange } from '../lib/mutations';
import { CombatMutations } from './CombatMutations';

function rangeReading(range:NumericRange|null,digits=2):string{
 if(!range)return '—';
 if(range.min===range.max)return num(range.min,digits);
 const minimum=num(range.min,digits),maximum=num(range.max,digits);
 return minimum===maximum?`${num(range.min,8)}–${num(range.max,8)}`:`${minimum}–${maximum}`;
}

export function attackEventKind(mechanic?:Mechanic):'hit'|'tick'|'model'{
 const text=`${mechanic?.name??''} ${mechanic?.description??''}`;
 if(/venom|\bDoT\b/i.test(text))return 'model';
 if(/per tick/i.test(text))return 'tick';
 return 'hit';
}
export function wildlifePrimaryDamage(specimen:Species,sample:Sample|undefined,mechanics:Mechanic[]=specimen.mechanics):number|null{
 const bite=sample?.values.bite;
 if(bite!=null)return bite;
 if(specimen.kind!=='wildlife')return null;
 return mechanics.find(m=>m.mode==='absolute'&&/^Bite$/i.test(m.name)&&m.minGrowth<=(sample?.growth??100))?.value??null;
}

export function Attacks({specimen,growth,state,mechanics}:{specimen:Species,growth:number,state:State,mechanics:Mechanic[]}){
 const [targetId,setTargetId]=useState('triceratops'),[targetGrowth,setTargetGrowth]=useState(75),[targetState,setTargetState]=useState<State>('Prime'),[attackId,setAttackId]=useState('bite'),[incomingId,setIncomingId]=useState('bite');
 const [yourMutations,setYourMutations]=useState(createCombatLoadout),[targetMutations,setTargetMutations]=useState(createCombatLoadout),[stacking,setStacking]=useState<MutationStacking>('additive');
 const changeYourMutations=(next:CombatMutationLoadout)=>{setYourMutations(next);if(next.largerSpeciesOpponent)setTargetMutations(current=>current.largerSpeciesOpponent?{...current,largerSpeciesOpponent:false}:current);};
 const changeTargetMutations=(next:CombatMutationLoadout)=>{setTargetMutations(next);if(next.largerSpeciesOpponent)setYourMutations(current=>current.largerSpeciesOpponent?{...current,largerSpeciesOpponent:false}:current);};
 const sample=getSample(specimen,growth,state);const target=species.find(s=>s.id===targetId)??species[0];const victim=getSample(target,targetGrowth,targetState);
 const dashboardGrowth=sample?.growth??growth;
 const primaryDamage=wildlifePrimaryDamage(specimen,sample,mechanics);
 const primaryFlat=specimen.kind==='wildlife'&&sample?.values.bite==null?mechanics.find(m=>m.mode==='absolute'&&/^Bite$/i.test(m.name)&&m.minGrowth<=dashboardGrowth):undefined;
 const attackMechanics=mechanics.filter(m=>(m.chart==='bite'&&m.mode==='multiplier')||m.mode==='absolute');
 const attacks=attackMechanics.filter(m=>m.minGrowth<=dashboardGrowth);
 const attack=attacks.find(m=>m.id===attackId);
 const activeAttackId=attack?.id??'bite';
 const damage=attack?attack.value==null?null:attack.mode==='absolute'?attack.value:attackDamage(sample?.values.bite,attack.value):primaryDamage;
 const hp=target.kind==='wildlife'?victim?.values.hp:victim?.values.weight;
 const incomingAttacks=[...(target.kind==='playable'?[{id:'bite',name:'Primary attack',damage:victim?.values.bite??null,mechanic:undefined as Mechanic|undefined}]:[]),...target.mechanics.filter(m=>((m.chart==='bite'&&m.mode==='multiplier')||m.mode==='absolute')&&m.minGrowth<=(victim?.growth??targetGrowth)).map(m=>({id:m.id,name:m.name,damage:m.mode==='absolute'?m.value:attackDamage(victim?.values.bite,m.value),mechanic:m}))];
 const incomingAttack=incomingAttacks.find(m=>m.id===incomingId)??incomingAttacks[0];
 const ourHp=specimen.kind==='wildlife'?sample?.values.hp:sample?.values.weight;
 const yourActor={kind:specimen.kind,diet:dietOf(specimen).toLowerCase() as CombatDiet,loadout:yourMutations,speciesId:specimen.id};
 const targetActor={kind:target.kind,diet:dietOf(target).toLowerCase() as CombatDiet,loadout:targetMutations,speciesId:target.id};
 const outgoing=mutationCombat(damage,hp,yourActor,targetActor,stacking);
 const incoming=mutationCombat(incomingAttack?.damage,ourHp,targetActor,yourActor,stacking);
 const mutationsSelected=COMBAT_MUTATION_IDS.some(id=>mutationSelected(id,yourActor)||mutationSelected(id,targetActor));
 const outgoingKind=attackEventKind(attack??primaryFlat),incomingKind=attackEventKind(incomingAttack?.mechanic);
 const eventName=(kind:ReturnType<typeof attackEventKind>)=>kind==='tick'?'tick':kind==='model'?'modeled event':'hit';
 const eventPlural=(kind:ReturnType<typeof attackEventKind>)=>kind==='tick'?'Ticks':kind==='model'?'Modeled events':'Hits';
 const exactDamage=attack?.mode==='multiplier'?`${num(sample?.values.bite,12)} × ${num(attack.value,12)} = ${num(damage,12)}`:num(damage,12);
 return <div className="panel-stack"><div className="section-heading"><div><h2>Attack analysis</h2><p>Inspect damage, controls and matchups with the source assumptions visible.</p></div><span className="tag"><Swords size={13}/> {outgoingKind==='hit'&&incomingKind==='hit'?'Body-hit model':'Source-event model'}</span></div>
  {!sample&&<div className="notice">Source 1 has no matchup records for this species. Its Source 2 attacks and controls are available below.</div>}
  <section className="panel combat-panel"><div className="combat-setup"><div><label htmlFor="attack">Your attack · base damage</label><select id="attack" value={activeAttackId} onChange={e=>setAttackId(e.target.value)}><option value="bite">{primaryFlat?'Bite':'Primary attack'} · {num(primaryDamage)} damage</option>{attacks.filter(m=>m.id!==primaryFlat?.id).map(m=><option value={m.id} key={m.id}>{m.name}{attackEventKind(m)==='model'?' · unverified model':attackEventKind(m)==='tick'?' · per tick':''}</option>)}</select></div><div><label htmlFor="target">Target species</label><select id="target" value={targetId} onChange={e=>{setTargetId(e.target.value);setTargetMutations(createCombatLoadout());setYourMutations(current=>({...current,largerSpeciesOpponent:false}));}}>{species.filter(s=>s.samples.length).map(s=><option key={s.id} value={s.id}>{s.name}{s.kind==='wildlife'?' · Wildlife':''}</option>)}</select></div><div><label htmlFor="target-state">Target condition</label><select id="target-state" value={targetState} onChange={e=>setTargetState(e.target.value as State)}><option>Prime</option><option>Frail</option></select></div></div>
   {target.kind==='playable'&&<div className="target-growth"><label htmlFor="target-growth">Target growth <strong>{targetGrowth}%</strong></label><input id="target-growth" type="range" min="25" max="100" value={targetGrowth} onChange={e=>setTargetGrowth(+e.target.value)}/></div>}
   <div className="data-line"><label htmlFor="incoming-attack">Their attack · base damage</label><select id="incoming-attack" value={incomingAttack?.id??''} onChange={e=>setIncomingId(e.target.value)} aria-label="Incoming attack">{incomingAttacks.length?incomingAttacks.map(m=><option key={m.id} value={m.id}>{m.name} · {num(m.damage,2)} damage{attackEventKind(m.mechanic)==='model'?' · unverified model':attackEventKind(m.mechanic)==='tick'?' / tick':''}</option>):<option value="">No damage value in the source</option>}</select></div>
   <div className="combat-results"><div><Crosshair size={21}/><span>Your damage / {eventName(outgoingKind)}</span><strong className={outgoing.firstDamage&&outgoing.firstDamage.min!==outgoing.firstDamage.max?'mutation-count-range':undefined} title={`Base Source 1 damage: ${exactDamage}. Unrounded first-event damage: ${rangeReading(outgoing.firstDamage,12)}. ${outgoing.applied.join(' · ')} Required events use unrounded damage.`}>{rangeReading(outgoing.firstDamage)}</strong>{outgoing.preyDriveActive&&<small className="combat-mutation-reading">Below 35% HP: {rangeReading(outgoing.lowHealthDamage)}</small>}</div><div><Swords size={21}/><span>{eventPlural(outgoingKind)} to defeat {target.name}</span><strong className={outgoing.hits&&outgoing.hits.min!==outgoing.hits.max?'mutation-count-range':undefined}>{rangeReading(outgoing.hits,0)}</strong>{mutationsSelected&&<small className="combat-baseline">Without mutations: {num(outgoing.baselineHits,0)}</small>}</div><div><Shield size={21}/><span>Their selected {eventPlural(incomingKind).toLowerCase()} to defeat you</span><strong className={incoming.hits&&incoming.hits.min!==incoming.hits.max?'mutation-count-range':undefined}>{rangeReading(incoming.hits,0)}</strong><small className="combat-mutation-reading" title={incoming.applied.join(' · ')}>First damage: {rangeReading(incoming.firstDamage)}{incoming.preyDriveActive?` · below 35% HP: ${rangeReading(incoming.lowHealthDamage)}`:''}</small>{mutationsSelected&&<small className="combat-baseline">Without mutations: {num(incoming.baselineHits,0)}</small>}</div></div>
   <div className="mutation-model"><div className="mutation-model-heading"><h3><Dna size={18}/> Mutation modifiers</h3><label>Stacking assumption<select aria-label="Mutation stacking assumption" value={stacking} onChange={e=>setStacking(e.target.value as MutationStacking)}><option value="additive">Add bonuses</option><option value="multiplicative">Multiply bonuses</option></select></label></div><div className="mutation-model-grid"><CombatMutations specimen={specimen} label="Your" prefix="your" value={yourMutations} onChange={changeYourMutations} maxHp={ourHp} opponentId={target.id}/><CombatMutations specimen={target} label="Target" prefix="target" value={targetMutations} onChange={changeTargetMutations} maxHp={hp} opponentId={specimen.id}/></div><p className="mutation-model-note">Stacking is a scenario assumption; conditional defense is applied after outgoing bonuses. Bleeding and species-size conditions stay fixed, while Prey Drive checks remaining HP before each event.{outgoing.unresolvedHyper||incoming.unresolvedHyper?' Ranges reflect Hypermetabolic’s unpublished hunger curve.':''}</p></div>
   <p className="footnote"><Info size={15}/> For constant damage, events = ceiling(remaining HP ÷ unrounded event damage). Prey Drive counts the two health stages separately. Playable HP equals weight; wildlife uses its explicit HP. Assumes body damage, excluding bleed, armor, missed attacks and recovery. Displayed damage is rounded. Event counts do not predict time to defeat. An empty value means unavailable.</p>
   {(outgoingKind==='tick'||incomingKind==='tick')&&<p className="footnote"><Info size={15}/> Loop damage is per source tick, not per attack animation or per second. Tick frequency is not inferred.</p>}
   {(outgoingKind==='model'||incomingKind==='model')&&<div className="notice"><Info size={16}/><div>Unverified venom community model. These are equivalent modeled events, not individual physical hits. Source 1 has no verified venom damage values; its Stage 1 note assumes five damage ticks over five seconds, and another pounce within five seconds restarts the effect. The calculator does not simulate timing or lost ticks.</div></div>}
  </section>
  <section className="panel"><div className="panel-heading"><h3>Source 1 attack modifiers</h3><span className="muted">{attackMechanics.length} mechanics</span></div><div className="attack-list">{attackMechanics.map(m=><div className="attack-row" key={m.id}><span className="attack-bullet" style={{background:m.color}}/><div><strong>{m.name}{attackEventKind(m)==='model'&&<span className="uncertain">Unverified model</span>}</strong><p>{m.description}</p></div><div className="attack-reading"><strong title={`Unrounded source damage: ${num(m.mode==='absolute'?m.value:attackDamage(sample?.values.bite,m.value),12)}`}>{m.minGrowth>dashboardGrowth?'Locked':num(m.mode==='absolute'?m.value:attackDamage(sample?.values.bite,m.value),2)}</strong><span>{m.mode==='multiplier'?`${num(m.value,6)}× bite`:`${num(m.value)} damage`}{attackEventKind(m)==='tick'?' · per tick':attackEventKind(m)==='model'?' · modeled event':''}{m.minGrowth>0?` · ${m.minGrowth}%+`:''}</span></div></div>)}{!attackMechanics.length&&<p className="empty-text">No attack modifiers are recorded in this source.</p>}</div></section>
  {specimen.sheet&&<section className="panel"><div className="panel-heading"><h3>Source 2 attack reference</h3></div><div className="attack-list">{specimen.sheet.attacks.map(row=>{const cell=getSheetValue(row,growth,state);return <div className="attack-row" key={row.id}><span className="attack-bullet mint"/><div><strong>{row.label}</strong><p>{cell?`${num(cell.growth,5)}% growth · ${cell.state} · cell ${cell.cell}`:'No matching source keyframe'}</p></div><div className="attack-reading"><strong>{cell?.text??'—'}</strong><span>source damage</span></div></div>;})}</div></section>}
  <div className="notice"><Info size={16}/><div>Primary damage at this growth: {formatMetric(primaryDamage,'bite')}. Multi-hit attacks and per-second effects retain the source’s wording; they should not be treated as interchangeable single hits.</div></div>
 </div>;
}
