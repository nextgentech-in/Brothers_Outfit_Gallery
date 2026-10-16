/**
 * High-Concurrency Load Test: 100 Concurrent Users against Brothers Outfit Gallery APIs
 */
import http from 'http';
import app from '../server.js';

const TEST_PORT = 3099;
const CONCURRENT_USERS = 100;
const TOTAL_REQUESTS = 1000;

const PINCODES = ['383001', '110001', '400001', '560001', '700001', '600001', '500001', '380001'];
const PLACES = ['Himatnagar', 'Ahmedabad', 'Mumbai', 'Delhi', 'Bengaluru', 'Pune'];
const POS_TOKEN = process.env.POS_SYNC_API_TOKEN || 'ee33921811cd0fa33a0bcf056a21665a25472aeafa84cda10396323c5c37afffc55c420a827fbc461a5d74d652741df2';

// Helper to make fast HTTP requests
function makeRequest(path, method = 'GET', body = null, extraHeaders = {}) {
  return new Promise((resolve) => {
    const start = performance.now();
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path,
      method,
      headers: {
        'Accept': 'application/json',
        ...extraHeaders,
        ...(payload ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        const duration = performance.now() - start;
        // Accept standard valid HTTP codes: 2xx (OK), 3xx (Redirect), or expected 404 for non-existent order
        const isSuccess = (res.statusCode >= 200 && res.statusCode < 400) || (res.statusCode === 404 && path.includes('/orders/track'));
        resolve({
          status: res.statusCode,
          duration,
          success: isSuccess,
          endpoint: path
        });
      });
    });

    req.on('error', (err) => {
      const duration = performance.now() - start;
      resolve({
        status: 500,
        duration,
        success: false,
        error: err.message,
        endpoint: path
      });
    });

    if (payload) req.write(payload);
    req.end();
  });
}

async function runLoadTest() {
  console.log('='.repeat(65));
  console.log(`🚀 STARTING API STRESS & LOAD TEST: ${CONCURRENT_USERS} CONCURRENT USERS`);
  console.log(`🎯 TARGET: ${TOTAL_REQUESTS} TOTAL REQUESTS ACROSS ALL CORE BACKEND ENDPOINTS`);
  console.log('='.repeat(65));

  // 1. Start test server
  const server = app.listen(TEST_PORT);
  await new Promise(r => setTimeout(r, 600));

  const endpointsScenarios = [
    (userId) => makeRequest('/api/health', 'GET', null, { 'x-simulated-user-ip': `10.0.0.${userId}` }),
    (userId) => {
      const pin = PINCODES[Math.floor(Math.random() * PINCODES.length)];
      return makeRequest('/api/delhivery/pincode/check', 'POST', { pincode: pin }, { 'x-simulated-user-ip': `10.0.0.${userId}` });
    },
    (userId) => {
      const place = PLACES[Math.floor(Math.random() * PLACES.length)];
      return makeRequest('/api/delhivery/pincode/lookup-by-place', 'POST', { place }, { 'x-simulated-user-ip': `10.0.0.${userId}` });
    },
    (userId) => makeRequest('/api/orders/track', 'POST', { orderId: 'BO-TEST-1234' }, { 'x-simulated-user-ip': `10.0.0.${userId}` }),
    (userId) => makeRequest('/api/pos/stock-changes?limit=20', 'GET', null, {
      'Authorization': `Bearer ${POS_TOKEN}`,
      'x-simulated-user-ip': `10.0.0.${userId}`
    })
  ];

  const results = [];
  let completed = 0;
  const overallStart = performance.now();

  // Concurrent worker loop executing 100 parallel user tasks
  async function worker(userId) {
    while (completed < TOTAL_REQUESTS) {
      completed++;
      const scenarioIndex = (userId + completed) % endpointsScenarios.length;
      const res = await endpointsScenarios[scenarioIndex](userId);
      results.push(res);
    }
  }

  // Launch 100 concurrent user sessions
  const workers = [];
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    workers.push(worker(i));
  }
  await Promise.all(workers);

  const overallDuration = (performance.now() - overallStart) / 1000;
  server.close();

  // Calculate metrics
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const successRate = ((successful / results.length) * 100).toFixed(2);
  const durations = results.map(r => r.duration).sort((a, b) => a - b);
  const avgLatency = (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2);
  const p50 = durations[Math.floor(durations.length * 0.50)].toFixed(2);
  const p90 = durations[Math.floor(durations.length * 0.90)].toFixed(2);
  const p95 = durations[Math.floor(durations.length * 0.95)].toFixed(2);
  const p99 = durations[Math.floor(durations.length * 0.99)].toFixed(2);
  const rps = (results.length / overallDuration).toFixed(2);

  // Group by endpoint
  const endpointMap = {};
  results.forEach(r => {
    const key = r.endpoint.split('?')[0];
    if (!endpointMap[key]) {
      endpointMap[key] = { count: 0, successes: 0, totalMs: 0 };
    }
    endpointMap[key].count++;
    if (r.success) endpointMap[key].successes++;
    endpointMap[key].totalMs += r.duration;
  });

  console.log('\n📊 LOAD TEST RESULTS SUMMARY:');
  console.log(`- Simulated Concurrent Users : ${CONCURRENT_USERS}`);
  console.log(`- Total Requests Completed   : ${results.length}`);
  console.log(`- Total Test Duration        : ${overallDuration.toFixed(2)}s`);
  console.log(`- Throughput (RPS)           : ${rps} req/sec`);
  console.log(`- Success Rate               : ${successRate}% (${successful} passed, ${failed} failed)`);
  console.log(`- Average Latency            : ${avgLatency}ms`);
  console.log(`- Median Latency (p50)       : ${p50}ms`);
  console.log(`- 90th Percentile (p90)      : ${p90}ms`);
  console.log(`- 95th Percentile (p95)      : ${p95}ms`);
  console.log(`- 99th Percentile (p99)      : ${p99}ms`);

  console.log('\n📈 ENDPOINT BREAKDOWN:');
  console.log('Endpoint'.padEnd(38) + 'Requests'.padEnd(12) + 'Success'.padEnd(12) + 'Avg Latency');
  console.log('-'.repeat(74));
  for (const [ep, stat] of Object.entries(endpointMap)) {
    const epAvg = (stat.totalMs / stat.count).toFixed(1) + 'ms';
    const epSuccess = `${((stat.successes / stat.count) * 100).toFixed(0)}%`;
    console.log(ep.padEnd(38) + String(stat.count).padEnd(12) + epSuccess.padEnd(12) + epAvg);
  }
  console.log('='.repeat(65));
}

runLoadTest().catch(console.error);
