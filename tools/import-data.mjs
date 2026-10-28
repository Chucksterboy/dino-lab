/** Rebuild the offline dataset from preserved CSV and connector snapshots.
 * Run `node tools/import-data.mjs`; add --refresh-dashboard to refetch public CSVs.
 * The separate species workbook is deliberately not merged into dashboard values.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'src', 'data');
const rawDir = path.join(dataDir, 'raw');
const dashboardUrl = 'https://theisle-speciesdatadashboard.pages.dev/';
const published = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTOR_zO2ZMBY8oVfxRZL2qE21877cCts1Ujt2QCgP3ff9wSutZ99xnlXbpECmTLR5aC-ACNFALnztnD/pub';
const gameUrl = `${published}?gid=574193446&single=true&output=csv`;
const mechanicsUrl = `${published}?gid=2076452961&single=true&output=csv`;
const sheetUrl = 'https://docs.google.com/spreadsheets/d/15aOvzrA6Wf5SORil4CQdplKLr6wsSGTE7uGitZlSDGM/edit';

/** RFC4180 parser: supports escaped quotes, CRLF and embedded newlines. */
export function parseCsv(text) {
  const rows = []; let row = []; let value = ''; let quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(value); value = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(value); if (row.some(Boolean)) rows.push(row); row = []; value = '';
    } else value += c;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  row.push(value); if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift().map((h, i) => h || `_unnamed_${i + 1}`);
  return rows.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const numeric = value => {
  if (value == null || String(value).trim() === '') return null;
  const number = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(number) ? number : null;
};
const letter = index => {
  let out = ''; index++;
  while (index) { index--; out = String.fromCharCode(65 + index % 26) + out; index = Math.floor(index / 26); }
  return out;
};

const metricDefs = [
  ['weight', 'Weight', 'kg', 'core', 'R Weight'],
  ['bite', 'Bite force', '', 'core', 'R Biteforce'],
  ['speed', 'Sprint speed', 'km/h', 'core', 'R Speed (KM/h)'],
  ['hp', 'Health pool', 'HP', 'core', 'HP'],
  ['walk', 'Walk', 'km/h', 'movement', 'WalkSpeed (KM/h)'],
  ['trot', 'Trot', 'km/h', 'movement', 'TrotSpeed (KM/h)'],
  ['sprint', 'Sprint', 'km/h', 'movement', 'SprintSpeed (KM/h)'],
  ['crouch', 'Crouch', 'km/h', 'movement', 'CrouchSpeed (KM/h)'],
  ['slowSwim', 'Slow swim', 'km/h', 'movement', 'SlowSwimSpeed (KM/h)'],
  ['fastSwim', 'Fast swim', 'km/h', 'movement', 'FastSwimSpeed (KM/h)'],
  ['waterWalk', 'Water walk', 'km/h', 'movement', 'WaterWalkSpeed (KM/h)'],
  ['waterSprint', 'Water sprint', 'km/h', 'movement', 'WaterSprintSpeed (KM/h)'],
  ['crouchSprint', 'Crouch sprint', 'km/h', 'movement', 'SprintSpeedCrouch (KM/h)'],
  ['takeoff', 'Takeoff', 'km/h', 'movement', 'TakeoffSpeed (KM/h)'],
  ['staminaDrain', 'Adult sprint stamina duration', 's', 'survival', 'Sprint (s)'],
  ['fastSwimDuration', 'Fast swim stamina duration', 's', 'survival', 'Fast swim (s)'],
  ['slowSwimDuration', 'Slow swim stamina duration', 's', 'survival', 'Slow swim (s)'],
  ['mudDuration', 'Mud walking duration (unverified)', 's', 'survival', 'Mud walking (s)'],
  ['staminaRegen', 'Standing refill baseline (0–100%)', 's', 'recovery', 'Stamina refill (s)'],
  ['hunger', 'Full hunger bar', 's', 'survival', 'Hunger (s)'],
  ['thirst', 'Full thirst bar', 's', 'survival', 'Thirst (s)'],
  ['oxygen', 'Dive duration', 's', 'survival', 'Dive (s)'],
  ['oxygenRegen', 'Oxygen refill', 's', 'recovery', 'Oxygen refill (s)'],
  ['restFlatUntil', 'Rest ramp starts', 's', 'recovery', 'Rest flat until (s)'],
  ['restCeiling', 'Maximum rest multiplier', '×', 'recovery', 'Rest ceiling (x)'],
  ['restCeilingAt', 'Maximum rest reached', 's', 'recovery', 'Rest ceiling at (s)'],
  ['staminaRest', 'Lying stamina refill (100% blood)', 's', 'recovery', 'Stamina rest to full (s)'],
  ['staminaStand', 'Standing refill baseline (0–100%)', 's', 'recovery', 'Stamina stand to full (s)'],
  ['bloodRest', 'Lying blood refill (unconfirmed)', 's', 'recovery', 'Blood rest to full (s)'],
  ['bloodStand', 'Standing blood refill (unconfirmed)', 's', 'recovery', 'Blood stand to full (s)'],
  ['healthRest', 'Lying health refill (unverified)', 's', 'recovery', 'Health rest to full (s)'],
  ['healthStand', 'Standing health refill (unverified)', 's', 'recovery', 'Health stand to full (s)'],
  ['maxStamina', 'Maximum stamina', '', 'core', 'MaxStamina'],
];
const metrics = metricDefs.map(([key, label, unit, group, sourceColumn]) => ({ key, label, unit, group, sourceColumn,
  ...(['mudDuration','bloodRest','bloodStand','healthRest','healthStand','fastSwimDuration','slowSwimDuration'].includes(key) ? { uncertain: true } : {}) }));

export async function importData({ refreshDashboard = false } = {}) {
if (refreshDashboard) {
  for (const [filename, url] of [['gamedata.csv', gameUrl], ['mechanics.csv', mechanicsUrl], ['dashboard-source.html', dashboardUrl]]) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${url}`);
    await fs.writeFile(path.join(rawDir, filename), await response.text());
  }
}

const gameRows = parseCsv(await fs.readFile(path.join(rawDir, 'gamedata.csv'), 'utf8')).filter(r => r.Species?.trim() && r.Species !== 'Species');
const mechanicRows = parseCsv(await fs.readFile(path.join(rawDir, 'mechanics.csv'), 'utf8')).filter(r => r.Species?.trim() && r.Mechanic?.trim());
const metadata = JSON.parse(await fs.readFile(path.join(rawDir, 'sheet-metadata.json'), 'utf8'));
const byId = new Map();
function ensureSpecies(name, kind = 'playable') {
  const canonical = name === 'Beipiaosaurus' ? 'Beipiosaurus' : name;
  const id = slug(canonical);
  if (!byId.has(id)) byId.set(id, { id, name: canonical, aliases: canonical === 'Beipiosaurus' ? ['Beipiaosaurus'] : [], kind, samples: [], mechanics: [] });
  return byId.get(id);
}
for (const row of gameRows) {
  const species = ensureSpecies(row.Species, row.Kind === 'Wildlife' ? 'wildlife' : 'playable');
  const growth = numeric(row['R Growth']);
  if (growth === null) throw new Error(`Missing growth: ${row.Species}`);
  if (!['Prime', 'Frail'].includes(row['Prime Status'])) throw new Error(`Unknown state: ${row['Prime Status']}`);
  species.samples.push({ growth, state: row['Prime Status'], stage: row.Stage, sourceId: 'dashboard-gamedata', peak: row['Peak?'] === 'TRUE', evicted: row['Evicted?'] === 'TRUE', values: Object.fromEntries(metrics.map(m => [m.key, numeric(row[m.sourceColumn])])), raw: row });
}
for (const [index, row] of mechanicRows.entries()) {
  ensureSpecies(row.Species).mechanics.push({ id: `${slug(row.Species)}-${slug(row.Mechanic)}-${index}`, name: row.Mechanic, chart: row.Chart, mode: row.Mode, value: numeric(row.Value), minGrowth: numeric(row['From Growth %']) ?? 0, color: row.Color, description: row.Description, sourceId: 'dashboard-mechanics', raw: row });
}

for (const { properties } of metadata.sheets) {
  const filename = `${properties.title.toLowerCase()}.json`;
  const snapshot = JSON.parse(await fs.readFile(path.join(rawDir, 'sheets', filename), 'utf8'));
  const sheet = snapshot.sheets[0]; const rowData = sheet.data[0].rowData;
  const width = properties.gridProperties.columnCount;
  const grid = Array.from({ length: 60 }, (_, r) => Array.from({ length: width }, (_, c) => rowData[r]?.values?.[c]?.formattedValue ?? ''));
  const growthRow = grid.findIndex(r => r[0].trim() === '% of Growth');
  if (growthRow < 0) throw new Error(`No growth row: ${properties.title}`);
  const secondLabel = grid[0].findIndex((v, i) => i > 0 && v.includes('Stat') && v.includes('Growth'));
  if (secondLabel < 0) throw new Error(`No second state block: ${properties.title}`);
  const stageRow = grid.findIndex(r => r[0].trim() === 'Stage');
  const cellNumber = (r, c) => {
    const cell = rowData[r]?.values?.[c];
    return cell?.effectiveValue?.numberValue ?? cell?.userEnteredValue?.numberValue ?? numeric(cell?.formattedValue);
  };
  const columns = grid[growthRow].flatMap((v, index) => {
    if (!/^\d+(?:\.\d+)?%$/.test(v.trim())) return [];
    const stage = stageRow >= 0 ? cellNumber(stageRow, index) : null;
    const growth = stage === null ? Number(v.replace('%', '')) : Number((stage * 100).toPrecision(15));
    return [{ index, letter: letter(index), growth, growthText: v, state: index < secondLabel ? 'Prime' : 'Frail', stage: grid[0][index] }];
  });
  const formulas = []; const notes = []; const hyperlinks = [];
  rowData.forEach((r, ri) => (r.values ?? []).forEach((cell, ci) => {
    const address = `${letter(ci)}${ri + 1}`;
    if (cell.userEnteredValue?.formulaValue) formulas.push({ cell: address, formula: cell.userEnteredValue.formulaValue, value: cell.formattedValue ?? '' });
    if (cell.note) notes.push({ cell: address, text: cell.note });
    if (cell.hyperlink) hyperlinks.push({ cell: address, url: cell.hyperlink });
  }));
  const rows = grid.flatMap((r, ri) => {
    const label = r[0].trim(); if (!label || ri === 0) return [];
    let category = ri > growthRow ? 'formula' : 'core';
    if (/^(?:(?:base |biped |quad |[123] nutrient )?speed \(km\/h\)|trot \(km\/h\)|swim speed \(km\/h\)|sprintspeed(?:crouch)? \(cm\/?s\)|trotspeed \(cm\/s\)|fastswimspeed \(cm\/s\)|[123]nutrientspeed \(cm\/s\))$/i.test(label)) category = 'movement';
    else if (ri < growthRow && !/weight|% of growth/i.test(label)) category = 'attack';
    if (label === '% of Growth' || label === 'Patch Last Updated') category = 'metadata';
    return [{ id: `${slug(label)}-${ri + 1}`, row: ri + 1, label, category, values: columns.map(column => ({ column: column.index, growth: column.growth, state: column.state, stage: column.stage, value: cellNumber(ri, column.index), text: r[column.index], cell: `${column.letter}${ri + 1}` })) }];
  });
  const patchRow = grid.find(r => r[0] === 'Patch Last Updated');
  const normalized = { title: properties.title, sheetId: properties.sheetId, url: `${sheetUrl}#gid=${properties.sheetId}`, sourceId: 'species-workbook', patch: patchRow?.[1] || null, range: `'${properties.title}'!A1:${letter(width - 1)}60`, rawFile: `src/data/raw/sheets/${filename}`, grid, columns, rows, attacks: rows.filter(r => r.category === 'attack'), formulas, notes, hyperlinks };
  ensureSpecies(properties.title).sheet = normalized;
}

const importedAt = new Date().toISOString();
const species = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
for (const item of species) item.samples.sort((a, b) => a.growth - b.growth || a.state.localeCompare(b.state));
const dataset = {
  schemaVersion: 1, importedAt,
  sources: [
    { id: 'dashboard-gamedata', title: 'Species Dashboard · Gamedata', url: gameUrl, patch: null, capturedAt: importedAt, description: 'Published CSV used by the live dashboard. Its game patch is not explicitly labeled.' },
    { id: 'dashboard-mechanics', title: 'Species Dashboard · Mechanics', url: mechanicsUrl, patch: null, capturedAt: importedAt, description: 'Attack multipliers, thresholds and wildlife damage. Preserved independently from the species workbook.' },
    { id: 'species-workbook', title: metadata.properties.title, url: sheetUrl, patch: [...new Set(species.map(s => s.sheet?.patch).filter(Boolean))].join(', ') || null, capturedAt: importedAt, description: '22 species tabs. Bounded formatted grids, controls, formulas, notes and source keyframes. These are a separate source and do not overwrite dashboard statistics.' },
  ], metrics, species,
  caveats: [
    'Dashboard samples use the nearest recorded growth point. Blank source values are unknown, not zero.',
    'The species workbook is a separate source. Its labeled patch is not proof that the dashboard uses the same patch.',
    'Body-hit estimates use bite force × attack multiplier, round up and assume playable HP equals weight. They do not simulate a full fight.',
    'Dashboard swim stamina durations use adult times at every growth; juvenile scaling remains unresolved.',
    'Blood recovery is unconfirmed. Health-recovery and mud-walking columns are preserved for inspection but were deliberately omitted from the source dashboard calculations.',
    'Food and water calculations stop at an empty bar. They do not estimate subsequent health loss.',
    'Workbook multi-hit and per-second attack labels retain their original meaning; no unsupported total damage is inferred.',
  ],
  counts: { playable: species.filter(s => s.kind === 'playable').length, wildlife: species.filter(s => s.kind === 'wildlife').length, dashboardRows: gameRows.length, mechanics: mechanicRows.length, sheetTabs: metadata.sheets.length, sheetFormulas: species.reduce((n, s) => n + (s.sheet?.formulas.length ?? 0), 0), sheetNotes: species.reduce((n, s) => n + (s.sheet?.notes.length ?? 0), 0), sheetAttacks: species.reduce((n, s) => n + (s.sheet?.attacks.length ?? 0), 0) },
};
await fs.writeFile(path.join(dataDir, 'dataset.json'), JSON.stringify(dataset));
return dataset;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dataset = await importData({ refreshDashboard: process.argv.includes('--refresh-dashboard') });
  console.log(JSON.stringify(dataset.counts, null, 2));
}
