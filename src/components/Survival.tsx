import { useState } from 'react';
import { Droplets, Utensils, Wind, Zap, Heart, Info, Footprints } from 'lucide-react';
import type { Species, State } from '../data';
import { getSample, formatDuration, metrics, formatMetric } from '../data';
import { num } from '../lib/ui';
import { rehydratesInWater, sprintDuration, staminaRecovery, standingStaminaRecovery, survivalDuration, swimDuration, travelDistance } from '../lib/calculations';

export function Survival({specimen,growth,state}:{specimen:Species,growth:number,state:State}){
 const [food,setFood]=useState(100),[water,setWater]=useState(100),[blood,setBlood]=useState(100);
 const [editingReserve,setEditingReserve]=useState<string|null>(null),[reserveText,setReserveText]=useState('');
 const sample=getSample(specimen,growth,state);const v=sample?.values??{};
 const sprint=sprintDuration(v.staminaDrain,sample?.growth??growth);
 const sprintDistance=travelDistance(v.sprint??v.speed,sprint);
 const fastSwimDistance=travelDistance(v.fastSwim,v.fastSwimDuration!=null&&v.fastSwimDuration>0?v.fastSwimDuration:null);
 const landThirst=rehydratesInWater(specimen.name);
 return <div className="panel-stack">
  <div className="section-heading"><div><h2>Survival systems</h2><p>Explore your reserves and recovery at {num(sample?.growth??growth)}% growth.</p></div><span className="tag"><span className="dot mint"/> Source 1 model</span></div>
  {!sample&&<div className="notice">Survival figures are unavailable for this species in Source 1. Its Source 2 stats remain available.</div>}
  <div className="survival-grid">
   {[{name:'Hunger',icon:Utensils,value:food,set:setFood,full:v.hunger,color:'#f3ba82',note:'Time until the food bar is empty.'},{name:'Thirst',icon:Droplets,value:water,set:setWater,full:v.thirst,color:'#87c9ed',note:'Time until the water bar is empty.'}].map(({name,icon:Icon,value,set,full,color,note})=><section className="panel reserve-card" key={name}>
    <div className="reserve-top"><span className="metric-icon" style={{color}}><Icon size={19}/></span><span>{name}{name==='Thirst'&&landThirst?' (land)':''}</span><strong><input aria-label={`${name} percentage`} type="number" min="0" max="100" step="1" value={editingReserve===name?reserveText:value} onFocus={()=>{setEditingReserve(name);setReserveText(String(value));}} onChange={e=>{setReserveText(e.target.value);const parsed=Number.parseFloat(e.target.value);if(Number.isFinite(parsed))set(Math.max(0,Math.min(100,parsed)));}} onBlur={()=>setEditingReserve(null)} style={{width:66,border:0,padding:0,background:'transparent',color:'inherit',font:'inherit',textAlign:'right'}}/><small>%</small></strong></div>
    <input type="range" aria-label={`${name} level`} min="0" max="100" value={value} onChange={e=>set(+e.target.value)} style={{accentColor:color}}/>
    <div className="timer-value">{formatDuration(editingReserve===name&&reserveText.trim()===''?null:survivalDuration(full,value))}<span>remaining</span></div><p>{note}{name==='Thirst'&&landThirst?' This species rehydrates while swimming.':''}</p>
   </section>)}
   <section className="panel reserve-card"><div className="reserve-top"><span className="metric-icon mint-text"><Wind size={20}/></span><span>Oxygen</span><strong><small>DIVE</small></strong></div><div className="timer-value">{formatDuration(v.oxygen)}<span>dive duration</span></div><div className="data-line"><span>Oxygen refill</span><strong>{formatDuration(v.oxygenRegen)}</strong></div><p>Source duration at the selected growth.</p></section>
  </div>
  <div className="two-columns"><section className="panel"><div className="panel-heading"><h3><Zap size={17}/> Stamina & movement</h3></div><div className="big-reading lime-text">{formatDuration(sprint)}<span>sprint endurance</span></div>
   <div className="data-line"><span><Footprints size={14}/> Estimated sprint distance</span><strong>{sprintDistance!=null?`${num(sprintDistance,0)} m`:'—'}</strong></div>
   <div className="data-line"><span>Fast swim endurance</span><strong>{formatDuration(swimDuration(v.fastSwimDuration))}{v.fastSwimDuration!=null&&v.fastSwimDuration<0?' · refills':''}</strong></div><div className="data-line"><span>Slow swim endurance</span><strong>{formatDuration(swimDuration(v.slowSwimDuration))}{v.slowSwimDuration!=null&&v.slowSwimDuration<0?' · refills':''}</strong></div>
   <div className="data-line"><span>Fast swim distance</span><strong>{fastSwimDistance!=null?`${num(fastSwimDistance,0)} m`:'—'}</strong></div>
   <p className="footnote"><Info size={14}/> Sprint uses Source 1’s juvenile scaling. Swim endurance uses adult duration; juvenile scaling remains unresolved. “Replenishes” indicates stamina gain.</p>
  </section><section className="panel"><div className="panel-heading"><h3><Heart size={17}/> Recovery model</h3><span className="tag">Blood-sensitive</span></div><div className="range-label"><label htmlFor="blood">Blood level</label><strong>{blood}%</strong></div><input id="blood" type="range" min="5" max="100" value={blood} onChange={e=>setBlood(+e.target.value)}/>
   <div className="data-line"><span>Stamina · resting to full</span><strong>{formatDuration(staminaRecovery(v.staminaRest,blood))}</strong></div><div className="data-line"><span title="Source full-bar equivalent; on land, standing recovery cannot start below 20% in this baseline model.">Standing · full-bar equivalent</span><strong>{formatDuration(staminaRecovery(v.staminaStand,blood))}</strong></div><div className="data-line"><span>Standing · from 20%</span><strong>{formatDuration(standingStaminaRecovery(v.staminaStand,blood))}</strong></div>
   <div className="data-line"><span>Rest ramp starts</span><strong>{formatDuration(v.restFlatUntil)}</strong></div><div className="data-line"><span>Rest maximum</span><strong>{num(v.restCeiling)}× at {formatDuration(v.restCeilingAt)}</strong></div>
   <p className="footnote"><Info size={14}/> Standing recovery starts at 20% stamina on land in this observed baseline. Lying down includes the rest ramp; standing resets its bonus. Blood scales stamina refill only. Blood recovery is unconfirmed; health recovery is excluded from this calculator.</p>
  </section></div>
  <div className="notice"><Info size={16}/><div>Hunger and thirst measure time to an empty bar, excluding subsequent damage. Growing hunger is an upper-bound estimate because server growth can consume extra food. Deinosuchus and Beipiaosaurus thirst timers apply on land.</div></div>
  <section className="panel"><div className="panel-heading"><h3>Complete survival & recovery values</h3><span className="muted">Original source values</span></div><div className="metric-list">{metrics.filter(m=>m.group==='survival'||m.group==='recovery').map(m=><div className="data-line" key={m.key}><span>{m.label}{m.uncertain&&<span className="uncertain">Unconfirmed</span>}</span><strong>{formatMetric(v[m.key],m.key)}</strong></div>)}</div></section>
 </div>;
}
