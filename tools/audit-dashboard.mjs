/** Read-only Source 1 audit. Fetches evidence into ignored test-results only.
 * Uses Python's standard-library csv reader independently of the app importer.
 * Does not execute downloaded JavaScript, change app data, or operate the UI.
 * Run: node tools/audit-dashboard.mjs [--offline] [--python ABSOLUTE_PYTHON_PATH]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidence = path.join(root, 'test-results', 'numeric-audit', 'dashboard');
const rawDir = path.join(root, 'src', 'data', 'raw');
const site = 'https://theisle-speciesdatadashboard.pages.dev/';
const offline = process.argv.includes('--offline');
const pythonIndex = process.argv.indexOf('--python');
const python = pythonIndex >= 0 ? process.argv[pythonIndex + 1] : process.env.DINO_AUDIT_PYTHON || path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe');
const hash = text => createHash('sha256').update(text).digest('hex');
const canonicalName = name => name === 'Beipiaosaurus' ? 'Beipiosaurus' : name;
const number = value => {
  if (value == null || String(value).trim() === '') return null;
  const text = String(value).replaceAll(',', '').trim();
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text) && Number.isFinite(Number(text)) ? Number(text) : null;
};
const bool = value => String(value).trim().toUpperCase() === 'TRUE';
const equal = (a, b) => a === b || (typeof a === 'number' && typeof b === 'number' && Object.is(a, b));
// Independent expected contract, not read from importer/metric.sourceColumn.
const fields = [
  ['weight','R Weight','kg','core'], ['bite','R Biteforce','','core'], ['speed','R Speed (KM/h)','km/h','core'], ['hp','HP','HP','core'],
  ['walk','WalkSpeed (KM/h)','km/h','movement'], ['trot','TrotSpeed (KM/h)','km/h','movement'], ['sprint','SprintSpeed (KM/h)','km/h','movement'],
  ['crouch','CrouchSpeed (KM/h)','km/h','movement'], ['slowSwim','SlowSwimSpeed (KM/h)','km/h','movement'], ['fastSwim','FastSwimSpeed (KM/h)','km/h','movement'],
  ['waterWalk','WaterWalkSpeed (KM/h)','km/h','movement'], ['waterSprint','WaterSprintSpeed (KM/h)','km/h','movement'], ['crouchSprint','SprintSpeedCrouch (KM/h)','km/h','movement'], ['takeoff','TakeoffSpeed (KM/h)','km/h','movement'],
  ['staminaDrain','Sprint (s)','s','survival'], ['fastSwimDuration','Fast swim (s)','s','survival'], ['slowSwimDuration','Slow swim (s)','s','survival'], ['mudDuration','Mud walking (s)','s','survival'],
  ['staminaRegen','Stamina refill (s)','s','recovery'], ['hunger','Hunger (s)','s','survival'], ['thirst','Thirst (s)','s','survival'], ['oxygen','Dive (s)','s','survival'], ['oxygenRegen','Oxygen refill (s)','s','recovery'],
  ['restFlatUntil','Rest flat until (s)','s','recovery'], ['restCeiling','Rest ceiling (x)','×','recovery'], ['restCeilingAt','Rest ceiling at (s)','s','recovery'],
  ['staminaRest','Stamina rest to full (s)','s','recovery'], ['staminaStand','Stamina stand to full (s)','s','recovery'], ['bloodRest','Blood rest to full (s)','s','recovery'], ['bloodStand','Blood stand to full (s)','s','recovery'],
  ['healthRest','Health rest to full (s)','s','recovery'], ['healthStand','Health stand to full (s)','s','recovery'], ['maxStamina','MaxStamina','','core'],
];

await fs.mkdir(evidence, { recursive: true });
const requests = offline ? JSON.parse(await fs.readFile(path.join(evidence, 'requests.json'), 'utf8').catch(() => '[]')) : [];
async function getSnapshot(url, filename) {
  if (offline) return fs.readFile(path.join(evidence, filename), 'utf8');
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  const text = await response.text();
  await fs.writeFile(path.join(evidence, filename), text);
  requests.push({ url, finalUrl: response.url, filename, fetchedAt: new Date().toISOString(), status: response.status, contentType: response.headers.get('content-type'), etag: response.headers.get('etag'), lastModified: response.headers.get('last-modified'), sha256: hash(text) });
  return text;
}
const liveHtml = await getSnapshot(site, 'dashboard-live.html');
const csvMatch = liveHtml.match(/\bconst\s+CSV\s*=\s*(['"])(https:\/\/docs\.google\.com\/spreadsheets\/[^'"]+)\1\s*;/);
const gidMatch = liveHtml.match(/\bconst\s+MECH_GID\s*=\s*(['"])(\d+)\1\s*;/);
if (!csvMatch || !gidMatch) throw new Error('Could not independently identify the current source URLs. No app files changed.');
const gameUrl = new URL(csvMatch[2]);
const mechanicsUrl = new URL(gameUrl); mechanicsUrl.searchParams.set('gid', gidMatch[2]);
const [liveGameText, liveMechanicsText, cachedHtml, datasetText] = await Promise.all([
  getSnapshot(gameUrl.href, 'gamedata-live.csv'), getSnapshot(mechanicsUrl.href, 'mechanics-live.csv'),
  fs.readFile(path.join(rawDir, 'dashboard-source.html'), 'utf8'), fs.readFile(path.join(root, 'src', 'data', 'dataset.json'), 'utf8'),
]);
const dataset = JSON.parse(datasetText);
const pythonCode = `import csv,json,sys\nout=[]\nfor filename in sys.argv[1:]:\n with open(filename,encoding='utf-8-sig',newline='') as f:\n  rows=list(csv.reader(f,strict=True))\n headers=rows[0]\n keys=[x if x else '_unnamed_'+str(i+1) for i,x in enumerate(headers)]\n records=[]; widths=[]\n for rownum,row in enumerate(rows[1:],2):\n  if not any(row): continue\n  if len(row)!=len(headers): widths.append({'row':rownum,'expected':len(headers),'actual':len(row)})\n  records.append(dict(zip(keys,row+['']*max(0,len(headers)-len(row)))))\n out.append({'headers':keys,'records':records,'widthIssues':widths})\nprint(json.dumps(out,ensure_ascii=False))`;
const parsed = JSON.parse(execFileSync(python, ['-c', pythonCode, path.join(evidence, 'gamedata-live.csv'), path.join(evidence, 'mechanics-live.csv'), path.join(rawDir, 'gamedata.csv'), path.join(rawDir, 'mechanics.csv')], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
const [liveGame, liveMechanics, cachedGame, cachedMechanics] = parsed;
for (const table of [liveGame, cachedGame]) table.records = table.records.filter(row => row.Species?.trim() && row.Species !== 'Species');
for (const table of [liveMechanics, cachedMechanics]) table.records = table.records.filter(row => row.Species?.trim() && row.Mechanic?.trim());
const sourceChanges = [], mappingIssues = [], sourceAnomalies = [], ruleChanges = [];
const counts = { sourceCellComparisons: 0, sampleRawCellComparisons: 0, sampleNumericComparisons: 0, sampleNullChecks: 0, sampleNonNullChecks: 0, sampleZeroChecks: 0, sampleNegativeChecks: 0, sampleIdentityFlagComparisons: 0, mechanicsRawCellComparisons: 0, mechanicsFieldComparisons: 0, metricMetadataComparisons: 0, playableGrowthStatePoints: 0, wildlifeStatePoints: 0, originalNumericSourceCells: 0, originalBlankNumericSourceCells: 0 };
const key = row => `${canonicalName(row.Species)}|${row['Prime Status']}|${number(row['R Growth'])}`;
const indexRows = (rows, keyFn, issues, label) => {
  const map = new Map();
  for (const row of rows) { const id = keyFn(row); if (map.has(id)) issues.push({ type: 'duplicate-source-key', table: label, key: id }); map.set(id, row); }
  return map;
};
const liveByKey = indexRows(liveGame.records, key, sourceAnomalies, 'live Gamedata');
const cachedByKey = indexRows(cachedGame.records, key, sourceAnomalies, 'cached Gamedata');
function compareTables(current, cached, table, keyFn) {
  if (JSON.stringify(current.headers) !== JSON.stringify(cached.headers)) sourceChanges.push({ type: 'headers-changed', table, cached: cached.headers, current: current.headers });
  const currentMap = indexRows(current.records, keyFn, sourceAnomalies, table);
  const cachedMap = indexRows(cached.records, keyFn, sourceAnomalies, `cached ${table}`);
  for (const [id, row] of currentMap) {
    const old = cachedMap.get(id);
    if (!old) { sourceChanges.push({ type: 'row-added', table, key: id, current: row }); continue; }
    for (const column of new Set([...current.headers, ...cached.headers])) { counts.sourceCellComparisons++; if (row[column] !== old[column]) sourceChanges.push({ type: 'cell-changed', table, key: id, column, cached: old[column], current: row[column] }); }
  }
  for (const [id, row] of cachedMap) if (!currentMap.has(id)) sourceChanges.push({ type: 'row-removed', table, key: id, cached: row });
}
compareTables(liveGame, cachedGame, 'Gamedata', key);
compareTables(liveMechanics, cachedMechanics, 'Mechanics', row => `${canonicalName(row.Species)}|${row.Mechanic}`);

const appByKey = new Map();
for (const specimen of dataset.species) for (const sample of specimen.samples) {
  const id = `${specimen.name}|${sample.state}|${sample.growth}`;
  if (appByKey.has(id)) mappingIssues.push({ type: 'duplicate-app-key', key: id });
  appByKey.set(id, { specimen, sample });
}
for (const [metricKey, column, unit, group] of fields) {
  const metadata = dataset.metrics.find(metric => metric.key === metricKey);
  for (const [property, expected] of [['sourceColumn', column], ['unit', unit], ['group', group]]) { counts.metricMetadataComparisons++; if (metadata?.[property] !== expected) mappingIssues.push({ type: 'metric-contract', key: metricKey, property, expected, actual: metadata?.[property] }); }
}
for (const [id, row] of cachedByKey) {
  const app = appByKey.get(id);
  if (!app) { mappingIssues.push({ type: 'missing-app-sample', key: id }); continue; }
  const { specimen, sample } = app;
  for (const column of cachedGame.headers) { counts.sampleRawCellComparisons++; if (sample.raw?.[column] !== row[column]) mappingIssues.push({ type: 'raw-cell', key: id, column, expected: row[column], actual: sample.raw?.[column] }); }
  for (const [metricKey, column] of fields) {
    const expected = number(row[column]); counts.sampleNumericComparisons++; expected === null ? counts.sampleNullChecks++ : counts.sampleNonNullChecks++;
    if (expected === 0) counts.sampleZeroChecks++;
    if (expected !== null && expected < 0) counts.sampleNegativeChecks++;
    if (!equal(sample.values?.[metricKey], expected)) mappingIssues.push({ type: 'normalized-value', key: id, metric: metricKey, column, expected, actual: sample.values?.[metricKey] });
  }
  for (const [property, expected] of [['stage', row.Stage], ['sourceId', 'dashboard-gamedata'], ['peak', bool(row['Peak?'])], ['evicted', bool(row['Evicted?'])]]) { counts.sampleIdentityFlagComparisons++; if (sample[property] !== expected) mappingIssues.push({ type: 'sample-property', key: id, property, expected, actual: sample[property] }); }
  counts.sampleIdentityFlagComparisons++;
  if (specimen.kind !== (row.Kind === 'Wildlife' ? 'wildlife' : 'playable')) mappingIssues.push({ type: 'kind', key: id, expected: row.Kind, actual: specimen.kind });
  const extraRaw = Object.keys(sample.raw ?? {}).filter(column => !cachedGame.headers.includes(column));
  if (extraRaw.length) mappingIssues.push({ type: 'extra-raw-columns', key: id, columns: extraRaw });
  const extraValues = Object.keys(sample.values ?? {}).filter(metricKey => !fields.some(field => field[0] === metricKey));
  if (extraValues.length) mappingIssues.push({ type: 'unexpected-normalized-metrics', key: id, metrics: extraValues });
}
for (const [id] of appByKey) if (!cachedByKey.has(id)) mappingIssues.push({ type: 'app-sample-without-source', key: id });

const mechanicsById = new Map(dataset.species.flatMap(specimen => specimen.mechanics.map(mechanic => [mechanic.id, { specimen, mechanic }])));
const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
for (const [index, row] of cachedMechanics.records.entries()) {
  const expectedId = `${slug(canonicalName(row.Species))}-${slug(row.Mechanic)}-${index}`;
  const app = mechanicsById.get(expectedId);
  if (!app) { mappingIssues.push({ type: 'missing-app-mechanic', id: expectedId, source: row }); continue; }
  for (const column of cachedMechanics.headers) { counts.mechanicsRawCellComparisons++; if (app.mechanic.raw?.[column] !== row[column]) mappingIssues.push({ type: 'mechanic-raw-cell', id: expectedId, column, expected: row[column], actual: app.mechanic.raw?.[column] }); }
  const expected = { name: row.Mechanic, chart: row.Chart, mode: row.Mode, value: number(row.Value), minGrowth: number(row['From Growth %']) ?? 0, color: row.Color, description: row.Description, sourceId: 'dashboard-mechanics' };
  for (const [property, value] of Object.entries(expected)) { counts.mechanicsFieldComparisons++; if (!equal(app.mechanic[property], value)) mappingIssues.push({ type: 'mechanic-field', id: expectedId, property, expected: value, actual: app.mechanic[property] }); }
  if (app.specimen.name !== canonicalName(row.Species)) mappingIssues.push({ type: 'mechanic-species', id: expectedId, expected: row.Species, actual: app.specimen.name });
}
if (mechanicsById.size !== cachedMechanics.records.length) mappingIssues.push({ type: 'mechanics-count', expected: cachedMechanics.records.length, actual: mechanicsById.size });
for (const [property, expected] of [['dashboardRows',cachedGame.records.length],['mechanics',cachedMechanics.records.length]]) if (dataset.counts[property] !== expected) mappingIssues.push({type:'dataset-count-metadata',property,expected,actual:dataset.counts[property]});

const liveSpecies = [...new Set(liveGame.records.map(row => row.Species))].sort();
const livePlayable = liveSpecies.filter(name => liveGame.records.some(row => row.Species === name && row.Kind === 'Playable'));
const liveWildlife = liveSpecies.filter(name => liveGame.records.some(row => row.Species === name && row.Kind === 'Wildlife'));
const coverage = [];
for (const name of liveSpecies) {
  const rows = liveGame.records.filter(row => row.Species === name);
  const kind = rows[0].Kind;
  if (kind === 'Playable') {
    for (let growth = 25; growth <= 100; growth++) for (const state of ['Prime', 'Frail']) { counts.playableGrowthStatePoints++; const selected = rows.filter(row => number(row['R Growth']) === growth && row['Prime Status'] === state); if (selected.length !== 1) sourceAnomalies.push({ type: 'playable-grid', species: name, growth, state, records: selected.length }); }
    if (rows.length !== 152) sourceAnomalies.push({ type: 'playable-record-count', species: name, expected: 152, actual: rows.length });
  } else if (kind === 'Wildlife') {
    for (const state of ['Prime', 'Frail']) { counts.wildlifeStatePoints++; if (rows.filter(row => row['Prime Status'] === state).length !== 1) sourceAnomalies.push({ type: 'wildlife-state-count', species: name, state }); }
    const growths = [...new Set(rows.map(row => row['R Growth']))];
    if (growths.length !== 1) sourceAnomalies.push({ type: 'wildlife-grows', species: name, growths });
    if (rows.length === 2) for (const [, column] of fields) if (rowValue(rows[0], column) !== rowValue(rows[1], column)) sourceAnomalies.push({ type: 'wildlife-state-value-differs', species: name, column, values: rows.map(row => row[column]) });
  } else sourceAnomalies.push({ type: 'unknown-source-kind', species: name, kind });
  const prime = rows.filter(row => row['Prime Status'] === 'Prime').sort((a,b) => number(a['R Growth']) - number(b['R Growth']));
  const markedPeaks = prime.filter(row => bool(row['Peak?'])).map(row => number(row['R Growth']));
  let lastFalse = null, firstTrue = null;
  for (const row of prime.filter(row => row['Evicted?'].trim() !== '')) { if (!bool(row['Evicted?'])) lastFalse = number(row['R Growth']); else { firstTrue = number(row['R Growth']); break; } }
  const sanctuary = firstTrue === null ? 'no recorded eviction' : lastFalse === null ? 'never eligible in recorded range' : { from: lastFalse, to: firstTrue };
  coverage.push({ species: name, kind, rows: rows.length, growths: [...new Set(rows.map(row => number(row['R Growth'])))].length, markedPeaks, sanctuary });
}
function rowValue(row, column) { return number(row[column]); }
const textColumns = new Set(['_unnamed_1','Species','Prime Status','Species Status','Stage','Kind','Peak?','Evicted?','Prime?']);
for (const row of liveGame.records) {
  for (const column of liveGame.headers.filter(column => !textColumns.has(column))) {
    if (row[column].trim() === '') counts.originalBlankNumericSourceCells++;
    else if (number(row[column]) !== null) counts.originalNumericSourceCells++;
    else sourceAnomalies.push({ type: 'non-numeric-source-cell', key: key(row), column, value: row[column] });
  }
  for (const column of ['Peak?','Evicted?','Prime?']) if (row[column].trim() && !['TRUE','FALSE'].includes(row[column].trim().toUpperCase())) sourceAnomalies.push({ type: 'unrecognized-flag', key: key(row), column, value: row[column] });
}
for (const [index, row] of liveMechanics.records.entries()) {
  if (!['threshold','multiplier','absolute'].includes(row.Mode) || !['weight','bite','speed','none'].includes(row.Chart) || number(row.Value) === null || (row['From Growth %'].trim() !== '' && number(row['From Growth %']) === null)) sourceAnomalies.push({ type: 'mechanic-source-schema', row: index + 2, value: row });
}
for (const [expected, actual, name] of [[3214,liveGame.records.length,'dashboard rows'],[96,liveMechanics.records.length,'mechanics rows'],[21,livePlayable.length,'playable species'],[11,liveWildlife.length,'wildlife species']]) if (expected !== actual) sourceAnomalies.push({ type: 'changed-cardinality', name, expected, actual });
const alias = dataset.species.find(specimen => specimen.name === 'Beipiosaurus');
if (!alias?.aliases?.includes('Beipiaosaurus')) mappingIssues.push({ type: 'missing-alias', expected: 'Beipiaosaurus -> Beipiosaurus' });
const hypsi = dataset.species.find(specimen => specimen.name === 'Hypsilophodon');
if (!hypsi || hypsi.samples.length !== 0) mappingIssues.push({ type: 'sheet-only-species-source-leak', species: 'Hypsilophodon' });

const ruleNames = ['getRows','getRowAt','getPeakGrowth','getSanctuaryLimit','compositePeak','parseMechanicsRows','speciesAttacks','killStat','killAttacks','killAttackList','killHits','killCell','updateKillCard','survClamp','survLeft','updateSurvOut','wildlifeRows','wildAttacks','wildBestHit','wildSprint','updateWildCard','gaitRange','bloodFactor','updateFactChips','updateRestCard','FACT_CHIPS','REST_POOLS','GAITS','STAND_REGEN_FLOOR_PCT','REHYDRATES_IN_WATER','mechanicBandsPlugin','FIELDS','FIELD_UNITS'];
function declarations(html) {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const code = [...withoutComments.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script\s*>/gi)].map(match => match[1]).join('\n');
  const result = new Map();
  // Conservative textual comparison only. No downloaded code is evaluated.
  // This source declares its functions/constants at column zero; nested locals
  // are indented. Any difference is flagged for manual review, not interpreted.
  const starts = [...code.matchAll(/^(?:function\s+(\w+)\s*\(|(?:const|let|var)\s+(\w+)\b)/gm)];
  for (const [index, match] of starts.entries()) {
    const text = code.slice(match.index, starts[index + 1]?.index ?? code.length);
    const canonical = text.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).filter(line => !/^\s*\/\//.test(line)).map(line => line.trim()).filter(Boolean).join('\n');
    result.set(match[1] || match[2], { canonical, text });
  }
  return result;
}
const oldDeclarations = declarations(cachedHtml), newDeclarations = declarations(liveHtml);
const ruleComparisons = [];
await fs.mkdir(path.join(evidence, 'rules'), { recursive: true });
for (const name of ruleNames) {
  const old = oldDeclarations.get(name), current = newDeclarations.get(name);
  const same = Boolean(old && current && old.canonical === current.canonical);
  ruleComparisons.push({ name, same, cachedPresent: Boolean(old), currentPresent: Boolean(current), cachedSha256: old ? hash(old.canonical) : null, currentSha256: current ? hash(current.canonical) : null, commentsOrWhitespaceChanged: Boolean(same && old.text !== current.text) });
  if (!same) { ruleChanges.push({ name, cachedPresent: Boolean(old), currentPresent: Boolean(current), evidence: `test-results/numeric-audit/dashboard/rules/${name}` }); await fs.writeFile(path.join(evidence,'rules',`${name}.cached.js`), old?.text ?? '// Absent in cached source'); await fs.writeFile(path.join(evidence,'rules',`${name}.live.js`), current?.text ?? '// Absent in live source'); }
}
const roundedVsOriginal = [['growth','R Growth','Growth %'],['weight','R Weight','Weight (KG)'],['bite','R Biteforce','Biteforce'],['speed','R Speed (KM/h)','Speed (KM/h)']].map(([metric, rounded, original]) => {
  const differing = liveGame.records.filter(row => number(row[rounded]) !== null && number(row[original]) !== null && number(row[rounded]) !== number(row[original]));
  return { metric, roundedColumn: rounded, originalColumn: original, differentRows: differing.length, largestAbsoluteDifference: Math.max(0,...differing.map(row => Math.abs(number(row[rounded]) - number(row[original])))), examples: differing.slice(0,3).map(row => ({ key:key(row),rounded:row[rounded],original:row[original] })) };
});
const wildlife = liveWildlife.map(name => { const row=liveGame.records.find(row=>row.Species===name&&row['Prime Status']==='Prime');const attacks=liveMechanics.records.filter(mechanic=>mechanic.Species===name&&mechanic.Mode==='absolute');return {name,growth:number(row['R Growth']),weight:number(row['R Weight']),hp:number(row.HP),speed:number(row['R Speed (KM/h)']),absoluteAttacks:attacks.map(attack=>({name:attack.Mechanic,value:number(attack.Value)})),bestHit:attacks.length?Math.max(...attacks.map(attack=>number(attack.Value))):null}; });
const result = { auditedAt: new Date().toISOString(), scope:'Source 1 dashboard and wildlife; independent source fidelity, not game-file truth or UI runtime behavior', offline, site, urls:{game:gameUrl.href,mechanics:mechanicsUrl.href}, parser:'Python standard-library csv.reader(strict=True), separate from app importer', requests, hashes:{ liveHtml:hash(liveHtml),cachedHtml:hash(cachedHtml),dataset:hash(datasetText),liveGame:hash(liveGameText),liveMechanics:hash(liveMechanicsText) }, cardinality:{liveRecords:liveGame.records.length,cachedRecords:cachedGame.records.length,appSamples:appByKey.size,liveMechanics:liveMechanics.records.length,appMechanics:mechanicsById.size,livePlayable:livePlayable.length,liveWildlife:liveWildlife.length,columns:liveGame.headers.length,normalizedMetrics:fields.length}, counts, sourceChanges, mappingIssues, sourceAnomalies, rowWidthIssues:parsed.flatMap((table,index)=>table.widthIssues.map(issue=>({table:index,...issue}))), ruleChanges, ruleComparisons, coverage, roundedVsOriginal, wildlife };
await fs.writeFile(path.join(evidence,'report.json'),JSON.stringify(result,null,2));
await fs.writeFile(path.join(evidence,'requests.json'),JSON.stringify(requests,null,2));
const md = `# Source 1 dashboard numeric audit\n\nAudited ${result.auditedAt}. This is an independent comparison with the public [Species Dashboard](${site}) and its current published CSV endpoints, not a claim that every source value matches the game. Downloaded HTML was parsed as data and was not executed. App data and the running app were not changed.\n\n## Coverage\n\n| Check | Coverage |\n|---|---:|\n| Gamedata records | ${result.cardinality.liveRecords.toLocaleString()} |\n| Playable species / wildlife species | ${livePlayable.length} / ${liveWildlife.length} |\n| Playable growth/state points (25–100, Prime/Frail) | ${counts.playableGrowthStatePoints.toLocaleString()} |\n| Fixed wildlife/state points | ${counts.wildlifeStatePoints} |\n| Original Gamedata columns / normalized metrics | ${liveGame.headers.length} / ${fields.length} |\n| Source snapshot cell comparisons, including mechanics | ${counts.sourceCellComparisons.toLocaleString()} |\n| Exact normalized raw Gamedata cell comparisons | ${counts.sampleRawCellComparisons.toLocaleString()} |\n| Normalized numeric-or-null comparisons | ${counts.sampleNumericComparisons.toLocaleString()} |\n| Non-null / null metric checks | ${counts.sampleNonNullChecks.toLocaleString()} / ${counts.sampleNullChecks.toLocaleString()} |\n| Sample identity, flag and kind comparisons | ${counts.sampleIdentityFlagComparisons.toLocaleString()} |\n| Mechanics rows | ${liveMechanics.records.length} |\n| Mechanics raw cell / normalized field checks | ${counts.mechanicsRawCellComparisons.toLocaleString()} / ${counts.mechanicsFieldComparisons.toLocaleString()} |\n| Metric mapping/unit/group checks | ${counts.metricMetadataComparisons} |\n| Current-versus-preserved rule declarations | ${ruleComparisons.length} |\n\nCSV parsing uses Python's standard-library reader, independently of the application's JavaScript importer. Values are keyed by species, condition and recorded growth; every metric is checked against a separately declared expected source-column map. Empty cells remain null, and source strings, original numbers, rounded headline columns, flags and aliases are checked separately.\n\n## Results\n\n- Fresh source changes versus preserved CSV: **${sourceChanges.length}**.\n- Import/mapping discrepancies against the preserved source: **${mappingIssues.length}**.\n- Source schema, cardinality or coverage anomalies: **${sourceAnomalies.length}**.\n- CSV row-width anomalies: **${result.rowWidthIssues.length}**.\n- Changed or missing focused rule declarations: **${ruleChanges.length}**.\n\n${sourceChanges.length ? 'Source changes require review before deciding whether to refresh app data. They do not by themselves establish an importer bug.' : 'The fresh CSV records match the preserved snapshots cell for cell.'}\n${mappingIssues.length ? 'Concrete mapping discrepancies are recorded in the machine-readable report for coordinated repair.' : 'Every checked normalized number, null, flag, source string and mechanic matches its preserved source.'}\n${ruleChanges.length ? 'Changed rule snapshots are saved separately and need manual review; changed UI wording is not automatically a changed arithmetic rule.' : 'All focused calculation/data-rule declarations match the preserved dashboard after conservative whitespace/comment normalization.'}\n\nThe 22nd playable entry, Hypsilophodon, is workbook-only and correctly has no Source 1 samples. Beipiosaurus retains Beipiaosaurus as an explicit cross-source alias. Wildlife uses explicit source HP and absolute attacks; absent attacks remain unknown.\n\n## Rounded versus original source numbers\n\n| Metric | Rows where source rounded/original differ | Largest absolute difference |\n|---|---:|---:|\n${roundedVsOriginal.map(row=>`| ${row.metric} | ${row.differentRows.toLocaleString()} | ${row.largestAbsoluteDifference} |`).join('\n')}\n\nThose differences are source-defined, not discrepancies to repair by substituting original columns. Dashboard headline values use R Growth, R Weight, R Biteforce and R Speed. All original columns remain preserved.\n\n## Evidence and limits\n\nFresh HTML/CSV files, request timestamps, hashes, per-species growth/peak/sanctuary coverage, wildlife numbers and every concrete issue are in the ignored folder \`test-results/numeric-audit/dashboard/\`; \`report.json\` is the detailed result. Reproduce with \`node tools/audit-dashboard.mjs\`, or use \`--offline\` to compare the saved audit snapshot again. Focused rule text comparison is conservative, not a proof of semantic equivalence or of game correctness.\n\nSource URLs: [Gamedata CSV](${gameUrl.href}), [Mechanics CSV](${mechanicsUrl.href}). A changing source can differ after the recorded audit time. This audit verifies import fidelity; underlying balance accuracy, live-game behavior and frontend presentation require separate evidence.\n`;
const boarVariance = sourceAnomalies.find(issue => issue.type === 'wildlife-state-value-differs' && issue.species === 'Boar' && issue.column === 'SprintSpeed (KM/h)');
const additionalFindings = [
  boarVariance ? `The source variance is Boar's unrounded SprintSpeed (KM/h): **${boarVariance.values[0]}** in Prime and **${boarVariance.values[1]}** in Frail. Both rounded R Speed (KM/h) entries are **${liveGame.records.find(row=>row.Species==='Boar'&&row['Prime Status']==='Prime')['R Speed (KM/h)']}**. Dino Lab preserves these values exactly. This is inherited source data requiring source-owner confirmation, not an importer discrepancy; no number was silently replaced.` : '',
  hash(liveHtml) === hash(cachedHtml) ? 'The fresh and preserved complete HTML hashes also match, so no website calculation-rule change was found. This includes documented nearest-row selection, source peaks/sanctuary flags, body-hit arithmetic, growth-scaled sprint duration, unscaled swim durations, blood-scaled stamina recovery, food/water-to-empty timers and the existing uncertainty qualifications.' : '',
].filter(Boolean).join('\n\n');
await fs.writeFile(path.join(root,'docs','DASHBOARD-NUMERIC-AUDIT.md'),md.replace('## Rounded versus original source numbers',`${additionalFindings}\n\n## Rounded versus original source numbers`).replaceAll('0.05000000000001137','0.05').replaceAll('0.05000000000000071','0.05'));
console.log(JSON.stringify({auditedAt:result.auditedAt,cardinality:result.cardinality,counts,sourceChanges:sourceChanges.length,mappingIssues:mappingIssues.length,sourceAnomalies:sourceAnomalies.length,rowWidthIssues:result.rowWidthIssues.length,ruleChanges:ruleChanges.map(change=>change.name),report:'test-results/numeric-audit/dashboard/report.json'},null,2));
