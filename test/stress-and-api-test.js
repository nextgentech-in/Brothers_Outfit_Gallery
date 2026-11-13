import http from 'http';
import { performance } from 'perf_hooks';

// Ensure test environment so server.js doesn't auto-bind to default port
process.env.NODE_ENV = 'test';

const { default: app } = await import('../server.js');

// High-capacity HTTP agent configured for high concurrency
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 1000,
  maxFreeSockets: 500,
  timeout: 30000
});

// Start an in-memory HTTP server with a 2048 socket backlog
const server = http.createServer(app);

await new Promise((resolve, reject) => {
  server.listen(0, '127.0.0.1', 2048, (err) => {
    if (err) reject(err);
    else resolve();
  });
});

const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;
console.log(`\n===============================================================`);
console.log(`🚀 BROTHERS OUTFIT API SUITE & 500 CONCURRENT USERS STRESS TEST`);
console.log(`===============================================================`);
console.log(`Server listening on temporary port: ${port}`);
console.log(`Target Base URL: ${baseUrl}\n`);

// Robust request helper with micro-retry on Windows TCP SYN backlog drops
function makeRequest(method, path, body = null, headers = {}, retries = 3) {
  return new Promise((resolve) => {
    const execute = (attempt) => {
      const t0 = performance.now();
      const payload = body ? JSON.stringify(body) : null;
      
      const reqHeaders = {
        'Content-Type': 'application/json',
        'Connection': 'keep-alive',
        ...headers
      };

      if (payload) {
        reqHeaders['Content-Length'] = Buffer.byteLength(payload);
      }

      const req = http.request({
        hostname: '127.0.0.1',
        port: port,
        path: path,
        method: method,
        headers: reqHeaders,
        agent: httpAgent,
        timeout: 15000
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          const t1 = performance.now();
          let parsed = null;
          try { parsed = JSON.parse(data); } catch (_) {}
          resolve({
            status: res.statusCode,
            duration: t1 - t0,
            headers: res.headers,
            data: parsed,
            error: null
          });
        });
      });

      req.on('error', (err) => {
        if (attempt < retries && (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET')) {
          setTimeout(() => execute(attempt + 1), 5 + Math.random() * 10);
        } else {
          const t1 = performance.now();
          resolve({
            status: 0,
            duration: t1 - t0,
            headers: null,
            data: null,
            error: err.message
          });
        }
      });

      req.on('timeout', () => {
        req.destroy();
        const t1 = performance.now();
        resolve({
          status: 0,
          duration: t1 - t0,
          headers: null,
          data: null,
          error: 'Socket timeout'
        });
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    };

    execute(0);
  });
}

// ============================================================================
// PART 1: FUNCTIONAL API ENDPOINT VALIDATION (ALL APIS)
// ============================================================================
console.log(`--- [PART 1/2] TESTING ALL API ENDPOINTS (FUNCTIONAL VERIFICATION) ---`);

const apiTests = [
  // 1. Health & Core
  { name: 'Health check', method: 'GET', path: '/api/health', expectedStatus: [200] },
  
  // 2. Public Serviceability & Logistics
  { name: 'Delhivery pincode check', method: 'POST', path: '/api/delhivery/pincode/check', body: { pincode: '380001' }, expectedStatus: [200, 400] },
  { name: 'Delhivery pincode lookup', method: 'POST', path: '/api/delhivery/pincode/lookup-by-place', body: { city: 'Ahmedabad' }, expectedStatus: [200, 400] },
  { name: 'Delhivery track (sample waybill)', method: 'GET', path: '/api/delhivery/track/SAMPLE123', expectedStatus: [200, 400, 404] },

  // 3. Public Order & Payment Validation
  { name: 'Create Razorpay order (invalid payload validation)', method: 'POST', path: '/api/create-order', body: { amount: -100 }, expectedStatus: [400] },
  { name: 'Verify payment (missing signature validation)', method: 'POST', path: '/api/verify-payment', body: {}, expectedStatus: [400] },
  { name: 'Order tracking (invalid order lookup)', method: 'POST', path: '/api/orders/track', body: { orderId: 'NON_EXISTENT', phone: '0000000000' }, expectedStatus: [400, 404] },

  // 4. OTP Endpoints (Validation)
  { name: 'Send OTP (invalid phone validation)', method: 'POST', path: '/api/otp/send-otp', body: { phone: '123' }, expectedStatus: [400] },
  { name: 'Verify OTP (empty code validation)', method: 'POST', path: '/api/otp/verify-otp', body: { phone: '9876543210', otp: '' }, expectedStatus: [400] },

  // 5. Protected User & Admin Endpoints (Must safely reject with 401 Unauthorized)
  { name: 'Admin status check [AUTH GUARD]', method: 'GET', path: '/api/auth/admin-status', expectedStatus: [401] },
  { name: 'Admin settings update [AUTH GUARD]', method: 'POST', path: '/api/admin/settings', body: {}, expectedStatus: [401] },
  { name: 'Admin product upsert [AUTH GUARD]', method: 'POST', path: '/api/admin/products/upsert', body: {}, expectedStatus: [401] },
  { name: 'Admin inventory set [AUTH GUARD]', method: 'POST', path: '/api/admin/inventory/set', body: {}, expectedStatus: [401] },
  { name: 'Admin POS status check [AUTH GUARD]', method: 'GET', path: '/api/admin/pos/status', expectedStatus: [401] },
  { name: 'Admin POS reconcile [AUTH GUARD]', method: 'POST', path: '/api/admin/pos/reconcile', body: {}, expectedStatus: [401] },
  { name: 'Admin ImageKit auth token [AUTH GUARD]', method: 'GET', path: '/api/imagekit/auth', expectedStatus: [401] },
  { name: 'Order creation [AUTH GUARD]', method: 'POST', path: '/api/orders/create', body: {}, expectedStatus: [401] },
  { name: 'Delhivery create shipment [AUTH GUARD]', method: 'POST', path: '/api/delhivery/create-shipment', body: {}, expectedStatus: [401] },
  { name: 'Delhivery cancel shipment [AUTH GUARD]', method: 'POST', path: '/api/delhivery/cancel-shipment', body: {}, expectedStatus: [401] },
  { name: 'Exchange request creation [AUTH GUARD]', method: 'POST', path: '/api/exchanges/create', body: {}, expectedStatus: [401] },
  { name: 'Exchange user list [AUTH GUARD]', method: 'GET', path: '/api/exchanges/my-exchanges', expectedStatus: [401] },
  { name: 'Exchange admin list [AUTH GUARD]', method: 'GET', path: '/api/exchanges/admin/list', expectedStatus: [401] },
  { name: 'Exchange admin approval [AUTH GUARD]', method: 'POST', path: '/api/exchanges/admin/approve', body: {}, expectedStatus: [401] },
  { name: 'Customer notifications [AUTH GUARD]', method: 'GET', path: '/api/notifications/customer', expectedStatus: [401] },
  { name: 'Customer notifications mark-read [AUTH GUARD]', method: 'POST', path: '/api/notifications/customer/mark-read', body: {}, expectedStatus: [401] },
  { name: 'Order cancellation [AUTH GUARD]', method: 'POST', path: '/api/orders/cancel', body: {}, expectedStatus: [401] },
  { name: 'Admin update order status [AUTH GUARD]', method: 'POST', path: '/api/admin/orders/update-status', body: {}, expectedStatus: [401] },

  // 6. Deprecated POS Routing (Must return 410 Gone)
  { name: 'Deprecated POS direct endpoint', method: 'GET', path: '/api/pos', expectedStatus: [410] },

  // 7. Unmatched API Endpoint (Must return clean 404 JSON)
  { name: '404 Catch-All JSON error', method: 'GET', path: '/api/unmatched-route-xyz', expectedStatus: [404] }
];

let functionalPassed = 0;
let functionalFailed = 0;

for (const test of apiTests) {
  const res = await makeRequest(test.method, test.path, test.body, { 'x-simulated-user-ip': '127.0.0.1' });
  const passed = test.expectedStatus.includes(res.status);

  if (passed) {
    functionalPassed++;
    console.log(`  ✓ [${res.status}] ${test.method.padEnd(6)} ${test.path.padEnd(42)} (${res.duration.toFixed(1)}ms) - ${test.name}`);
  } else {
    functionalFailed++;
    console.log(`  ✗ [FAIL ${res.status}] ${test.method.padEnd(6)} ${test.path.padEnd(42)} Expected: ${test.expectedStatus.join(',')} (${test.duration.toFixed(1)}ms) - ${test.name}`);
  }
}

console.log(`\nFunctional Test Results: ${functionalPassed}/${apiTests.length} PASSED (Failures: ${functionalFailed})\n`);

// ============================================================================
// PART 2: 500 CONCURRENT USERS STRESS & LOAD TEST
// ============================================================================
const CONCURRENT_USERS = 500;
console.log(`--- [PART 2/2] STRESS TEST: SIMULATING ${CONCURRENT_USERS} CONCURRENT USERS AT ONCE ---`);
console.log(`Generating ${CONCURRENT_USERS} distinct simulated clients with unique IPs...`);
console.log(`Executing concurrent multi-endpoint user workflows simultaneously...\n`);

const memBefore = process.memoryUsage();
const stressStartTime = performance.now();

// Each simulated user runs a realistic multi-step user journey
async function simulateUserJourney(userId) {
  // Micro-jitter to simulate realistic concurrent arrivals over ~100ms
  const staggerMs = Math.floor(Math.random() * 80);
  if (staggerMs > 0) {
    await new Promise(r => setTimeout(r, staggerMs));
  }

  const octet3 = Math.floor(userId / 254);
  const octet4 = (userId % 254) + 1;
  const simulatedIp = `10.0.${octet3}.${octet4}`;

  const userHeaders = {
    'x-simulated-user-ip': simulatedIp,
    'User-Agent': `BrothersLoadTestBot/1.0 (User-${userId})`
  };

  const userLatencies = [];
  const userResults = [];

  // Call 1: Health check / ping
  const r1 = await makeRequest('GET', '/api/health', null, userHeaders, 5);
  userLatencies.push(r1.duration);
  userResults.push({ path: '/api/health', status: r1.status });

  // Call 2: Auth guard check (protected route test under high load)
  const r2 = await makeRequest('GET', '/api/auth/admin-status', null, userHeaders, 5);
  userLatencies.push(r2.duration);
  userResults.push({ path: '/api/auth/admin-status', status: r2.status });

  // Call 3: Pincode lookup validation
  const r3 = await makeRequest('POST', '/api/delhivery/pincode/lookup-by-place', { city: 'Ahmedabad' }, userHeaders, 5);
  userLatencies.push(r3.duration);
  userResults.push({ path: '/api/delhivery/pincode/lookup-by-place', status: r3.status });

  // Call 4: Deprecated POS route guard
  const r4 = await makeRequest('GET', '/api/pos', null, userHeaders, 5);
  userLatencies.push(r4.duration);
  userResults.push({ path: '/api/pos', status: r4.status });

  return {
    userId,
    ip: simulatedIp,
    latencies: userLatencies,
    results: userResults
  };
}

// Launch all 500 users concurrently at the exact same time
const userPromises = [];
for (let i = 1; i <= CONCURRENT_USERS; i++) {
  userPromises.push(simulateUserJourney(i));
}

const userOutputs = await Promise.all(userPromises);
const stressEndTime = performance.now();
const totalWallTimeMs = stressEndTime - stressStartTime;
const memAfter = process.memoryUsage();

// Aggregate metrics
const allLatencies = [];
const statusCounts = {};
let totalRequests = 0;
let totalErrors5xx = 0;

for (const user of userOutputs) {
  for (const lat of user.latencies) {
    allLatencies.push(lat);
  }
  for (const res of user.results) {
    totalRequests++;
    statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;
    if (res.status >= 500) {
      totalErrors5xx++;
    }
  }
}

allLatencies.sort((a, b) => a - b);

const minLatency = allLatencies[0];
const maxLatency = allLatencies[allLatencies.length - 1];
const sumLatency = allLatencies.reduce((a, b) => a + b, 0);
const avgLatency = sumLatency / allLatencies.length;
const p50 = allLatencies[Math.floor(allLatencies.length * 0.50)];
const p90 = allLatencies[Math.floor(allLatencies.length * 0.90)];
const p95 = allLatencies[Math.floor(allLatencies.length * 0.95)];
const p99 = allLatencies[Math.floor(allLatencies.length * 0.99)];
const requestsPerSec = (totalRequests / (totalWallTimeMs / 1000)).toFixed(1);

console.log(`===============================================================`);
console.log(`📊 500 CONCURRENT USERS STRESS TEST RESULTS`);
console.log(`===============================================================`);
console.log(`Concurrent Users Simulated : ${CONCURRENT_USERS}`);
console.log(`Total Requests Completed   : ${totalRequests}`);
console.log(`Wall Clock Execution Time  : ${(totalWallTimeMs / 1000).toFixed(2)} seconds`);
console.log(`Throughput (Requests/sec)  : ${requestsPerSec} req/sec`);
console.log(`Server Errors (5xx crashes): ${totalErrors5xx} (0 expected)`);
console.log(`Network / Connection Drops : ${statusCounts[0] || 0} (0 expected)`);
console.log(`\nHTTP Response Breakdown:`);
for (const [code, count] of Object.entries(statusCounts)) {
  const percent = ((count / totalRequests) * 100).toFixed(1);
  const label = code === '200' ? 'OK (Health/Pincode)' :
                code === '400' ? 'Bad Request (Expected Validation)' :
                code === '401' ? 'Unauthorized (Expected Auth Guard)' :
                code === '410' ? 'Gone (Deprecated Route)' :
                code === '429' ? 'Rate Limited' :
                code >= '500' ? 'Server Error' : 'Status';
  console.log(`  - HTTP ${code.padEnd(4)}: ${count.toString().padStart(5)} (${percent}%) - ${label}`);
}

console.log(`\nLatency Percentiles (Response Times):`);
console.log(`  - Min Latency       : ${minLatency.toFixed(1)} ms`);
console.log(`  - Average (Mean)    : ${avgLatency.toFixed(1)} ms`);
console.log(`  - 50th %ile (Median): ${p50.toFixed(1)} ms`);
console.log(`  - 90th %ile         : ${p90.toFixed(1)} ms`);
console.log(`  - 95th %ile         : ${p95.toFixed(1)} ms`);
console.log(`  - 99th %ile         : ${p99.toFixed(1)} ms`);
console.log(`  - Max Latency       : ${maxLatency.toFixed(1)} ms`);

console.log(`\nMemory Utilization:`);
console.log(`  - Heap Used Before  : ${(memBefore.heapUsed / 1024 / 1024).toFixed(1)} MB`);
console.log(`  - Heap Used After   : ${(memAfter.heapUsed / 1024 / 1024).toFixed(1)} MB`);
console.log(`  - RSS Footprint     : ${(memAfter.rss / 1024 / 1024).toFixed(1)} MB`);

// Gracefully close server
await new Promise(resolve => server.close(resolve));
httpAgent.destroy();
console.log(`\nServer successfully closed. Test complete.\n`);

if (functionalFailed > 0 || totalErrors5xx > 0 || (statusCounts[0] || 0) > 0) {
  process.exitCode = 1;
} else {
  process.exitCode = 0;
}
