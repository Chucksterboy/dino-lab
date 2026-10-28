import type { Species, SheetRow, State } from '../data';
import { getSheetValue, getSample, formatNumber } from '../data';
import { invoke } from '@tauri-apps/api/core';

export type SourceMode = 'dashboard' | 'sheet';
export const sourceLabel=(source:SourceMode)=>source==='sheet'?'Source 2':'Source 1';
export const dietMap: Record<string,string>={beipiaosaurus:'Omnivore',beipiosaurus:'Omnivore',gallimimus:'Omnivore',diabloceratops:'Herbivore',dryosaurus:'Herbivore',hypsilophodon:'Herbivore',kentrosaurus:'Herbivore',maiasaura:'Herbivore',pachycephalosaurus:'Herbivore',stegosaurus:'Herbivore',tenontosaurus:'Herbivore',triceratops:'Herbivore'};
export const artFor=(s:Species)=>`/art/${s.id==='beipiosaurus'?'beipiaosaurus':s.id}.webp`;
export const dietOf=(s:Species)=>s.kind==='wildlife'?'Wildlife':dietMap[s.id]??'Carnivore';
export const accentOf=(s:Species)=>s.kind==='wildlife'?'#b8c5d5':dietOf(s)==='Herbivore'?'#b9ec79':dietOf(s)==='Omnivore'?'#79ded0':'#f0b180';
export const titleOf=(name:string)=>name.replace(/aurus$/,'aurus');
export function sheetRow(s:Species,key:string):SheetRow|undefined{
 if(key==='sprint')key='speed';
 const rows=s.sheet?.rows??[];
 const match:Record<string,RegExp>={weight:/^Weight \(kg\)$/i,bite:/^(Bite\b|Gore\b|Headbutt\b)/i,speed:/^(Speed|Base Speed|Biped Speed) \(km\/h\)$/i,trot:/^Trot \(km\/h\)$/i,fastSwim:/^Swim Speed \(km\/h\)$/i};
 return rows.find(r=>match[key]?.test(r.label));
}
export function readValue(s:Species,growth:number,state:State,key:string,source:SourceMode):number|null{
 if(source==='dashboard') return getSample(s,growth,state)?.values[key]??null;
 const row=sheetRow(s,key);return row?getSheetValue(row,growth,state)?.value??null:null;
}
export const num=(n:number|null|undefined,digits=1)=>formatNumber(n,digits);
export function comparisonDifference(value:number|null,reference:number|null):string|null{
 if(value===null||reference===null||reference===0)return value===0&&reference===0?'0%':null;
 // A refill duration and a drain duration describe different events.
 if((value<0)!==(reference<0))return null;
 const difference=(value/reference-1)*100;
 return `${difference>0?'+':''}${num(difference,1)}%`;
}
export function weightReferenceAt(s:Species,growth:number,state:State,source:SourceMode):{growth:number;value:number|null}|undefined{
 if(source==='dashboard'){const sample=getSample(s,growth,state);return sample?{growth:sample.growth,value:sample.values.weight??null}:undefined;}
 const row=sheetRow(s,'weight');const cell=row?getSheetValue(row,growth,state):undefined;
 return cell?{growth:cell.growth,value:cell.value}:undefined;
}
export async function openSource(url:string){
 if('__TAURI_INTERNALS__' in window) await invoke('open_source',{url});
 else window.open(url,'_blank','noopener,noreferrer');
}
export const initialGrowth=(s:Species)=>s.kind==='wildlife'?100:75;
