import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dataset, formatDuration, formatMetric, formatNumber, playableSpecies, sourceDataset } from '../src/data/index.ts';

test('number formatting preserves nonzero sub-unit source values and true zero', () => {
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(-0, 0), '0');
  assert.equal(formatNumber(1234.567), '1,234.6');
  assert.equal(formatNumber(1234.567, 0), '1,235');
  assert.equal(formatNumber(12.34567, 3), '12.346');
  assert.equal(formatNumber(0.02, 0), '0.02');
  assert.equal(formatNumber(0.5, 0), '0.5');
  assert.equal(formatNumber(0.002, 2), '0.002');
  assert.equal(formatNumber(-0.002, 0), '-0.002');
  assert.equal(formatNumber(0.0000000123456789), '0.000000012346');
  assert.equal(formatNumber(0.123456789, 7), '0.1234568');
  for (const absent of [null, undefined, NaN, Infinity, -Infinity]) assert.equal(formatNumber(absent), '—');
});

test('metric formatting keeps tiny weights, primary damage and units', () => {
  assert.equal(formatMetric(0.02, 'weight'), '0.02 kg');
  assert.equal(formatMetric(0.5, 'weight'), '0.5 kg');
  assert.equal(formatMetric(0.002, 'bite'), '0.002');
  assert.equal(formatMetric(0.02, 'weight', false), '0.02');
  assert.equal(formatMetric(0, 'weight'), '0 kg');
  assert.equal(formatMetric(null, 'weight'), '—');
  assert.equal(formatMetric(Infinity, 'bite'), '—');
});

test('all 463 Source 2 keyframes keep every positive weight and primary attack above displayed zero', () => {
  let columns = 0;
  let numbers = 0;
  for (const specimen of playableSpecies) {
    const sheet = specimen.sheet!;
    const native = JSON.parse(readFileSync(new URL(`../${sheet.rawFile}`, import.meta.url), 'utf8')).sheets[0].data[0].rowData;
    // Every authored source tab places weight on row 2 and its primary attack on row 4.
    const rows = [['weight', 1], ['bite', 3]] as const;
    for (const column of sheet.columns) {
      for (const [key, rowIndex] of rows) {
        const value = native[rowIndex].values[column.index].effectiveValue.numberValue;
        assert.ok(value > 0, `${specimen.name} ${column.letter} ${key} has positive native input`);
        const formatted = formatMetric(value, key, false);
        const displayed = Number(formatted.replaceAll(',', ''));
        assert.ok(Number.isFinite(displayed) && displayed > 0, `${specimen.name} ${column.letter} ${key}: ${value} must not display as ${formatted}`);
        if (value < 1) assert.ok(Math.abs(displayed - value) / value < 0.00005, `${specimen.name} ${column.letter} ${key} keeps at least five significant digits`);
        numbers++;
      }
      columns++;
    }
  }
  assert.equal(columns, 463);
  assert.equal(numbers, 926);
});

test('negative duration shows absolute refill magnitude without changing positive/zero/missing output', () => {
  assert.equal(formatDuration(-303), '5m 3s · refills');
  assert.equal(formatMetric(-303, 'slowSwimDuration'), '5m 3s · refills');
  assert.equal(formatDuration(303), '5m 3s');
  assert.equal(formatDuration(0), '0s');
  assert.equal(formatDuration(3603), '1h 0m 3s');
  for (const absent of [null, undefined, NaN, Infinity, -Infinity]) assert.equal(formatDuration(absent), '—');
  const deino = dataset.species.find(specimen => specimen.id === 'deinosuchus')!;
  assert.equal(deino.samples.length, 152);
  for (const sample of deino.samples) {
    assert.equal(sample.values.slowSwimDuration, -303);
    assert.equal(sample.raw['Slow swim (s)'], '-303');
    assert.equal(formatMetric(sample.values.slowSwimDuration, 'slowSwimDuration'), '5m 3s · refills');
  }
});

test('baseline labels explain raw timing while every other snapshot field stays unchanged', () => {
  const labels: Record<string, string> = {
    staminaDrain: 'Adult sprint stamina duration',
    staminaRegen: 'Standing refill baseline (0–100%)',
    staminaStand: 'Standing refill baseline (0–100%)',
    staminaRest: 'Lying stamina refill (100% blood)',
  };
  for (const [key, label] of Object.entries(labels)) assert.equal(dataset.metrics.find(metric => metric.key === key)?.label, label);
  const protectedSnapshot = JSON.parse(JSON.stringify(sourceDataset));
  for (const metric of protectedSnapshot.metrics) if (metric.key in labels) metric.label = '<display-label>';
  // This pre-change fingerprint includes all source numbers/strings/formulas,
  // raw rows, identities, timestamps, counts and all unrelated metric metadata.
  const fingerprint = createHash('sha256').update(JSON.stringify(protectedSnapshot)).digest('hex');
  assert.equal(fingerprint, 'ed68567fbe78103215826c680d7221aa57a6152d7cdbb3d0d439adddae9e69a5');
  assert.equal(dataset.importedAt, '2026-10-28T00:46:14.734Z');
});
