/** Safe local API smoke test: no real orders, payments, SMS, shipments, or emails. */
const base = process.env.TEST_BASE_URL || 'http://localhost:3001';
const protectedRoutes = [
  ['GET', '/api/auth/admin-status'],
  ['POST', '/api/notifications/send-admin-alert'],
  ['POST', '/api/admin/settings'],
  ['POST', '/api/admin/products/upsert'],
  ['POST', '/api/admin/inventory/set'],
  ['GET', '/api/admin/pos/status'],
  ['POST', '/api/admin/pos/reconcile'],
  ['GET', '/api/imagekit/auth'],
  ['DELETE', '/api/imagekit/delete/fake-file'],
  ['POST', '/api/orders/create'],
  ['POST', '/api/delhivery/create-shipment'],
  ['POST', '/api/delhivery/cancel-shipment'],
  ['POST', '/api/exchanges/create'],
  ['GET', '/api/exchanges/my-exchanges'],
  ['GET', '/api/exchanges/admin/list'],
  ['POST', '/api/exchanges/admin/approve'],
  ['POST', '/api/exchanges/admin/reject'],
  ['POST', '/api/exchanges/admin/retry-reverse-pickup'],
  ['POST', '/api/exchanges/admin/update-status'],
  ['GET', '/api/notifications/customer'],
  ['POST', '/api/notifications/customer/mark-read'],
  ['POST', '/api/orders/cancel'],
  ['POST', '/api/admin/orders/update-status'],
  ['POST', '/api/pos/products'],
  ['PUT', '/api/pos/products'],
  ['DELETE', '/api/pos/products'],
  ['GET', '/api/pos/products-sync'],
  ['POST', '/api/pos/stock-sync'],
  ['POST', '/api/pos/stock-changes'],
  ['GET', '/api/pos/stock-snapshot'],
  ['GET', '/api/pos/stock-changes'],
  ['GET', '/api/pos/stock-sync']
];
const publicValidationRoutes = [
  ['POST', '/api/otp/send-otp', {}],
  ['POST', '/api/otp/verify-otp', {}],
  ['POST', '/api/create-order', { currency: 'USD' }],
  ['POST', '/api/verify-payment', {}],
  ['POST', '/api/orders/track', {}],
  ['POST', '/api/delhivery/pincode/check', {}],
  ['POST', '/api/delhivery/pincode/lookup-by-place', {}],
  ['POST', '/api/delhivery/webhook', {}]
];

async function probe(method, path, body) {
  const response = await fetch(new URL(path, base), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body || {}),
    signal: AbortSignal.timeout(8000)
  });
  const json = await response.json().catch(() => null);
  if (response.headers.get('cache-control') !== 'no-store') throw new Error(`${path}: missing no-store`);
  if (response.headers.get('x-content-type-options') !== 'nosniff') throw new Error(`${path}: missing nosniff`);
  if (!json || typeof json !== 'object') throw new Error(`${path}: non-JSON response`);
  return response.status;
}

let passed = 0;
const failures = [];
for (const [method, path] of protectedRoutes) {
  try {
    const status = await probe(method, path);
    if (status !== 401) throw new Error(`expected 401, received ${status}`);
    passed++;
  } catch (error) { failures.push(`${method} ${path}: ${error.message}`); }
}
for (const [method, path, body] of publicValidationRoutes) {
  try {
    const status = await probe(method, path, body);
    if (status >= 500) throw new Error(`received ${status}`);
    passed++;
  } catch (error) { failures.push(`${method} ${path}: ${error.message}`); }
}
try {
  const status = await probe('GET', '/api/health');
  if (status !== 200) throw new Error(`expected 200, received ${status}`);
  passed++;
} catch (error) { failures.push(`GET /api/health: ${error.message}`); }

console.log(`API smoke: ${passed}/${protectedRoutes.length + publicValidationRoutes.length + 1} passed`);
for (const failure of failures) console.error(`FAIL ${failure}`);
if (failures.length) process.exitCode = 1;
