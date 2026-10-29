import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const read = path => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('service worker does not cache HTTP error responses', async () => {
  const source = await read('sw.js');
  let fetchHandler;
  const putCalls = [];
  let responsePromise;

  const context = {
    URL,
    fetch: async () => ({
      ok: false,
      status: 503,
      clone() { return this; }
    }),
    caches: {
      open: async () => ({
        addAll: async () => {},
        put: async (...args) => { putCalls.push(args); }
      }),
      keys: async () => [],
      delete: async () => true,
      match: async () => null
    },
    self: {
      location: { origin: 'https://example.test' },
      clients: { claim: async () => {} },
      skipWaiting: async () => {},
      addEventListener(type, handler) {
        if (type === 'fetch') fetchHandler = handler;
      }
    }
  };

  vm.runInNewContext(source, context, { filename: 'sw.js' });
  assert.equal(typeof fetchHandler, 'function');

  fetchHandler({
    request: { method: 'GET', url: 'https://example.test/app.js' },
    respondWith(promise) { responsePromise = promise; }
  });

  const response = await responsePromise;
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(response.status, 503);
  assert.equal(putCalls.length, 0, 'HTTP error responses must not overwrite a valid cache entry');
});

test('SIGNED_OUT clears stored authenticated state before a future login', async () => {
  const source = await read('app.js');
  const handler = source.match(/onAuthStateChange\(\(event,s\)=>\{([\s\S]*?)\}\);if\('serviceWorker'/)?.[1];

  assert.ok(handler, 'auth state change handler should exist');
  assert.match(handler, /event==='SIGNED_OUT'/);
  assert.match(handler, /state\.session=null/);
  assert.match(handler, /state\.user=null/);
  assert.match(handler, /state\.member=null/);
  assert.match(handler, /state\.householdId=null/);
});
