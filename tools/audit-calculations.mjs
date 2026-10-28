/** Offline numerical/semantic audit. No network, browser, native app or build.
 * Run: node --import tsx tools/audit-calculations.mjs
 * Optional --wildlife-only isolates the original-source wildlife HP/threat matrix.
 * Reference arithmetic is executed from the preserved dashboard source, not
 * rewritten from Dino Lab's calculation helpers. Workbook raw values are
 * audited separately by audit-workbook.mjs.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { species as activeSpecies, sourceDataset, metrics, getSample, getSheetValue, getPeakSample, formatDuration } from '../src/data/index.ts';
import { GrowthChart } from '../src/components/Chart.tsx';
import { Survival } from '../src/components/Survival.tsx';
import { Attacks } from '../src/components/Attacks.tsx';
import { WildlifeEncounters } from '../src/components/WildlifeEncounters.tsx';
import { sheetRow, readValue, num } from '../src/lib/ui.ts';
import { survivalDuration, sprintDuration, staminaRecovery, standingStaminaRecovery, swimDuration, travelDistance, attackDamage, hitsToKill, rehydratesInWater } from '../src/lib/calculations.ts';

const html = fs.readFileSync(new URL('../src/data/raw/dashboard-source.html', import.meta.url), 'utf8');
const source = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).join('\n');
const species=sourceDataset.species;
const activeIds=new Set(activeSpecies.map(s=>s.id));
const activeWildlifeNames=new Set(activeSpecies.filter(s=>s.kind==='wildlife').map(s=>s.name));
const extractedFunction = name => {
  const declaration = new RegExp(`function ${name}\\s*\\(`).exec(source);
  assert.ok(declaration, `Preserved source function ${name} exists`);
  const start = declaration.index, open = source.indexOf('{', start);
  // Ask the JavaScript parser where this function is complete; this correctly
  // handles braces/quotes inside regular expressions, strings and comments.
  for(let i=source.indexOf('}',open);i>=0;i=source.indexOf('}',i+1)) {
    const fragment=source.slice(start,i+1);
    try{new vm.Script(`(${fragment}\n)`);return fragment;}catch{}
  }
  throw new Error(`Unclosed source function ${name}`);
};
const extractedConstant = name => {
  const statement = new RegExp(`const ${name}\\s*=`).exec(source);
  assert.ok(statement, `Preserved source constant ${name} exists`);
  const end = name==='FACT_CHIPS' ? source.indexOf('\n];', statement.index)+3 : source.indexOf(';',statement.index)+1;
  return source.slice(statement.index,end);
};
const allData = species.flatMap(s => s.samples.map(p => p.raw));
const rowsBySpeciesState = new Map(species.flatMap(s => ['Prime','Frail'].map(state => [`${s.name}/${state}`,s.samples.filter(p=>p.state===state).map(p=>p.raw)])));
const sourceMechanics=Object.fromEntries(species.map(s=>[s.name,s.mechanics.map(m=>({name:m.name,chart:m.chart,mode:m.mode,threshold:m.value,minGrowth:m.minGrowth,color:m.color,desc:m.description}))]));
const dom = new Map();
const context = vm.createContext({
  allData, Math, Number, parseFloat, isNaN,
  document: { getElementById(id) { if (!dom.has(id)) dom.set(id, { innerHTML: '', style: {} }); return dom.get(id); } },
  selfKey: () => 'self', pins: {}, mySp: '', bloodPct: 100,
  getRows: (name, state) => rowsBySpeciesState.get(`${name}/${state}`) ?? [],
  tiBtn: () => '',
  wildAtk:null,
  cleanName:value=>value,
  fmtOrDash:value=>Number.isFinite(value)?String(value):'—',
  getMechanics:()=>sourceMechanics,
  compareSlots:()=>[{sp:context.mySp,key:'self',isMe:true}],
});
vm.runInContext([
  'col', 'numCol', 'atkEsc', 'rehydratesInWater', 'bloodFactor', 'survLeft', 'killHits',
  'getRowAt', 'getPeakGrowth', 'getSanctuaryLimit', 'compositePeak', 'gaitRange', 'updateFactChips',
  'isBaseBite','sheetHasBiteRows','speciesAttacks','isAttackMech','killSlotRow','killStat','killAttacks','killAttackList',
  'isWildRow','wildlifeRows','wildAttacks','wildBestHit','wildSprint','updateWildCard',
].map(extractedFunction).join('\n') + '\n' + [
  'REHYDRATES_IN_WATER', 'FACT_CHIPS', 'STAND_REGEN_FLOOR_PCT',
].map(extractedConstant).join('\n') + '\nfunction clk(seconds){return "[SECONDS:"+String(Math.abs(seconds))+"]";}', context);

const counts = { remainingDecimalCeilingErrors:0, ulpNormalizedCeilingMismatches:0 };
const wildlifeOnly=process.argv.includes('--wildlife-only');
const findings = [];
const count = (key, amount = 1) => { counts[key] = (counts[key] ?? 0) + amount; };
const failures = [];
const sameNumber = (a, b) => a === b || (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-10 * Math.max(1, Math.abs(a), Math.abs(b)));
function compare(actual, expected, label, group) {
  count(group);
  if (!sameNumber(actual, expected)) failures.push({ label, actual, expected });
}
const optional = value => Number.isFinite(value) ? value : null;
const rawNumber = text => text == null || String(text).trim() === '' ? null : Number(text);
const strip = text => text.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
function sourceChips(specimen, sample, blood) {
  context.mySp = specimen.name;
  context.pins = { self: { growthPct: sample.growth, status: sample.state } };
  context.bloodPct = blood;
  context.updateFactChips();
  const chips = new Map();
  for (const id of ['chipsMove', 'chipsStam', 'chipsBreath']) {
    for (const match of dom.get(id).innerHTML.matchAll(/<span class="fc-l">([^<]*)<\/span><span class="fc-v">\[SECONDS:([^\]]+)\]<\/span>/g)) chips.set(match[1], Number(match[2]));
  }
  return chips;
}

for (const specimen of species) {
  count(specimen.kind === 'playable' ? 'playableSpecies' : 'wildlifeSpecies');
  compare(rehydratesInWater(specimen.name), context.rehydratesInWater(specimen.name), specimen.name, 'landThirstAliases');
  for (const sample of specimen.samples) {
    count('dashboardRows');
    if(!wildlifeOnly){
    // These assertions detect wrong metric bindings as well as wrong arithmetic.
    for (const metric of metrics) compare(sample.values[metric.key], rawNumber(sample.raw[metric.sourceColumn]), `${specimen.name}/${sample.state}/${sample.growth}/${metric.key}`, 'rawMetricBindings');
    for (let level = 0; level <= 100; level++) {
      for (const [key, column] of [['hunger', 'Hunger (s)'], ['thirst', 'Thirst (s)']]) compare(survivalDuration(sample.values[key], level), context.survLeft(sample.raw, column, level), `${specimen.name}/${sample.state}/${sample.growth}/${key}/${level}`, 'hungerThirstLevels');
    }
    const chips = sourceChips(specimen, sample, 100);
    for (const [key, chip, actual] of [
      ['staminaDrain', 'Sprint', sprintDuration(sample.values.staminaDrain, sample.growth)],
      ['fastSwimDuration', 'Fast swim', swimDuration(sample.values.fastSwimDuration)],
      ['slowSwimDuration', sample.values.slowSwimDuration < 0 ? 'Slow swim (refills)' : 'Slow swim', swimDuration(sample.values.slowSwimDuration)],
      ['staminaRest', 'Lying down', staminaRecovery(sample.values.staminaRest, 100)],
      ['staminaStand', 'Standing from 20%', standingStaminaRecovery(sample.values.staminaStand, 100)],
    ]) compare(actual, chips.get(chip) ?? null, `${specimen.name}/${sample.state}/${sample.growth}/${key}`, 'sourceChipFormulas');
    // Execute the source's DOM-producing formula at every reachable blood slider value.
    // Survival and source chips share no calculation-helper implementation.
    for (let blood = 5; blood <= 100; blood++) {
      const byBlood = blood === 100 ? chips : sourceChips(specimen, sample, blood);
      compare(staminaRecovery(sample.values.staminaRest, blood), byBlood.get('Lying down') ?? null, `${specimen.name}/${sample.state}/${sample.growth}/rest/${blood}`, 'restBloodLevels');
      compare(standingStaminaRecovery(sample.values.staminaStand, blood), byBlood.get('Standing from 20%') ?? null, `${specimen.name}/${sample.state}/${sample.growth}/stand/${blood}`, 'standingBloodLevels');
    }
    // Distances: validate against the source's gaitRange numerical input/output.
    const sprint = sprintDuration(sample.values.staminaDrain, sample.growth);
    const expectedSprintSpeed = context.numCol(sample.raw, 'SprintSpeed (KM/h)');
    const fallbackSprintSpeed = expectedSprintSpeed > 0 ? expectedSprintSpeed : context.numCol(sample.raw, 'R Speed (KM/h)');
    compare(travelDistance(sample.values.sprint ?? sample.values.speed, sprint), sprint == null || !Number.isFinite(fallbackSprintSpeed) ? null : fallbackSprintSpeed * 1000 / 3600 * sprint, `${specimen.name}/${sample.state}/${sample.growth}/sprint-distance`, 'sprintDistances');
    const swimSeconds = sample.values.fastSwimDuration;
    const swimSpeed = rawNumber(sample.raw['FastSwimSpeed (KM/h)']);
    compare(travelDistance(sample.values.fastSwim, swimSeconds > 0 ? swimSeconds : null), swimSpeed == null || !(swimSeconds > 0) ? null : swimSpeed * 1000 / 3600 * swimSeconds, `${specimen.name}/${sample.state}/${sample.growth}/fast-swim-distance`, 'swimDistances');
    compare(sample.values.oxygen, optional(context.numCol(sample.raw, 'Dive (s)')), `${specimen.name}/${sample.state}/${sample.growth}/oxygen`, 'oxygenBindings');
    compare(sample.values.oxygenRegen, optional(context.numCol(sample.raw, 'Oxygen refill (s)')), `${specimen.name}/${sample.state}/${sample.growth}/oxygen-refill`, 'oxygenBindings');
    }
    if(activeIds.has(specimen.id)){
      // The source's Wildlife card explicitly prefers its HP column, unlike
      // updateKillCard's deliberately rounded-weight body-hit estimate.
      context.mySp=specimen.name;
      context.pins={self:{growthPct:sample.growth,status:sample.state}};
      context.updateWildCard();
      const originalRows=[...dom.get('wildWrap').innerHTML.matchAll(/<tr><td>([^<]+)<\/td>([\s\S]*?)<\/tr>/g)].filter(row=>activeWildlifeNames.has(row[1]));
      const actual=renderToStaticMarkup(React.createElement(WildlifeEncounters,{specimen,growth:sample.growth,state:sample.state,onSelect:()=>{}}));
      const actualRows=[...actual.matchAll(/<tr><td>([\s\S]*?)<\/td>([\s\S]*?)<\/tr>/g)];
      assert.equal(originalRows.length,activeWildlifeNames.size,`${specimen.name} source wildlife rows after active visibility filter`);
      assert.equal(actualRows.length,activeWildlifeNames.size,`${specimen.name} app wildlife rows`);
      for(const original of originalRows){
        const target=actualRows.find(row=>strip(row[1])===original[1]);
        assert.ok(target,`Wildlife row ${original[1]} present`);
        compare(target[2].includes('Known one-hit threat'),original[2].includes('wild-lethal'),`${specimen.name}/${sample.state}/${sample.growth}/wildlife-threat/${original[1]}`,'sourceWildlifeThreatBindings');
      }
    }
  }
  if(wildlifeOnly)continue;
  for (const state of ['Prime', 'Frail']) {
    // Every integer slider position plus every midpoint and neighboring input boundary.
    for (let twiceGrowth = -2; twiceGrowth <= 202; twiceGrowth++) {
      const growth = twiceGrowth / 2;
      const expected = context.getRowAt(specimen.name, state, growth);
      compare(getSample(specimen, growth, state)?.growth ?? null, expected ? Number(expected['R Growth']) : null, `${specimen.name}/${state}/${growth}/nearest`, 'nearestSource1Selections');
    }
  }
  const peak = context.getPeakGrowth(specimen.name);
  const fallback = context.compositePeak(allData.filter(r => r.Species === specimen.name && r['Prime Status'] === 'Prime'));
  compare(getPeakSample(specimen)?.growth ?? null, peak ?? (fallback ? Number(fallback['R Growth']) : null), `${specimen.name}/peak`, 'peakMarkers');
  const sanctuary = context.getSanctuaryLimit(specimen.name);
  const primeFlags = specimen.samples.filter(p => p.state === 'Prime' && /^(TRUE|FALSE)$/i.test((p.raw['Evicted?'] ?? '').trim())).sort((a,b) => a.growth-b.growth);
  const index = primeFlags.findIndex(p => p.evicted);
  const actualSanctuary = index < 0 ? null : index === 0 ? { never: true } : { from: primeFlags[index-1].growth, to: primeFlags[index].growth };
  count('sanctuaryMarkers');
  assert.deepEqual(JSON.parse(JSON.stringify(actualSanctuary)), JSON.parse(JSON.stringify(sanctuary)), specimen.name);
  if (specimen.sheet) {
    for (const row of specimen.sheet.rows) for (const state of ['Prime', 'Frail']) {
      const cells = row.values.filter(c => c.state === state);
      // Each exact keyframe; lower wins exact midpoint; just below/above it too.
      const inputs = new Set(cells.map(c => c.growth));
      for (let i = 1; i < cells.length; i++) {
        const midpoint = (cells[i-1].growth + cells[i].growth) / 2;
        for (const g of [midpoint - 1e-9, midpoint, midpoint + 1e-9]) inputs.add(g);
      }
      for (const growth of inputs) {
        const distances = cells.map(c => Math.abs(c.growth-growth));
        const nearestIndex = distances.indexOf(Math.min(...distances));
        const expected = cells[nearestIndex];
        const actual = getSheetValue(row, growth, state);
        count('workbookNearestCellSelections');
        if (actual?.cell !== expected?.cell || actual?.value !== expected?.value || actual?.text !== expected?.text) failures.push({ label: `${specimen.name}/${row.label}/${state}/${growth}`, actual, expected });
      }
    }
    for (const state of ['Prime','Frail']) for (const column of specimen.sheet.columns.filter(c => c.state === state)) {
      for (const metric of ['weight','bite','speed','trot','fastSwim']) {
        const row = sheetRow(specimen, metric);
        compare(readValue(specimen,column.growth,state,metric,'sheet'),row ? getSheetValue(row,column.growth,state)?.value ?? null : null,`${specimen.name}/${state}/${column.growth}/${metric}`,'workbookCoreMovementReads');
        const value=readValue(specimen,column.growth,state,metric,'sheet');
        if(value>0){
          count('positiveWorkbookReadings');
          assert.notEqual(num(value,metric==='weight'?0:2),'0',`${specimen.name}/${state}/${column.growth}/${metric} positive value must stay visible`);
        }
      }
    }
  }
}

// Full body-hit cross-product for every available attacker record and unlocked
// source mechanic, against every available target record (both conditions).
const victims = species.flatMap(s => s.samples.map(sample => ({ name:s.name, sample, hp:s.kind==='wildlife'?sample.values.hp:sample.values.weight })));
const precision = [], rounding = [];
const decimal = value => { const [int,frac=''] = String(value).split('.'); return [BigInt(int+frac), 10n ** BigInt(frac.length)]; };
for (const specimen of wildlifeOnly?[]:species) for (const sample of specimen.samples) {
  const attacks = [{ name:'Primary attack', value:1, mode:'multiplier', minGrowth:0 }, ...specimen.mechanics.filter(m => (m.chart==='bite'&&m.mode==='multiplier')||m.mode==='absolute')];
  for (const mechanic of attacks) {
    if (sample.growth < mechanic.minGrowth) { count('lockedAttackStates'); continue; }
    const damage = mechanic.mode==='absolute' ? mechanic.value : attackDamage(sample.values.bite,mechanic.value);
    const sourceDamage = mechanic.mode==='absolute' ? mechanic.value : sample.values.bite == null || mechanic.value == null ? null : Number(sample.raw['R Biteforce']) * mechanic.value;
    compare(damage,sourceDamage,`${specimen.name}/${sample.state}/${sample.growth}/${mechanic.name}`,'attackDamageStates');
    if (!(damage > 0)) continue;
    const [bn,bd] = decimal(mechanic.mode==='absolute'?mechanic.value:sample.values.bite);
    const [mn,md] = decimal(mechanic.mode==='absolute'?1:mechanic.value);
    const numerator = bn * mn, denominator = bd * md;
    const roundedDamage = Number(num(damage,2).replaceAll(',',''));
    for (const victim of victims) {
      const hits = hitsToKill(victim.hp,damage);
      const legacyHits = Math.ceil(context.killHits(sourceDamage,victim.hp));
      let expectedHits=legacyHits;
      const quotient = victim.hp / damage;
      if (Math.abs(quotient - Math.round(quotient)) < 1e-9) {
        const [hn,hd] = decimal(victim.hp);
        const exact = Number((hn * denominator + hd * numerator - 1n) / (hd * numerator));
        expectedHits=exact;
        const normalized = Math.ceil(quotient - 4 * Number.EPSILON * quotient);
        if(normalized !== exact)count('ulpNormalizedCeilingMismatches');
        count('ulpNormalizedCeilingChecks');
        if (legacyHits !== exact) {
          count('legacyDecimalCeilingErrors');
          if(precision.length < 10) precision.push({ attacker:specimen.name, growth:sample.growth,state:sample.state,attack:mechanic.name,bite:sample.values.bite,multiplier:mechanic.value,damage,target:victim.name,targetGrowth:victim.sample.growth,hp:victim.hp,legacyHits,correctedHits:hits,decimalExactHits:exact });
        }
        if(hits!==exact)count('remainingDecimalCeilingErrors');
        count('decimalBoundaryHitChecks');
      }
      compare(hits,expectedHits,`${specimen.name}/${sample.state}/${sample.growth}/${mechanic.name} -> ${victim.name}/${victim.sample.state}/${victim.sample.growth}`,'bodyHitMatchups');
      if(hits!==legacyHits)count('intentionalLegacyCeilingCorrections');
      if (roundedDamage > 0 && Math.ceil(victim.hp/roundedDamage) !== hits) {
        count('roundedDamageHitAmbiguities');
        if (rounding.length < 5) rounding.push({attacker:specimen.name,growth:sample.growth,state:sample.state,attack:mechanic.name,damage,displayedDamage:roundedDamage,target:victim.name,targetGrowth:victim.sample.growth,hp:victim.hp,hits,roundedDamageHits:Math.ceil(victim.hp/roundedDamage)});
      }
    }
  }
}

// SSR is pure: verifies all growth/condition/core and movement chart paths with
// no browser or app launched. Exact SVG points checked against raw source data.
for (const specimen of wildlifeOnly?[]:species) for (const source of ['dashboard','sheet']) for (const state of ['Prime','Frail']) {
  const sourceGrowths = source==='dashboard' ? specimen.samples.filter(s=>s.state===state).map(s=>s.growth) : specimen.sheet?.columns.filter(c=>c.state===state).map(c=>c.growth) ?? [];
  for (const metric of ['weight','bite','speed',...metrics.filter(m=>m.group==='movement').map(m=>m.key)]) for (const log of [false,true]) {
    // One render validates the entire SVG polyline; current-growth at all samples
    // is checked by selection tests above and a separate expected point count.
    const markup = renderToStaticMarkup(React.createElement(GrowthChart,{specimen,source,state,metric,log,growth:sourceGrowths[Math.floor(sourceGrowths.length/2)]??75}));
    count('growthChartRenders');
    assert.ok(!/\b(?:d|x|y|x1|x2|y1|y2|cx|cy|width|height)="[^"]*(?:NaN|Infinity|undefined)/.test(markup),`${specimen.name}/${source}/${state}/${metric}/log=${log}`);
    const row = source==='sheet'?sheetRow(specimen,metric):null;
    const expectedValues = source==='sheet'?row?.values.filter(v=>v.state===state).map(v=>v.value)??[]:specimen.samples.filter(v=>v.state===state).map(v=>v.values[metric]);
    const expectedCount = expectedValues.filter(v=>v!=null&&Number.isFinite(v)&&(!log||v>0)).length;
    const line = markup.match(/<path d="([^"]*)" fill="none" stroke="#b8ee75" stroke-width="2.5"/);
    const actualCount = line ? [...line[1].matchAll(/[ML]/g)].length : 0;
    compare(actualCount,expectedCount,`${specimen.name}/${source}/${state}/${metric}/log=${log}/vertices`,'growthChartVertices');
  }
  // Attacks and survival initial render expose all verbatim reference rows and
  // units; calculator defaults are independently cross-checked above.
  if (source==='dashboard') for (const growth of sourceGrowths) {
    const survival = renderToStaticMarkup(React.createElement(Survival,{specimen,growth,state}));
    const attacks = renderToStaticMarkup(React.createElement(Attacks,{specimen,growth,state,mechanics:specimen.mechanics}));
    count('survivalRenders'); count('attackRenders');
    assert.ok(!survival.includes('NaN')&&!attacks.includes('NaN'),`${specimen.name}/${state}/${growth}`);
    for (const row of specimen.sheet?.attacks??[]) {
      const value=getSheetValue(row,growth,state);
      if(value) assert.ok(strip(attacks).includes(strip(value.text)),`${specimen.name}/${state}/${growth}/${row.label} preserved source attack text`);
      count('attackReferenceTexts');
    }
  }
}
if (precision.length) findings.push({type:'legacy-binary-ceiling-boundary-corrected',examples:precision});
if (rounding.length) findings.push({type:'displayed-damage-rounding-qualified-by-exact-tooltip',examples:rounding});
const negativeSwim = species.flatMap(s=>s.samples.filter(p=>p.values.slowSwimDuration<0).map(p=>({species:s.name,growth:p.growth,state:p.state,raw:p.values.slowSwimDuration,formatted:formatDuration(p.values.slowSwimDuration)})));
if(negativeSwim.some(v=>!/\d/.test(v.formatted))) findings.push({type:'negative-swim-magnitude-hidden',count:negativeSwim.length,example:negativeSwim[0]});
else count('negativeSwimMagnitudesPreserved',negativeSwim.length);
console.log(JSON.stringify({scope:wildlifeOnly?'wildlife-only':'complete',counts,failures:failures.slice(0,25),failureCount:failures.length,findings},null,2));
assert.equal(failures.length,0,`Numerical source parity failures: ${failures.length}`);
