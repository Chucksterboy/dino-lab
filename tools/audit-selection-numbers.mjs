/** Read-only numeric audit. Run with node --import tsx tools/audit-selection-numbers.mjs. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { species, getSpecies, getSample, metricByKey, metrics } from '../src/data/index.ts';
import { sheetRow, readValue, num } from '../src/lib/ui.ts';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const code=await fs.readFile(path.join(root,'src/components/AnalysisViews.tsx'),'utf8');
const names=['columnsFor','normalizeSelection','initialSelection','patchedSelection','movementSheetRow','valueFor','labelFor','percentDifference'];
// Expose the repository's existing helpers in memory without mounting any UI.
const bundled=await build({stdin:{contents:code+`\nexport {${names.join(',')}};`,resolveDir:path.join(root,'src/components'),loader:'tsx'},bundle:true,packages:'external',platform:'node',format:'cjs',write:false,jsx:'automatic',logLevel:'silent'});
const auditModule={exports:{}};
new Function('require','module','exports',bundled.outputFiles[0].text)(createRequire(path.join(root,'package.json')),auditModule,auditModule.exports);
const helpers=auditModule.exports;
const report={checkedAt:new Date().toISOString(),checks:0,counts:{dashboardSelections:0,sheetSelections:0,metricCells:0,sourceIsolation:0,stateSwitches:0,sourceSwitches:0},failures:[]};
function check(condition,message,detail){report.checks++;if(!condition)report.failures.push({message,...detail});}
const equal=(a,b)=>a===b||(typeof a==='number'&&typeof b==='number'&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-12);
function numeric(cell){const n=cell?.effectiveValue?.numberValue??cell?.userEnteredValue?.numberValue;if(typeof n==='number')return n;const text=cell?.formattedValue?.trim();if(!text)return null;const parsed=Number(text.replaceAll(',',''));return Number.isFinite(parsed)?parsed:null;}
const patterns={weight:/^Weight \(kg\)$/i,bite:/^(Bite\b|Gore\b|Headbutt\b)/i,speed:/^(Speed|Base Speed|Biped Speed) \(km\/h\)$/i,sprint:/^(Speed|Base Speed|Biped Speed) \(km\/h\)$/i,trot:/^Trot \(km\/h\)$/i,fastSwim:/^Swim Speed \(km\/h\)$/i};

for(const specimen of species){
 for(const sample of specimen.samples){
  const selection=helpers.normalizeSelection({speciesId:specimen.id,source:'dashboard',growth:sample.growth,state:sample.state});
  report.counts.dashboardSelections++;
  check(selection.growth===sample.growth&&selection.state===sample.state&&selection.source==='dashboard','Dashboard selection changed source/growth/state',{species:specimen.id,growth:sample.growth,state:sample.state});
  for(const metric of metrics){
   report.counts.metricCells++;
   const actual=helpers.valueFor(selection,metric.key),expected=sample.values[metric.key]??null;
   check(equal(actual,expected),'Comparison/table value differs from selected Source 1 record',{species:specimen.id,growth:sample.growth,state:sample.state,metric:metric.key,actual,expected});
  }
 }
 if(!specimen.sheet)continue;
 const native=JSON.parse(await fs.readFile(path.join(root,specimen.sheet.rawFile),'utf8')).sheets[0].data[0].rowData;
 const sourceRows=Object.fromEntries(Object.entries(patterns).map(([key,pattern])=>[key,native.findIndex(row=>pattern.test(row.values?.[0]?.formattedValue?.trim()??''))]));
 for(const column of specimen.sheet.columns){
  const selection=helpers.normalizeSelection({speciesId:specimen.id,source:'sheet',growth:column.growth,state:column.state,column:column.index});
  report.counts.sheetSelections++;
  check(selection.column===column.index&&selection.growth===column.growth&&selection.state===column.state&&selection.source==='sheet','Source 2 selection lost its exact source column',{species:specimen.id,column:column.index,state:column.state});
  for(const metric of metrics){
   const row=sourceRows[metric.key];
   const expected=row===undefined||row<0?null:numeric(native[row]?.values?.[column.index]);
   const actual=helpers.valueFor(selection,metric.key);
   report.counts.metricCells++;
   check(equal(actual,expected),'Comparison/table value differs from native Source 2 cell',{species:specimen.id,column:column.index,state:column.state,metric:metric.key,actual,expected});
   if(row===undefined){report.counts.sourceIsolation++;check(actual===null,'Source 1 metric leaked into Source 2 selection',{species:specimen.id,metric:metric.key,column:column.index,actual});}
   if(row!==undefined){
    const direct=readValue(specimen,column.growth,column.state,metric.key,'sheet');
    check(equal(direct,expected),'Shared Source 2 metric binding differs from native cell',{species:specimen.id,column:column.index,state:column.state,metric:metric.key,actual:direct,expected});
   }
  }
  const otherState=column.state==='Prime'?'Frail':'Prime';
  const candidates=specimen.sheet.columns.filter(c=>c.state===otherState);
  const nearest=candidates.reduce((best,item)=>!best||Math.abs(item.growth-column.growth)<Math.abs(best.growth-column.growth)?item:best,undefined);
  const changed=helpers.patchedSelection(selection,{state:otherState});report.counts.stateSwitches++;
  check(changed.state===otherState&&changed.column===nearest?.index&&changed.growth===nearest?.growth,'Condition change selected the wrong native keyframe',{species:specimen.id,fromColumn:column.index,actual:changed,expectedColumn:nearest?.index});
  if(specimen.samples.length){
   const changedSource=helpers.patchedSelection(selection,{source:'dashboard'});report.counts.sourceSwitches++;
   const nearestSample=specimen.samples.filter(s=>s.state===column.state).reduce((best,item)=>!best||Math.abs(item.growth-Math.max(25,Math.min(100,column.growth)))<Math.abs(best.growth-Math.max(25,Math.min(100,column.growth)))?item:best,undefined);
   check(changedSource.source==='dashboard'&&changedSource.growth===nearestSample?.growth&&changedSource.state===column.state,'Source change selected the wrong Source 1 record',{species:specimen.id,column:column.index,actual:changedSource,expectedGrowth:nearestSample?.growth});
  }
 }
}
for(const [value,reference,expected] of [[0,0,'0%'],[1,0,null],[0,1,'-100%'],[150,100,'+50%'],[50,100,'-50%'],[null,100,null],[100,null,null],[-303,75.8,null],[75.8,-303,null],[-303,-303,'0%'],[-606,-303,'+100%']])check(helpers.percentDifference(value,reference)===expected,'Reference percentage arithmetic failed',{value,reference,expected,actual:helpers.percentDifference(value,reference)});
const output=path.join(root,'test-results/numeric-audit');await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'selection-audit.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,failures:report.failures.slice(0,8)},null,2));
if(report.failures.length)process.exitCode=1;
