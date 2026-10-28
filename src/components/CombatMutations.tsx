import { Dna, RotateCcw } from 'lucide-react';
import type { Species } from '../data';
import { byIdMap } from '../data/mutations';
import { dietOf, num } from '../lib/ui';
import { combatMutationRules, createCombatLoadout, mutationBonus, mutationEligible } from '../lib/mutations';
import type { CombatDiet, CombatMutationLoadout, ListedStrength } from '../lib/mutations';

export function CombatMutations({specimen,label,prefix,value,onChange,maxHp,opponentId}:{specimen:Species;label:string;prefix:string;value:CombatMutationLoadout;onChange:(loadout:CombatMutationLoadout)=>void;maxHp:number|null|undefined;opponentId?:string}){
 const diet=dietOf(specimen).toLowerCase() as CombatDiet;
 const actor={kind:specimen.kind,diet};
 const wildlife=specimen.kind==='wildlife';
 const hyper=value.selected.includes('hypermetabolic-inanition')&&mutationEligible('hypermetabolic-inanition',actor);
 const maxHyper=mutationBonus('hypermetabolic-inanition',value.strength)*100;
 const congenital=value.selected.includes('congenital-hypoalgesia')&&mutationEligible('congenital-hypoalgesia',actor);
 const patch=(changes:Partial<CombatMutationLoadout>)=>onChange({...value,...changes});
 return <section className={`mutation-loadout ${wildlife?'mutation-loadout-wildlife':''}`} aria-label={`${label} mutation loadout`}>
  <div className="mutation-loadout-heading"><div><span>{label}</span><h4>{specimen.name}</h4></div><button type="button" className="btn-icon" aria-label={`Reset ${label.toLowerCase()} mutation scenario`} title="Reset this scenario" onClick={()=>onChange(createCombatLoadout())}><RotateCcw size={15}/></button></div>
  <label className="mutation-strength">Mutation level<select aria-label={`${label} entombment level`} disabled={wildlife} value={value.strength} onChange={e=>patch({strength:+e.target.value as ListedStrength,hyperBonusPercent:Math.min(value.hyperBonusPercent,mutationBonus('hypermetabolic-inanition',+e.target.value as ListedStrength)*100)})}>{(['Default','Entombed 1','Entombed 2'] as const).map((name,index)=><option value={index} key={name}>{name}</option>)}</select></label>
  {wildlife&&<p className="mutation-disabled-note">Wildlife cannot equip mutations.</p>}
  <div className="combat-mutation-cards">{combatMutationRules.map(rule=>{
   const allowed=mutationEligible(rule.id,actor),selected=allowed&&value.selected.includes(rule.id);
   const percent=mutationBonus(rule.id,value.strength)*100;
   const catalog=byIdMap[rule.id];
   return <label className={`combat-mutation-card ${selected?'selected':''} ${!allowed?'unavailable':''}`} key={rule.id}>
    <input type="checkbox" aria-label={`${label} ${rule.name}`} checked={selected} disabled={!allowed} onChange={e=>patch({selected:e.target.checked?[...value.selected,rule.id]:value.selected.filter(id=>id!==rule.id)})}/>
    <span className="combat-mutation-copy"><strong>{rule.name}</strong><small>{rule.condition}</small>{!allowed&&!wildlife&&<span className="mutation-eligibility-note">Carnivore only · unavailable for this species</span>}{catalog?.restrictions.some(item=>/slot/i.test(item))&&<span className="mutation-slot-note">{catalog.restrictions.filter(item=>/slot/i.test(item)).join(' · ')}</span>}</span>
    <span className={`mutation-percent ${rule.effect==='defense'?'defense':''}`}>{rule.effect==='defense'?'−':'+'}{num(percent)}%</span>
   </label>;
  })}</div>
  {hyper&&<div className="hyper-scenario"><label htmlFor={`${prefix}-hyper-mode`}>Hypermetabolic effect<select id={`${prefix}-hyper-mode`} aria-label={`${label} Hypermetabolic effect`} value={value.hyperMode} onChange={e=>patch({hyperMode:e.target.value as 'range'|'manual'})}><option value="range">Unknown hunger curve · 0–{num(maxHyper)}%</option><option value="manual">Manual effective bonus</option></select></label>{value.hyperMode==='manual'&&<label className="mutation-health" htmlFor={`${prefix}-hyper-bonus`}><span>Known bonus <strong>{num(value.hyperBonusPercent)}%</strong></span><input id={`${prefix}-hyper-bonus`} aria-label={`${label} Hypermetabolic effective bonus`} type="range" min="0" max={maxHyper} step="0.1" value={value.hyperBonusPercent} onChange={e=>patch({hyperBonusPercent:+e.target.value})}/></label>}</div>}
  <div className="mutation-conditions"><div className="mutation-condition-title"><Dna size={15}/><span>Combat conditions</span></div><label className="mutation-health" htmlFor={`${prefix}-health`}><span>Starting health <strong>{num(value.healthPercent)}%{maxHp!=null?` · ${num(maxHp*value.healthPercent/100,5)} HP`:''}</strong></span><input type="range" id={`${prefix}-health`} aria-label={`${label} starting health percentage`} min="1" max="100" step="1" value={value.healthPercent} onChange={e=>patch({healthPercent:+e.target.value})}/></label><label className="mutation-condition"><input type="checkbox" aria-label={`${label} bleeding`} checked={value.bleeding} onChange={e=>patch({bleeding:e.target.checked})}/><span>Bleeding throughout these events</span></label>{congenital&&<label className="mutation-condition"><input type="checkbox" aria-label={`${label} opponent is a larger species`} checked={opponentId!==specimen.id&&value.largerSpeciesOpponent} disabled={opponentId===specimen.id} onChange={e=>patch({largerSpeciesOpponent:e.target.checked})}/><span>Opponent is a larger species <small>{opponentId===specimen.id?'Same species; this condition cannot apply.':'Set this condition explicitly; growth weight is not used.'}</small></span></label>}</div>
 </section>;
}
