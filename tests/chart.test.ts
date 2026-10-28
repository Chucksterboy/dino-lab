import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GrowthChart } from '../src/components/Chart.tsx';
import { getSpecies, species } from '../src/data/index.ts';
import type { Mechanic, Species, State } from '../src/data/types.ts';

const allosaurus = getSpecies('Allosaurus')!;
const threshold: Mechanic = {
  id: 'audit-half-weight', name: 'Audit grab limit', chart: 'weight', mode: 'threshold',
  value: 0.5, minGrowth: 50, color: '#abcdef', description: 'Test fixture: target weight at most half selected weight.',
  sourceId: 'local', raw: {},
};
const withThreshold: Species = { ...allosaurus, mechanics: [threshold] };

function render(props: Partial<Parameters<typeof GrowthChart>[0]> = {}) {
  return renderToStaticMarkup(createElement(GrowthChart, { specimen: allosaurus, ...props }));
}

test('threshold band uses selected stat times ratio, preserving exact limit in tooltip', () => {
  const markup = render({ specimen: withThreshold, growth: 75, metric: 'weight', source: 'dashboard' });
  assert.ok(markup.includes('your selected stat (2,593) × 0.5 = 1,296.5'));
  assert.ok(markup.includes('Audit grab limit ≤ 1,297 kg'), 'display rounding is separate from exact limit');
  assert.match(markup, /<path[^>]*stroke="#abcdef"/);
  assert.match(markup, /<rect[^>]*fill="#abcdef"[^>]*opacity="\.1"/);
});

test('threshold unlock uses selected growth and selected condition', () => {
  const locked = render({ specimen: withThreshold, growth: 49, metric: 'weight' });
  assert.doesNotMatch(locked, /<path[^>]*stroke="#abcdef"/);
  assert.ok(locked.includes('unlocks 50%'));
  assert.match(locked, /disabled=""/);
  const prime = render({ specimen: withThreshold, growth: 100, state: 'Prime', metric: 'weight' });
  const frail = render({ specimen: withThreshold, growth: 100, state: 'Frail', metric: 'weight' });
  assert.ok(prime.includes('your selected stat (3,672) × 0.5 = 1,836'));
  assert.ok(frail.includes('your selected stat (2,593) × 0.5 = 1,296.5'));
});

test('independent workbook charts do not inherit dashboard mechanics', () => {
  const markup = render({ specimen: withThreshold, growth: 75, metric: 'weight', source: 'sheet' });
  assert.doesNotMatch(markup, /<path[^>]*stroke="#abcdef"/);
  assert.ok(!markup.includes('Audit grab limit'));
});

test('sanctuary window is derived from Prime flags even while Frail is selected', () => {
  const specimen: Species = { ...allosaurus, samples: allosaurus.samples.map(sample => sample.state === 'Frail' ? { ...sample, evicted: false, raw: { ...sample.raw, 'Evicted?': 'FALSE' } } : sample) };
  const markup = render({ specimen, state: 'Frail', source: 'dashboard' });
  assert.ok(markup.includes('Sanctuary exit 37–38%'));
  assert.ok(markup.includes('based on Prime flags'));
});

test('sanctuary first-TRUE and absent-flags cases remain distinct', () => {
  const never: Species = { ...allosaurus, samples: allosaurus.samples.map(sample => sample.state === 'Prime' ? { ...sample, evicted: true, raw: { ...sample.raw, 'Evicted?': 'TRUE' } } : sample) };
  assert.ok(render({ specimen: never, state: 'Frail' }).includes('Never allowed in sanctuary (source)'));
  const noFlags: Species = { ...allosaurus, samples: allosaurus.samples.map(sample => ({ ...sample, evicted: false, raw: { ...sample.raw, 'Evicted?': '' } })) };
  const markup = render({ specimen: noFlags });
  assert.ok(!markup.includes('Sanctuary exit'));
  assert.ok(!markup.includes('Never allowed in sanctuary'));
});

test('all 720 active species/source/state/core-metric/scale combinations render finite SVG coordinates', () => {
  let rendered = 0;
  for (const specimen of species) {
    for (const source of ['dashboard', 'sheet'] as const) {
      for (const state of ['Prime', 'Frail'] as State[]) {
        for (const metric of ['weight', 'bite', 'speed']) {
          for (const log of [false, true]) {
            const markup = render({ specimen, source, state, metric, log, growth: 75 });
            const invalid = markup.match(/\b(?:d|x|y|x1|x2|y1|y2|cx|cy|width|height)="[^"]*(?:NaN|Infinity|undefined)/);
            assert.equal(invalid, null, `${specimen.name} ${source} ${state} ${metric} log=${log}`);
            assert.ok(markup.includes('<svg') || markup.includes('chart-empty'));
            rendered++;
          }
        }
      }
    }
  }
  assert.equal(rendered, 720);
});

test('log chart with no positive data renders an explicit empty state', () => {
  const specimen: Species = { ...allosaurus, samples: allosaurus.samples.map(sample => ({ ...sample, values: { ...sample.values, weight: 0 } })) };
  const markup = render({ specimen, metric: 'weight', log: true });
  assert.ok(markup.includes('No positive weight curve'));
  assert.ok(!markup.includes('<svg'));
});
