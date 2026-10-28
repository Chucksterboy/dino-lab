import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  dataset, getPeakSample, getSample, getSheetValue, getSpecies,
  metrics, playableSpecies, sourceDataset, species, wildlifeSpecies,
} from '../src/data/index.ts';
import type { State } from '../src/data/types.ts';

const rawPath = (relative: string) => fileURLToPath(new URL(`../src/data/raw/${relative}`, import.meta.url));

/** Independent token parser: quoted CSV fields may include commas and newlines. */
function readSourceCsv(relative: string): Record<string, string>[] {
  const content = readFileSync(rawPath(relative), 'utf8').replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let row = [''];
  for (const [token] of content.matchAll(/"(?:[^"]|"")*"|[^",\r\n]+|,|\r\n|\n|\r/g)) {
    if (token === ',') row.push('');
    else if (/^[\r\n]/.test(token)) {
      if (row.some(Boolean)) records.push(row);
      row = [''];
    } else row[row.length - 1] += token.startsWith('"') ? token.slice(1, -1).replace(/""/g, '"') : token;
  }
  if (row.some(Boolean)) records.push(row);
  const header = records.shift()!.map((value, index) => value || `_unnamed_${index + 1}`);
  return records.map(record => Object.fromEntries(header.map((key, index) => [key, record[index] ?? ''])));
}

function sourceNumber(value: string | undefined): number | null {
  if (value == null || value.trim() === '') return null;
  const numeric = Number(value.replace(/,/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

const originalGame = readSourceCsv('gamedata.csv');
const originalMechanics = readSourceCsv('mechanics.csv');
const metadata = JSON.parse(readFileSync(rawPath('sheet-metadata.json'), 'utf8'));
const sourceSpecies = (name: string) => sourceDataset.species.find(item => item.id === name.toLowerCase() || item.name.toLowerCase() === name.toLowerCase() || item.aliases.some(alias => alias.toLowerCase() === name.toLowerCase()));

test('source record counts and coverage are complete, with sheet-only species distinct', () => {
  assert.equal(originalGame.length, 3214);
  assert.equal(originalMechanics.length, 96);
  assert.equal(metadata.sheets.length, 22);
  assert.equal(sourceDataset.species.length, 33);
  assert.equal(species.length, 30);
  assert.equal(playableSpecies.length, 22);
  assert.equal(wildlifeSpecies.length, 8);
  assert.equal(sourceDataset.species.reduce((sum, item) => sum + item.samples.length, 0), 3214);
  assert.equal(sourceDataset.species.reduce((sum, item) => sum + item.mechanics.length, 0), 96);
  assert.equal(species.reduce((sum, item) => sum + item.samples.length, 0), 3208);
  assert.equal(species.reduce((sum, item) => sum + item.mechanics.length, 0), 94);
  assert.equal(species.filter(item => item.sheet).length, 22);
  assert.equal(playableSpecies.filter(item => item.samples.length).length, 21);
  assert.deepEqual(playableSpecies.filter(item => !item.samples.length).map(item => item.name), ['Hypsilophodon']);
  assert.equal(getSample('Hypsilophodon', 75), undefined);
});

test('every playable dashboard species has every integer slider point in both states', () => {
  for (const item of playableSpecies.filter(item => item.samples.length)) {
    assert.equal(item.samples.length, 152, item.name);
    const identities = new Set(item.samples.map(sample => `${sample.state}|${sample.growth}`));
    assert.equal(identities.size, 152, `${item.name} has no duplicate growth/state records`);
    for (const state of ['Prime', 'Frail'] as State[]) {
      for (let growth = 25; growth <= 100; growth++) {
        const sample = getSample(item, growth, state);
        assert.ok(sample, `${item.name} ${state} ${growth}% exists`);
        assert.equal(sample.growth, growth);
        assert.equal(sample.state, state);
      }
    }
  }
});

test('normalized values and every original source column match independent CSV parsing', () => {
  let blanks = 0;
  for (const original of originalGame) {
    const item = sourceSpecies(original.Species);
    assert.ok(item, original.Species);
    const sample = item.samples.find(sample => sample.state === original['Prime Status'] && sample.growth === sourceNumber(original['R Growth']));
    assert.ok(sample, `${original.Species} ${original['Prime Status']} ${original['R Growth']}`);
    assert.deepEqual(sample.raw, original);
    for (const metric of metrics) {
      const expected = sourceNumber(original[metric.sourceColumn]);
      assert.equal(sample.values[metric.key], expected, `${original.Species} ${sample.state} ${sample.growth} ${metric.key}`);
      if (expected === null) blanks++;
    }
  }
  assert.ok(blanks > 0, 'blank source values are exercised');
});

test('every mechanic description, mode, multiplier, threshold and unlock survives', () => {
  const normalized = sourceDataset.species.flatMap(item => item.mechanics);
  for (const original of originalMechanics) {
    const mechanic = normalized.find(item => item.raw.Species === original.Species && item.raw.Mechanic === original.Mechanic);
    assert.ok(mechanic, `${original.Species}: ${original.Mechanic}`);
    assert.deepEqual(mechanic.raw, original);
    assert.equal(mechanic.name, original.Mechanic);
    assert.equal(mechanic.description, original.Description);
    assert.equal(mechanic.chart, original.Chart);
    assert.equal(mechanic.mode, original.Mode);
    assert.equal(mechanic.value, sourceNumber(original.Value));
    assert.equal(mechanic.minGrowth, sourceNumber(original['From Growth %']) ?? 0);
    assert.equal(mechanic.color, original.Color);
  }
});

test('source checkpoints stay separate instead of silently overwriting conflicting numbers', () => {
  const allosaurus = getSpecies('Allosaurus')!;
  assert.deepEqual(
    ['weight', 'bite', 'speed'].map(key => getSample(allosaurus, 75, 'Prime')!.values[key]),
    [2593, 175, 39.8],
  );
  assert.deepEqual(
    ['weight', 'bite', 'speed'].map(key => getSample(allosaurus, 100, 'Frail')!.values[key]),
    [2593, 105, 33.6],
  );
  const sheetSpeed = allosaurus.sheet!.rows.find(row => row.label === 'Speed (km/h)')!;
  const value = getSheetValue(sheetSpeed, 75, 'Prime')!;
  assert.ok(value.value != null && Math.abs(value.value - 39.72609796) < 1e-7);
  assert.notEqual(value.value, getSample(allosaurus, 75, 'Prime')!.values.speed);
  assert.equal(getSpecies('Beipiaosaurus'), getSpecies('Beipiosaurus'));
});

test('nearest dashboard lookup has deterministic ties and rejects invalid requests', () => {
  assert.equal(getSample('Allosaurus', 74.5, 'Prime')!.growth, 74);
  assert.equal(getSample('Allosaurus', 74.51, 'Prime')!.growth, 75);
  assert.equal(getSample('Allosaurus', NaN, 'Prime'), undefined);
  assert.equal(getSample('does-not-exist', 75), undefined);
});

test('every workbook tab, native numeric value, formula and formatted cell is preserved', () => {
  let formulaCount = 0;
  for (const { properties } of metadata.sheets) {
    const item = getSpecies(properties.title);
    assert.ok(item?.sheet, properties.title);
    const sheet = item.sheet;
    assert.equal(sheet.title, properties.title);
    assert.equal(sheet.sheetId, properties.sheetId);
    assert.equal(sheet.patch, '0.21.748');
    const raw = JSON.parse(readFileSync(rawPath(`sheets/${properties.title.toLowerCase()}.json`), 'utf8'));
    const sourceRows = raw.sheets[0].data[0].rowData;
    const formulas: { cell: string; formula: string; value: string }[] = [];
    for (let rowIndex = 0; rowIndex < sourceRows.length; rowIndex++) {
      const row = sourceRows[rowIndex];
      for (let column = 0; column < (row.values ?? []).length; column++) {
        const cell = row.values[column];
        assert.equal(sheet.grid[rowIndex][column], cell.formattedValue ?? '', `${properties.title} row${rowIndex + 1} col${column + 1}`);
        if (cell.userEnteredValue?.formulaValue) {
          const letter = excelColumn(column);
          formulas.push({ cell: `${letter}${rowIndex + 1}`, formula: cell.userEnteredValue.formulaValue, value: cell.formattedValue ?? '' });
        }
      }
    }
    assert.deepEqual(sheet.formulas, formulas);
    formulaCount += formulas.length;
    for (const normalized of sheet.rows) {
      for (const value of normalized.values) {
        const originalCell = sourceRows[normalized.row - 1]?.values?.[value.column];
        const expected = typeof originalCell?.effectiveValue?.numberValue === 'number'
          ? originalCell.effectiveValue.numberValue
          : typeof originalCell?.userEnteredValue?.numberValue === 'number'
            ? originalCell.userEnteredValue.numberValue
            : sourceNumber(originalCell?.formattedValue);
        assert.equal(value.value, expected, `${properties.title} ${value.cell}`);
      }
    }
  }
  assert.equal(formulaCount, 7865);
  assert.equal(dataset.counts.sheetFormulas, formulaCount);
});

test('every workbook growth column is independently selectable in both states', () => {
  for (const item of playableSpecies) {
    assert.ok(item.sheet, item.name);
    const sheet = item.sheet;
    const weight = sheet.rows.find(row => row.label === 'Weight (kg)');
    assert.ok(weight, `${item.name} weight row exists`);
    const identities = sheet.columns.map(column => `${column.state}|${column.growth}`);
    assert.equal(new Set(identities).size, identities.length, `${item.name} exact growth breakpoints are unique`);
    for (const state of ['Prime', 'Frail'] as State[]) {
      const columns = sheet.columns.filter(column => column.state === state);
      assert.equal(Math.min(...columns.map(column => column.growth)), 0, `${item.name} ${state} hatchling`);
      assert.equal(Math.max(...columns.map(column => column.growth)), 100, `${item.name} ${state} elder`);
      for (const column of columns) {
        const value = getSheetValue(weight, column.growth, state);
        assert.ok(value, `${item.name} ${state} ${column.growth}%`);
        assert.equal(value.growth, column.growth);
        assert.equal(value.column, column.index);
        assert.equal(value.state, state);
      }
    }
  }
  assert.ok(getSpecies('Allosaurus')!.sheet!.columns.some(column => column.growth === 74.43656));
  const trike = getSpecies('Triceratops')!.sheet!.columns;
  assert.ok(trike.some(column => column.growth === 62.4981));
  assert.ok(trike.some(column => column.growth === 62.5));
  const allosaurusStage = getSpecies('Allosaurus')!.sheet!.rows.find(row => row.label === 'Stage')!;
  assert.equal(getSheetValue(allosaurusStage, 0, 'Prime')!.value, 0, 'native numeric zero survives independently of blank cells');
});

test('no workbook cell information lies outside the imported first 60 rows', () => {
  const audit = JSON.parse(readFileSync(fileURLToPath(new URL('../docs/workbook-tail-audit.json', import.meta.url)), 'utf8'));
  assert.equal(audit.ranges.length, 22);
  for (const { properties } of metadata.sheets) {
    const checked = audit.ranges.find((entry: { sheet: string }) => entry.sheet === properties.title);
    assert.ok(checked, properties.title);
    assert.equal(checked.returnedRowData, 0);
    assert.equal(checked.range, `'${properties.title}'!A61:${excelColumn(properties.gridProperties.columnCount - 1)}${properties.gridProperties.rowCount}`);
  }
  assert.ok(audit.fields.includes('note'));
  assert.ok(audit.fields.includes('userEnteredValue'));
});

test('posture and movement words in attack labels do not hide workbook attacks', () => {
  assert.equal(species.reduce((sum, item) => sum + (item.sheet?.attacks.length ?? 0), 0), 111);
  assert.equal(dataset.counts.sheetAttacks, 111);
  for (const [name, fragment] of [['Maiasaura', 'Box'], ['Maiasaura', 'StampTrot'], ['Tyrannosaurus', 'Swim Snatch'], ['Gallimimus', 'Kick']]) {
    assert.ok(getSpecies(name)!.sheet!.attacks.some(row => row.label.includes(fragment)), `${name}: ${fragment}`);
  }
});

test('wildlife retains fixed records, explicit HP and unknown damage', () => {
  for (const item of wildlifeSpecies) {
    assert.equal(item.samples.length, 2, item.name);
    const prime = item.samples.find(sample => sample.state === 'Prime')!;
    const frail = item.samples.find(sample => sample.state === 'Frail')!;
    // Some unrounded wildlife gait columns differ slightly across the two
    // source rows. Keep those original records; the dashboard uses Prime.
    for (const key of ['weight', 'bite', 'speed', 'hp']) {
      assert.equal(prime.values[key], frail.values[key], `${item.name} fixed headline ${key}`);
    }
    assert.ok((prime.values.hp ?? 0) > 0, `${item.name} explicit HP`);
  }
  assert.ok(wildlifeSpecies.some(item => !item.mechanics.some(mechanic => mechanic.mode === 'absolute')), 'some source wildlife damage remains unknown');
});

test('every marked peak remains authoritative and points to its own species', () => {
  for (const item of playableSpecies.filter(item => item.samples.length)) {
    const selected = getPeakSample(item);
    assert.ok(selected);
    assert.equal(selected.state, 'Prime');
    assert.ok(item.samples.includes(selected));
    const flagged = item.samples.find(sample => sample.state === 'Prime' && sample.peak);
    if (flagged) assert.equal(selected, flagged);
  }
});

function excelColumn(zeroBased: number): string {
  let value = zeroBased + 1;
  let label = '';
  while (value) {
    value--;
    label = String.fromCharCode(65 + value % 26) + label;
    value = Math.floor(value / 26);
  }
  return label;
}
