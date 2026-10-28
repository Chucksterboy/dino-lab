import test from 'node:test';
import assert from 'node:assert/strict';
import { Children, createElement, isValidElement } from 'react';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getSpecies } from '../src/data/index.ts';
import { SpeciesPage } from '../src/components/SpeciesPage.tsx';
import { CompareView, TableView } from '../src/components/AnalysisViews.tsx';

test('both source paths omit the removed growth captions, footer strips, survival footer and growth log button',()=>{
 for(const id of ['allosaurus','hypsilophodon']){
  const specimen=getSpecies(id)!;
  const html=renderToStaticMarkup(createElement(SpeciesPage,{specimen,onBack:()=>{},onSelect:()=>{},favorite:false,onFavorite:()=>{},mechanics:specimen.mechanics,onCompare:()=>{}}));
  for(const removed of ['growth-source-note','Source 1 growth','Source 2 keyframes','Survival uses Source 1','Toggle logarithmic scale'])assert.ok(!html.includes(removed),`${id}: ${removed}`);
  assert.ok(!/patch (?:unspecified|unlabeled|0\.)/i.test(html));
  assert.ok(html.includes('Growth stage'));
  assert.ok(html.includes('Data source'));
  assert.equal((html.match(/role="tab"/g)??[]).length,4);
  assert.ok(html.includes('8 wildlife entries'));
 }
});

test('comparison drops saved baby slots, preserves adults, and omits all removed copy',()=>{
 const runtime=globalThis as unknown as {localStorage?:unknown};const previous=runtime.localStorage;
 runtime.localStorage={getItem:()=>JSON.stringify({slots:[
  {speciesId:'babyboar',source:'dashboard',growth:100,state:'Prime'},
  {speciesId:'allosaurus',source:'dashboard',growth:75,state:'Prime'},
  {speciesId:'carnotaurus',source:'sheet',growth:75,state:'Prime'},
 ]})};
 try{
  const html=renderToStaticMarkup(createElement(CompareView,{onSelect:()=>{},notify:()=>{}}));
  assert.ok(!/BabyBoar|BabyDeer|BabyGoat/.test(html));
  assert.ok(html.includes('Allosaurus')&&html.includes('Carnotaurus'));
  assert.ok(html.includes('Add a species twice to compare life stages.'));
  assert.ok(!html.includes('Every slot keeps its own source'));
  assert.ok(!/Patch (?:unlabeled|unspecified|0\.)/.test(html));
  const headers=html.match(/<thead>.*?<\/thead>/)?.[0]??'';
  assert.ok(!/Source [12]/.test(headers),'redundant source line is absent from comparison headings');
  assert.ok(html.includes('Your specimens <span class="muted">2/6</span>'),'valid saved slots survive removal');
 }finally{if(previous===undefined)delete runtime.localStorage;else runtime.localStorage=previous;}
});

test('wildlife table and all selector options contain only the eight retained animals',()=>{
 let clicked=false;
 function Probe(){
  const tree=TableView({onSelect:()=>{},notify:()=>{}});
  const find=(element:ReactElement):ReactElement<{onClick:()=>void;children?:React.ReactNode}>|undefined=>{
   if(element.type==='button'&&(element.props as {children?:unknown}).children==='Wildlife')return element as ReturnType<typeof find>;
   for(const child of Children.toArray((element.props as {children?:React.ReactNode}).children))if(isValidElement(child)){const found=find(child);if(found)return found;}
   return undefined;
  };
  if(!clicked){clicked=true;find(tree)!.props.onClick();}
  return tree;
 }
 const html=renderToStaticMarkup(createElement(Probe));
 assert.ok(!/BabyBoar|BabyDeer|BabyGoat/.test(html));
 for(const name of ['Boar','Deer','Goat','Bullfrog','Chicken','Crab','Rabbit','Seaturtle'])assert.ok(html.includes(name),name);
 assert.ok(!/Patch (?:unlabeled|unspecified|0\.)/.test(html));
 const body=html.match(/<tbody>.*?<\/tbody>/)?.[0]??'';
 assert.equal((body.match(/<tr>/g)??[]).length,8);
});
