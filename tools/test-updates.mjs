/** Update-status UI acceptance with a mocked Tauri transport in isolated Edge. */
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageInfo = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const configuration = JSON.parse(await fs.readFile(path.join(root, 'src-tauri/update-config.json'), 'utf8'));
const currentVersion = packageInfo.version;
const releaseUrl = `https://github.com/${configuration.owner}/${configuration.repo}/releases/tag/v9.0.0`;
const startedAt = new Date().toISOString();
const results = [];
const errors = [];
const transports = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true });

function report(status, additions = {}) {
  return { status, currentVersion, latestVersion: null, releaseUrl: null, releaseName: null, publishedAt: null, message: null, checkedAtUnix: Math.floor(Date.now() / 1000), ...additions };
}
const available = report('available', { latestVersion: '9.0.0', releaseUrl, releaseName: 'Dino Lab 9.0.0', publishedAt: '2026-10-28T00:00:00Z' });
const current = report('current', { latestVersion: currentVersion });

async function check(name, action) {
  try { await action(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: String(error.message ?? error).slice(0, 1800) }); console.error(`FAIL ${name}: ${error.message}`); }
}

async function openContext({ responses, viewport = { width: 1440, height: 960 }, native = true }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ responses, native }) => {
    globalThis.isTauri = native;
    const mock = { calls: [], pending: [], checks: 0 };
    mock.resolveNext = () => { const next = mock.pending.shift(); if (!next) throw new Error('No pending update request'); next.resolve(next.result); };
    globalThis.__updateMock = mock;
    globalThis.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
      invoke: (command, arguments_ = {}) => {
        mock.calls.push({ command, arguments_ });
        if (command === 'check_for_updates') {
          const entry = responses[Math.min(mock.checks++, responses.length - 1)];
          if (entry.reject) return Promise.reject(new Error(entry.reject));
          if (entry.deferred) return new Promise(resolve => mock.pending.push({ resolve, result: entry.result }));
          return Promise.resolve(entry.result);
        }
        if (command === 'open_update_release') return Promise.resolve();
        return Promise.reject(new Error(`Unexpected native command: ${command}`));
      },
    };
  }, { responses, native });
  await page.goto('http://127.0.0.1:1420/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.library h1')).toContainText('Species library');
  await expect(page.locator('.startup')).toBeHidden({ timeout: 6500 });
  await expect(page.getByRole('button', { name: 'Updates', exact: true })).toBeVisible();
  return { page, context };
}

async function callCount(page) { return page.evaluate(() => globalThis.__updateMock.calls.filter(call => call.command === 'check_for_updates').length); }
async function nativeCalls(page) { return page.evaluate(() => globalThis.__updateMock.calls); }
async function resolvePending(page) { await page.evaluate(() => globalThis.__updateMock.resolveNext()); }

async function openDialog(page) {
  await page.getByRole('button', { name: 'Updates', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'App updates', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

const headings = {
  available: 'New version available', current: 'You’re up to date', unpublished: 'No release published yet',
  unavailable: 'Unable to check for updates', offline: 'You’re offline', rate_limited: 'Please try again later',
};

try {
  for (const status of ['available', 'current', 'unpublished', 'unavailable', 'offline', 'rate_limited']) {
    const value = status === 'available' ? available : status === 'current' ? current : report(status, { message: status === 'unavailable' ? 'Private or inaccessible repository (404).' : null });
    const { page, context } = await openContext({ responses: [{ result: value }] });
    await check(`${status}: one automatic check despite development StrictMode`, async () => {
      expect(await callCount(page)).toBe(1);
      await expect(page.getByRole('dialog', { name: 'App updates', exact: true })).toHaveCount(0);
      expect((await nativeCalls(page)).map(call => call.command)).toEqual(['check_for_updates']);
    });
    await check(`${status}: correct rail indicator and quiet failure behavior`, async () => {
      await expect(page.locator('.updates-trigger .update-indicator')).toHaveCount(status === 'available' ? 1 : 0);
      await expect(page.locator('.update-notice')).toHaveCount(status === 'available' ? 1 : 0);
      const box = await page.getByRole('button', { name: 'Updates', exact: true }).boundingBox();
      const preferences = await page.getByRole('button', { name: 'Preferences', exact: true }).boundingBox();
      expect(box.x).toBeLessThan(90);
      expect(box.y).toBeLessThan(preferences.y);
    });
    const dialog = await openDialog(page);
    await check(`${status}: truthful status and version fields`, async () => {
      await expect(dialog.locator('.update-status-reading h3')).toHaveText(headings[status]);
      await expect(dialog.locator('.update-versions strong')).toHaveText([currentVersion, value.latestVersion ?? '—']);
      await expect(dialog.getByRole('button', { name: 'View release', exact: true })).toHaveCount(status === 'available' ? 1 : 0);
      if (status !== 'current') await expect(dialog).not.toContainText('You’re up to date');
      if (status === 'available') await expect(dialog).toContainText('9.0.0');
    });
    await check(`${status}: Escape closes details and returns keyboard focus`, async () => {
      await expect(page.getByRole('button', { name: 'Close updates', exact: true })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Updates', exact: true })).toBeFocused();
      expect(await callCount(page)).toBe(1);
    });
    transports.push({ scenario: status, calls: await nativeCalls(page) });
    await context.close();
  }

  for (const viewport of [{ width: 1440, height: 960 }, { width: 1100, height: 760 }]) {
    const size = `${viewport.width}×${viewport.height}`;
    const { page, context } = await openContext({ viewport, responses: [{ result: available, deferred: true }, { result: current, deferred: true }] });
    await check(`${size}: pending launch check does not block the application or steal focus`, async () => {
      expect(await callCount(page)).toBe(1);
      await expect(page.locator('.startup')).toHaveCount(0);
      const search = page.getByRole('textbox', { name: 'Search species', exact: true });
      await search.fill('Allo');
      const beforeScroll = await page.locator('.main-content').evaluate(element => element.scrollTop);
      await resolvePending(page);
      await expect(page.locator('.update-notice')).toContainText('New version available');
      await expect(search).toBeFocused();
      await expect(search).toHaveValue('Allo');
      expect(await page.locator('.main-content').evaluate(element => element.scrollTop)).toBe(beforeScroll);
      await expect(page.getByRole('dialog', { name: 'App updates', exact: true })).toHaveCount(0);
    });
    await check(`${size}: keyboard opens details, Tab is contained and dialog fits viewport`, async () => {
      const trigger = page.getByRole('button', { name: 'Updates', exact: true });
      await trigger.focus();
      await trigger.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'App updates', exact: true });
      await expect(dialog).toBeVisible();
      const close = page.getByRole('button', { name: 'Close updates', exact: true });
      const last = dialog.getByRole('button').last();
      await expect(close).toBeFocused();
      await close.press('Shift+Tab');
      await expect(last).toBeFocused();
      await last.press('Tab');
      await expect(close).toBeFocused();
      const box = await dialog.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    });
    await check(`${size}: closing details does not clear the research search`, async () => {
      await page.getByRole('button', { name: 'Close updates', exact: true }).press('Control+k');
      await expect(page.getByRole('dialog', { name: 'App updates', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Close updates', exact: true })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'App updates', exact: true })).toHaveCount(0);
      await expect(page.getByRole('textbox', { name: 'Search species', exact: true })).toHaveValue('Allo');
      await expect(page.getByRole('button', { name: 'Updates', exact: true })).toBeFocused();
    });
    await check(`${size}: dismissing the new-version notice keeps its rail badge`, async () => {
      await page.getByRole('button', { name: 'Dismiss update notice', exact: true }).click();
      await expect(page.locator('.update-notice')).toHaveCount(0);
      await expect(page.locator('.updates-trigger .update-indicator')).toHaveCount(1);
    });
    const dialog = await openDialog(page);
    await check(`${size}: View release is the sole explicit release-opening action`, async () => {
      expect((await nativeCalls(page)).filter(call => call.command === 'open_update_release')).toEqual([]);
      await page.getByRole('button', { name: 'View release', exact: true }).click();
      expect((await nativeCalls(page)).filter(call => call.command === 'open_update_release')).toEqual([{ command: 'open_update_release', arguments_: { url: releaseUrl } }]);
      expect((await nativeCalls(page)).every(call => ['check_for_updates', 'open_update_release'].includes(call.command))).toBe(true);
    });
    await check(`${size}: manual recheck is singular while pending and replaces stale status`, async () => {
      const recheck = page.getByRole('button', { name: 'Check again', exact: true });
      await recheck.click();
      await expect(page.getByRole('button', { name: 'Checking…', exact: true })).toHaveAttribute('aria-disabled', 'true');
      await expect(dialog.locator('.update-status-reading h3')).toHaveText('Checking for updates');
      expect(await callCount(page)).toBe(2);
      await page.keyboard.press('Enter');
      expect(await callCount(page)).toBe(2);
      await resolvePending(page);
      await expect(dialog.locator('.update-status-reading h3')).toHaveText('You’re up to date');
      await expect(page.locator('.updates-trigger .update-indicator')).toHaveCount(0);
      await expect(dialog.getByRole('button', { name: 'View release', exact: true })).toHaveCount(0);
    });
    await check(`${size}: keyboard focus remains inside details after rechecking`, async () => {
      await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
      await page.keyboard.press('Tab');
      await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    });
    transports.push({ scenario: `deferred-and-manual-${size}`, calls: await nativeCalls(page) });
    await context.close();
  }

  {
    const { page, context } = await openContext({ responses: [{ result: current }, { result: available, deferred: true }] });
    await check('Manual reduced-motion preference suppresses update-dialog spinner animation', async () => {
      await page.getByRole('button', { name: 'Preferences', exact: true }).click();
      await page.getByRole('checkbox', { name: 'Reduced motion', exact: true }).check();
      await page.getByRole('button', { name: 'Close preferences', exact: true }).click();
      const dialog = await openDialog(page);
      await dialog.getByRole('button', { name: 'Check again', exact: true }).click();
      await expect(dialog.getByRole('button', { name: 'Checking…', exact: true })).toHaveAttribute('aria-disabled', 'true');
      await expect(page.locator('.updates-surface')).toHaveClass(/reduce-motion/);
      const animations = await dialog.locator('.update-spinning').evaluateAll(elements => elements.map(element => getComputedStyle(element).animationName));
      expect(animations.length).toBeGreaterThan(0);
      expect(animations.every(animation => animation === 'none')).toBe(true);
      await resolvePending(page);
      await expect(dialog.locator('.update-status-reading h3')).toHaveText('New version available');
      expect(await callCount(page)).toBe(2);
    });
    transports.push({ scenario: 'manual-reduced-motion', calls: await nativeCalls(page) });
    await context.close();
  }

  for (const scenario of ['native-rejection', 'browser-preview']) {
    const { page, context } = await openContext({ native: scenario !== 'browser-preview', responses: [{ reject: 'Native command could not be reached' }] });
    const dialog = await openDialog(page);
    await check(`${scenario}: checker failure is unavailable, not up-to-date`, async () => {
      await expect(dialog.locator('.update-status-reading h3')).toHaveText('Unable to check for updates');
      await expect(dialog).not.toContainText('You’re up to date');
      await expect(page.locator('.updates-trigger .update-indicator')).toHaveCount(0);
      expect(await callCount(page)).toBe(scenario === 'browser-preview' ? 0 : 1);
    });
    transports.push({ scenario, calls: await nativeCalls(page) });
    await context.close();
  }
  await check('No uncaught page errors during update acceptance', async () => { expect(errors).toEqual([]); });
} catch (error) {
  results.push({ name: 'Update acceptance execution', passed: false, error: String(error.stack ?? error) });
} finally {
  await browser.close();
  const summary = { startedAt, finishedAt: new Date().toISOString(), appVersion: currentVersion, configuredRepository: `${configuration.owner}/${configuration.repo}`, transport: 'Mocked Tauri invoke; no real GitHub requests or installation', passed: results.filter(result => result.passed).length, failed: results.filter(result => !result.passed).length, errors, transports, results };
  await fs.writeFile(path.join(root, 'docs/update-verification-results.json'), JSON.stringify(summary, null, 2));
  const failed = results.filter(result => !result.passed);
  await fs.writeFile(path.join(root, 'docs/UPDATE-CHECKER-VERIFICATION.md'), `# Update checker verification\n\n${summary.finishedAt}\n\n**${summary.passed} integration checks passed; ${summary.failed} failed.** Current package version: ${currentVersion}. Isolated headless Edge contexts; the Tauri transport was mocked, with no real release download, installation or external write. Native GitHub HTTP classification and URL validation are covered separately by Rust tests.\n\nThe scenarios cover launch-once behavior under development StrictMode, all six native statuses, quiet failure states, notice/badge behavior, manual recheck and in-flight deduplication, explicit release opening, keyboard focus containment/return, context preservation and dialog geometry at 1440×960 and 1100×760.\n\n${failed.length ? '## Failures\n\n' + failed.map(result => '- **' + result.name + '**: ' + result.error.replace(/\n/g, ' ')).join('\n') : 'All integration scenarios passed.'}\n\nThe [GitHub latest-release API](https://docs.github.com/en/rest/releases/releases#get-the-latest-release) identifies published stable releases. [Private-resource 404 responses and rate-limit errors](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api) must not be interpreted as a confirmed current installation.\n\nMachine-readable evidence: [update-verification-results.json](update-verification-results.json). Unit/service coverage: [update-checker.test.ts](../tests/update-checker.test.ts).\n`);
  console.log(JSON.stringify({ passed: summary.passed, failed: summary.failed, errors, failedChecks: failed.map(result => ({ name: result.name, error: result.error })) }, null, 2));
  if (summary.failed) process.exitCode = 1;
}
