import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_VERSION, updateStatusCopy } from '../src/lib/updates.ts';
import type { UpdateCheck, UpdateState } from '../src/lib/updates.ts';

const releaseUrl = 'https://github.com/Chucksterboy/dino-lab/releases/tag/v0.2.0';
function report(status: UpdateState, overrides: Partial<UpdateCheck> = {}): UpdateCheck {
  return { status, currentVersion: APP_VERSION, latestVersion: null, releaseUrl: null, releaseName: null, publishedAt: null, message: null, checkedAtUnix: 1793145600, ...overrides };
}

let moduleId = 0;
async function freshModule() {
  const url = new URL('../src/lib/updates.ts', import.meta.url);
  url.searchParams.set('unit', String(++moduleId));
  return import(url.href) as Promise<typeof import('../src/lib/updates.ts')>;
}

async function withRuntime<T>(native: boolean, invoke: (command: string, arguments_: Record<string, unknown>) => unknown, action: () => Promise<T>) {
  const runtime = globalThis as unknown as { isTauri?: boolean; window?: unknown };
  const previousTauri = runtime.isTauri;
  const previousWindow = runtime.window;
  runtime.isTauri = native;
  runtime.window = { __TAURI_INTERNALS__: { invoke } };
  try { return await action(); }
  finally {
    if (previousTauri === undefined) delete runtime.isTauri; else runtime.isTauri = previousTauri;
    if (previousWindow === undefined) delete runtime.window; else runtime.window = previousWindow;
  }
}

test('installed-version label uses the application package version', () => {
  const metadata = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(APP_VERSION, metadata.version);
});

test('only a confirmed current report displays an up-to-date result', () => {
  const unavailableStates: UpdateState[] = ['unpublished', 'unavailable', 'offline', 'rate_limited'];
  for (const status of unavailableStates) {
    const copy = updateStatusCopy(report(status));
    assert.ok(!/up to date|no newer version/i.test(`${copy.heading} ${copy.description}`), status);
    assert.ok(copy.heading.length > 0 && copy.description.length > 0);
  }
  assert.equal(updateStatusCopy(report('current')).heading, 'You’re up to date');
  assert.equal(updateStatusCopy(null).heading, 'Updates');
});

test('available release is named and an in-progress check takes precedence over stale results', () => {
  const available = report('available', { latestVersion: '0.2.0', releaseUrl });
  const copy = updateStatusCopy(available);
  assert.equal(copy.heading, 'New version available');
  assert.ok(copy.description.includes('0.2.0'));
  assert.equal(updateStatusCopy(report('current'), true).heading, 'Checking for updates');
  assert.equal(updateStatusCopy(available, true).heading, 'Checking for updates');
});

test('an unexpected future status falls back to unavailable rather than up-to-date', () => {
  const unknown = report('unavailable');
  unknown.status = 'not-understood' as UpdateState;
  assert.equal(updateStatusCopy(unknown).heading, 'Unable to check for updates');
});

test('simultaneous checks share one native request, and a completed manual check can run again', async () => {
  let resolve!: (value: UpdateCheck) => void;
  const pending = new Promise<UpdateCheck>(complete => { resolve = complete; });
  const calls: string[] = [];
  await withRuntime(true, command => { calls.push(command); return pending; }, async () => {
    const updates = await freshModule();
    const first = updates.checkForUpdates();
    const second = updates.checkForUpdates();
    assert.equal(first, second);
    assert.deepEqual(calls, ['check_for_updates']);
    resolve(report('current', { latestVersion: APP_VERSION }));
    assert.equal((await first).status, 'current');
    await second;
    const next = updates.checkForUpdates();
    assert.notEqual(next, first);
    await next;
    assert.deepEqual(calls, ['check_for_updates', 'check_for_updates']);
  });
});

test('launch request remains cached across StrictMode-style remounts but manual checking remains available', async () => {
  const calls: string[] = [];
  await withRuntime(true, command => { calls.push(command); return Promise.resolve(report('unpublished')); }, async () => {
    const updates = await freshModule();
    const first = updates.checkForUpdatesOnLaunch();
    const replay = updates.checkForUpdatesOnLaunch();
    assert.equal(first, replay);
    await first;
    assert.equal(updates.checkForUpdatesOnLaunch(), first);
    assert.equal(calls.length, 1);
    await updates.checkForUpdates();
    assert.equal(calls.length, 2);
    assert.equal(updates.checkForUpdatesOnLaunch(), first);
  });
});

test('native invocation failure becomes unavailable and never triggers installation', async () => {
  const calls: string[] = [];
  await withRuntime(true, command => { calls.push(command); throw new Error('native command unavailable'); }, async () => {
    const updates = await freshModule();
    const result = await updates.checkForUpdates();
    assert.equal(result.status, 'unavailable');
    assert.equal(result.currentVersion, APP_VERSION);
    assert.ok(Number.isFinite(result.checkedAtUnix));
    assert.equal(updateStatusCopy(result).heading, 'Unable to check for updates');
    assert.deepEqual(calls, ['check_for_updates']);
  });
});

test('browser preview cannot falsely confirm a current release or silently launch a release page', async () => {
  const calls: string[] = [];
  await withRuntime(false, command => { calls.push(command); throw new Error('unexpected native call'); }, async () => {
    const updates = await freshModule();
    assert.equal((await updates.checkForUpdates()).status, 'unavailable');
    await assert.rejects(updates.openUpdateRelease(releaseUrl), /Windows application/);
    assert.deepEqual(calls, []);
  });
});

test('opening a release is a separate explicit command using the exact returned URL', async () => {
  const calls: { command: string; arguments_: Record<string, unknown> }[] = [];
  await withRuntime(true, (command, arguments_) => { calls.push({ command, arguments_ }); return Promise.resolve(); }, async () => {
    const updates = await freshModule();
    assert.deepEqual(calls, []);
    await updates.openUpdateRelease(releaseUrl);
    assert.deepEqual(calls, [{ command: 'open_update_release', arguments_: { url: releaseUrl } }]);
  });
});
