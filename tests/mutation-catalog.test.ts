import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byIdMap, mutationCatalog, mutationSourceMetadata, mutationSources } from '../src/data/mutations.ts';

const html = readFileSync(new URL('../src/data/raw/mutations/eqg-mutations.html', import.meta.url), 'utf8');
const blocks: { Tag: string; Text: string }[] = JSON.parse(readFileSync(new URL('../src/data/raw/mutations/eqg-blocks.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const normalizeName = (text: string) => text.replace(/\s+/g, ' ').trim().replace(/^P\s+arthenogenesis$/i, 'Parthenogenesis');
const sourceNames = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].flatMap(paragraph => {
  const nameSpans = [...paragraph[1].matchAll(/<span\b[^>]*style="([^"]*)"[^>]*>([\s\S]*?)<\/span>/g)]
    .filter(span => /color:\s*#(?:f6b26b|ffd966)/i.test(span[1]) && /font-weight:\s*700/.test(span[1]));
  const name = normalizeName(nameSpans.map(span => span[2].replace(/<[^>]+>/g, '')).join(''));
  return name ? [name] : [];
});

test('all 43 highlighted guide entries exist exactly once in original order', () => {
  assert.equal(sourceNames.length, 43);
  assert.deepEqual(mutationCatalog.map(mutation => mutation.name), sourceNames);
  assert.equal(new Set(mutationCatalog.map(mutation => mutation.id)).size, 43);
  assert.equal(mutationCatalog.filter(mutation => mutation.status === 'current').length, 41);
  assert.equal(mutationCatalog.filter(mutation => mutation.status === 'removed').length, 2);
  assert.equal(mutationCatalog.filter(mutation => mutation.category === 'universal').length, 20);
  assert.equal(mutationCatalog.filter(mutation => ['carnivore','herbivore','omnivore'].includes(mutation.category)).length, 12);
  assert.equal(mutationCatalog.filter(mutation => mutation.category === 'unlockable').length, 9);
});

test('each original tier sequence is preserved without added units or missing-strength guesses', () => {
  const title = (text: string) => normalizeName(text.replace(/\s*\((?:Female Only|Carnivore|Herbivore(?:\/Omnivore)?|Removed[^)]*)\)\s*$/, ''));
  const titlePositions = blocks.flatMap((block, index) => sourceNames.includes(title(block.Text)) ? [{ index, name: title(block.Text) }] : []);
  assert.equal(titlePositions.length, 43);
  for (const [index, entry] of titlePositions.entries()) {
    const end = titlePositions[index + 1]?.index ?? blocks.length;
    const value = blocks.slice(entry.index + 1, end).find(block => block.Text.startsWith('Value:'));
    const expected = value ? value.Text.replace(/^Value:\s*/, '').split('|').map(part => part.trim()) : [];
    assert.deepEqual(mutationCatalog.find(mutation => mutation.name === entry.name)?.tiers, expected, entry.name);
  }
  assert.deepEqual(byIdMap['advanced-gestation'].tiers, ['50%','75%','1','1']);
  assert.deepEqual(byIdMap.reabsorption.tiers, ['1','2','3','3']);
  assert.deepEqual(byIdMap['augmented-tapetum'].tiers, ['1','2','3']);
  assert.deepEqual(byIdMap['photosynthetic-tissue'].tiers, ['5%','7 %','10%','10%']);
});

test('eligibility, cross-diet restrictions and factual unlock counters survive', () => {
  assert.deepEqual(byIdMap['social-behavior'].diets, ['herbivore','omnivore']);
  assert.ok(byIdMap['social-behavior'].restrictions.includes('Group leader only'));
  for (const id of ['advanced-gestation','parthenogenesis','prolific-reproduction']) assert.ok(byIdMap[id].restrictions.some(restriction => /female only/i.test(restriction)), id);
  for (const id of ['gastronomic-regeneration','tactile-endurance','cannibalistic','hypermetabolic-inanition']) assert.ok(byIdMap[id].restrictions.includes('Slots 2 and 4 only'), id);
  assert.match(byIdMap['enhanced-digestion'].unlock!, /60 minutes/);
  assert.match(byIdMap['heightened-ghrelin'].unlock!, /80%.*30 minutes/);
  assert.match(byIdMap['multichambered-lungs'].unlock!, /4,500 stamina/);
  assert.match(byIdMap['reinforced-tendons'].unlock!, /50 times/);
  assert.match(byIdMap['reniculate-kidneys'].unlock!, /1,250.*50.*1,200/);
  assert.match(byIdMap['augmented-tapetum'].unlock!, /five players at night/);
  assert.match(byIdMap.osteophagic.unlock!, /bones.*fracture/);
  assert.ok(byIdMap.parthenogenesis.aliases.includes('P arthenogenesis'));
});

test('uncertainties and conflicting official unlock counters remain explicit', () => {
  assert.equal(byIdMap['multichambered-lungs'].quality, 'conflicting');
  assert.match(byIdMap['multichambered-lungs'].notes.join(' '), /200,000.*2 km/);
  assert.equal(byIdMap['reniculate-kidneys'].quality, 'conflicting');
  assert.match(byIdMap['reniculate-kidneys'].notes.join(' '), /1,000 water units/);
  assert.equal(byIdMap['hypermetabolic-inanition'].quality, 'unclear');
  assert.match(byIdMap['hypermetabolic-inanition'].notes.join(' '), /No continuous hunger-to-damage formula/);
  assert.equal(byIdMap['tactile-endurance'].combatRole, 'stamina');
  assert.match(byIdMap['tactile-endurance'].notes.join(' '), /not modeled as free health resistance/);
  assert.match(byIdMap['congenital-hypoalgesia'].description, /larger species/);
  assert.match(byIdMap['congenital-hypoalgesia'].notes.join(' '), /not heavier selected growth/);
  assert.equal(byIdMap['traumatic-thrombosis'].status, 'removed');
  assert.equal(byIdMap['traumatic-thrombosis'].removedIn, '0.21.720');
});

test('every entry has traceable sources and hidden source qualification metadata', () => {
  const known = new Set(mutationSources.map(source => source.url));
  for (const mutation of mutationCatalog) {
    assert.ok(mutation.sources.length > 0, mutation.name);
    for (const url of mutation.sources) { assert.ok(known.has(url), `${mutation.name}: ${url}`); assert.equal(new URL(url).protocol, 'https:'); }
  }
  assert.equal(mutationSourceMetadata.guideLastUpdatedText, '9/4/2026');
  assert.equal(mutationSourceMetadata.dateFormatAmbiguous, true);
  assert.match(mutationSourceMetadata.guideWarningText, /outdated information/);
});
