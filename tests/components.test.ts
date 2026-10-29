import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CombatArena as Attacks } from '../src/components/CombatArena.tsx';
import { Survival } from '../src/components/Survival.tsx';
import { getSpecies, getSheetValue, playableSpecies } from '../src/data/index.ts';

test('all 22 species render survival and combat while removed attack panels stay absent and workbook records remain intact', () => {
  for (const specimen of playableSpecies) {
    const props = { specimen, growth: 75, state: 'Prime' as const };
    const survival = renderToStaticMarkup(createElement(Survival, props));
    const attacks = renderToStaticMarkup(createElement(Attacks, { ...props, mechanics: specimen.mechanics }));
    assert.ok(survival.includes('Hunger percentage'), specimen.name);
    assert.ok(survival.includes('Thirst percentage'), specimen.name);
    assert.ok(attacks.includes('Attack analysis'), specimen.name);
    assert.doesNotMatch(attacks,/Source 1 attack modifiers|Source 2 attack reference|Primary damage at this growth/,specimen.name);
    if (!specimen.samples.length) {
      assert.ok(survival.includes('Survival figures are unavailable'), specimen.name);
      assert.ok(attacks.includes('Primary attack · 2 damage'), specimen.name+' uses its existing workbook primary');
      assert.ok(!attacks.includes('Source 1 has no matchup records'), specimen.name);
    }
    for (const sourceRow of specimen.sheet!.attacks) {
      // The reference panels are intentionally removed, while their original
      // authored cells remain accessible through the unchanged data API.
      const source = sourceRow.values.find(value => value.state === 'Prime' && value.growth === 75);
      if (source) assert.deepEqual(getSheetValue(sourceRow,75,'Prime'),source,`${specimen.name}: ${sourceRow.label}`);
    }
  }
});

test('Deinosuchus survival presents known refill magnitude and source qualifications', () => {
  const specimen = getSpecies('Deinosuchus')!;
  const markup = renderToStaticMarkup(createElement(Survival, { specimen, growth: 25, state: 'Prime' }));
  assert.ok(markup.includes('2m 32s'), '15.2s adult sprint scales tenfold at25%');
  assert.ok(markup.includes('5m 3s'), 'negative303s swim duration remains a visible magnitude');
  assert.ok(markup.includes('refills'));
  assert.ok(markup.includes('Thirst (land)'));
  assert.ok(markup.includes('Blood scales stamina refill only'));
  assert.ok(markup.includes('juvenile scaling remains unresolved'));
});

test('hatchling workbook selection keeps the matchup model without the removed source notice', () => {
  const specimen = getSpecies('Allosaurus')!;
  const markup = renderToStaticMarkup(createElement(Attacks, { specimen, growth: 0, state: 'Prime', mechanics: specimen.mechanics }));
  assert.ok(!markup.includes('nearest available record at 25% growth'));
  assert.ok(!markup.includes('These remain separate from the Source 1 matchup model'));
  assert.ok(!markup.includes('Patch 0.'));
  assert.ok(!markup.includes('ceiling(remaining HP'));
  assert.ok(markup.includes('Their selected hits to defeat you'));
});
