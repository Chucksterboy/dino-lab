import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dataset, getPeakSample, getSample, getSeries, getSpecies, isRemovedSpeciesId, playableSpecies, sourceDataset, species, wildlifeSpecies } from '../src/data/index.ts';

const removedNames = ['BabyBoar', 'BabyDeer', 'BabyGoat'];

test('only the three baby wildlife are excluded from every active data accessor', () => {
  for (const name of removedNames) {
    assert.equal(isRemovedSpeciesId(name), true);
    assert.equal(isRemovedSpeciesId(` ${name.toUpperCase()} `), true);
    assert.equal(getSpecies(name), undefined);
    assert.equal(getSample(name, 100, 'Prime'), undefined);
    assert.equal(getPeakSample(name), undefined);
    assert.deepEqual(getSeries(name, 'weight'), []);
    assert.ok(!species.some(item => item.name === name));
    assert.ok(!wildlifeSpecies.some(item => item.name === name));
  }
  assert.equal(species.length, 30);
  assert.equal(playableSpecies.length, 22);
  assert.equal(wildlifeSpecies.length, 8);
  for (const adult of ['Boar', 'Deer', 'Goat']) {
    assert.equal(isRemovedSpeciesId(adult), false);
    assert.ok(getSpecies(adult));
    assert.ok(getSample(adult, 100, 'Prime'));
    assert.ok(wildlifeSpecies.some(item => item.name === adult));
  }
});

test('active counts are recomputed from the visible catalog without changing captured source counts', () => {
  assert.deepEqual(dataset.counts, { ...sourceDataset.counts, wildlife: 8, dashboardRows: 3208, mechanics: 94 });
  assert.equal(dataset.counts.dashboardRows, species.reduce((n, item) => n + item.samples.length, 0));
  assert.equal(dataset.counts.mechanics, species.reduce((n, item) => n + item.mechanics.length, 0));
  assert.equal(sourceDataset.counts.wildlife, 11);
  assert.equal(sourceDataset.counts.dashboardRows, 3214);
  assert.equal(sourceDataset.counts.mechanics, 96);
});

test('the original complete snapshot and all retained records survive the visibility filter unchanged', () => {
  const file = JSON.parse(readFileSync(new URL('../src/data/dataset.json', import.meta.url), 'utf8'));
  assert.deepEqual(sourceDataset, file);
  assert.equal(sourceDataset.species.length, 33);
  for (const name of removedNames) {
    const original = sourceDataset.species.find(item => item.name === name);
    assert.ok(original);
    assert.equal(original.samples.length, 2);
  }
  for (const item of sourceDataset.species) {
    const actual = getSpecies(item.id);
    if (isRemovedSpeciesId(item.id)) assert.equal(actual, undefined);
    else assert.equal(actual, item, `${item.name} keeps its exact original record`);
  }
  assert.equal(dataset.importedAt, sourceDataset.importedAt);
  assert.equal(dataset.sources, sourceDataset.sources);
  assert.equal(dataset.metrics, sourceDataset.metrics);
});
