import assert from 'node:assert/strict';
import { after, before, mock, test } from 'node:test';
import express from 'express';
import { registerDelhiveryLabelRoutes } from '../src/server/delhiveryLabels.js';

const pdf = '%PDF-1.4\noriginal courier label\n%%EOF';
const records = new Map([
  ['WEB-001', { waybill: '12345678901234', status: 'Packed' }],
  ['WEB-NO-AWB', {}], ['WEB-CANCELLED', { waybill: '12345678901234', status: 'Cancelled' }],
  ['POS-001', { waybill: '12345678901234', createdBy: 'admin-pos' }]
]);
const app = express();
registerDelhiveryLabelRoutes(app, {
  getDb: () => ({ collection: name => { assert.equal(name, 'orders'); return { doc: id => ({ get: async () => ({ id, exists: records.has(id), data: () => records.get(id) }) }) }; } }),
  requireAdminAuth: (req, res, next) => req.get('authorization') === 'Bearer fixture-admin' ? next() : res.status(401).json({ error: 'Admin authentication required.' })
});
const server = app.listen(0, '127.0.0.1');
const nativeFetch = globalThis.fetch, oldKey = process.env.DELHIVERY_API_KEY, oldEnv = process.env.DELHIVERY_ENV;
let origin, scenario = 'link';
const calls = [];
before(async () => {
  if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  process.env.DELHIVERY_API_KEY = 'fixture-private-key'; process.env.DELHIVERY_ENV = 'production';
  mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(String(input));
    if (url.origin === origin) return nativeFetch(input, options);
    calls.push({ url, options });
    if (url.hostname === 'track.delhivery.com') {
      if (scenario === 'direct') return new Response(pdf, { headers: { 'content-type': 'application/pdf' } });
      if (scenario === 'missing') return Response.json({ packages_found: 0, packages: [] });
      if (scenario === 'auth') return new Response('secret provider response', { status: 403 });
      return Response.json({ packages_found: 1, packages: [{ wbn: scenario === 'mismatch' ? 'WRONG-AWB' : '12345678901234', pdf_download_link: scenario === 'unsafe' ? 'http://127.0.0.1/private' : 'https://courier-labels.s3.amazonaws.com/original.pdf' }] });
    }
    assert.equal(url.hostname, 'courier-labels.s3.amazonaws.com');
    assert.equal(new Headers(options.headers).has('authorization'), false);
    return new Response(scenario === 'invalid' ? '<html>not a PDF</html>' : pdf);
  });
});
after(() => new Promise(resolve => server.close(() => {
  mock.restoreAll();
  if (oldKey === undefined) delete process.env.DELHIVERY_API_KEY; else process.env.DELHIVERY_API_KEY = oldKey;
  if (oldEnv === undefined) delete process.env.DELHIVERY_ENV; else process.env.DELHIVERY_ENV = oldEnv;
  resolve();
})));
const get = (id, authenticated = true) => fetch(`${origin}/api/delhivery/orders/${id}/label`, { headers: authenticated ? { Authorization: 'Bearer fixture-admin' } : {} });

test('only admins can retrieve labels; API requests use the saved AWB and preserve the original PDF', async () => {
  assert.equal((await get('WEB-001', false)).status, 401); assert.equal(calls.length, 0);
  const response = await get('WEB-001');
  assert.equal(response.status, 200); assert.equal(await response.text(), pdf);
  assert.match(response.headers.get('content-type'), /application\/pdf/);
  assert.match(response.headers.get('content-disposition'), /delhivery-WEB-001.pdf/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(calls[0].url.pathname, '/api/p/packing_slip');
  assert.equal(calls[0].url.searchParams.get('wbns'), '12345678901234');
  assert.equal(calls[0].url.searchParams.get('pdf'), 'True');
  assert.equal(new Headers(calls[0].options.headers).get('authorization'), 'Token fixture-private-key');
  assert.equal(records.size, 4);
});
test('direct PDFs work; missing, cancelled and POS shipments cannot request labels', async () => {
  scenario = 'direct'; assert.equal(await (await get('WEB-001')).text(), pdf); calls.length = 0;
  for (const id of ['WEB-NO-AWB', 'WEB-CANCELLED', 'POS-001']) assert.equal((await get(id)).status, 409);
  assert.equal((await get('WEB-UNKNOWN')).status, 404); assert.equal(calls.length, 0);
});
test('provider failures, wrong AWBs and unsafe downloads never produce replacement labels or expose tokens', async () => {
  for (const value of ['missing', 'auth', 'unsafe', 'invalid', 'mismatch']) {
    scenario = value; const response = await get('WEB-001');
    assert.equal(response.status, value === 'missing' ? 409 : 502);
    assert.doesNotMatch(await response.text(), /fixture-private-key|secret provider response|<html>/);
  }
});
