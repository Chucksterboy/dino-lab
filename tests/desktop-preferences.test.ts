import test from 'node:test';
import assert from 'node:assert/strict';
import { getCloseToTray, setCloseToTray } from '../src/lib/desktop.ts';

type Invocation = { command: string; arguments_: Record<string, unknown> };

/** Mock IPC only: these tests never open a window or touch saved app settings. */
async function withRuntime(
  native: boolean,
  handler: (command: string, arguments_: Record<string, unknown>) => unknown,
  action: (calls: Invocation[]) => Promise<void>,
) {
  const runtime = globalThis as unknown as { isTauri?: boolean; window?: unknown };
  const previousFlag = runtime.isTauri;
  const previousWindow = runtime.window;
  const calls: Invocation[] = [];
  runtime.isTauri = native;
  runtime.window = { __TAURI_INTERNALS__: { invoke: (command: string, arguments_: Record<string, unknown> = {}) => { calls.push({ command, arguments_ }); return handler(command, arguments_); } } };
  try { await action(calls); }
  finally {
    if (previousFlag === undefined) delete runtime.isTauri; else runtime.isTauri = previousFlag;
    if (previousWindow === undefined) delete runtime.window; else runtime.window = previousWindow;
  }
}

test('native close preference reads preserve both enabled and disabled values', async () => {
  for (const expected of [true, false]) {
    await withRuntime(true, () => Promise.resolve(expected), async calls => {
      assert.equal(await getCloseToTray(), expected);
      assert.deepEqual(calls, [{ command: 'get_close_to_tray', arguments_: {} }]);
    });
  }
});

test('preference writes send the exact requested boolean and require confirmation', async () => {
  for (const enabled of [true, false]) {
    await withRuntime(true, (_command, arguments_) => Promise.resolve(arguments_.enabled), async calls => {
      assert.equal(await setCloseToTray(enabled), enabled);
      assert.deepEqual(calls, [{ command: 'set_close_to_tray', arguments_: { enabled } }]);
    });
  }
});

test('browser preview rejects reading and saving before any native invocation', async () => {
  await withRuntime(false, () => { throw new Error('No preview IPC should execute'); }, async calls => {
    await assert.rejects(getCloseToTray(), /Windows application/);
    await assert.rejects(setCloseToTray(true), /Windows application/);
    await assert.rejects(setCloseToTray(false), /Windows application/);
    assert.deepEqual(calls, []);
  });
});

test('failed native read propagates an error instead of inventing a default preference', async () => {
  await withRuntime(true, () => Promise.reject(new Error('setting unavailable')), async calls => {
    await assert.rejects(getCloseToTray(), /setting unavailable/);
    assert.equal(calls.length, 1);
  });
});

test('failed native persistence never resolves as a successful setting change', async () => {
  await withRuntime(true, () => Promise.reject(new Error('settings directory is not writable')), async calls => {
    await assert.rejects(setCloseToTray(true), /not writable/);
    assert.deepEqual(calls, [{ command: 'set_close_to_tray', arguments_: { enabled: true } }]);
  });
});

test('nonboolean native read payloads are rejected rather than coerced', async () => {
  for (const payload of [null, undefined, 'true', 'false', 1, 0, { enabled: true }]) {
    await withRuntime(true, () => Promise.resolve(payload), async () => {
      await assert.rejects(getCloseToTray(), /could not be read/);
    });
  }
});

test('nonboolean native write payloads cannot pretend a preference was saved', async () => {
  for (const payload of [null, undefined, 'true', 1, { enabled: true }]) {
    await withRuntime(true, () => Promise.resolve(payload), async () => {
      await assert.rejects(setCloseToTray(true), /could not be read/);
    });
  }
});

test('mismatched saved booleans are unconfirmed writes in either direction', async () => {
  for (const requested of [true, false]) {
    await withRuntime(true, () => Promise.resolve(!requested), async () => {
      await assert.rejects(setCloseToTray(requested), /was not saved/);
    });
  }
});

test('a later read retrieves actual native state after a rejected write', async () => {
  await withRuntime(true, command => command === 'set_close_to_tray'
    ? Promise.reject(new Error('write failed'))
    : Promise.resolve(false), async calls => {
    await assert.rejects(setCloseToTray(true), /write failed/);
    assert.equal(await getCloseToTray(), false);
    assert.deepEqual(calls.map(call => call.command), ['set_close_to_tray', 'get_close_to_tray']);
  });
});
