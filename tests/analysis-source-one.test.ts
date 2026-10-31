import test from 'node:test';
import assert from 'node:assert/strict';
import { Children, createElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { formatDuration, formatMetric, getSample, getSpecies, playableSpecies, species } from '../src/data/index.ts';
import { CompareView, TableView } from '../src/components/AnalysisViews.tsx';
import { sprintDuration } from '../src/lib/calculations.ts';

type Node = ReactElement<Record<string, any>>;
function findAll(tree: ReactNode, predicate: (node: Node) => boolean): Node[] {
  if (!isValidElement(tree)) return [];
  const node=tree as Node;
  return [...(predicate(node)?[node]:[]),...Children.toArray(node.props.children).flatMap(child=>findAll(child,predicate))];
}
function button(tree: Node, text: string): Node {
  const found=findAll(tree,node=>node.type==='button'&&Children.toArray(node.props.children).some(child=>typeof child==='string'&&child.trim()===text))[0];
  assert.ok(found,`button ${text}`);return found;
}
function labelled(tree: Node, text: string): Node {
  const found=findAll(tree,node=>node.props['aria-label']===text)[0];assert.ok(found,`control ${text}`);return found;
}
function withSaved(saved: Record<string, unknown>, run:()=>void) {
  const runtime=globalThis as unknown as {localStorage?:unknown};const previous=runtime.localStorage;
  runtime.localStorage={getItem:(key:string)=>key in saved?JSON.stringify(saved[key]):null};
  try{run();}finally{if(previous===undefined)delete runtime.localStorage;else runtime.localStorage=previous;}
}
function renderDriven(View: typeof TableView|typeof CompareView, steps: ((tree:Node)=>void)[]=[], inspect?:(tree:Node)=>void) {
  let phase=0;
  function Probe(){const tree=View({onSelect:()=>{},notify:()=>{}}) as Node;inspect?.(tree);if(phase<steps.length)steps[phase++](tree);return tree;}
  const html=renderToStaticMarkup(createElement(Probe));assert.equal(phase,steps.length,'all UI actions executed');return html;
}
function rowsOf(html:string){const table=html.match(/<table class="species-data-table">[\s\S]*?<\/table>/)?.[0]??'';return table.match(/<tr>[\s\S]*?<\/tr>/g)?.slice(1)??[];}
const oldSheetRows=()=>Object.fromEntries(species.map(item=>[item.id,{speciesId:item.id,source:'sheet',growth:87.5,state:'Frail',column:999}]));
function compareSelections(tree:Node){return findAll(tree,node=>typeof node.type==='function'&&node.type.name==='SelectionControls').map(node=>{const {id:_id,...selection}=node.props.value;return selection;});}
function maximumSprintCells(html:string) {
  const table=html.match(/<table class="comparison-table">[\s\S]*?<\/table>/)?.[0]??'';
  const rows=(table.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)??[]).filter(row=>row.includes('<span>Maximum sprint duration</span>'));
  assert.equal(rows.length,1,'maximum sprint duration appears exactly once in the comparison');
  return {row:rows[0],cells:rows[0].match(/<td\b[^>]*>[\s\S]*?<\/td>/g)??[]};
}
const sprintReadings=(html:string)=>maximumSprintCells(html).cells.map(cell=>cell.match(/<strong>([^<]+)<\/strong>/)?.[1]);

test('Complete Picture migrates all saved Source 2 rows to Source 1 without a workbook fallback',()=>{
  const saved=oldSheetRows();saved.hypsilophodon.growth=0;
  withSaved({'dino-lab-table-v1':saved},()=>{
    const html=renderDriven(TableView);
    assert.doesNotMatch(html,/Source 2|table source|table keyframe|Source \/ condition/);
    const rows=rowsOf(html);assert.equal(rows.length,22);
    assert.equal((html.match(/table condition"/g)??[]).length,22,'every playable row keeps a condition control');
    for(const id of ['allosaurus','carnotaurus','triceratops']){
      const specimen=getSpecies(id)!;const row=rows.find(row=>row.includes(specimen.name))!;const sample=getSample(specimen,87.5,'Frail')!;
      assert.ok(row.includes(`<strong>${sample.growth}%</strong>`),'legacy growth maps to nearest Source 1 record');
      assert.ok(row.includes(`<strong>${formatMetric(sample.values.weight,'weight')}</strong>`),`${id} shows actual Source 1 weight`);
      assert.ok(row.includes('<option selected="">Frail</option>'),'condition survives migration');
    }
    const missing=rows.find(row=>row.includes('Hypsilophodon'))!;
    assert.equal(getSpecies('hypsilophodon')!.samples.length,0);
    assert.equal((missing.match(/<strong>—<\/strong>/g)??[]).length,6,'missing Source 1 stays unknown for every core statistic');
    assert.ok(missing.includes('<strong>25%</strong>'),'missing-source growth still clamps to the Source 1 range');
  });
});

test('Complete Picture bulk changes, scatter and reset expose no source selector and stay on Source 1',()=>{
  withSaved({'dino-lab-table-v1':oldSheetRows()},()=>{
    const html=renderDriven(TableView,[
      tree=>button(tree,'Set visible rows').props.onClick(),
      tree=>{const bulk=findAll(tree,node=>node.props.className==='bulk-controls')[0];assert.ok(bulk);assert.equal(findAll(bulk,node=>node.type==='select').length,1,'bulk exposes condition only');labelled(tree,'Bulk growth percentage').props.onChange({target:{value:'50'}});},
      tree=>{const bulk=findAll(tree,node=>node.props.className==='bulk-controls')[0];const condition=findAll(bulk,node=>node.type==='select')[0];condition.props.onChange({target:{value:'Prime'}});},
      tree=>{const apply=findAll(tree,node=>node.type==='button'&&String(node.props.className).includes('btn-primary'))[0];apply.props.onClick();},
      tree=>button(tree,'Explore scatter plot').props.onClick(),
    ]);
    assert.doesNotMatch(html,/Data source|Source 2|Keep each source|table source|Scatter data source/);
    for(const row of rowsOf(html))assert.ok(row.includes('<option selected="">Prime</option>'));
    const allo=rowsOf(html).find(row=>row.includes('Allosaurus'))!;
    assert.ok(allo.includes(`<strong>${formatMetric(getSample('allosaurus',50,'Prime')!.values.weight,'weight')}</strong>`));
    assert.ok(html.includes('aria-label="Scatter condition"'),'scatter retains Prime/Frail');
    const reset=renderDriven(TableView,[tree=>button(tree,'Reset rows').props.onClick()]);
    assert.doesNotMatch(reset,/Source 2|table source/);
    const resetAllo=rowsOf(reset).find(row=>row.includes('Allosaurus'))!;
    assert.ok(resetAllo.includes('<strong>75%</strong>'));
    assert.ok(resetAllo.includes(`<strong>${formatMetric(getSample('allosaurus',75,'Prime')!.values.weight,'weight')}</strong>`));
  });
});

test('comparison migrates legacy Source 2 slots, drops keyframe indices and preserves valid condition',()=>{
  withSaved({'dino-lab-comparison-v1':{slots:[
    {speciesId:'allosaurus',source:'sheet',growth:12.5,state:'Frail',column:6},
    {speciesId:'hypsilophodon',source:'sheet',growth:0,state:'Prime',column:3},
  ]}},()=>{
    let selections:any[]=[];
    const html=renderDriven(CompareView,[],tree=>{selections=compareSelections(tree);});
    assert.deepEqual(selections,[
      {speciesId:'allosaurus',source:'dashboard',growth:25,state:'Frail'},
      {speciesId:'hypsilophodon',source:'dashboard',growth:25,state:'Prime'},
    ]);
    assert.doesNotMatch(html,/Data source|data source|Source 2|exact keyframe/);
    assert.ok(html.includes('aria-label="Allosaurus condition"'));
    assert.ok(html.includes('aria-label="Hypsilophodon condition"'));
    assert.ok(html.includes('aria-label="Hypsilophodon growth" min="25"'));
    assert.ok(html.includes(`<strong>${formatMetric(getSample('allosaurus',25,'Frail')!.values.weight,'weight')}</strong>`));
    const header=html.match(/<thead>[\s\S]*?<\/thead>/)?.[0]??'';assert.ok(header.includes('Hypsilophodon'));
    assert.ok(html.includes('Your specimens <span class="muted">2/6</span>'),'legacy valid slots survive instead of resetting');
  });
});

test('comparison additions, condition/growth edits and reset cannot reintroduce Source 2',()=>{
  withSaved({},()=>{
    let selections:any[]=[];
    const html=renderDriven(CompareView,[
      tree=>labelled(tree,'Species to add').props.onChange({target:{value:'hypsilophodon'}}),
      tree=>button(tree,'Add specimen').props.onClick(),
      tree=>{const controls=findAll(tree,node=>typeof node.type==='function'&&node.type.name==='SelectionControls');controls.at(-1)!.props.onChange({state:'Frail',growth:4});},
    ],tree=>{selections=compareSelections(tree);});
    assert.equal(selections.length,4);assert.ok(selections.every(row=>row.source==='dashboard'&&!('column' in row)));
    assert.deepEqual(selections.at(-1),{speciesId:'hypsilophodon',source:'dashboard',state:'Frail',growth:25});
    assert.doesNotMatch(html,/Data source|Source 2|exact keyframe/);
    const reset=renderDriven(CompareView,[tree=>button(tree,'Reset').props.onClick()],tree=>{selections=compareSelections(tree);});
    assert.equal(selections.length,3);assert.ok(selections.every(row=>row.source==='dashboard'&&row.state==='Prime'&&row.growth===75));
    assert.doesNotMatch(reset,/Data source|Source 2|exact keyframe/);
  });
});

test('comparison always shows maximum sprint minutes and seconds with unrounded reference differences',()=>{
  withSaved({},()=>{
    const html=renderDriven(CompareView);
    assert.deepEqual(sprintReadings(html),['1m 45s','2m 34s','2m 23s']);
    const {row,cells}=maximumSprintCells(html);
    assert.ok(html.indexOf('<span>Sprint speed</span>')<html.indexOf(row),'duration follows the core sprint-speed statistic');
    assert.ok(cells[1].includes('46.1% vs reference'),'153.8 / 105.3 uses unrounded duration rather than rounded display times');
    assert.ok(cells[2].includes('35.7% vs reference'));
    const expanded=renderDriven(CompareView,[tree=>{
      const survival=findAll(tree,node=>node.type==='input'&&node.props.type==='checkbox')[0];
      survival.props.onChange({target:{checked:true}});
    }]);
    assert.deepEqual(sprintReadings(expanded),['1m 45s','2m 34s','2m 23s'],'opening survival metrics does not duplicate or replace the maximum sprint row');
    assert.ok(expanded.includes('Adult sprint stamina duration'),'the original adult source duration remains a separate optional field');
  });
});

test('comparison growth and condition handlers recompute only their own specimen sprint duration',()=>{
  const frail=getSample('allosaurus',50,'Frail')!;
  const original=frail.values.staminaDrain;
  // A condition-specific fixture proves that the actual handler reads the
  // selected condition, even though current captured drain times often match.
  frail.values.staminaDrain=97.6;
  try{
    withSaved({'dino-lab-comparison-v1':{slots:[
      {speciesId:'allosaurus',source:'dashboard',growth:75,state:'Prime'},
      {speciesId:'allosaurus',source:'dashboard',growth:75,state:'Prime'},
      {speciesId:'carnotaurus',source:'dashboard',growth:75,state:'Prime'},
    ]}},()=>{
      const grown=renderDriven(CompareView,[tree=>{
        const controls=findAll(tree,node=>typeof node.type==='function'&&node.type.name==='SelectionControls');
        controls[0].props.onChange({growth:50});
      }]);
      assert.deepEqual(sprintReadings(grown),['3m 31s','1m 45s','2m 34s']);
      const changed=renderDriven(CompareView,[
        tree=>findAll(tree,node=>typeof node.type==='function'&&node.type.name==='SelectionControls')[0].props.onChange({growth:50,state:'Frail'}),
        tree=>findAll(tree,node=>typeof node.type==='function'&&node.type.name==='SelectionControls')[1].props.onChange({growth:25}),
      ]);
      assert.deepEqual(sprintReadings(changed),['3m 15s','17m 33s','2m 34s']);
      assert.ok(changed.includes('50% · Frail'));
      assert.ok(changed.includes('25% · Prime'));
    });
  }finally{frail.values.staminaDrain=original;}
});

test('maximum sprint comparison uses the shared survival calculation for all 22 playable species and both conditions',()=>{
  assert.equal(playableSpecies.length,22);
  for(const state of ['Prime','Frail'] as const)for(let start=0;start<playableSpecies.length;start+=6){
    const slots=playableSpecies.slice(start,start+6).map((specimen,index)=>({speciesId:specimen.id,source:'dashboard',growth:[25,50,75,100][(start+index)%4],state}));
    withSaved({'dino-lab-comparison-v1':{slots}},()=>{
      const html=renderDriven(CompareView);
      const expected=slots.map(slot=>{
        const sample=getSample(slot.speciesId,slot.growth,slot.state);
        return formatDuration(sprintDuration(sample?.values.staminaDrain,sample?.growth??slot.growth));
      });
      assert.deepEqual(sprintReadings(html),expected,`${state} group starting at ${start} matches the same model as Survival`);
    });
  }
});

test('maximum sprint preserves missing Source 1 values and fixed wildlife durations without workbook borrowing',()=>{
  withSaved({'dino-lab-comparison-v1':{slots:[
    {speciesId:'hypsilophodon',source:'sheet',growth:0,state:'Prime'},
    {speciesId:'boar',source:'sheet',growth:25,state:'Frail'},
    {speciesId:'deer',source:'dashboard',growth:75,state:'Prime'},
    {speciesId:'goat',source:'dashboard',growth:75,state:'Prime'},
  ]}},()=>{
    const html=renderDriven(CompareView);
    assert.deepEqual(sprintReadings(html),['—','2m 5s','—','—']);
    assert.doesNotMatch(maximumSprintCells(html).row,/vs reference/,'an unknown reference cannot produce a percentage');
    assert.doesNotMatch(html,/Source 2/);
    assert.ok(html.includes('100% · Frail'),'wildlife uses its fixed Source 1 record, not requested juvenile scaling');
  });
});

test('invalid sprint source durations remain unavailable instead of becoming zero or refill times',()=>{
  const sample=getSample('allosaurus',75,'Prime')!,original=sample.values.staminaDrain;
  try{
    for(const invalid of [null,0,-60,NaN,Infinity]){
      sample.values.staminaDrain=invalid;
      withSaved({'dino-lab-comparison-v1':{slots:[{speciesId:'allosaurus',source:'dashboard',growth:75,state:'Prime'}]}},()=>{
        assert.deepEqual(sprintReadings(renderDriven(CompareView)),['—'],`invalid source ${invalid} stays unknown`);
      });
    }
  }finally{sample.values.staminaDrain=original;}
});
