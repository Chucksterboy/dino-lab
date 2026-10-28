/**
 * End-to-end verification against the local Vite UI in an isolated Edge
 * context. No connection is made to the user's existing browser/profile.
 * Start `npm run dev`, then run `node tools/test-ui.mjs`.
 */
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataset = JSON.parse(await fs.readFile(path.join(root, 'src/data/dataset.json'), 'utf8'));
const playable = dataset.species.filter(species => species.kind === 'playable');
const baseUrl = process.env.DINO_LAB_TEST_URL ?? 'http://127.0.0.1:1420';
const startedAt = new Date().toISOString();
const results = [];
const runtimeErrors = [];
const requestFailures = [];
const counts = { speciesPages: 0, heroImages: 0, galleryImages: 0, dashboardEndpoints: 0, workbookEndpoints: 0, numericStatChecks: 0, movementStatChecks: 0, tabVisits: 0 };
let browser;
let browserChannel = 'msedge';
try { browser = await chromium.launch({ channel: browserChannel, headless: true }); }
catch { browserChannel = 'chrome'; browser = await chromium.launch({ channel: browserChannel, headless: true }); }
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(6000);
page.on('pageerror', error => runtimeErrors.push(error.message));
page.on('requestfailed', request => {
  if (!request.url().includes('/@vite/')) requestFailures.push({ url: request.url(), failure: request.failure()?.errorText });
});

async function check(name, action) {
  try { await action(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: String(error.message ?? error).slice(0, 1800) }); console.error(`FAIL ${name}: ${error.message}`); }
}

const display = (value, digits = 1) => value == null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
const primaryRow = sheet => sheet.rows.find(row => row.category === 'attack' && /^(?:Bite|Gore|Headbutt)\b/i.test(row.label));
const sprintRow = sheet => sheet.rows.find(row => /^(?:Speed|Base Speed|Biped Speed) \(km\/h\)$/i.test(row.label));

async function statTexts() {
  return page.locator('.stat-card .stat-number').evaluateAll(elements => elements.map(element => [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join('').trim()));
}

async function verifyStats(values) {
  const expected = [display(values[0], 0), display(values[1], 2), display(values[2], 2)];
  await expect.poll(statTexts, { timeout: 2000 }).toEqual(expected);
  counts.numericStatChecks += 3;
}

async function verifyMovement(values) {
  const expected = values.map(value => value == null ? '—' : `${display(value, 2)} km/h`);
  await expect.poll(() => page.locator('.movement-glance .data-line strong').allTextContents(), { timeout: 2000 }).toEqual(expected);
  counts.movementStatChecks += 3;
}

async function verifyRemovedInterface() {
  await expect(page.getByRole('tab')).toHaveText(['Overview', 'Movement', 'Survival', 'Attacks']);
  await expect(page.getByRole('tab', { name: /^Mechanics|^Source data/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Field mechanics', exact: true })).toHaveCount(0);
  await expect(page.locator('.workspace-footer')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Inspect values & sources', exact: true })).toHaveCount(0);
  await expect(page.getByText('Local data · offline ready', { exact: true })).toHaveCount(0);
  await expect(page.getByText('ARTWORK: EVRIMA FIELD GUIDE', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /\b(?:export|import|download|configuration)\b|\bcopy\b|\bsave file\b/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Data & sources', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Explore the data', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'SpeciesData', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Stat Sheet', exact: true })).toHaveCount(0);
}

async function openSpecies(specimen) {
  const sidebar = page.locator('.species-sidebar');
  if (await sidebar.count()) await sidebar.getByRole('button', { name: specimen.name, exact: true }).click();
  else await page.getByRole('button', { name: `Open ${specimen.name}`, exact: true }).click();
  await expect(page.locator('.specimen-hero h1')).toHaveText(specimen.name);
}

async function tab(name, heading) {
  await (name === 'Mechanics' ? page.getByRole('tab', { name: /^Mechanics/ }) : page.getByRole('tab', { name, exact: true })).click();
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  counts.tabVisits++;
}

async function navigateLibrary() {
  await page.getByRole('button', { name: 'Dino Lab species library', exact: true }).click();
  await expect(page.locator('.library h1')).toContainText('Species library');
  await expect(page.locator('.startup')).toBeHidden();
}

try {
  // A brief test-only module delay makes the real startup UI observable without
  // imposing any artificial wait on application users.
  await page.route('**/src/App.tsx*', async route => {
    await new Promise(resolve => setTimeout(resolve, 650));
    await route.continue();
  }, { times: 1 });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await check('Startup renders an active pulse while initialization is pending', async () => {
    await expect(page.getByRole('status', { name: 'Dino Lab is preparing the species database' })).toBeVisible();
    const animations = await page.locator('.startup-orbit').evaluate(element => [element, ...element.querySelectorAll('*')].map(node => ({ name: getComputedStyle(node).animationName, duration: getComputedStyle(node).animationDuration })).filter(animation => animation.name !== 'none' && animation.duration !== '0s'));
    expect(animations.length).toBeGreaterThan(0);
  });
  await expect(page.locator('.library h1')).toContainText('Species library');
  await check('Initial gallery contains all 22 source species and readable names', async () => {
    await expect(page.locator('.species-card')).toHaveCount(22);
    for (const specimen of playable) await expect(page.getByRole('button', { name: `Open ${specimen.name}`, exact: true })).toBeAttached();
  });
  for (let index = 0; index < playable.length; index++) {
    await check(`Gallery artwork loads: ${playable[index].name}`, async () => {
      const card = page.locator('.species-card').nth(index);
      await card.scrollIntoViewIfNeeded();
      await expect.poll(() => card.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
      counts.galleryImages++;
    });
  }

  for (const specimen of playable) {
    await check(`Open species and load its own artwork: ${specimen.name}`, async () => {
      await openSpecies(specimen);
      await expect.poll(() => page.getByAltText(`${specimen.name} species artwork`, { exact: true }).evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
      await verifyRemovedInterface();
      await expect(page.getByRole('heading', { name: 'Movement at a glance', exact: true })).toBeVisible();
      counts.speciesPages++;
      counts.heroImages++;
    });
    const slider = page.getByRole('slider', { name: `${specimen.name} growth`, exact: true });
    if (specimen.samples.length) {
      await page.getByRole('button', { name: 'Source 1', exact: true }).click();
      for (const state of ['Prime', 'Frail']) {
        await page.getByRole('button', { name: state, exact: true }).click();
        for (const [key, growth] of [['Home', 25], ['End', 100]]) {
          await check(`Dashboard ${specimen.name} ${state} ${growth}% slider and stats`, async () => {
            await slider.press(key);
            await expect(slider).toHaveValue(String(growth));
            await expect(page.getByRole('spinbutton', { name: 'Exact growth percentage', exact: true })).toHaveValue(String(growth));
            const source = specimen.samples.find(sample => sample.growth === growth && sample.state === state);
            await verifyStats(['weight', 'bite', 'speed'].map(metric => source.values[metric]));
            await verifyMovement(['speed', 'trot', 'fastSwim'].map(metric => source.values[metric]));
            await expect(page.locator('.growth-source-note')).toContainText('Source 1');
            counts.dashboardEndpoints++;
          });
        }
      }
    } else {
      await check(`${specimen.name} clearly limits unavailable dashboard source`, async () => {
        await expect(page.getByRole('button', { name: 'Source 1', exact: true })).toBeDisabled();
      });
    }

    await page.getByRole('button', { name: 'Source 2', exact: true }).click();
    for (const state of ['Prime', 'Frail']) {
      await page.getByRole('button', { name: state, exact: true }).click();
      const columns = specimen.sheet.columns.filter(column => column.state === state);
      for (const [key, position] of [['Home', 0], ['End', columns.length - 1]]) {
        const column = columns[position];
        await check(`Workbook ${specimen.name} ${state} ${column.growth}% exact keyframe and stats`, async () => {
          await slider.press(key);
          await expect(slider).toHaveValue(String(position));
          await expect(page.getByRole('spinbutton', { name: 'Exact growth percentage', exact: true })).toHaveValue(String(column.growth));
          const rows = [specimen.sheet.rows.find(row => /^Weight \(kg\)$/i.test(row.label)), primaryRow(specimen.sheet), sprintRow(specimen.sheet)];
          await verifyStats(rows.map(row => row?.values.find(value => value.column === column.index && value.state === state)?.value ?? null));
          const movementRows = [sprintRow(specimen.sheet), specimen.sheet.rows.find(row => /^Trot \(km\/h\)$/i.test(row.label)), specimen.sheet.rows.find(row => /^Swim Speed \(km\/h\)$/i.test(row.label))];
          await verifyMovement(movementRows.map(row => row?.values.find(value => value.column === column.index && value.state === state)?.value ?? null));
          await expect(page.locator('.growth-source-note')).toContainText('Source 2');
          counts.workbookEndpoints++;
        });
      }
    }

    await check(`Movement at a glance opens Movement: ${specimen.name}`, async () => {
      await page.locator('.movement-glance').getByRole('button', { name: 'Explore', exact: true }).click();
      await expect(page.getByRole('tab', { name: 'Movement', exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('heading', { name: 'Movement profile', exact: true })).toBeVisible();
      counts.tabVisits++;
    });
    await check(`Survival controls remain reachable: ${specimen.name}`, async () => {
      await tab('Survival', 'Survival systems');
      await expect(page.getByRole('spinbutton', { name: 'Hunger percentage', exact: true })).toBeVisible();
      await expect(page.getByRole('slider', { name: 'Thirst level', exact: true })).toBeVisible();
      if (!specimen.samples.length) await expect(page.getByText('Survival figures are unavailable for this species in Source 1. Its Source 2 stats remain available.', { exact: true })).toBeVisible();
    });
    await check(`All workbook attack rows are reachable: ${specimen.name}`, async () => {
      await tab('Attacks', 'Attack analysis');
      const panel = page.locator('section.panel').filter({ has: page.getByRole('heading', { name: 'Source 2 attack reference', exact: true }) });
      await expect(panel.locator('.attack-row')).toHaveCount(specimen.sheet.attacks.length);
    });
    await page.getByRole('tab', { name: 'Overview', exact: true }).click();
    console.log(`Verified ${specimen.name}: artwork, Source 1/2 sliders/states, stats, movement glance and four-tab interface.`);
  }

  await check('Rapid switching settles on the latest species', async () => {
    for (const name of ['Allosaurus', 'Carnotaurus', 'Triceratops']) await page.locator('.species-sidebar').getByRole('button', { name, exact: true }).click({ force: true });
    await expect(page.locator('.specimen-hero h1')).toHaveText('Triceratops');
    await expect(page.getByAltText('Triceratops species artwork', { exact: true })).toBeVisible();
  });

  await check('Typed hunger level accepts 1 and 100 without replacing digits', async () => {
    await openSpecies(playable.find(specimen => specimen.name === 'Troodon'));
    await tab('Survival', 'Survival systems');
    const input = page.getByRole('spinbutton', { name: 'Hunger percentage', exact: true });
    await input.fill('1');
    await input.press('Tab');
    await expect(input).toHaveValue('1');
    await expect(page.locator('.reserve-card').filter({ has: input }).locator('.timer-value')).toContainText('36s');
    await input.fill('100');
    await input.press('Tab');
    await expect(input).toHaveValue('100');
    await expect(page.locator('.reserve-card').filter({ has: input }).locator('.timer-value')).toContainText('1h 0m 0s');
  });

  await navigateLibrary();
  await check('Favorites filter shows the selected species and persists after reload', async () => {
    await page.getByRole('button', { name: 'Favorite Allosaurus', exact: true }).click();
    await page.locator('.library-filters').getByRole('button', { name: 'Favorites', exact: true }).click();
    await expect(page.locator('.species-card')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Open Allosaurus', exact: true })).toBeVisible();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.library h1')).toContainText('Species library');
    await expect(page.locator('.startup')).toBeHidden();
    await page.locator('.library-filters').getByRole('button', { name: 'Favorites', exact: true }).click();
    await expect(page.locator('.species-card')).toHaveCount(1);
  });
  await check('Search empty state and clear search restore all 22 species', async () => {
    await page.locator('.library-filters').getByRole('button', { name: /All species/ }).click();
    await page.getByRole('textbox', { name: 'Search species', exact: true }).fill('no-such-dinosaur-smoke-test');
    await expect(page.getByRole('heading', { name: 'No species found', exact: true })).toBeVisible();
    await expect(page.locator('.species-card')).toHaveCount(0);
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await expect(page.locator('.species-card')).toHaveCount(22);
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('textbox', { name: 'Search species', exact: true })).toBeFocused();
  });
  await check('Reduced-motion preference can be enabled and retained locally', async () => {
    await page.getByRole('button', { name: 'Preferences', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Reduced motion', exact: true }).check();
    await expect(page.locator('.desktop-shell')).toHaveClass(/reduce-motion/);
    await page.getByRole('button', { name: 'Close preferences', exact: true }).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dinolab-reduce-motion')))).toBe(true);
  });
  await check('No uncaught JavaScript errors were emitted', async () => { expect(runtimeErrors).toEqual([]); });
  await check('No artwork or data requests failed', async () => { expect(requestFailures).toEqual([]); });
} catch (error) {
  results.push({ name: 'Smoke script execution', passed: false, error: String(error.stack ?? error) });
} finally {
  await context.close();
  await browser.close();
  const report = { startedAt, finishedAt: new Date().toISOString(), baseUrl, browserChannel, viewport: '1440 × 960', counts, passed: results.filter(result => result.passed).length, failed: results.filter(result => !result.passed).length, runtimeErrors, requestFailures, results };
  await fs.writeFile(path.join(root, 'docs/ui-verification-results.json'), JSON.stringify(report, null, 2));
  const failures = results.filter(result => !result.passed);
  const markdown = `# UI verification\n\nRun: ${report.finishedAt}\n\nTarget: ${baseUrl}, isolated headless ${browserChannel}, ${report.viewport}. No existing user browser profile was used.\n\nResult: **${report.passed} checks passed, ${report.failed} failed.**\n\n- ${counts.speciesPages}/22 playable species pages opened.\n- ${counts.galleryImages}/22 gallery images and ${counts.heroImages}/22 species images loaded with nonzero image dimensions.\n- ${counts.dashboardEndpoints}/84 Source 1 slider endpoints verified: 21 species × Prime/Frail × 25/100%.\n- ${counts.workbookEndpoints}/88 Source 2 endpoints verified: 22 species × Prime/Frail × first/last exact source keyframe.\n- ${counts.numericStatChecks}/516 displayed weight, primary damage and sprint-speed readings checked against the independent local source snapshot.\n- ${counts.movementStatChecks}/516 Movement at a glance readings checked against their selected source and growth.\n- ${counts.tabVisits} visits to the four information tabs: Overview, Movement, Survival and Attacks. Retired tabs, field-mechanics overview card and bottom footer are absent on all species.\n- Rapid switching, typed hunger percentages, favorite persistence, search/empty state, keyboard search and reduced-motion preference exercised.\n- ${runtimeErrors.length} uncaught page errors; ${requestFailures.length} failed requests.\n\nThe startup test held one application-module response for 650ms solely to observe the actual loading screen and confirm active CSS animation. This does not add a wait to application startup. Headless checks establish control/data behavior; they do not establish native Windows frame pacing, appearance or installer behavior. Native desktop visual checks and the separate comparison/table smoke test are recorded by the main build workflow.\n\n${failures.length ? '## Failures\n\n' + failures.map(result => `- **${result.name}**: ${result.error.replace(/\n/g, ' ')}`).join('\n') : 'All requested checks in this script passed.'}\n\nFull machine-readable results: [ui-verification-results.json](ui-verification-results.json).\n`;
  await fs.writeFile(path.join(root, 'docs/UI-VERIFICATION.md'), markdown);
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed, counts, runtimeErrors, requestFailures }, null, 2));
  if (report.failed) process.exitCode = 1;
}
