import { useId, useState } from 'react';
import { getPeakSample, getSample, getSeries, getSheetValue, metricByKey } from '../data';
import type { Species, State } from '../data';
import { num, sheetRow, sourceLabel } from '../lib/ui';
import type { SourceMode } from '../lib/ui';

export function GrowthChart({specimen,metric='weight',growth=75,state='Prime',source='dashboard',log=false,onGrowth,compact=false,showOther=true,showMechanics=true,showSanctuary=true,showPeak=true}:{specimen:Species,metric?:string,growth?:number,state?:State,source?:SourceMode,log?:boolean,onGrowth?:(n:number)=>void,compact?:boolean,showOther?:boolean,showMechanics?:boolean,showSanctuary?:boolean,showPeak?:boolean}){
 const id=useId().replaceAll(':','');
 const [hover,setHover]=useState<number|null>(null);
 const [hiddenMechanics,setHiddenMechanics]=useState<string[]>([]);
 const row=source==='sheet'?sheetRow(specimen,metric):undefined;
 const otherState:State=state==='Prime'?'Frail':'Prime';
 type CurvePoint={growth:number,value:number|null};
 const readSeries=(variant:State):CurvePoint[] => (source==='sheet'
  ? row?.values.filter(point=>point.state===variant).map(point=>({growth:point.growth,value:point.value}))??[]
  : getSeries(specimen,metric,variant)).slice().sort((a,b)=>a.growth-b.growth);
 const series=readSeries(state);
 const otherSeries=showOther?readSeries(otherState):[];
 const valid=(value:number|null|undefined):value is number => value!=null&&Number.isFinite(value)&&(!log||value>0);
 const points=series.filter((point):point is CurvePoint&{value:number}=>valid(point.value));
 if(!points.length) return <div className="chart-empty">{log?'No positive':'No'} {metricByKey[metric]?.label.toLowerCase()??metric} curve in this source{log?' for a logarithmic scale':''}.</div>;
 const W=760,H=compact?140:210,L=53,R=18,T=25,B=30;
 const minG=Math.min(...series.map(point=>point.growth)),maxG=Math.max(...series.map(point=>point.growth));
 // Mechanics belong to the dashboard dataset. Do not apply its attack model
 // to the independently versioned spreadsheet's values.
 const matchingMechanics=source==='dashboard'?specimen.mechanics.filter(mechanic=>mechanic.chart===metric&&mechanic.value!=null&&Number.isFinite(mechanic.value)&&mechanic.minGrowth<=maxG):[];
 const ownSample=source==='dashboard'?getSample(specimen,growth,state):undefined;
 const ownStat=ownSample?.values[metric]??null;
 const mechanicCurves=showMechanics?matchingMechanics.filter(mechanic=>!hiddenMechanics.includes(mechanic.id)&&growth>=mechanic.minGrowth).map(mechanic=>({
  mechanic,
  points:mechanic.mode==='threshold'
   ? [{growth:minG,value:ownStat==null?null:ownStat*mechanic.value!},{growth:maxG,value:ownStat==null?null:ownStat*mechanic.value!}]
   : series.map(point=>({growth:point.growth,value:point.growth<mechanic.minGrowth?null:mechanic.mode==='multiplier'?(point.value==null?null:point.value*mechanic.value!):mechanic.value})),
 })):[];
 const transform=(value:number)=>log?Math.log10(value):value;
 const scaleValues=[...series,...otherSeries,...mechanicCurves.flatMap(curve=>curve.points)].flatMap(point=>valid(point.value)?[transform(point.value)]:[]);
 const minimum=Math.min(...scaleValues),maximum=Math.max(...scaleValues);
 const low=log?minimum:Math.min(0,minimum);
 const span=Math.max(maximum-low,log ? .2 : 1);
 const hi=low+span*1.16;
 const x=(value:number)=>maxG===minG?L+(W-L-R)/2:L+(value-minG)/(maxG-minG)*(W-L-R);
 const y=(value:number)=>T+(1-(transform(value)-low)/(hi-low))*(H-T-B);
 const path=(values:CurvePoint[])=>{
  let drawing=false;
  return values.map(point=>{
   if(!valid(point.value)){drawing=false;return '';}
   const command=drawing?'L':'M';drawing=true;
   return `${command}${x(point.growth).toFixed(2)},${y(point.value).toFixed(2)}`;
  }).join(' ');
 };
 const d=path(series);
 // Close each continuous segment separately, so missing/zero log samples
 // stay gaps instead of being filled with invented data.
 const segments:CurvePoint[][]=[];
 for(const point of series){if(valid(point.value)){if(!segments.length||!segments.at(-1)!.length)segments.push([]);segments.at(-1)!.push(point);}else if(segments.at(-1)?.length)segments.push([]);}
 const area=segments.filter(segment=>segment.length).map(segment=>path(segment)+` L${x(segment.at(-1)!.growth)},${H-B} L${x(segment[0].growth)},${H-B} Z`).join(' ');
 const nearest=(value:number)=>points.reduce((a,b)=>Math.abs(a.growth-value)<=Math.abs(b.growth-value)?a:b);
 const selected=nearest(hover??growth);
 const current=source==='sheet'&&row?getSheetValue(row,growth,state)?.value:nearest(growth).value;
 // Sanctuary is species-level reference data from Source 1 Prime flags.
 // Source 2 has no eviction flags: reuse only this annotation, never its stats.
 const sanctuarySamples=specimen.samples.filter(sample=>sample.state==='Prime'&&Number.isFinite(sample.growth)&&/^(TRUE|FALSE)$/i.test((sample.raw['Evicted?']??'').trim())).slice().sort((a,b)=>a.growth-b.growth);
 const firstEvicted=sanctuarySamples.findIndex(sample=>sample.evicted);
 const sanctuaryNever=showSanctuary&&firstEvicted===0;
 const sanctuaryWindow=showSanctuary&&firstEvicted>0?{observedStart:sanctuarySamples[0].growth,from:sanctuarySamples[firstEvicted-1].growth,to:sanctuarySamples[firstEvicted].growth}:null;
 const sanctuaryReference=source==='sheet'?'Source 1 sanctuary reference':'Source Prime rows';
 const sanctuaryClip=(value:number)=>Math.max(minG,Math.min(maxG,value));
 const sanctuaryStart=sanctuaryWindow?sanctuaryClip(sanctuaryWindow.observedStart):minG;
 const sanctuaryEnd=sanctuaryWindow?sanctuaryClip(sanctuaryWindow.to):minG;
 const sanctuaryTransition=sanctuaryWindow?sanctuaryClip(sanctuaryWindow.from):minG;
 const peak=source==='dashboard'&&showPeak?getPeakSample(specimen):undefined;
 const sourceFlaggedPeak=specimen.samples.some(sample=>sample.state==='Prime'&&sample.peak);
 const peakExplanation=sourceFlaggedPeak?'Source-flagged Prime peak growth. This is not a universal best growth.':'Prime growth with the highest equally weighted normalized weight, bite and speed score, matching the Source 1 fallback. This is not a universal best growth.';
 const axisLabel=(value:number)=>value!==0&&Math.abs(value)<.01?value.toExponential(1):num(value,Math.abs(value)<1?3:Math.abs(value)<10?1:0);
 return <div className="growth-chart" onMouseLeave={()=>setHover(null)}>
  <div className="chart-live"><span className="dot lime"/>{hover==null?`Selected growth · ${num(source==='sheet'&&row?getSheetValue(row,growth,state)?.growth:nearest(growth).growth,5)}%`:`${num(selected.growth,5)}% growth`}<strong title={`Recorded value: ${num(hover==null?current:selected.value,12)} ${metricByKey[metric]?.unit??''}`}>{num(hover==null?current:selected.value,metric==='weight'?0:2)} <small>{metricByKey[metric]?.unit}</small></strong></div>
  <div className="chart-legend">
   <span className="chart-legend-item"><i style={{backgroundColor:'#b8ee75'}}/>{state}</span>
   {showOther&&otherSeries.some(point=>valid(point.value))&&<span className="chart-legend-item"><i style={{backgroundColor:'#79ded0'}}/>{otherState}</span>}
   {sanctuaryWindow&&<span className="chart-legend-item" title={`${sanctuaryReference}: sanctuary exit lies between the last Evicted? FALSE and first TRUE growth samples.`}><i style={{backgroundColor:'#7b8ec2'}}/>Sanctuary exit {num(sanctuaryWindow.from)}–{num(sanctuaryWindow.to)}%</span>}
   {sanctuaryNever&&<span className="chart-legend-item" title={`${source==='sheet'?'Source 1 sanctuary reference: ':''}The first recorded Prime growth sample is Evicted? TRUE; Source 1 labels this species never allowed in sanctuary.`}>Never allowed in sanctuary (source)</span>}
   {peak&&<span className="chart-legend-item" title={peakExplanation}><i style={{backgroundColor:'#edc77b'}}/>{sourceFlaggedPeak?'Prime peak':'Composite peak'} {num(peak.growth)}%</span>}
  </div>
  <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${specimen.name} ${metricByKey[metric]?.label??metric} by growth${log?', logarithmic scale':''}`} onMouseMove={event=>{const bounds=event.currentTarget.getBoundingClientRect();setHover(minG+Math.max(0,Math.min(1,((event.clientX-bounds.left)/bounds.width*W-L)/(W-L-R)))*(maxG-minG));}} onClick={()=>hover!=null&&onGrowth?.(selected.growth)}>
   <defs>
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b8ee75" stopOpacity=".21"/><stop offset="100%" stopColor="#b8ee75" stopOpacity="0"/></linearGradient>
    <clipPath id={`${id}-plot`}><rect x={L} y={T} width={W-L-R} height={H-T-B}/></clipPath>
   </defs>
   {sanctuaryWindow&&<g data-sanctuary-overlay="true" clipPath={`url(#${id}-plot)`}>
    {sanctuaryEnd>sanctuaryStart&&<rect x={x(sanctuaryStart)} y={T} width={Math.max(0,x(sanctuaryEnd)-x(sanctuaryStart))} height={H-T-B} fill="#7b8ec2" opacity=".07"/>}
    {sanctuaryEnd>sanctuaryTransition&&<rect x={x(sanctuaryTransition)} y={T} width={Math.max(0,x(sanctuaryEnd)-x(sanctuaryTransition))} height={H-T-B} fill="#7b8ec2" opacity=".18"/>}
    {[sanctuaryWindow.from,sanctuaryWindow.to].filter(value=>value>=minG&&value<=maxG).map(value=><line key={value} x1={x(value)} x2={x(value)} y1={T} y2={H-B} stroke="#7b8ec2" strokeDasharray="2 5" opacity=".5"><title>{`${source==='sheet'?'Source 1 sanctuary reference':'Source sanctuary exit window'}: after ${num(sanctuaryWindow.from)}% and by ${num(sanctuaryWindow.to)}% growth, based on Prime flags.`}</title></line>)}
   </g>}
   {[0,.25,.5,.75,1].map(fraction=><g key={fraction}><line className="chart-gridline" x1={L} x2={W-R} y1={T+fraction*(H-T-B)} y2={T+fraction*(H-T-B)}/><text x={L-10} y={T+fraction*(H-T-B)+4} textAnchor="end">{axisLabel(log?10**(hi-fraction*(hi-low)):hi-fraction*(hi-low))}</text></g>)}
   {[minG,50,75,maxG].filter((value,index,all)=>value>=minG&&value<=maxG&&all.indexOf(value)===index).map(value=><text key={value} x={x(value)} y={H-7} textAnchor="middle">{num(value)}%</text>)}
   <g clipPath={`url(#${id}-plot)`}>
    {mechanicCurves.filter(curve=>curve.mechanic.mode==='threshold'&&valid(curve.points[0]?.value)).sort((a,b)=>b.points[0].value!-a.points[0].value!).map(({mechanic,points:curve})=>{
     const boundary=curve[0].value!;const top=y(boundary),bottom=log?H-B:y(0);
     return <g key={`${mechanic.id}-band`}><rect x={L} y={Math.min(top,bottom)} width={W-L-R} height={Math.abs(bottom-top)} fill={mechanic.color} opacity=".1"/><text x={W-R-6} y={top-5} textAnchor="end" fill={mechanic.color}>{`${mechanic.name} ≤ ${num(boundary,metric==='weight'?0:2)} ${metricByKey[metric]?.unit??''}`}</text></g>;
    })}
    <path d={area} fill={`url(#${id})`}/>
    {showOther&&<path d={path(otherSeries)} fill="none" stroke="#79ded0" strokeWidth="1.6" strokeDasharray="5 5" opacity=".6" strokeLinejoin="round"><title>{`${otherState} ${metricByKey[metric]?.label??metric}`}</title></path>}
    {mechanicCurves.map(({mechanic,points:curve})=><path key={mechanic.id} d={path(curve)} fill="none" stroke={mechanic.color} strokeWidth="1.4" strokeDasharray={mechanic.mode==='threshold'?'4 6':undefined} opacity=".72" strokeLinejoin="round"><title>{`${mechanic.name}: ${mechanic.mode==='threshold'?`target ${metricByKey[metric]?.label??metric} ≤ your selected stat (${num(ownStat,6)}) × ${num(mechanic.value,6)} = ${num(curve[0]?.value,6)}`:mechanic.mode==='multiplier'?`${num(mechanic.value,6)} × ${metricByKey[metric]?.label??metric}`:num(mechanic.value)}; available from ${num(mechanic.minGrowth)}% growth. ${mechanic.description}`}</title></path>)}
    <path d={d} fill="none" stroke="#b8ee75" strokeWidth="2.5" strokeLinejoin="round"/>
   </g>
   {peak&&peak.growth>=minG&&peak.growth<=maxG&&<g><line x1={x(peak.growth)} x2={x(peak.growth)} y1={T} y2={H-B} stroke="#edc77b" strokeDasharray="2 5" opacity=".55"/><path d={`M${x(peak.growth)-4},${T-6} L${x(peak.growth)+4},${T-6} L${x(peak.growth)},${T-1} Z`} fill="#edc77b"/><title>{peakExplanation}</title></g>}
   {(hover!=null||valid(current))&&<g><line x1={x(selected.growth)} x2={x(selected.growth)} y1={T} y2={H-B} stroke="#a8b6ad" strokeDasharray="3 5" opacity=".5"/><circle cx={x(selected.growth)} cy={y(selected.value)} r="5" fill="#b8ee75" stroke="#17201b" strokeWidth="3"/></g>}
  </svg>
  {showMechanics&&matchingMechanics.length>0&&!compact&&<div className="chart-mechanic-toggles" aria-label="Visible mechanic curves">{matchingMechanics.map(mechanic=><button type="button" key={mechanic.id} className={`chart-mechanic-toggle ${hiddenMechanics.includes(mechanic.id)||growth<mechanic.minGrowth?'is-muted':''}`} aria-pressed={!hiddenMechanics.includes(mechanic.id)&&growth>=mechanic.minGrowth} disabled={growth<mechanic.minGrowth} title={`${mechanic.description} From ${num(mechanic.minGrowth)}% growth.`} onClick={()=>setHiddenMechanics(previous=>previous.includes(mechanic.id)?previous.filter(value=>value!==mechanic.id):[...previous,mechanic.id])}><i style={{backgroundColor:mechanic.color}}/>{mechanic.name}{growth<mechanic.minGrowth?` · unlocks ${num(mechanic.minGrowth)}%`:''}</button>)}</div>}
  {log&&<div className="chart-scale-note">Logarithmic scale · zero and negative values are omitted.</div>}
 </div>;
}

export function ScatterChart({items,state='Prime',growth=75,onSelect,source='dashboard',atPeak=false,log=false}:{items:Species[],state?:State,growth?:number,onSelect?:(s:Species)=>void,source?:SourceMode,atPeak?:boolean,log?:boolean}){
 const [hover,setHover]=useState<string|null>(null);
 type PlotPoint={growth:number,weight:number|null,bite:number|null,speed:number|null,peak?:boolean};
 const choosePeak=(points:PlotPoint[])=>{
  const marked=points.find(p=>p.peak);if(marked)return marked;
  const keys=['weight','bite','speed'] as const;
  const ranges=keys.map(key=>{const values=points.flatMap(p=>p[key]==null?[]:[p[key]!]);return{min:Math.min(...values),max:Math.max(...values)};});
  let best:PlotPoint|undefined,score=-Infinity;
  for(const point of points){const value=keys.reduce((sum,key,i)=>{const n=point[key],r=ranges[i];return sum+(n==null?0:r.min===r.max?1:(n-r.min)/(r.max-r.min));},0);if(value>score){best=point;score=value;}}
  return best;
 };
 const data=items.flatMap(s=>{
  let point:PlotPoint|undefined;
  if(source==='dashboard'){
   if(atPeak)point=choosePeak(s.samples.filter(sample=>sample.state===state).map(sample=>({growth:sample.growth,weight:sample.values.weight,bite:sample.values.bite,speed:sample.values.speed,peak:sample.peak})));
   else{const sample=getSample(s,growth,state);if(sample)point={growth:sample.growth,weight:sample.values.weight,bite:sample.values.bite,speed:sample.values.speed};}
  }else if(s.sheet){
   const weight=sheetRow(s,'weight'),speed=sheetRow(s,'speed'),bite=sheetRow(s,'bite');
   const points=s.sheet.columns.filter(column=>column.state===state).map(column=>({growth:column.growth,weight:weight?.values.find(v=>v.column===column.index)?.value??null,bite:bite?.values.find(v=>v.column===column.index)?.value??null,speed:speed?.values.find(v=>v.column===column.index)?.value??null}));
   point=atPeak?choosePeak(points):points.reduce<PlotPoint|undefined>((best,p)=>!best||Math.abs(p.growth-growth)<Math.abs(best.growth-growth)?p:best,undefined);
  }
  return point&&point.weight!=null&&point.speed!=null&&Number.isFinite(point.weight)&&Number.isFinite(point.speed)&&(!log||point.weight>0)?[{s,p:point as PlotPoint&{weight:number,speed:number}}]:[];
 });
 if(!data.length)return <div className="chart-empty">No species in this filter have both weight and speed in the selected source.</div>;
 const transform=(n:number)=>log?Math.log10(n):n;
 const low=log?Math.floor(Math.min(...data.map(({p})=>transform(p.weight)))):0;
 const high=Math.max(low+1,...data.map(({p})=>transform(p.weight)));
 const maxS=Math.max(1,...data.map(({p})=>p.speed))*1.1;
 const x=(weight:number)=>65+(transform(weight)-low)/(high-low)*855;
 const y=(speed:number)=>290-speed/maxS*270;
 return <div className="scatter"><div className="data-line"><span className="muted">{data.length} species plotted · {sourceLabel(source)} · {atPeak?'individual peak':`nearest to ${growth}%`} · {state}</span><span className="muted">{log?'Logarithmic weight':'Linear weight'}</span></div><svg viewBox="0 0 950 340" role="img" aria-label={`Species speed versus weight scatter plot, ${sourceLabel(source)}, ${atPeak?'individual peak':`${growth}% growth`}`} onMouseLeave={()=>setHover(null)}>
  {[0,.25,.5,.75,1].map(k=><g key={k}><line x1="65" x2="920" y1={20+k*270} y2={20+k*270} className="chart-gridline"/><text x="52" y={24+k*270} textAnchor="end">{num(maxS*(1-k),0)}</text><text x={65+k*855} y="310" textAnchor="middle">{num(log?10**(low+k*(high-low)):low+k*(high-low),log?2:0)}</text></g>)}
  {data.map(({s,p})=><g key={s.id} tabIndex={0} role="button" aria-label={`Open ${s.name}, ${num(p.growth,5)}% growth, ${num(p.weight)} kg, ${num(p.speed)} km/h`} onClick={()=>onSelect?.(s)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect?.(s);}}} onFocus={()=>setHover(s.id)} onBlur={()=>setHover(null)} onMouseEnter={()=>setHover(s.id)}><circle cx={x(p.weight)} cy={y(p.speed)} r={hover===s.id?9:6} fill={hover===s.id?'#b8ee75':'#7ed6c6'} opacity=".85"/><title>{s.name}: {num(p.weight)} kg · {num(p.speed)} km/h · {num(p.growth,5)}% · {state}</title>{hover===s.id&&<text x={Math.max(180,Math.min(910,x(p.weight)))} y={Math.max(15,y(p.speed)-15)} textAnchor="end" fill="#f4f8f1">{s.name} · {num(p.growth,5)}%</text>}</g>)}
  <text x="480" y="338" textAnchor="middle">Weight (kg){log?' · log scale':''}</text><text transform="translate(14 170) rotate(-90)" textAnchor="middle">Speed (km/h)</text>
 </svg></div>;
}
