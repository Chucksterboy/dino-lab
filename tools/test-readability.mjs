/** Focused acceptance for removing transfer controls and improving desktop readability. */
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataset = JSON.parse(await fs.readFile(path.join(root, 'src/data/dataset.json'), 'utf8'));
const playable = dataset.species.filter(specimen => specimen.kind === 'playable');
const results = [];
const errors = [];
const fonts = [];
const layouts = [];
const forbidden = /\b(?:export|import|download|configuration)\b|\bcopy(?:\s+image|\s+current)?\b|\bsave\s+file\b/i;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const startedAt = new Date().toISOString();

async function check(name, run) {
  try { await run(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: String(error.message ?? error).slice(0, 1600) }); console.error(`FAIL ${name}: ${error.message}`); }
}

async function noTransferControls(page, label) {
  await check(`${label}: transfer controls and removed global route absent`, async () => {
    await expect(page.getByRole('button', { name: forbidden })).toHaveCount(0);
    await expect(page.getByRole('link', { name: forbidden })).toHaveCount(0);
    await expect(page.locator('a[download], input[type="file"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Data & sources', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Explore the data', exact: true })).toHaveCount(0);
    await expect(page.getByText('Source snapshots stay independent. Percentages compare the selected records to the first slot.', { exact: true })).toHaveCount(0);
  });
  await check(`${label}: rendered text and tooltips use anonymous source names`, async () => {
    const providerPattern = /dashboard|workbook|stat\s*sheet|speciesdata/i;
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(providerPattern);
    const attributes = await page.locator('[title], [aria-label]').evaluateAll(elements => elements.flatMap(element => ['title', 'aria-label'].flatMap(attribute => element.hasAttribute(attribute) ? [element.getAttribute(attribute)] : [])));
    const svgTitles = await page.locator('svg title').allTextContents();
    for (const text of [...attributes, ...svgTitles]) expect(text).not.toMatch(providerPattern);
  });
}

async function simplifiedSpeciesInterface(page, label) {
  await check(`${label}: four tabs and clean overview/footer`, async () => {
    await expect(page.getByRole('tab')).toHaveText(['Overview', 'Movement', 'Survival', 'Attacks']);
    await expect(page.getByRole('tab', { name: /^Mechanics|^Source data/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Field mechanics', exact: true })).toHaveCount(0);
    await expect(page.locator('.workspace-footer')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Inspect values & sources', exact: true })).toHaveCount(0);
    await expect(page.getByText('Local data · offline ready', { exact: true })).toHaveCount(0);
    await expect(page.getByText('ARTWORK: EVRIMA FIELD GUIDE', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Movement at a glance', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Source 1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Source 2', exact: true })).toBeVisible();
  });
}

async function layout(page, label) {
  const measured = await page.evaluate(() => {
    const main = document.querySelector('.main-content');
    const clippedControls = [];
    for (const element of document.querySelectorAll('button, input, select, textarea, a[href]')) {
      if (!(element instanceof HTMLElement) || element.closest('.table-wrap, .source-grid, .formula-table')) continue;
      const rectangle = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (!rectangle.width || !rectangle.height || style.display === 'none' || style.visibility === 'hidden') continue;
      const text = element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 80) || element.tagName;
      if (rectangle.left < -1 || rectangle.right > innerWidth + 1) clippedControls.push({ text, left: rectangle.left, right: rectangle.right, reason: 'outside viewport' });
      for (let ancestor = element.parentElement; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
        const ancestorStyle = getComputedStyle(ancestor);
        if (!['hidden', 'clip'].includes(ancestorStyle.overflowX)) continue;
        const bounds = ancestor.getBoundingClientRect();
        if (rectangle.left < bounds.left - 1 || rectangle.right > bounds.right + 1) {
          clippedControls.push({ text, left: rectangle.left, right: rectangle.right, reason: `clipped by ${ancestor.className}` });
          break;
        }
      }
    }
    const clippedGalleryNames = Array.from(document.querySelectorAll('.card-bottom h2')).filter(element => element.scrollWidth > element.clientWidth + 1).map(element => ({ text: element.textContent, width: element.clientWidth, content: element.scrollWidth }));
    const sidebarEllipses = Array.from(document.querySelectorAll('.sidebar-species span:nth-child(2)')).filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.textContent);
    return {
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      mainWidth: main?.clientWidth ?? 0,
      mainContentWidth: main?.scrollWidth ?? 0,
      clippedControls,
      clippedGalleryNames,
      sidebarEllipses,
    };
  });
  layouts.push({ label, ...measured });
  await check(`${label}: no overall horizontal overflow or clipped controls/names`, async () => {
    expect(measured.documentWidth).toBeLessThanOrEqual(measured.viewport + 1);
    expect(measured.mainContentWidth).toBeLessThanOrEqual(measured.mainWidth + 1);
    expect(measured.clippedControls).toEqual([]);
    expect(measured.clippedGalleryNames).toEqual([]);
  });
}

async function font(page, label, selector, minimum) {
  await check(`${label}: readable ${selector}`, async () => {
    const size = await page.locator(selector).first().evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize));
    fonts.push({ label, selector, pixels: size, minimum });
    expect(size).toBeGreaterThanOrEqual(minimum);
  });
}

try {
  for (const viewport of [{ width: 1440, height: 960 }, { width: 1100, height: 760 }]) {
    const label = `${viewport.width}×${viewport.height}`;
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    page.on('pageerror', error => errors.push({ viewport: label, message: error.message }));
    await page.goto('http://127.0.0.1:1420/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.library h1')).toContainText('Species library');
    await expect(page.locator('.startup')).toBeHidden();
    await noTransferControls(page, `${label} library`);
    await layout(page, `${label} library`);
    await font(page, label, '.titlebar-brand>span:first-of-type', 14);
    await font(page, label, '.card-bottom h2', 15);
    await font(page, label, '.library-header p', 14);
    await check(`${label}: larger brand symbol`, async () => {
      const size = await page.locator('.app-logo>svg').evaluate(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
      expect(size.width).toBeGreaterThanOrEqual(33);
      expect(size.height).toBeGreaterThanOrEqual(33);
    });

    for (const specimen of playable) {
      const sidebar = page.locator('.species-sidebar');
      if (await sidebar.count()) await sidebar.getByRole('button', { name: specimen.name, exact: true }).click();
      else await page.getByRole('button', { name: `Open ${specimen.name}`, exact: true }).click();
      await expect(page.locator('.specimen-hero h1')).toHaveText(specimen.name);
      await simplifiedSpeciesInterface(page, `${label} ${specimen.name}`);
      for (const tabName of ['Overview', 'Movement', 'Survival', 'Attacks']) {
        const button = page.getByRole('tab', { name: tabName, exact: true });
        await button.click();
        await expect(button).toHaveAttribute('aria-selected', 'true');
        await noTransferControls(page, `${label} ${specimen.name} ${tabName}`);
        await layout(page, `${label} ${specimen.name} ${tabName}`);
      }
      if (specimen.name === 'Allosaurus') {
        await font(page, label, '.sidebar-species', 14);
        await font(page, label, '.workspace-tabs button', 13);
        await page.getByRole('tab', { name: 'Overview', exact: true }).click();
        await font(page, label, '.movement-glance .data-line strong', 14);
      }
      console.log(`${label}: ${specimen.name} four-tab interface, removed footer and clean controls verified.`);
    }

    await page.locator('.sidebar-wildlife-toggle').click();
    await page.locator('.species-sidebar').getByRole('button', { name: 'Boar', exact: true }).click();
    await expect(page.locator('.specimen-hero h1')).toHaveText('Boar');
    await simplifiedSpeciesInterface(page, `${label} wildlife`);
    for (const tabName of ['Overview', 'Movement', 'Survival', 'Attacks']) {
      await page.getByRole('tab', { name: tabName, exact: true }).click();
      await noTransferControls(page, `${label} wildlife ${tabName}`);
      await layout(page, `${label} wildlife ${tabName}`);
    }

    await page.getByRole('button', { name: 'Compare species', exact: true }).click();
    await expect(page.getByLabel('Species in comparison slot 1')).toBeVisible();
    await expect(page.getByLabel('Allosaurus data source', { exact: true }).locator('option')).toHaveText(['Source 1', 'Source 2']);
    await noTransferControls(page, `${label} comparison`);
    await layout(page, `${label} comparison`);
    await page.getByLabel('Allosaurus data source', { exact: true }).selectOption('sheet');
    await noTransferControls(page, `${label} workbook comparison`);
    await layout(page, `${label} workbook comparison`);
    await page.getByRole('button', { name: 'Data table', exact: true }).click();
    await expect(page.locator('.species-data-table tbody tr')).toHaveCount(22);
    await expect(page.getByLabel('Allosaurus table source', { exact: true }).locator('option')).toHaveText(['Source 1', 'Source 2']);
    await noTransferControls(page, `${label} data table`);
    await layout(page, `${label} data table`);
    await check(`${label}: every table row exposes Source 1/2 option labels`, async () => {
      for (const specimen of playable) await expect(page.getByLabel(`${specimen.name} table source`, { exact: true }).locator('option')).toHaveText(['Source 1', 'Source 2']);
    });
    await page.getByRole('button', { name: 'Set visible rows', exact: true }).click();
    await check(`${label}: bulk source menu has anonymous option labels`, async () => {
      await expect(page.locator('.bulk-controls select').first().locator('option')).toHaveText(['Keep each source', 'Source 1 where available', 'Source 2 where available']);
    });
    await noTransferControls(page, `${label} table bulk menu`);
    await layout(page, `${label} table bulk menu`);
    await page.locator('.bulk-controls select').first().selectOption('sheet');
    await page.getByRole('button', { name: 'Apply to 22 rows', exact: true }).click();
    await check(`${label}: applying Source 2 changes every playable table row`, async () => {
      for (const specimen of playable) await expect(page.getByLabel(`${specimen.name} table source`, { exact: true })).toHaveValue('sheet');
    });
    await noTransferControls(page, `${label} Source 2 table rows`);
    await layout(page, `${label} Source 2 table rows`);
    await page.getByRole('button', { name: 'Wildlife', exact: true }).click();
    await expect(page.locator('.species-data-table tbody tr')).toHaveCount(8);
    await noTransferControls(page, `${label} wildlife table`);
    await layout(page, `${label} wildlife table`);
    await page.getByRole('button', { name: 'Explore scatter plot', exact: true }).click();
    await noTransferControls(page, `${label} scatter`);
    await layout(page, `${label} scatter`);
    await page.getByRole('button', { name: 'Playable', exact: true }).click();
    await page.getByLabel('Scatter data source', { exact: true }).selectOption('sheet');
    await check(`${label}: scatter source caption and accessible name use Source 2`, async () => {
      await expect(page.getByRole('img', { name: /scatter plot, Source 2/ })).toBeVisible();
      await expect(page.locator('.scatter>.data-line')).toContainText('Source 2');
    });
    await noTransferControls(page, `${label} Source 2 scatter`);
    await layout(page, `${label} Source 2 scatter`);
    await page.getByLabel('Scatter data source', { exact: true }).selectOption('dashboard');
    await check(`${label}: scatter source caption and accessible name use Source 1`, async () => {
      await expect(page.getByRole('img', { name: /scatter plot, Source 1/ })).toBeVisible();
      await expect(page.locator('.scatter>.data-line')).toContainText('Source 1');
    });
    await noTransferControls(page, `${label} Source 1 scatter`);
    await layout(page, `${label} Source 1 scatter`);
    await page.getByRole('button', { name: 'Preferences', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Preferences', exact: true })).toBeVisible();
    await noTransferControls(page, `${label} preferences`);
    await layout(page, `${label} preferences`);
    await context.close();
  }
  await check('No uncaught runtime errors during focused acceptance', async () => { expect(errors).toEqual([]); });
} catch (error) {
  results.push({ name: 'Focused acceptance execution', passed: false, error: String(error.stack ?? error) });
} finally {
  await browser.close();
  const report = { startedAt, finishedAt: new Date().toISOString(), passed: results.filter(result => result.passed).length, failed: results.filter(result => !result.passed).length, fonts, layouts, errors, results };
  await fs.writeFile(path.join(root, 'docs/readability-verification-results.json'), JSON.stringify(report, null, 2));
  const failures = results.filter(result => !result.passed);
  await fs.writeFile(path.join(root, 'docs/READABILITY-VERIFICATION.md'), `# Readability and control-removal verification\n\n${report.finishedAt}\n\nIsolated headless Microsoft Edge contexts at 1440×960 and 1100×760. **${report.passed} checks passed; ${report.failed} failed.**\n\nChecks cover all 22 playable profiles and their four information tabs, a wildlife profile, comparison, tables, scatter and preferences. They verify removal of export/import/download/copy/configuration/file-input controls and the global Data & sources navigation/footer link. Mechanics and Source data tabs, the Field mechanics overview card and the entire species footer are absent. Source 1/2 selectors and the Movement at a glance card remain. Rendered body text, title/aria-label attributes and SVG tooltips were scanned across the four tabs, comparison, table/bulk menu and scatter; no original provider names remain. Every one of the 22 table-row source menus and the bulk menu uses Source 1/2 labels. Applying Source 2 updated all 22 rows, and scatter captions/accessibility names were checked in both source modes.\n\nThe script measures brand/logo size and representative text sizes, outer document/main-pane horizontal overflow and clipped controls/gallery names. Inner data tables are deliberately allowed their own horizontal scrolling. This verifies layout geometry and computed styles, not subjective visual quality or native animation frame pacing.\n\n${failures.length ? '## Failures\n\n' + failures.map(result => '- **' + result.name + '**: ' + result.error.replace(/\n/g, ' ')).join('\n') : 'All focused acceptance checks passed.'}\n\nFull measurements: [readability-verification-results.json](readability-verification-results.json).\n`);
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed, errors, fonts }, null, 2));
  if (report.failed) process.exitCode = 1;
}
