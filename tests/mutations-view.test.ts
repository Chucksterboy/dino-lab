import test from 'node:test';
import assert from 'node:assert/strict';
import { Children, createElement, isValidElement } from 'react';
import type { ChangeEvent, ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mutationCatalog } from '../src/data/mutations.ts';
import type { Mutation } from '../src/data/mutations.ts';
import { filterMutations, MutationCard, MutationsView } from '../src/components/MutationsView.tsx';

const renderText = (text: string) => renderToStaticMarkup(createElement('span', null, text)).replace(/^<span>|<\/span>$/g, '');
const renderPage = () => renderToStaticMarkup(createElement(MutationsView));
const active = mutationCatalog.filter(item => item.status === 'current');
const archived = mutationCatalog.filter(item => item.status === 'removed');

test('the product renders all 41 current entries exactly once and no archived entries or history counter', () => {
  assert.equal(active.length, 41);
  assert.equal(archived.length, 2);
  const html = renderPage();
  assert.equal((html.match(/<article\b/g) ?? []).length, 41);
  assert.doesNotMatch(html, /mutations-archive|HISTORICAL ENTRIES/);
  assert.ok(html.includes('<strong>41</strong><span>ACTIVE MUTATIONS</span>'));
  assert.ok(html.includes('<strong>41</strong> of 41 active mutations'));
  for (const mutation of active) {
    const expected = `<h3 id="mutation-${mutation.id}">${renderText(mutation.name)}</h3>`;
    assert.equal(html.split(expected).length - 1, 1, mutation.name);
  }
  for (const mutation of archived) assert.ok(!html.includes(renderText(mutation.name)), `${mutation.name} is retained internally but absent from the product`);
});

test('every current card preserves its complete effect, listed strengths, unlock and eligibility', () => {
  let tierCount = 0, unlockCount = 0, restrictionCount = 0;
  for (const mutation of active) {
    const html = renderToStaticMarkup(createElement(MutationCard, { mutation }));
    assert.ok(html.includes(renderText(mutation.description)), `${mutation.name} effect`);
    for (const tier of mutation.tiers) {
      assert.ok(html.includes(renderText(tier)), `${mutation.name} strength: ${tier}`);
      tierCount++;
    }
    if (mutation.tiers.length) assert.ok(html.includes('Listed strengths'));
    if (mutation.unlock) {
      assert.ok(html.includes('Unlock condition'));
      assert.ok(html.includes(renderText(mutation.unlock)), `${mutation.name} unlock`);
      assert.ok(html.includes('Unlockable'), `${mutation.name} keeps its unlockable badge within the eligibility group`);
      unlockCount++;
    }
    for (const restriction of mutation.restrictions) {
      assert.ok(html.includes(renderText(restriction)), `${mutation.name} restriction`);
      restrictionCount++;
    }
  }
  assert.ok(tierCount > 0);
  assert.ok(unlockCount >= 9);
  assert.ok(restrictionCount > 0);
});

test('Universal, Carnivore and Herbivore cover all 41 current entries once, including unlockables', () => {
  const universal = filterMutations(mutationCatalog, { category: 'universal' });
  const carnivore = filterMutations(mutationCatalog, { category: 'carnivore' });
  const herbivore = filterMutations(mutationCatalog, { category: 'herbivore' });
  assert.equal(universal.length, 27);
  assert.equal(carnivore.length, 7);
  assert.equal(herbivore.length, 7);
  const grouped = [...universal, ...carnivore, ...herbivore];
  assert.equal(grouped.length, 41);
  assert.equal(new Set(grouped.map(item => item.id)).size, 41, 'groups have no duplicates');
  assert.deepEqual(new Set(grouped.map(item => item.id)), new Set(active.map(item => item.id)));
  assert.ok(grouped.every(item => item.status === 'current'));
  assert.ok(universal.every(item => item.diets.length === 0));
  assert.ok(carnivore.every(item => item.diets.includes('carnivore')));
  assert.ok(herbivore.every(item => item.diets.includes('herbivore')));
  assert.ok(universal.some(item => item.name === 'Enhanced Digestion'));
  for (const name of ['Augmented Tapetum', 'Osteophagic']) assert.ok(carnivore.some(item => item.name === name), name);
  for (const mutation of archived) assert.deepEqual(filterMutations(mutationCatalog, { query: mutation.name }), []);
});

test('the Herbivore filter preserves Social Behavior shared herbivore/omnivore eligibility', () => {
  const social = active.find(item => item.diets.includes('herbivore') && item.diets.includes('omnivore'));
  assert.ok(social, 'a shared herbivore/omnivore mutation exists');
  assert.match(social.name, /social behavio[u]?r/i);
  assert.ok(filterMutations(mutationCatalog, { category: 'herbivore' }).some(item => item.id === social.id));
  assert.ok(!filterMutations(mutationCatalog, { category: 'carnivore' }).some(item => item.id === social.id));
  const html = renderToStaticMarkup(createElement(MutationCard, { mutation: social }));
  assert.ok(html.includes('Herbivore or omnivore'), 'the shared eligibility remains visible without an Omnivore filter');
});

test('search reaches every active name, alias, effect, strength, unlock and restriction', () => {
  let fields = 0;
  for (const item of active) {
    const queryFields = [item.name, ...item.aliases, item.description, ...item.tiers, ...item.restrictions, item.unlock].filter((text): text is string => Boolean(text?.trim()));
    for (const query of queryFields) {
      const matches = filterMutations(mutationCatalog, { query });
      assert.ok(matches.some(match => match.id === item.id), `${item.name}: ${query}`);
      assert.ok(matches.every(match => match.status === 'current'));
      fields++;
    }
    assert.ok(filterMutations(mutationCatalog, { query: `  ${item.name.toUpperCase()}  ` }).some(match => match.id === item.id));
  }
  assert.ok(fields > 100);
  assert.deepEqual(filterMutations(mutationCatalog, { query: 'no_such_mutation_9f01' }), []);
  assert.ok(filterMutations(mutationCatalog, { combatOnly: true }).length > 0);
  assert.ok(filterMutations(mutationCatalog, { combatOnly: true }).every(item => item.combatRole !== 'none'));
});

test('filter search normalizes accents and apostrophes and combines all supplied terms', () => {
  const fixture: Mutation = { id: 'search-fixture', name: 'Café Trait', aliases: ['Runner’s gift'], category: 'universal', description: 'Keeps a useful reserve.', tiers: ['Small reserve', 'Larger reserve'], restrictions: ['While active'], diets: [], unlock: null, combatRole: 'stamina', status: 'current', quality: 'guide-only', sources: [], notes: ['Invisible metadata marker qwertyzz9f01'] };
  assert.equal(filterMutations([fixture], { query: 'CAFE reserve' }).length, 1);
  assert.equal(filterMutations([fixture], { query: "runner's gift" }).length, 1);
  assert.equal(filterMutations([fixture], { query: 'cafe impossible' }).length, 0);
  assert.equal(filterMutations([fixture], { category: 'carnivore' }).length, 0);
  assert.equal(filterMutations([fixture], { query: 'qwertyzz9f01' }).length, 0, 'hidden notes must not produce a search match');
});

function findElement(element: ReactElement, predicate: (element: ReactElement) => boolean): ReactElement | undefined {
  if (predicate(element)) return element;
  for (const child of Children.toArray((element.props as { children?: ReactNode }).children)) if (isValidElement(child)) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return undefined;
}

test('the actual search handler renders an empty state without opening a browser or live app', () => {
  let changed = false;
  function Probe() {
    const tree = MutationsView();
    if (!changed) {
      changed = true;
      const input = findElement(tree, element => element.type === 'input' && (element.props as { 'aria-label'?: string })['aria-label'] === 'Search mutations') as ReactElement<{ onChange: (event: ChangeEvent<HTMLInputElement>) => void }>;
      assert.ok(input);
      input.props.onChange({ target: { value: 'no_such_mutation_9f01' } } as ChangeEvent<HTMLInputElement>);
    }
    return tree;
  }
  const html = renderToStaticMarkup(createElement(Probe));
  assert.ok(html.includes('No active mutations match'));
  assert.ok(html.includes('<strong>0</strong> of 41 active mutations'));
  assert.equal((html.match(/<article\b/g) ?? []).length, 0);
  assert.doesNotMatch(html, /mutations-archive|historical entries/i);
});

test('the page omits note content, qualifications, quality labels, patch versions and transfer controls', () => {
  const html = renderPage();
  assert.doesNotMatch(html, /mutation-reference-note|mutation-quality|mutation-notes|mutation-crosscheck|<details\b/);
  for (const label of ['Details & qualifications', 'Clarifications & limitations', 'Some details unclear', 'Values differ', 'Cross-checked reference', 'The guide warns that some information is outdated.']) assert.ok(!html.includes(renderText(label)), label);
  for (const mutation of mutationCatalog) for (const note of mutation.notes) assert.ok(!html.includes(renderText(note)), `${mutation.name} hidden note is absent`);
  assert.doesNotMatch(html, /\bpatch\b|\b0\.\d+\.\d+\b/i);
  for (const [control] of html.matchAll(/<(button|a)\b[^>]*>[\s\S]*?<\/\1>/g)) {
    assert.doesNotMatch(control.replace(/<[^>]*>/g, ' '), /\bexport\b|\bdownload\b|\bimport\b|copy image|save file|configuration/i);
  }
  assert.doesNotMatch(html, /<a\b|download=/i);
  assert.ok(html.includes('aria-label="Mutation category"'));
  assert.doesNotMatch(html, /<select\b|<option\b|mutation-diet-filter|Applicable mutation diet/);
  const filterGroup = html.match(/<div class="mutation-categories"[^>]*>([\s\S]*?)<\/div>/)?.[1];
  assert.ok(filterGroup);
  const buttonNames = [...filterGroup.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(match => match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
  assert.deepEqual(buttonNames, ['All mutations 41', 'Universal 27', 'Carnivore 7', 'Herbivore 7']);
  for (const group of ['universal', 'carnivore', 'herbivore']) assert.ok(html.includes(`id="mutation-group-${group}"`));
  assert.doesNotMatch(html, /Diet-specific mutations|Unlockable mutations/);
  assert.ok(html.includes('Combat effects'));
});
