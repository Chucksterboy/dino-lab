import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { formatMetric, getSample, getSpecies, playableSpecies } from '../src/data/index.ts';
import { comparisonDifference, readValue, sheetRow, weightReferenceAt } from '../src/lib/ui.ts';
import { WildlifeEncounters } from '../src/components/WildlifeEncounters.tsx';

test('Source 2 Sprint chart resolves every species and exact Prime/Frail keyframe to the native speed cell',()=>{
 let checked=0;
 for(const specimen of playableSpecies){
  const sheet=specimen.sheet!;
  const native=JSON.parse(readFileSync(new URL(`../${sheet.rawFile}`,import.meta.url),'utf8')).sheets[0].data[0].rowData;
  // Every authored tab puts its displayed km/h speed (base/biped where named) on row 3.
  assert.match(native[2].values[0].formattedValue,/Speed \(km\/h\)$/);
  assert.equal(sheetRow(specimen,'sprint')?.row,3,specimen.name);
  for(const column of sheet.columns){
   const expected=native[2].values[column.index].effectiveValue.numberValue;
   const actual=readValue(specimen,column.growth,column.state,'sprint','sheet');
   assert.equal(actual,expected,`${specimen.name} ${column.letter} ${column.state}`);
   checked++;
  }
 }
 assert.equal(checked,463);
});

test('opposite-condition weight references expose the actual independent nearest keyframe',()=>{
 let checked=0,differentGrowth=0;
 for(const specimen of playableSpecies){
  const row=specimen.sheet!.rows.find(r=>r.label==='Weight (kg)')!;
  for(const column of specimen.sheet!.columns){
   const state=column.state==='Prime'?'Frail':'Prime';
   const candidates=row.values.filter(value=>value.state===state);
   const expected=candidates.reduce((best,value)=>Math.abs(value.growth-column.growth)<Math.abs(best.growth-column.growth)?value:best);
   const actual=weightReferenceAt(specimen,column.growth,state,'sheet');
   assert.deepEqual(actual,{growth:expected.growth,value:expected.value},`${specimen.name} ${column.letter}`);
   if(actual!.growth!==column.growth)differentGrowth++;
   checked++;
  }
 }
 assert.equal(checked,463);
 assert.equal(differentGrowth,45,'these references must not be described as the same growth');
});

test('wildlife estimates identify the Source 1 growth used below the source minimum',()=>{
 const markup=renderToStaticMarkup(createElement(WildlifeEncounters,{specimen:getSpecies('Allosaurus')!,growth:0,state:'Prime',onSelect:()=>{}}));
 assert.ok(markup.includes('Source 1 · 25% growth · Prime · primary damage 5.2'));
 assert.ok(markup.includes('Source 1 primary hits'));
 const row=markup.match(/<tr>.*?Goat.*?<\/tr>/)?.[0];
 assert.ok(row?.includes('<td>60</td>'));
 assert.ok(row?.includes('<td>12</td>'),'60 HP / 5.2 Source 1 damage needs 12 body hits');
});

test('wildlife threat uses explicit HP and known absolute Bite rather than weight or unknown biteforce',()=>{
 const boar=getSpecies('Boar')!;
 const markup=renderToStaticMarkup(createElement(WildlifeEncounters,{specimen:boar,growth:100,state:'Prime',onSelect:()=>{}}));
 assert.ok(markup.includes('primary damage 40'));
 const boarRow=markup.match(/<tr><td><button[^>]*>Boar<.*?<\/tr>/)?.[0];
 assert.ok(boarRow,'Boar row exists');
 assert.ok(boarRow.includes('<td>350</td>'));
 assert.ok(boarRow.includes('<td>9</td>'),'350 HP / 40 absolute Bite is 9 hits');
 assert.ok(!boarRow.includes('Known one-hit threat'),'175 damage cannot one-hit 350 HP despite 125 kg body weight');
});

test('refill durations are not compared as percentages against stamina drain durations',()=>{
 assert.equal(comparisonDifference(-303,75.8),null);
 assert.equal(comparisonDifference(75.8,-303),null);
 assert.equal(comparisonDifference(0,-303),null);
 assert.equal(comparisonDifference(-303,0),null);
 assert.equal(comparisonDifference(-303,-303),'0%');
 assert.equal(comparisonDifference(-606,-303),'+100%');
 assert.equal(comparisonDifference(150,100),'+50%');
 assert.equal(comparisonDifference(0,100),'-100%');
});

test('wildlife threat retains fractional playable HP instead of rounding it down to body weight',()=>{
 const specimen=getSpecies('beipiosaurus')!;
 const sample=getSample(specimen,39,'Prime')!;
 const probe={...specimen,samples:[{...sample,values:{...sample.values,weight:175,hp:175.2}}]};
 const markup=renderToStaticMarkup(createElement(WildlifeEncounters,{specimen:probe,growth:39,state:'Prime',onSelect:()=>{}}));
 assert.ok(markup.includes('HP reference 175.2'));
 const boarRow=markup.match(/<tr><td><button[^>]*>Boar<.*?<\/tr>/)?.[0];
 assert.ok(boarRow,'Adult Boar row exists');
 assert.ok(!boarRow.includes('Known one-hit threat'),'175 damage cannot one-hit 175.2 HP, even with a rounded body weight of 175 kg');
 assert.equal(formatMetric(getSample(specimen,39,'Prime')?.values.hp,'hp'),'25.2 HP');
});
