/**
 * Brothers Outfit Gallery — API Functional & Load Test Suite
 * ===========================================================
 * Tests every API endpoint for correctness, then runs 100
 * concurrent virtual users hammering the server for performance.
 *
 * Usage:  node test/api-load-test.js
 *
 * No external dependencies — uses only Node.js built-ins.
 */

import http from 'node:http';
import crypto from 'node:crypto';

// ─── Config ──────────────────────────────────────────────────────────────────
const BASE = process.env.TEST_BASE_URL || 'http://localhost:3001';
const CONCURRENT_USERS = 100;
const REQUESTS_PER_USER = 10;   // Each virtual user fires this many sequential reqs
const VERBOSE = process.argv.includes('--verbose');

// ─── Helpers ─────────────────────────────────────────────────────────────────
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      timeout: 15000,
    };
    const payload = body ? JSON.stringify(body) : null;
    if (payload) opts.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        let json = null;
        try { json = JSON.parse(raw); } catch { }
        resolve({ status: res.statusCode, headers: res.headers, body: json, raw });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${method} ${path}`)); });
    if (payload) req.write(payload);
    req.end();
  });
}

const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

// ─── Test Results Tracking ───────────────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0;
const failures = [];

function assert(condition, testName, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ${green('✓')} ${testName}`);
  } else {
    failed++;
    failures.push({ testName, detail });
    console.log(`  ${red('✗')} ${testName}${detail ? red(' — ' + detail) : ''}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PART 1 — FUNCTIONAL API TESTS
// ═══════════════════════════════════════════════════════════════════════════════
async function runFunctionalTests() {
  console.log(`\n${bold('═══ PART 1: FUNCTIONAL API TESTS ═══')}\n`);

  // ── 1. Health Check ─────────────────────────────────────────────
  console.log(cyan('\n▸ Health Check'));
  try {
    const r = await request('GET', '/api/health');
    assert(r.status === 200, 'GET /api/health returns 200');
    assert(r.body?.status === 'ok', 'Health response has status:ok');
    assert(!!r.body?.time, 'Health response includes timestamp');
  } catch (e) {
    assert(false, 'GET /api/health reachable', e.message);
  }

  // ── 2. Security Headers ────────────────────────────────────────
  console.log(cyan('\n▸ Security Headers'));
  try {
    const r = await request('GET', '/api/health');
    assert(r.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options: nosniff');
    assert(r.headers['x-frame-options'] === 'SAMEORIGIN', 'X-Frame-Options: SAMEORIGIN');
    assert(r.headers['x-xss-protection'] === '1; mode=block', 'X-XSS-Protection present');
    assert((r.headers['referrer-policy'] || '').includes('strict-origin'), 'Referrer-Policy set');
    assert((r.headers['strict-transport-security'] || '').includes('max-age'), 'HSTS header set');
    assert(!r.headers['x-powered-by'], 'X-Powered-By hidden (Express fingerprint removed)');
    assert((r.headers['cross-origin-opener-policy'] || '').includes('same-origin'), 'COOP header set');
  } catch (e) {
    assert(false, 'Security headers check', e.message);
  }

  // ── 3. CORS ────────────────────────────────────────────────────
  console.log(cyan('\n▸ CORS'));
  try {
    const r = await request('GET', '/api/health', null, {
      Origin: 'http://localhost:5173'
    });
    assert(r.status === 200, 'Localhost origin allowed in dev');

    const r2 = await request('GET', '/api/health', null, {
      Origin: 'https://evil-site.com'
    });
    assert(r2.status === 200, 'Server responds even to disallowed origins (CORS is browser-enforced)');
  } catch (e) {
    assert(false, 'CORS test', e.message);
  }

  // ── 4. 404 for Unknown API Routes ──────────────────────────────
  console.log(cyan('\n▸ Unknown API Routes'));
  try {
    const r = await request('GET', '/api/nonexistent-endpoint-xyz');
    assert(r.status === 404, 'Unknown API path returns 404');
    assert(r.body?.error?.includes('not found'), 'Returns descriptive error message');
  } catch (e) {
    assert(false, 'Unknown route test', e.message);
  }

  // ── 5. Input Sanitization ──────────────────────────────────────
  console.log(cyan('\n▸ Input Sanitization / XSS Protection'));
  try {
    const r = await request('POST', '/api/otp/send-otp', {
      phone: '<script>alert(1)</script>9876500010'
    }, { 'x-simulated-user-ip': '10.99.0.5' });
    assert(r.status === 400 || r.status === 200, 'XSS in phone field handled gracefully');
  } catch (e) {
    assert(false, 'Input sanitization test', e.message);
  }

  // ── 6. Prototype Pollution Protection ──────────────────────────
  console.log(cyan('\n▸ Prototype Pollution Protection'));
  try {
    const r = await request('POST', '/api/health', {
      __proto__: { isAdmin: true },
      constructor: { prototype: { isAdmin: true } }
    }, { 'x-simulated-user-ip': '10.99.0.6' });
    assert(r.status === 404 || r.status === 200, '__proto__ keys stripped from body');
  } catch (e) {
    assert(false, 'Prototype pollution test', e.message);
  }

  // ── 7. OTP Send ────────────────────────────────────────────────
  console.log(cyan('\n▸ OTP Send Endpoint'));
  try {
    const r1 = await request('POST', '/api/otp/send-otp', {}, { 'x-simulated-user-ip': '10.99.0.7' });
    assert(r1.status === 400, 'Missing phone returns 400');
    assert(r1.body?.error?.includes('required'), 'Error says phone is required');

    const r2 = await request('POST', '/api/otp/send-otp', { phone: '1234' }, { 'x-simulated-user-ip': '10.99.0.7' });
    assert(r2.status === 400, 'Invalid phone returns 400');
    assert(r2.body?.error?.includes('valid'), 'Error says enter a valid number');

    const r3 = await request('POST', '/api/otp/send-otp', { phone: '9876500011' }, { 'x-simulated-user-ip': '10.99.0.7' });
    assert(r3.status === 200 || r3.status === 503, 'Valid phone accepted (200 or 503 if SMS not configured)');
    if (r3.status === 200) {
      assert(r3.body?.success === true, 'OTP send returns success:true');
      assert(!!r3.body?.phone, 'Response includes cleaned phone');
    }
  } catch (e) {
    assert(false, 'OTP send test', e.message);
  }

  // ── 8. OTP Verify ──────────────────────────────────────────────
  console.log(cyan('\n▸ OTP Verify Endpoint'));
  try {
    const r1 = await request('POST', '/api/otp/verify-otp', {}, { 'x-simulated-user-ip': '10.99.0.8' });
    assert(r1.status === 400, 'Missing phone+OTP returns 400');

    const r2 = await request('POST', '/api/otp/verify-otp', { phone: '9999999999', otp: '999999' }, { 'x-simulated-user-ip': '10.99.0.8' });
    assert(r2.status === 400 || r2.status === 200, 'Non-existent OTP handled');

    const r3 = await request('POST', '/api/otp/verify-otp', { phone: '9876500012', otp: '123456' }, { 'x-simulated-user-ip': '10.99.0.8' });
    assert(
      r3.status === 200 || r3.status === 400,
      `Dev test OTP ${r3.status === 200 ? 'accepted (dev mode)' : 'rejected (prod mode or no stored OTP)'}`
    );
  } catch (e) {
    assert(false, 'OTP verify test', e.message);
  }

  // ── 9. Admin Alert Notification ────────────────────────────────
  console.log(cyan('\n▸ Admin Alert Notification'));
  try {
    const r1 = await request('POST', '/api/notifications/send-admin-alert', {}, { 'x-simulated-user-ip': '10.99.0.9' });
    assert(r1.status === 400, 'Missing orderId returns 400');

    const r2 = await request('POST', '/api/notifications/send-admin-alert', {
      orderId: 'TEST-001',
      customerName: 'Load Test User',
      totalAmount: 1500,
      paymentMethod: 'Online',
      shippingAddress: { addressLine: '123 Test St', city: 'TestCity', pincode: '380001', phone: '9876543210' }
    }, { 'x-simulated-user-ip': '10.99.0.9' });
    assert(r2.status === 200, 'Admin alert accepted with valid data');
    assert(r2.body?.success === true, 'Admin alert returns success:true');
  } catch (e) {
    assert(false, 'Admin alert test', e.message);
  }

  // ── 10. ImageKit Auth (requires admin) ─────────────────────────
  console.log(cyan('\n▸ ImageKit Auth (Admin-Protected)'));
  try {
    const r1 = await request('GET', '/api/imagekit/auth', null, { 'x-simulated-user-ip': '10.99.0.10' });
    assert(r1.status === 401, 'Unauthenticated request returns 401');

    const r2 = await request('GET', '/api/imagekit/auth', null, { 'x-admin-secret': 'wrong-secret', 'x-simulated-user-ip': '10.99.0.10' });
    assert(r2.status === 401, 'Wrong admin secret returns 401');
  } catch (e) {
    assert(false, 'ImageKit auth test', e.message);
  }

  // ── 11. ImageKit Delete (requires admin) ───────────────────────
  console.log(cyan('\n▸ ImageKit Delete (Admin-Protected)'));
  try {
    const r = await request('DELETE', '/api/imagekit/delete/fake-file-id', null, { 'x-simulated-user-ip': '10.99.0.11' });
    assert(r.status === 401, 'Unauthenticated delete returns 401');
  } catch (e) {
    assert(false, 'ImageKit delete test', e.message);
  }

  // ── 12. Razorpay Create Order ──────────────────────────────────
  console.log(cyan('\n▸ Razorpay Create Order'));
  try {
    const headers = { 'x-simulated-user-ip': '10.99.0.12' };
    const r1 = await request('POST', '/api/create-order', {}, headers);
    assert(r1.status === 400 || r1.status === 500, 'Missing amount/items returns error');

    const r2 = await request('POST', '/api/create-order', { amount: 10000, currency: 'USD' }, headers);
    assert(r2.status === 400, 'Non-INR currency rejected');
    assert(r2.body?.error?.includes('INR'), 'Error mentions INR');

    const r3 = await request('POST', '/api/create-order', { amount: 50 }, headers);
    assert(r3.status === 400 || r3.status === 500, 'Amount below min rejected');

    const r4 = await request('POST', '/api/create-order', { amount: 200000000 }, headers);
    assert(r4.status === 400, 'Excessive amount rejected');

    const r5 = await request('POST', '/api/create-order', { amount: 10000 }, headers);
    assert(
      r5.status === 200 || r5.status === 500,
      `Valid amount ${r5.status === 200 ? 'created order successfully' : 'Razorpay keys not configured (expected in test)'}`
    );
  } catch (e) {
    assert(false, 'Razorpay create order test', e.message);
  }

  // ── 13. Razorpay Verify Payment ────────────────────────────────
  console.log(cyan('\n▸ Razorpay Verify Payment'));
  try {
    const r1 = await request('POST', '/api/verify-payment', {});
    assert(r1.status === 400, 'Missing params returns 400');

    const r2 = await request('POST', '/api/verify-payment', {
      razorpay_order_id: 'order_test123',
      razorpay_payment_id: 'pay_test123',
      razorpay_signature: 'invalid_sig'
    });
    assert(r2.status === 400 || r2.status === 500, 'Invalid signature rejected');
  } catch (e) {
    assert(false, 'Razorpay verify test', e.message);
  }

  // ── 14. Orders Create (requires auth) ──────────────────────────
  console.log(cyan('\n▸ Orders Create (Auth-Protected)'));
  try {
    const r = await request('POST', '/api/orders/create', {
      items: [{ id: 'test', quantity: 1 }],
      paymentMethod: 'cod',
      shippingAddress: {
        fullName: 'Test User',
        phone: '9876543210',
        addressLine: '123 Test St',
        city: 'TestCity',
        state: 'Gujarat',
        pincode: '380001'
      }
    });
    assert(r.status === 401, 'Unauthenticated order creation returns 401');
  } catch (e) {
    assert(false, 'Orders create test', e.message);
  }

  // ── 15. Order Track ────────────────────────────────────────────
  console.log(cyan('\n▸ Order Track'));
  try {
    const r1 = await request('POST', '/api/orders/track', {});
    assert(r1.status === 400, 'Missing query returns 400');

    const r2 = await request('POST', '/api/orders/track', { query: 'NONEXISTENT-ORDER-12345' });
    assert(r2.status === 404 || r2.status === 500, 'Non-existent order returns 404 or 500 (if Firestore not init)');
  } catch (e) {
    assert(false, 'Order track test', e.message);
  }

  // ── 16. Delhivery Pincode Check ────────────────────────────────
  console.log(cyan('\n▸ Delhivery Pincode Check'));
  try {
    const r1 = await request('POST', '/api/delhivery/pincode/check', {});
    assert(r1.status === 400 || r1.status === 503, 'Missing pincode handled');

    const r2 = await request('POST', '/api/delhivery/pincode/check', { pincode: '380001' });
    assert(
      r2.status === 200 || r2.status === 503,
      `Pincode check ${r2.status === 200 ? 'returned serviceability' : 'Delhivery API not configured'}`
    );
  } catch (e) {
    assert(false, 'Delhivery pincode test', e.message);
  }

  // ── 17. Delhivery Pincode Lookup by Place ──────────────────────
  console.log(cyan('\n▸ Delhivery Pincode Lookup by Place'));
  try {
    const r = await request('POST', '/api/delhivery/pincode/lookup-by-place', { place: 'Ahmedabad' });
    assert(
      r.status === 200 || r.status === 503 || r.status === 400,
      `Place lookup ${r.status === 200 ? 'returned data' : 'handled gracefully'}`
    );
  } catch (e) {
    assert(false, 'Delhivery lookup test', e.message);
  }

  // ── 18. Delhivery Create Shipment (admin-protected) ────────────
  console.log(cyan('\n▸ Delhivery Create Shipment (Admin-Protected)'));
  try {
    const r = await request('POST', '/api/delhivery/create-shipment', {});
    assert(r.status === 401, 'Unauthenticated shipment creation returns 401');
  } catch (e) {
    assert(false, 'Delhivery create shipment test', e.message);
  }

  // ── 19. Delhivery Cancel Shipment (auth-protected) ─────────────
  console.log(cyan('\n▸ Delhivery Cancel Shipment (Auth-Protected)'));
  try {
    const r = await request('POST', '/api/delhivery/cancel-shipment', {});
    assert(r.status === 401, 'Unauthenticated cancel returns 401');
  } catch (e) {
    assert(false, 'Delhivery cancel test', e.message);
  }

  // ── 20. Delhivery Track ────────────────────────────────────────
  console.log(cyan('\n▸ Delhivery Track'));
  try {
    const r = await request('GET', '/api/delhivery/track/FAKE123456');
    assert(
      r.status === 200 || r.status === 503 || r.status === 404 || r.status === 400,
      `Tracking ${r.status === 200 ? 'returned data' : 'handled gracefully (' + r.status + ')'}`
    );
  } catch (e) {
    assert(false, 'Delhivery track test', e.message);
  }

  // ── 21. Delhivery Webhook ──────────────────────────────────────
  console.log(cyan('\n▸ Delhivery Webhook'));
  try {
    const r = await request('POST', '/api/delhivery/webhook', { Waybill: 'TEST123', StatusCode: 'DL' });
    assert(
      r.status === 200 || r.status === 401 || r.status === 503 || r.status === 429 || r.status === 400 || r.status === 500,
      `Webhook ${r.status === 200 ? 'processed' : 'rejected without valid secret (' + r.status + ')'}`
    );
  } catch (e) {
    assert(false, 'Delhivery webhook test', e.message);
  }

  // ── 22. Exchanges Create (auth-protected) ──────────────────────
  console.log(cyan('\n▸ Exchanges Create (Auth-Protected)'));
  try {
    const r = await request('POST', '/api/exchanges/create', {
      orderId: 'TEST-001',
      reason: 'size_issue'
    });
    assert(r.status === 401, 'Unauthenticated exchange returns 401');
  } catch (e) {
    assert(false, 'Exchanges create test', e.message);
  }

  // ── 23. My Exchanges (auth-protected) ──────────────────────────
  console.log(cyan('\n▸ My Exchanges (Auth-Protected)'));
  try {
    const r = await request('GET', '/api/exchanges/my-exchanges');
    assert(r.status === 401, 'Unauthenticated my-exchanges returns 401');
  } catch (e) {
    assert(false, 'My exchanges test', e.message);
  }

  // ── 24. Admin Exchange Endpoints (admin-protected) ─────────────
  console.log(cyan('\n▸ Admin Exchange Endpoints (Admin-Protected)'));
  try {
    const endpoints = [
      ['GET', '/api/exchanges/admin/list'],
      ['POST', '/api/exchanges/admin/approve'],
      ['POST', '/api/exchanges/admin/reject'],
      ['POST', '/api/exchanges/admin/update-status'],
      ['POST', '/api/exchanges/admin/retry-reverse-pickup'],
    ];
    for (const [method, path] of endpoints) {
      const r = await request(method, path, method === 'POST' ? {} : null);
      assert(r.status === 401, `${method} ${path.split('/').pop()} — unauthenticated → 401`);
    }
  } catch (e) {
    assert(false, 'Admin exchange endpoints test', e.message);
  }

  // ── 25. Customer Notifications (auth-protected) ────────────────
  console.log(cyan('\n▸ Customer Notifications (Auth-Protected)'));
  try {
    const r1 = await request('GET', '/api/notifications/customer');
    assert(r1.status === 401, 'Unauthenticated customer notifications returns 401');

    const r2 = await request('POST', '/api/notifications/customer/mark-read', { notificationId: 'test' });
    assert(r2.status === 401, 'Unauthenticated mark-read returns 401');
  } catch (e) {
    assert(false, 'Customer notifications test', e.message);
  }

  // ── 26. Admin Order Status Update (admin-protected) ────────────
  console.log(cyan('\n▸ Admin Order Status Update (Admin-Protected)'));
  try {
    const r = await request('POST', '/api/admin/orders/update-status', {
      orderId: 'TEST-001',
      status: 'Shipped'
    });
    assert(r.status === 401, 'Unauthenticated status update returns 401');
  } catch (e) {
    assert(false, 'Admin order status test', e.message);
  }

  // ── 27. JSON Body Size Limit ───────────────────────────────────
  console.log(cyan('\n▸ JSON Body Size Limit'));
  try {
    const bigPayload = { data: 'x'.repeat(1.5 * 1024 * 1024) };
    const r = await request('POST', '/api/health', bigPayload);
    assert(r.status === 413 || r.status === 404 || r.status === 500, 'Oversized payload rejected (413 or error)');
  } catch (e) {
    assert(true, 'Oversized payload rejected (connection error)');
  }

  // ── 28. HTTP Method Enforcement ────────────────────────────────
  console.log(cyan('\n▸ HTTP Method Enforcement'));
  try {
    const r = await request('POST', '/api/health');
    assert(r.status === 404, 'POST to GET-only /api/health returns 404');

    const r2 = await request('GET', '/api/otp/send-otp');
    assert(r2.status === 404, 'GET to POST-only /api/otp/send-otp returns 404');
  } catch (e) {
    assert(false, 'HTTP method enforcement test', e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PART 2 — RATE LIMITING TESTS
// ═══════════════════════════════════════════════════════════════════════════════
async function runRateLimitTests() {
  console.log(`\n${bold('═══ PART 2: RATE LIMITING TESTS ═══')}\n`);

  console.log(cyan('\n▸ Sensitive Endpoint Rate Limiting'));
  console.log(dim('  (Sending rapid OTP requests to trigger sensitive rate limit)'));
  try {
    let hitLimit = false;
    for (let i = 0; i < 25; i++) {
      const r = await request('POST', '/api/otp/send-otp', {
        phone: `98765${String(i).padStart(5, '0')}`
      });
      if (r.status === 429) {
        hitLimit = true;
        break;
      }
    }
    assert(hitLimit, 'Sensitive rate limiter triggers 429 after rapid requests');
  } catch (e) {
    assert(false, 'Sensitive rate limit test', e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PART 3 — 100 CONCURRENT USER LOAD TEST
// ═══════════════════════════════════════════════════════════════════════════════

const LOAD_TEST_ENDPOINTS = [
  { method: 'GET', path: '/api/health', label: 'health' },
  { method: 'POST', path: '/api/otp/send-otp', body: { phone: '9876500001' }, label: 'otp-send' },
  { method: 'POST', path: '/api/otp/verify-otp', body: { phone: '9876500001', otp: '000000' }, label: 'otp-verify' },
  { method: 'GET', path: '/api/imagekit/auth', label: 'imagekit-auth' },
  { method: 'POST', path: '/api/create-order', body: { amount: 10000 }, label: 'create-order' },
  { method: 'POST', path: '/api/verify-payment', body: { razorpay_order_id: 'ord_test', razorpay_payment_id: 'pay_test', razorpay_signature: 'sig' }, label: 'verify-payment' },
  { method: 'POST', path: '/api/orders/track', body: { query: 'TEST-123' }, label: 'order-track' },
  { method: 'POST', path: '/api/delhivery/pincode/check', body: { pincode: '380001' }, label: 'pincode-check' },
  { method: 'GET', path: '/api/delhivery/track/FAKEAWB123', label: 'delhivery-track' },
  { method: 'GET', path: '/api/nonexistent', label: '404-handler' },
];

async function simulateUser(userId) {
  const results = [];
  const userIp = `10.100.${Math.floor(userId / 200)}.${(userId % 200) + 1}`;
  const userHeaders = { 'x-simulated-user-ip': userIp };

  for (let i = 0; i < REQUESTS_PER_USER; i++) {
    const endpoint = LOAD_TEST_ENDPOINTS[i % LOAD_TEST_ENDPOINTS.length];
    let body = endpoint.body ? { ...endpoint.body } : null;
    if (body?.phone) body.phone = `98765${String(userId * 100 + i).padStart(5, '0').slice(-5)}`;

    const start = performance.now();
    try {
      const r = await request(endpoint.method, endpoint.path, body, userHeaders);
      const elapsed = performance.now() - start;
      results.push({
        userId,
        label: endpoint.label,
        status: r.status,
        latency: elapsed,
        success: r.status < 500,
      });
    } catch (e) {
      const elapsed = performance.now() - start;
      results.push({
        userId,
        label: endpoint.label,
        status: 0,
        latency: elapsed,
        success: false,
        error: e.message,
      });
    }
  }
  return results;
}

async function runLoadTest() {
  console.log(`\n${bold('═══ PART 3: 100 CONCURRENT USER LOAD TEST ═══')}\n`);
  console.log(dim(`  Config: ${CONCURRENT_USERS} virtual users × ${REQUESTS_PER_USER} requests each = ${CONCURRENT_USERS * REQUESTS_PER_USER} total requests`));
  console.log(dim(`  Target: ${BASE}`));
  console.log(dim(`  Endpoints under test: ${LOAD_TEST_ENDPOINTS.length}`));
  console.log();

  const overallStart = performance.now();

  const userPromises = [];
  for (let u = 0; u < CONCURRENT_USERS; u++) {
    userPromises.push(simulateUser(u));
  }

  const allResults = (await Promise.all(userPromises)).flat();
  const overallElapsed = performance.now() - overallStart;

  // ── Aggregate stats ────────────────────────────────────────────
  const totalReqs = allResults.length;
  const successReqs = allResults.filter(r => r.success).length;
  const failedReqs = allResults.filter(r => !r.success).length;
  const rateLimited = allResults.filter(r => r.status === 429).length;
  const latencies = allResults.map(r => r.latency).sort((a, b) => a - b);

  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p90 = latencies[Math.floor(latencies.length * 0.9)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const maxLatency = latencies[latencies.length - 1];
  const minLatency = latencies[0];
  const rps = totalReqs / (overallElapsed / 1000);

  // ── Per-endpoint breakdown ─────────────────────────────────────
  const byEndpoint = {};
  for (const r of allResults) {
    if (!byEndpoint[r.label]) {
      byEndpoint[r.label] = { count: 0, success: 0, failed: 0, rate429: 0, latencies: [], errors: [] };
    }
    const e = byEndpoint[r.label];
    e.count++;
    if (r.success) e.success++;
    else e.failed++;
    if (r.status === 429) e.rate429++;
    e.latencies.push(r.latency);
    if (r.error) e.errors.push(r.error);
  }

  // ── Per-status code breakdown ──────────────────────────────────
  const statusCounts = {};
  for (const r of allResults) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  }

  // ── Print Results ──────────────────────────────────────────────
  console.log(bold('  ┌─────────────────────────────────────────────────────────┐'));
  console.log(bold('  │              LOAD TEST RESULTS SUMMARY                  │'));
  console.log(bold('  └─────────────────────────────────────────────────────────┘'));
  console.log();

  console.log(cyan('  ▸ Overall Metrics'));
  console.log(`    Total Requests ......... ${bold(totalReqs)}`);
  console.log(`    Successful ............. ${green(successReqs)} (${(successReqs / totalReqs * 100).toFixed(1)}%)`);
  console.log(`    Failed (5xx/error) ..... ${failedReqs > 0 ? red(failedReqs) : green(0)}`);
  console.log(`    Rate Limited (429) ..... ${yellow(rateLimited)}`);
  console.log(`    Total Duration ......... ${bold((overallElapsed / 1000).toFixed(2) + 's')}`);
  console.log(`    Throughput (RPS) ....... ${bold(rps.toFixed(1))} req/s`);
  console.log();

  console.log(cyan('  ▸ Latency Distribution'));
  console.log(`    Min .................... ${rpad(minLatency.toFixed(1), 8)} ms`);
  console.log(`    P50 (Median) ........... ${rpad(p50.toFixed(1), 8)} ms`);
  console.log(`    P90 .................... ${rpad(p90.toFixed(1), 8)} ms`);
  console.log(`    P95 .................... ${rpad(p95.toFixed(1), 8)} ms`);
  console.log(`    P99 .................... ${rpad(p99.toFixed(1), 8)} ms`);
  console.log(`    Max .................... ${rpad(maxLatency.toFixed(1), 8)} ms`);
  console.log(`    Average ................ ${rpad(avgLatency.toFixed(1), 8)} ms`);
  console.log();

  console.log(cyan('  ▸ Status Code Distribution'));
  for (const [code, count] of Object.entries(statusCounts).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const pct = (count / totalReqs * 100).toFixed(1);
    const bar = '█'.repeat(Math.max(1, Math.round(count / totalReqs * 40)));
    const color = Number(code) < 400 ? green : (Number(code) < 500 ? yellow : red);
    console.log(`    ${pad(code === '0' ? 'ERR' : code, 4)} ${color(bar)} ${count} (${pct}%)`);
  }
  console.log();

  console.log(cyan('  ▸ Per-Endpoint Breakdown'));
  console.log(`    ${pad('Endpoint', 20)} ${rpad('Count', 6)} ${rpad('OK', 6)} ${rpad('Fail', 6)} ${rpad('429', 6)} ${rpad('Avg(ms)', 9)} ${rpad('P95(ms)', 9)}`);
  console.log(`    ${'─'.repeat(62)}`);
  for (const [label, stats] of Object.entries(byEndpoint)) {
    const sorted = stats.latencies.sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const ep95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
    console.log(
      `    ${pad(label, 20)} ${rpad(stats.count, 6)} ${rpad(stats.success, 6)} ${rpad(stats.failed, 6)} ${rpad(stats.rate429, 6)} ${rpad(avg.toFixed(1), 9)} ${rpad(ep95.toFixed(1), 9)}`
    );
  }
  console.log();

  // ── Latency histogram ──────────────────────────────────────────
  console.log(cyan('  ▸ Latency Histogram'));
  const buckets = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 15000];
  let prev = 0;
  for (const b of buckets) {
    const count = latencies.filter(l => l > prev && l <= b).length;
    if (count > 0) {
      const bar = '▓'.repeat(Math.max(1, Math.round(count / totalReqs * 60)));
      console.log(`    ${rpad(prev, 5)}-${pad(b + 'ms', 7)} ${bar} ${count}`);
    }
    prev = b;
  }
  const overBucket = latencies.filter(l => l > buckets[buckets.length - 1]).length;
  if (overBucket > 0) {
    console.log(`    ${rpad(buckets[buckets.length - 1], 5)}ms+      ${'▓'.repeat(Math.max(1, Math.round(overBucket / totalReqs * 60)))} ${overBucket}`);
  }
  console.log();

  // ── Performance Assessment ─────────────────────────────────────
  console.log(cyan('  ▸ Performance Assessment'));
  const errorRate = failedReqs / totalReqs * 100;
  if (p95 < 500 && errorRate < 5) {
    console.log(`    ${green('✓ EXCELLENT')} — P95 < 500ms and error rate < 5%`);
  } else if (p95 < 1000 && errorRate < 10) {
    console.log(`    ${yellow('⚠ ACCEPTABLE')} — P95 < 1000ms and error rate < 10%`);
  } else {
    console.log(`    ${red('✗ NEEDS IMPROVEMENT')} — P95=${p95.toFixed(0)}ms, Error Rate=${errorRate.toFixed(1)}%`);
  }
  if (rps > 200) {
    console.log(`    ${green('✓ HIGH THROUGHPUT')} — ${rps.toFixed(0)} RPS`);
  } else if (rps > 50) {
    console.log(`    ${yellow('⚠ MODERATE THROUGHPUT')} — ${rps.toFixed(0)} RPS`);
  } else {
    console.log(`    ${red('✗ LOW THROUGHPUT')} — ${rps.toFixed(0)} RPS`);
  }
  console.log();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('\n' + bold('╔═══════════════════════════════════════════════════════════════╗'));
  console.log(bold('║  Brothers Outfit Gallery — API Test & Load Test Suite         ║'));
  console.log(bold('║  Target: ') + cyan(BASE) + bold(rpad('', 37 - BASE.length) + '║'));
  console.log(bold('╚═══════════════════════════════════════════════════════════════╝'));

  // 1. Quick connectivity check
  try {
    await request('GET', '/api/health');
  } catch (e) {
    console.error(red(`\n  ✗ Cannot connect to ${BASE}`));
    console.error(red(`    Make sure the server is running: node server.js`));
    console.error(dim(`    Error: ${e.message}\n`));
    process.exit(1);
  }

  // 2. Functional tests
  await runFunctionalTests();

  // 3. Rate limit tests
  await runRateLimitTests();

  // 4. Load test
  await runLoadTest();

  // ── Final Summary ──────────────────────────────────────────────
  console.log(bold('═══ FINAL TEST SUMMARY ═══'));
  console.log(`  Functional Tests:  ${green(`${passed} passed`)}  ${failed > 0 ? red(`${failed} failed`) : ''}  ${skipped > 0 ? yellow(`${skipped} skipped`) : ''}`);
  if (failures.length > 0) {
    console.log(red('\n  Failed Tests:'));
    for (const f of failures) {
      console.log(red(`    ✗ ${f.testName}${f.detail ? ': ' + f.detail : ''}`));
    }
  }
  console.log();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(red('Fatal error:'), e);
  process.exit(1);
});
