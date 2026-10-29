import { useState } from 'react';
import { Crosshair, Shield, Info, Swords, Dna, Footprints } from 'lucide-react';
import { getSample, species } from '../data';
import type { Species, State, Mechanic, Sample } from '../data';
import { dietOf, num, readValue } from '../lib/ui';
import { attackDamage } from '../lib/calculations';
import { createCombatLoadout, mutationCombat, mutationSelected, COMBAT_MUTATION_IDS } from '../lib/mutations';
import type { CombatDiet, CombatMutationLoadout, MutationStacking, NumericRange } from '../lib/mutations';
import { CombatHealth, CombatMutations } from './CombatMutations';
import { SpeciesArtwork } from './SpeciesArtwork';

const combatSpecies=species.filter(s=>s.samples.length||s.kind==='playable'&&s.sheet);
const dietColours:Record<string,string>={Carnivore:'#ff9898',Herbivore:'#b8ee75',Omnivore:'#caa7ff',Wildlife:'#b8c5d5'};

type CombatantCardProps={
 specimen:Species;label:'Your'|'Target';prefix:'your'|'target';growth:number;state:State;
 onSpecies:(id:string)=>void;onGrowth:(growth:number)=>void;onState:(state:State)=>void;
 loadout:CombatMutationLoadout;onLoadout:(loadout:CombatMutationLoadout)=>void;
 maxHp:number|null|undefined;baseBite:number|null|undefined;
};

/** Portraits use the same asset resolver and idle animation as the library. */
export function CombatantCard({specimen,label,prefix,growth,state,onSpecies,onGrowth,onState,loadout,onLoadout,maxHp,baseBite}:CombatantCardProps){
 const wildlife=specimen.kind==='wildlife';
 const workbookOnly=!wildlife&&specimen.samples.length===0;
 const sample=getSample(specimen,growth,state);
 const column=workbookOnly?specimen.sheet?.columns.filter(c=>c.state===state).reduce<(NonNullable<Species['sheet']>['columns'][number])|undefined>((best,c)=>!best||Math.abs(c.growth-growth)<Math.abs(best.growth-growth)?c:best,undefined):undefined;
 const stage=wildlife?'Fixed reference':column?.stage??sample?.stage??'Growth reference';
 const diet=dietOf(specimen);
 return <section className={`arena-combatant arena-combatant--${prefix}`} aria-label={`${label} combatant`}>
  <div className="arena-portrait-heading"><span className="arena-corner-label">{prefix==='your'?'01 / YOUR DINOSAUR':'02 / OPPONENT'}</span><span className="arena-diet" style={{color:dietColours[diet]}}><span className="dot"/>{diet}</span></div>
  <div className="arena-portrait"><div className="arena-portrait-grid"/><div className="arena-portrait-orbit"/>{wildlife?<div className="wildlife-art"><Footprints size={82}/><span>{specimen.name}</span></div>:<SpeciesArtwork key={specimen.id} specimen={specimen} variant="hero" eager/>}<div className="arena-portrait-floor"/></div>
  <div className="arena-combatant-controls">
   <label className="arena-species-select" htmlFor={prefix==='your'?'your-species':'target'}>Dinosaur<select id={prefix==='your'?'your-species':'target'} aria-label={`${label} species`} value={specimen.id} onChange={e=>onSpecies(e.target.value)}>{combatSpecies.map(s=><option key={s.id} value={s.id}>{s.name}{s.kind==='wildlife'?' · Wildlife':''}</option>)}</select></label>
   <div className="arena-growth">
    <div className="arena-growth-heading"><label htmlFor={`${prefix}-growth`}>Growth stage <span>{stage}</span></label><label className="arena-condition"><span>Condition</span><select id={`${prefix}-state`} aria-label={`${label} condition`} value={state} onChange={e=>onState(e.target.value as State)}><option>Prime</option><option>Frail</option></select></label></div>
    {wildlife?<div className="arena-fixed-growth">100% · Fixed reference</div>:<div className="arena-growth-inputs"><input type="range" id={`${prefix}-growth`} aria-label={`${label} growth percentage`} min={workbookOnly?0:25} max="100" step={workbookOnly?'any':'1'} value={growth} onChange={e=>onGrowth(+e.target.value)}/><label className="arena-growth-number"><input key={`${specimen.id}-${growth}`} type="number" aria-label={`${label} exact growth percentage`} min={workbookOnly?0:25} max="100" step="any" defaultValue={growth} onBlur={e=>{const text=e.currentTarget.value;const next=text.trim()&&Number.isFinite(+text)?boundedGrowth(+text,specimen):growth;e.currentTarget.value=String(next);onGrowth(next);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/><span>%</span></label></div>}
   </div>
   <CombatHealth specimen={specimen} label={label} prefix={prefix} value={loadout} onChange={onLoadout} maxHp={maxHp} baseBite={baseBite}/>
  </div>
 </section>;
}

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

type CombatArenaProps={specimen?:Species;growth?:number;state?:State;mechanics?:Mechanic[];mechanicsOverrides?:Record<string,Mechanic[]>};
const boundedGrowth=(value:number,s:Species)=>Math.max(s.samples.length?25:0,Math.min(100,Number.isFinite(value)?value:75));

export function CombatArena({specimen:initialSpecimen=species[0],growth:initialGrowth=75,state:initialState='Prime',mechanics:initialMechanics,mechanicsOverrides={}}:CombatArenaProps={}){
 const [yourId,setYourId]=useState(initialSpecimen.id),[growth,setGrowth]=useState(initialSpecimen.kind==='wildlife'?100:boundedGrowth(initialGrowth,initialSpecimen)),[state,setState]=useState<State>(initialState);
 const specimen=yourId===initialSpecimen.id?initialSpecimen:species.find(s=>s.id===yourId)??initialSpecimen;
 const mechanics=mechanicsOverrides[specimen.id]??(specimen.id===initialSpecimen.id?initialMechanics:undefined)??specimen.mechanics;
 const [targetId,setTargetId]=useState('triceratops'),[targetGrowth,setTargetGrowth]=useState(75),[targetState,setTargetState]=useState<State>('Prime'),[attackId,setAttackId]=useState('bite'),[incomingId,setIncomingId]=useState('bite');
 const [yourMutations,setYourMutations]=useState(createCombatLoadout),[targetMutations,setTargetMutations]=useState(createCombatLoadout),[stacking,setStacking]=useState<MutationStacking>('additive');
 const changeYourMutations=(next:CombatMutationLoadout)=>{setYourMutations(next);if(next.largerSpeciesOpponent)setTargetMutations(current=>current.largerSpeciesOpponent?{...current,largerSpeciesOpponent:false}:current);};
 const changeTargetMutations=(next:CombatMutationLoadout)=>{setTargetMutations(next);if(next.largerSpeciesOpponent)setYourMutations(current=>current.largerSpeciesOpponent?{...current,largerSpeciesOpponent:false}:current);};
 const sample=getSample(specimen,growth,state);const target=species.find(s=>s.id===targetId)??species[0];const victim=getSample(target,targetGrowth,targetState);
 const targetMechanics=mechanicsOverrides[target.id]??target.mechanics;
 const dashboardGrowth=sample?.growth??growth;
 const workbookOnly=specimen.kind==='playable'&&specimen.samples.length===0;
 const targetWorkbookOnly=target.kind==='playable'&&target.samples.length===0;
 const primaryDamage=workbookOnly?readValue(specimen,growth,state,'bite','sheet'):wildlifePrimaryDamage(specimen,sample,mechanics);
 const targetPrimaryDamage=targetWorkbookOnly?readValue(target,targetGrowth,targetState,'bite','sheet'):wildlifePrimaryDamage(target,victim,targetMechanics);
 const primaryFlat=specimen.kind==='wildlife'&&sample?.values.bite==null?mechanics.find(m=>m.mode==='absolute'&&/^Bite$/i.test(m.name)&&m.minGrowth<=dashboardGrowth):undefined;
 const attackMechanics=mechanics.filter(m=>(m.chart==='bite'&&m.mode==='multiplier')||m.mode==='absolute');
 const attacks=attackMechanics.filter(m=>m.minGrowth<=dashboardGrowth);
 const attack=attacks.find(m=>m.id===attackId);
 const activeAttackId=attack?.id??'bite';
 const damage=attack?attack.value==null?null:attack.mode==='absolute'?attack.value:attackDamage(sample?.values.bite,attack.value):primaryDamage;
 const hp=targetWorkbookOnly?readValue(target,targetGrowth,targetState,'weight','sheet'):target.kind==='wildlife'?victim?.values.hp:victim?.values.weight;
 const incomingAttacks=[...(target.kind==='playable'?[{id:'bite',name:'Primary attack',damage:targetPrimaryDamage,mechanic:undefined as Mechanic|undefined}]:[]),...targetMechanics.filter(m=>((m.chart==='bite'&&m.mode==='multiplier')||m.mode==='absolute')&&m.minGrowth<=(victim?.growth??targetGrowth)).map(m=>({id:m.id,name:m.name,damage:m.mode==='absolute'?m.value:attackDamage(victim?.values.bite,m.value),mechanic:m}))];
 const incomingAttack=incomingAttacks.find(m=>m.id===incomingId)??incomingAttacks[0];
 const ourHp=workbookOnly?readValue(specimen,growth,state,'weight','sheet'):specimen.kind==='wildlife'?sample?.values.hp:sample?.values.weight;
 const yourActor={kind:specimen.kind,diet:dietOf(specimen).toLowerCase() as CombatDiet,loadout:yourMutations,speciesId:specimen.id};
 const targetActor={kind:target.kind,diet:dietOf(target).toLowerCase() as CombatDiet,loadout:targetMutations,speciesId:target.id};
 const outgoing=mutationCombat(damage,hp,yourActor,targetActor,stacking);
 const incoming=mutationCombat(incomingAttack?.damage,ourHp,targetActor,yourActor,stacking);
 const mutationsSelected=COMBAT_MUTATION_IDS.some(id=>mutationSelected(id,yourActor)||mutationSelected(id,targetActor));
 const outgoingKind=attackEventKind(attack??primaryFlat),incomingKind=attackEventKind(incomingAttack?.mechanic);
 const eventName=(kind:ReturnType<typeof attackEventKind>)=>kind==='tick'?'tick':kind==='model'?'modeled event':'hit';
 const eventPlural=(kind:ReturnType<typeof attackEventKind>)=>kind==='tick'?'Ticks':kind==='model'?'Modeled events':'Hits';
 const exactDamage=attack?.mode==='multiplier'?`${num(sample?.values.bite,12)} × ${num(attack.value,12)} = ${num(damage,12)}`:num(damage,12);
 const changeYourSpecies=(id:string)=>{
  const next=combatSpecies.find(s=>s.id===id);if(!next)return;
  setYourId(id);setGrowth(next.kind==='wildlife'?100:boundedGrowth(growth,next));setAttackId('bite');
  setYourMutations(createCombatLoadout());setTargetMutations(current=>({...current,largerSpeciesOpponent:false}));
 };
 const changeTargetSpecies=(id:string)=>{
  const next=combatSpecies.find(s=>s.id===id);if(!next)return;
  setTargetId(id);setTargetGrowth(next.kind==='wildlife'?100:boundedGrowth(targetGrowth,next));setIncomingId('bite');
  setTargetMutations(createCombatLoadout());setYourMutations(current=>({...current,largerSpeciesOpponent:false}));
 };
 return <div className="full-page combat-arena">
  <header className="page-header arena-header"><div><span className="eyebrow">THE MATCHUP LAB</span><h1>Combat Arena<span className="heading-dot">.</span></h1><p>Choose your dinosaurs. Build your matchup.</p></div><span className="arena-header-mark" aria-hidden="true"><Swords size={30}/></span></header>
  <div className="arena-combatants">
   <CombatantCard specimen={specimen} label="Your" prefix="your" growth={growth} state={state} onSpecies={changeYourSpecies} onGrowth={n=>setGrowth(boundedGrowth(n,specimen))} onState={setState} loadout={yourMutations} onLoadout={changeYourMutations} maxHp={ourHp} baseBite={primaryDamage}/>
   <div className="arena-versus" aria-hidden="true"><span/><div><Swords size={20}/><strong>VS</strong></div><span/></div>
   <CombatantCard specimen={target} label="Target" prefix="target" growth={targetGrowth} state={targetState} onSpecies={changeTargetSpecies} onGrowth={n=>setTargetGrowth(boundedGrowth(n,target))} onState={setTargetState} loadout={targetMutations} onLoadout={changeTargetMutations} maxHp={hp} baseBite={targetPrimaryDamage}/>
  </div>
  <div className="section-heading arena-analysis-heading"><div><h2>Attack analysis</h2></div><span className="tag"><Swords size={13}/> {outgoingKind==='hit'&&incomingKind==='hit'?'Body-hit model':'Source-event model'}</span></div>
  {!sample&&(primaryDamage==null||ourHp==null)&&<div className="notice">No matchup records are available for this species at the selected growth.</div>}
  <section className="panel combat-panel"><div className="arena-attack-selectors"><div><label htmlFor="attack">Your attack · base damage</label><select id="attack" value={activeAttackId} onChange={e=>setAttackId(e.target.value)}><option value="bite">{primaryFlat?'Bite':'Primary attack'} · {num(primaryDamage)} damage</option>{attacks.filter(m=>m.id!==primaryFlat?.id).map(m=><option value={m.id} key={m.id}>{m.name}{attackEventKind(m)==='model'?' · unverified model':attackEventKind(m)==='tick'?' · per tick':''}</option>)}</select></div>
   <div><label htmlFor="incoming-attack">Their attack · base damage</label><select id="incoming-attack" value={incomingAttack?.id??''} onChange={e=>setIncomingId(e.target.value)} aria-label="Incoming attack">{incomingAttacks.length?incomingAttacks.map(m=><option key={m.id} value={m.id}>{m.name} · {num(m.damage,2)} damage{attackEventKind(m.mechanic)==='model'?' · unverified model':attackEventKind(m.mechanic)==='tick'?' / tick':''}</option>):<option value="">No damage value in the source</option>}</select></div></div>
   <div className="combat-results"><div><Crosshair size={21}/><span>Your damage / {eventName(outgoingKind)}</span><strong className={outgoing.firstDamage&&outgoing.firstDamage.min!==outgoing.firstDamage.max?'mutation-count-range':undefined} title={`Base ${workbookOnly?'Source 2':'Source 1'} damage: ${exactDamage}. Unrounded first-event damage: ${rangeReading(outgoing.firstDamage,12)}. ${outgoing.applied.join(' · ')} Required events use unrounded damage.`}>{rangeReading(outgoing.firstDamage)}</strong>{outgoing.preyDriveActive&&<small className="combat-mutation-reading">Below 35% HP: {rangeReading(outgoing.lowHealthDamage)}</small>}</div><div><Swords size={21}/><span>{eventPlural(outgoingKind)} to defeat {target.name}</span><strong className={outgoing.hits&&outgoing.hits.min!==outgoing.hits.max?'mutation-count-range':undefined}>{rangeReading(outgoing.hits,0)}</strong>{mutationsSelected&&<small className="combat-baseline">Without mutations: {num(outgoing.baselineHits,0)}</small>}</div><div><Shield size={21}/><span>Their selected {eventPlural(incomingKind).toLowerCase()} to defeat you</span><strong className={incoming.hits&&incoming.hits.min!==incoming.hits.max?'mutation-count-range':undefined}>{rangeReading(incoming.hits,0)}</strong><small className="combat-mutation-reading" title={`Base ${targetWorkbookOnly?'Source 2':'Source 1'} damage: ${num(incomingAttack?.damage,12)}. ${incoming.applied.join(' · ')}`}>First damage: {rangeReading(incoming.firstDamage)}{incoming.preyDriveActive?` · below 35% HP: ${rangeReading(incoming.lowHealthDamage)}`:''}</small>{mutationsSelected&&<small className="combat-baseline">Without mutations: {num(incoming.baselineHits,0)}</small>}</div></div>
   <div className="mutation-model"><div className="mutation-model-heading"><h3><Dna size={18}/> Mutation modifiers</h3><label>Stacking assumption<select aria-label="Mutation stacking assumption" value={stacking} onChange={e=>setStacking(e.target.value as MutationStacking)}><option value="additive">Add bonuses</option><option value="multiplicative">Multiply bonuses</option></select></label></div><div className="mutation-model-grid"><CombatMutations specimen={specimen} label="Your" prefix="your" value={yourMutations} onChange={changeYourMutations} opponentId={target.id}/><CombatMutations specimen={target} label="Target" prefix="target" value={targetMutations} onChange={changeTargetMutations} opponentId={specimen.id}/></div></div>
   {(outgoingKind==='tick'||incomingKind==='tick')&&<p className="footnote"><Info size={15}/> Loop damage is per source tick, not per attack animation or per second. Tick frequency is not inferred.</p>}
   {(outgoingKind==='model'||incomingKind==='model')&&<div className="notice"><Info size={16}/><div>Unverified venom community model. These are equivalent modeled events, not individual physical hits. Source 1 has no verified venom damage values; its Stage 1 note assumes five damage ticks over five seconds, and another pounce within five seconds restarts the effect. The calculator does not simulate timing or lost ticks.</div></div>}
  </section>
 </div>;
}
