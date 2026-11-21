import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { registerHooks } from 'node:module';

test('website label download uses Firebase admin authentication, downloads the API PDF, and surfaces failures', async () => {
  const service = new URL('../src/services/delhiveryService.js', import.meta.url).href;
  const fixture = { token: 'fixture-admin-token' };
  globalThis[Symbol.for('delhivery.download.fixture')] = fixture;
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL === service && specifier.includes('apiConfig')) return { url: 'data:text/javascript,export const getBackendUrl=()=>"";', shortCircuit: true };
    if (context.parentURL === service && specifier.includes('firebaseConfig')) return { url: 'data:text/javascript,' + encodeURIComponent('export const auth={currentUser:{getIdToken:async()=>globalThis[Symbol.for("delhivery.download.fixture")].token}};'), shortCircuit: true };
    return next(specifier, context);
  } });
  const oldDocument = globalThis.document, oldWindow = globalThis.window;
  let clicked = false, removed = false, requested = 0, fail = false;
  const anchor = { click: () => { clicked = true; }, remove: () => { removed = true; } };
  try {
    globalThis.document = { createElement: () => anchor, body: { append: () => {} } };
    globalThis.window = { setTimeout: callback => callback() };
    mock.method(URL, 'createObjectURL', () => 'blob:fixture'); mock.method(URL, 'revokeObjectURL', () => {});
    mock.method(globalThis, 'fetch', async (url, options) => {
      requested++; assert.equal(url, '/api/delhivery/orders/WEB-001/label');
      assert.equal(options.headers.Authorization, 'Bearer fixture-admin-token');
      return fail ? Response.json({ error: 'Shipment not manifested yet.' }, { status: 409 }) : new Response('%PDF-fixture', { headers: { 'content-type': 'application/pdf' } });
    });
    const { downloadDelhiveryLabel } = await import(service);
    await downloadDelhiveryLabel('WEB-001');
    assert.equal(clicked, true); assert.equal(removed, true); assert.equal(anchor.download, 'delhivery-WEB-001.pdf');
    fail = true; await assert.rejects(downloadDelhiveryLabel('WEB-001'), /not manifested/);
    fixture.token = null; await assert.rejects(downloadDelhiveryLabel('WEB-001'), /Sign in as an admin/);
    assert.equal(requested, 2);
  } finally {
    hooks.deregister(); mock.restoreAll();
    if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
    if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
    delete globalThis[Symbol.for('delhivery.download.fixture')];
  }
});
