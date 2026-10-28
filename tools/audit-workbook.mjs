/** Read-only, exhaustive three-way audit of already captured Google Sheets cells.
 * Capture fresh CellData through the connected Google Drive get_spreadsheet_cells
 * tool into test-results/numeric-audit/workbook before running:
 * node --import tsx tools/audit-workbook.mjs
 * This script never contacts or edits the source or rewrites app data.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { dataset, getSpecies, getSheetValue } from '../src/data/index.ts';
import { sheetRow, readValue } from '../src/lib/ui.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const freshDir = path.resolve(root, process.argv[2] ?? 'test-results/numeric-audit/workbook');
const rawDir = path.join(root, 'src/data/raw');
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const freshMetadata = await readJson(path.join(freshDir, 'metadata.json'));
const oldMetadata = await readJson(path.join(rawDir, 'sheet-metadata.json'));
const driveMetadata = await readJson(path.join(freshDir, 'drive-metadata.json'));
const columnName = index => {
  let name = '';
  for (index++; index; index = Math.floor((index - 1) / 26)) name = String.fromCharCode(65 + (index - 1) % 26) + name;
  return name;
};
const address = (r, c) => `${columnName(c)}${r + 1}`;
const numeric = value => {
  if (value == null || String(value).trim() === '') return null;
  const number = Number(String(value).replaceAll(',', ''));
  return Number.isFinite(number) ? number : null;
};
const cellNumber = cell => cell?.effectiveValue?.numberValue ?? cell?.userEnteredValue?.numberValue ?? numeric(cell?.formattedValue);
const fields = ['formattedValue', 'effectiveValue', 'userEnteredValue', 'note', 'hyperlink', 'dataValidation'];
const sourceChanges = [], importMismatches = [], baselineImportMismatches = [], metadataChanges = [];
const integrity = [];
const checks = { gridCells: 0, sourceFieldComparisons: 0, sourceNonemptyCells: 0, nativeNumbers: 0, formulaCells: 0, normalizedValues: 0, numericNormalizedValues: 0, zeroNormalizedValues: 0, nullNormalizedValues: 0, keyframeColumns: 0, selectedRowValues: 0, attackRows: 0, attackValues: 0, movementRows: 0, movementValues: 0, mappedReadings: 0, mirroredSourceNumbers: 0, movementUnitConversions: 0, tailCellsScanned: 0, tailNonemptyCells: 0, errorsInSource: 0 };
const perSpecies = [], precision = [], helperNumbers = [], sourceArithmeticMismatches = [];
function same(actual, expected, target, details) {
  if (!isDeepStrictEqual(actual, expected)) target.push({ ...details, expected: expected ?? null, actual: actual ?? null });
}
function check(condition, message) { if (!condition) integrity.push(message); }

same(freshMetadata.properties, oldMetadata.properties, metadataChanges, { field: 'properties' });
same(freshMetadata.sheets, oldMetadata.sheets, metadataChanges, { field: 'sheets' });
same(dataset.counts.sheetTabs, freshMetadata.sheets.length, importMismatches, { field: 'sheetTabs' });
const topMovement = new Set(['Speed (km/h)', 'Base Speed (km/h)', 'Biped Speed (km/h)', 'Quad Speed (km/h)', '1 Nutrient Speed (km/h)', '2 Nutrient Speed (km/h)', '3 Nutrient Speed (km/h)', 'Trot (km/h)', 'Swim Speed (km/h)']);

for (const { properties: p } of freshMetadata.sheets) {
  const filename = `${p.title.toLowerCase()}.json`;
  const fresh = await readJson(path.join(freshDir, filename));
  const old = await readJson(path.join(rawDir, 'sheets', filename));
  const tails = await readJson(path.join(freshDir, `tail-${filename}`));
  const rows = fresh.sheets[0].data[0].rowData ?? [];
  const oldRows = old.sheets[0].data[0].rowData ?? [];
  const specimen = getSpecies(p.title), sheet = specimen?.sheet;
  check(Boolean(sheet), `${p.title}: missing imported sheet`);
  if (!sheet) continue;
  same(sheet.title, p.title, importMismatches, { species: p.title, field: 'title' });
  same(sheet.sheetId, p.sheetId, importMismatches, { species: p.title, field: 'sheetId' });
  const width = p.gridProperties.columnCount;
  for (let r = 0; r < 60; r++) for (let c = 0; c < width; c++) {
    const current = rows[r]?.values?.[c] ?? {}, before = oldRows[r]?.values?.[c] ?? {};
    const details = { species: p.title, cell: address(r, c) };
    for (const field of fields) {
      same(current[field], before[field], sourceChanges, { ...details, field });
      checks.sourceFieldComparisons++;
    }
    same(sheet.grid[r]?.[c], current.formattedValue ?? '', importMismatches, { ...details, field: 'grid' });
    same(sheet.grid[r]?.[c], before.formattedValue ?? '', baselineImportMismatches, { ...details, field: 'grid' });
    checks.gridCells++;
    if (fields.some(field => current[field] !== undefined)) checks.sourceNonemptyCells++;
    if (typeof current.effectiveValue?.numberValue === 'number') checks.nativeNumbers++;
    if (current.effectiveValue?.errorValue) checks.errorsInSource++;
  }

  const growthRow = rows.findIndex(row => row.values?.[0]?.formattedValue?.trim() === '% of Growth');
  const stageRow = rows.findIndex(row => row.values?.[0]?.formattedValue?.trim() === 'Stage');
  const blockHeaders = (rows[0]?.values ?? []).flatMap((cell, c) => /Stat.*Growth/s.test(cell.formattedValue ?? '') ? [c] : []);
  check(blockHeaders.length === 2, `${p.title}: expected two original state blocks`);
  const secondBlock = blockHeaders[1];
  const sourceColumns = [];
  for (let c = 0; c < width; c++) {
    const text = rows[growthRow]?.values?.[c]?.formattedValue ?? '';
    if (!/^\d+(?:\.\d+)?%$/.test(text.trim())) continue;
    const stage = cellNumber(rows[stageRow]?.values?.[c]);
    check(stage !== null, `${p.title} ${columnName(c)}: native Stage absent`);
    const exactGrowth = stage * 100;
    const growth = Number(exactGrowth.toPrecision(15));
    const column = { index: c, letter: columnName(c), growth, growthText: text, state: c < secondBlock ? 'Prime' : 'Frail', stage: rows[0]?.values?.[c]?.formattedValue ?? '' };
    sourceColumns.push(column);
    precision.push({ species: p.title, column: column.letter, exactStage: stage, stageTimes100: exactGrowth, storedGrowth: growth, floatingCleanup: Math.abs(exactGrowth - growth), displayedGrowth: text });
  }
  same(sheet.columns, sourceColumns, importMismatches, { species: p.title, field: 'columns' });
  check(new Set(sourceColumns.map(c => `${c.state}|${c.growth}`)).size === sourceColumns.length, `${p.title}: duplicate growth/state keyframe`);
  for (const state of ['Prime', 'Frail']) {
    const columns = sourceColumns.filter(c => c.state === state);
    check(Math.min(...columns.map(c => c.growth)) === 0 && Math.max(...columns.map(c => c.growth)) === 100, `${p.title} ${state}: incomplete 0–100 path`);
  }
  checks.keyframeColumns += sourceColumns.length;
  const labels = rows.flatMap((row, r) => r > 0 && row.values?.[0]?.formattedValue?.trim() ? [{ row: r + 1, label: row.values[0].formattedValue.trim() }] : []);
  same(sheet.rows.map(({ row, label }) => ({ row, label })), labels, importMismatches, { species: p.title, field: 'rowLabels' });
  let numericValues = 0, zeros = 0, nulls = 0;
  for (const row of sheet.rows) {
    same(row.values.length, sourceColumns.length, importMismatches, { species: p.title, row: row.row, field: 'valueCount' });
    for (const [index, value] of row.values.entries()) {
      const column = sourceColumns[index];
      if (!column) continue;
      const sourceCell = rows[row.row - 1]?.values?.[column.index];
      const originalCell = oldRows[row.row - 1]?.values?.[column.index];
      const expected = { column: column.index, growth: column.growth, state: column.state, stage: column.stage, value: cellNumber(sourceCell), text: sourceCell?.formattedValue ?? '', cell: address(row.row - 1, column.index) };
      same(value, expected, importMismatches, { species: p.title, cell: expected.cell, field: 'normalizedValue' });
      same(value.value, cellNumber(originalCell), baselineImportMismatches, { species: p.title, cell: expected.cell, field: 'normalizedNumber' });
      same(value.text, originalCell?.formattedValue ?? '', baselineImportMismatches, { species: p.title, cell: expected.cell, field: 'normalizedText' });
      same(getSheetValue(row, column.growth, column.state), value, importMismatches, { species: p.title, cell: expected.cell, field: 'keyframeLookup' });
      checks.normalizedValues++; checks.selectedRowValues++;
      if (value.value === null) nulls++; else { numericValues++; if (value.value === 0) zeros++; }
    }
  }
  checks.numericNormalizedValues += numericValues; checks.zeroNormalizedValues += zeros; checks.nullNormalizedValues += nulls;
  const covered = new Set(sheet.rows.flatMap(row => row.values.map(value => value.cell)));
  for (const [r, row] of rows.entries()) for (const [c, cell] of (row.values ?? []).entries()) {
    if (typeof cell.effectiveValue?.numberValue === 'number' && !covered.has(address(r, c))) helperNumbers.push({ species: p.title, cell: address(r, c), label: row.values[0]?.formattedValue ?? '', value: cell.effectiveValue.numberValue, text: cell.formattedValue, formula: cell.userEnteredValue?.formulaValue ?? null, note: 'Preserved original helper cell; column has no labeled growth keyframe.' });
  }
  // Independently check the source's repeated headline/formula rows and its
  // unit arithmetic. This diagnoses internal source disagreement separately
  // from an import mismatch; it does not rewrite the original numbers.
  for (const label of new Set(sheet.rows.map(row => row.label))) {
    const repeated = sheet.rows.filter(row => row.label === label);
    if (repeated.length !== 2) continue;
    for (const column of sourceColumns) {
      const a = cellNumber(rows[repeated[0].row - 1]?.values?.[column.index]);
      const b = cellNumber(rows[repeated[1].row - 1]?.values?.[column.index]);
      if (a === null || b === null) continue;
      if (Math.abs(a - b) > 1e-10 * Math.max(1, Math.abs(a), Math.abs(b))) sourceArithmeticMismatches.push({ species: p.title, label, first: address(repeated[0].row - 1, column.index), second: address(repeated[1].row - 1, column.index), firstValue: a, secondValue: b });
      checks.mirroredSourceNumbers++;
    }
  }
  const rawSprint = sheet.rows.find(row => /^Sprintspeed \(cm\/?s\)$/i.test(row.label));
  const conversions = [
    { output: p.title === 'Gallimimus' ? 'Base Speed (km/h)' : p.title === 'Maiasaura' ? 'Biped Speed (km/h)' : 'Speed (km/h)', input: rawSprint?.label },
    { output: 'Trot (km/h)', input: 'Trotspeed (cm/s)' },
    { output: 'Swim Speed (km/h)', input: 'FastSwimSpeed (cm/s)', scale: 'Scale' },
    ...(p.title === 'Gallimimus' ? [1, 2, 3].map(n => ({ output: `${n} Nutrient Speed (km/h)`, input: `${n}NutrientSpeed (cm/s)` })) : []),
    ...(p.title === 'Maiasaura' ? [{ output: 'Quad Speed (km/h)', input: 'Sprintspeedcrouch (cm/s)' }] : []),
  ];
  for (const conversion of conversions) {
    const output = sheet.rows.find(row => row.label === conversion.output);
    const input = sheet.rows.find(row => row.label === conversion.input);
    const scale = conversion.scale ? sheet.rows.find(row => row.label === conversion.scale) : null;
    check(Boolean(output && input && (!conversion.scale || scale)), `${p.title}: missing movement conversion row ${conversion.output}`);
    if (!input || !output || conversion.scale && !scale) continue;
    for (const column of sourceColumns) {
      const read = row => cellNumber(rows[row.row - 1]?.values?.[column.index]);
      const actual = read(output), base = read(input), scaleNumber = scale ? read(scale) : 1;
      if (actual === null || base === null || scaleNumber === null) continue;
      const expected = base * scaleNumber * 0.036;
      if (Math.abs(actual - expected) > 1e-10 * Math.max(1, Math.abs(actual), Math.abs(expected))) sourceArithmeticMismatches.push({ species: p.title, cell: address(output.row - 1, column.index), conversion, actual, expected });
      checks.movementUnitConversions++;
    }
  }
  const formulas = [], notes = [], hyperlinks = [];
  for (const [r, row] of rows.entries()) for (const [c, cell] of (row.values ?? []).entries()) {
    const cellAddress = address(r, c);
    if (cell.userEnteredValue?.formulaValue) formulas.push({ cell: cellAddress, formula: cell.userEnteredValue.formulaValue, value: cell.formattedValue ?? '' });
    if (cell.note) notes.push({ cell: cellAddress, text: cell.note });
    if (cell.hyperlink) hyperlinks.push({ cell: cellAddress, url: cell.hyperlink });
  }
  same(sheet.formulas, formulas, importMismatches, { species: p.title, field: 'formulas' });
  same(sheet.notes, notes, importMismatches, { species: p.title, field: 'notes' });
  same(sheet.hyperlinks, hyperlinks, importMismatches, { species: p.title, field: 'hyperlinks' });
  checks.formulaCells += formulas.length;
  const attackRows = labels.filter(row => row.row <= growthRow && row.label !== 'Weight (kg)' && !topMovement.has(row.label));
  same(sheet.attacks.map(({ row, label }) => ({ row, label })), attackRows, importMismatches, { species: p.title, field: 'attackMembership' });
  checks.attackRows += attackRows.length;
  checks.attackValues += sheet.attacks.reduce((n, row) => n + row.values.length, 0);
  const movementRows = sheet.rows.filter(row => row.category === 'movement');
  checks.movementRows += movementRows.length;
  checks.movementValues += movementRows.reduce((n, row) => n + row.values.length, 0);
  const mapping = {};
  const expectedLabels = { weight: 'Weight (kg)', bite: p.title === 'Maiasaura' ? 'Headbutt (Quad RMB)' : ['Diabloceratops', 'Triceratops'].includes(p.title) ? 'Gore (LMB)' : p.title === 'Gallimimus' ? 'Bite\n(RMB walking/standing)' : 'Bite (LMB)', speed: p.title === 'Gallimimus' ? 'Base Speed (km/h)' : p.title === 'Maiasaura' ? 'Biped Speed (km/h)' : 'Speed (km/h)', trot: 'Trot (km/h)', fastSwim: 'Swim Speed (km/h)' };
  expectedLabels.sprint = expectedLabels.speed;
  for (const [key, label] of Object.entries(expectedLabels)) {
    const expectedRow = sheet.rows.find(row => row.label === label);
    const actualRow = sheetRow(specimen, key);
    same(actualRow?.row, expectedRow?.row, importMismatches, { species: p.title, key, field: 'uiRowMapping' });
    check(Boolean(expectedRow), `${p.title}: expected ${label} absent`);
    mapping[key] = { row: actualRow?.row ?? null, label: actualRow?.label ?? null };
    for (const column of sourceColumns) {
      const expected = cellNumber(rows[expectedRow.row - 1]?.values?.[column.index]);
      same(readValue(specimen, column.growth, column.state, key, 'sheet'), expected, importMismatches, { species: p.title, cell: address(expectedRow.row - 1, column.index), key, field: 'uiReadValue' });
      checks.mappedReadings++;
    }
  }
  const tailRange = `'${p.title}'!A61:${columnName(width - 1)}${p.gridProperties.rowCount}`;
  checks.tailCellsScanned += (p.gridProperties.rowCount - 60) * width;
  let nonemptyTail = 0;
  for (const data of tails.sheets[0].data ?? []) for (const row of data.rowData ?? []) for (const cell of row.values ?? []) if (Object.keys(cell).length) nonemptyTail++;
  checks.tailNonemptyCells += nonemptyTail;
  perSpecies.push({ sourceTitle: p.title, canonicalSpecies: specimen.name, id: specimen.id, gridWidth: width, populatedRows: rows.length, normalizedRows: sheet.rows.length, nativeNumbers: rows.reduce((n, row) => n + (row.values ?? []).filter(c => typeof c.effectiveValue?.numberValue === 'number').length, 0), keyframes: sourceColumns.length, primeKeyframes: sourceColumns.filter(c => c.state === 'Prime').length, frailKeyframes: sourceColumns.filter(c => c.state === 'Frail').length, normalizedValues: sheet.rows.reduce((n, row) => n + row.values.length, 0), numericValues, zeroValues: zeros, nullValues: nulls, formulas: formulas.length, attacks: attackRows.length, movementRows: movementRows.length, mapping, tailRange, nonemptyTail });
}

check(freshMetadata.sheets.length === 22, 'Live workbook does not have expected 22 tabs');
check(checks.formulaCells === 7865, 'Live workbook formula count differs from 7865 baseline');
check(checks.attackRows === 111, 'Live workbook attack count differs from 111 baseline');
check(checks.tailNonemptyCells === 0, 'Live workbook has content outside imported 60 rows');
const maxCleanup = Math.max(...precision.map(p => p.floatingCleanup));
check(maxCleanup < 1e-12, `Growth precision cleanup unexpectedly large: ${maxCleanup}`);
const snapshotFiles = await fs.readdir(freshDir);
const result = {
  auditedAt: new Date().toISOString(), spreadsheetId: freshMetadata.spreadsheetId, sourceUrl: freshMetadata.spreadsheetUrl, sourceModifiedTime: driveMetadata.modified_time,
  workbookTitle: freshMetadata.properties.title, importedAt: dataset.importedAt,
  passed: sourceChanges.length === 0 && importMismatches.length === 0 && baselineImportMismatches.length === 0 && metadataChanges.length === 0 && integrity.length === 0 && sourceArithmeticMismatches.length === 0,
  checks, sourceChanges, importMismatches, baselineImportMismatches, metadataChanges, integrity, sourceArithmeticMismatches, helperNumbers,
  growthPrecision: { maxFloatingCleanupPercent: maxCleanup, exactStageValuesPreserved: true, floatingCleanupExamples: precision.filter(p => p.floatingCleanup > 0).slice(0, 10), distinctCloseKeyframes: precision.filter(p => p.species === 'Triceratops' && [62.4981, 62.5, 87.50788, 87.5079].includes(p.storedGrowth)) },
  mappingNotes: [
    'Gallimimus headline speed is Base Speed; 1/2/3 nutrient speeds remain separate movement variant rows.',
    'Maiasaura headline speed is Biped Speed; Quad Speed remains separate and is not relabeled as crouch sprint.',
    'Diabloceratops and Triceratops primary damage maps Gore; Maiasaura maps Headbutt; Gallimimus maps its newline-bearing Bite label.',
    'Workbook Beipiaosaurus resolves to canonical dashboard species Beipiosaurus without losing the original tab spelling.',
    'Unsupported Source 2 survival/gait/HP fields remain unknown, not fabricated from Source 1.',
    'Formula results are the native effectiveValue, not rounded formattedValue. Keyframes use native Stage × 100 with at most 15 significant digits of floating-point cleanup.'
  ],
  resolvedUiBindings: [{ id: 'source2-sprint-curve', status: 'resolved', verification: 'Shared sprint-to-speed alias checked against all 463 fresh native speed cells; no data changes or live GUI test.' }],
  snapshotFiles: snapshotFiles.length, perSpecies,
};
await fs.writeFile(path.join(freshDir, '..', 'workbook-audit.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ passed: result.passed, checks, metadataChanges: metadataChanges.length, sourceChanges: sourceChanges.length, importMismatches: importMismatches.length, baselineImportMismatches: baselineImportMismatches.length, sourceArithmeticMismatches, helperNumbers, integrity, maxFloatingCleanupPercent: maxCleanup, report: path.relative(root, path.join(freshDir, '..', 'workbook-audit.json')) }, null, 2));
if (!result.passed) process.exitCode = 1;
