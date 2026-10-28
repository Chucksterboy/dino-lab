import { ArrowUpRight } from 'lucide-react';
import { formatMetric, getSample, wildlifeSpecies } from '../data';
import type { Species, State } from '../data';
import { hitsToKill } from '../lib/calculations';
import { num } from '../lib/ui';

/** Wildlife and matchup records are explicitly Source 1, independent of Source 2. */
export function WildlifeEncounters({specimen,growth,state,onSelect}:{specimen:Species;growth:number;state:State;onSelect:(value:Species)=>void}){
 const sample=getSample(specimen,growth,state);
 // The original wildlife card uses explicit HP, including fractional playable
 // HP. The separate Attacks panel declares its rounded-weight body-hit model.
 const ourHp=sample?.values.hp??sample?.values.weight;
 const primaryDamage=sample?.values.bite??(specimen.kind==='wildlife'?specimen.mechanics.find(m=>m.mode==='absolute'&&/^bite$/i.test(m.name.trim())&&m.minGrowth<=(sample?.growth??growth))?.value:null)??null;
 return <div className="panel table-wrap"><p className="footnote matchup-reference">{sample?`Source 1 · ${specimen.kind==='wildlife'?'fixed wildlife reference':`${num(sample.growth,5)}% growth`} · ${state} · primary damage ${num(primaryDamage,5)} · HP reference ${num(ourHp,5)}`:'Source 1 wildlife reference · matchup unavailable for this species.'}</p><table><thead><tr><th>Wildlife</th><th>HP</th><th>Speed</th><th>Source 1 primary hits</th><th>Threat</th></tr></thead><tbody>{wildlifeSpecies.map(w=>{
  const target=getSample(w,100,state),hp=target?.values.hp;
  const knownAttacks=[target?.values.bite,...w.mechanics.filter(m=>m.mode==='absolute').map(m=>m.value)].filter((value):value is number=>value!=null&&Number.isFinite(value));
  const maxAttack=knownAttacks.length?Math.max(...knownAttacks):null;
  return <tr key={w.id}><td><button className="text-button" onClick={()=>onSelect(w)}>{w.name}<ArrowUpRight size={12}/></button></td><td>{num(hp,0)}</td><td>{formatMetric(target?.values.speed,'speed')}</td><td>{num(hitsToKill(hp,primaryDamage),0)}</td><td>{hitsToKill(ourHp,maxAttack)===1?<span className="danger-text">Known one-hit threat</span>:target?.values.speed!=null&&sample?.values.speed!=null&&target.values.speed>sample.values.speed?<span className="warm-text">Outruns selected growth</span>:'—'}</td></tr>;
 })}</tbody></table></div>;
}
