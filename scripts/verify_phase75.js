import http from 'http';

function request(options, data) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const duration = performance.now() - start;
        resolve({ status: res.statusCode, headers: res.headers, body, duration });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function calculatePercentiles(latencies) {
  const sorted = [...latencies].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const median = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  return { min, max, mean, median, p95, p99 };
}

async function runPhase75Audit() {
  console.log('================================================================');
  console.log('FASE 7.5: AUDITORIA DE OPERAÇÃO CONTÍNUA, OBSERVABILIDADE E RESILIÊNCIA');
  console.log('================================================================\n');

  // 1. Health Check
  console.log('--- [1] Health Check & PostgreSQL Connectivity ---');
  const health = await request({ hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET' });
  console.log(`Status: ${health.status} (${health.duration.toFixed(2)}ms)`);
  console.log(`Body: ${health.body}`);
  const healthJson = JSON.parse(health.body);
  console.log(`PostgreSQL Status: ${healthJson.postgres === 'connected' ? 'CONNECTED (PASS)' : 'DISCONNECTED'}`);

  // 2. Latency Benchmarks with Percentiles (20 samples per endpoint)
  console.log('\n--- [2] Comprehensive Latency Benchmarks (20 iterations each) ---');
  const endpointsToBenchmark = [
    { label: '/api/health', path: '/api/health', method: 'GET' },
    { label: '/api/auth/status', path: '/api/auth/status', method: 'GET' },
    { label: '/api/track/AO-451023', path: '/api/track/AO-451023', method: 'GET' },
    { label: '/api/data (Protected 401)', path: '/api/data', method: 'GET' },
    { label: '/track/AO-451023 (SPA HTML)', path: '/track/AO-451023', method: 'GET' },
  ];

  for (const ep of endpointsToBenchmark) {
    const latencies = [];
    for (let i = 0; i < 20; i++) {
      const res = await request({ hostname: 'localhost', port: 3000, path: ep.path, method: ep.method });
      latencies.push(res.duration);
    }
    const stats = calculatePercentiles(latencies);
    let rating = 'EXCELENTE';
    if (stats.mean > 500) rating = 'CRÍTICO';
    else if (stats.mean > 250) rating = 'ATENÇÃO';
    else if (stats.mean > 100) rating = 'ACEITÁVEL';

    console.log(`  * ${ep.label}:`);
    console.log(`      Min: ${stats.min.toFixed(2)}ms | Max: ${stats.max.toFixed(2)}ms | Mean: ${stats.mean.toFixed(2)}ms`);
    console.log(`      Median: ${stats.median.toFixed(2)}ms | p95: ${stats.p95.toFixed(2)}ms | p99: ${stats.p99.toFixed(2)}ms`);
    console.log(`      Rating: ${rating}`);
  }

  // 3. HTTP Error Handling & Structured JSON Responses
  console.log('\n--- [3] HTTP Error Responses & Security Translation ---');
  const errorTests = [
    { label: '401 Unauthorized', path: '/api/data', method: 'GET', expectedStatus: 401 },
    { label: '404 Tracking Code Not Found', path: '/api/track/AO-999999', method: 'GET', expectedStatus: 404 },
    { label: '404 Unknown API Route', path: '/api/unknown-endpoint-xyz', method: 'GET', expectedStatus: 404 },
    { label: '401 Order Mutation Unauthorized', path: '/api/orders', method: 'POST', data: JSON.stringify({ code: 'AO-000' }), expectedStatus: 401 },
    { label: '401 Client Mutation Unauthorized', path: '/api/clients', method: 'POST', data: JSON.stringify({ name: 'Test' }), expectedStatus: 401 },
    { label: '401 Settings Mutation Unauthorized', path: '/api/settings', method: 'POST', data: JSON.stringify({}), expectedStatus: 401 },
  ];

  for (const test of errorTests) {
    const headers = test.data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(test.data) } : {};
    const res = await request({ hostname: 'localhost', port: 3000, path: test.path, method: test.method, headers }, test.data);
    const passed = res.status === test.expectedStatus;
    let isJson = false;
    try {
      JSON.parse(res.body);
      isJson = true;
    } catch (_) {}
    console.log(`  - ${test.label}: HTTP ${res.status} (Expected ${test.expectedStatus}), JSON=${isJson} -> ${passed ? 'PASS' : 'FAIL'}`);
  }

  // 4. Resilience & Attack Payload Resistance
  console.log('\n--- [4] Resilience & Malicious Request Resistance ---');
  const attackPayloads = [
    { label: 'SQL Injection 1', path: `/api/track/${encodeURIComponent("' OR 1=1 --")}`, expectedStatus: 404 },
    { label: 'SQL Injection 2 (Union)', path: `/api/track/${encodeURIComponent("AO-451023' UNION SELECT * FROM app_settings --")}`, expectedStatus: 404 },
    { label: 'Cross-Site Scripting (XSS)', path: `/api/track/${encodeURIComponent("<svg onload=alert(1)>")}`, expectedStatus: 404 },
    { label: 'Path Traversal', path: `/api/track/${encodeURIComponent("../../etc/passwd")}`, expectedStatus: 404 },
    { label: 'Buffer Overflow Attempt (500 chars)', path: `/api/track/${'X'.repeat(500)}`, expectedStatus: 404 },
    { label: 'Malformed JSON Payload', path: '/api/auth/login', method: 'POST', data: '{ bad json :::: ', expectedStatus: 400 },
  ];

  for (const attack of attackPayloads) {
    const headers = attack.data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(attack.data) } : {};
    const res = await request({ hostname: 'localhost', port: 3000, path: attack.path, method: attack.method || 'GET', headers }, attack.data);
    const passed = res.status === attack.expectedStatus;
    console.log(`  - ${attack.label}: HTTP ${res.status} (Expected ${attack.expectedStatus}) -> ${passed ? 'PASS (RESILIENT)' : 'FAIL'}`);
  }

  // 5. Public Tracking Sanitization Audit
  console.log('\n--- [5] Rigorous Privacy Sanitization Verification ---');
  const trackRes = await request({ hostname: 'localhost', port: 3000, path: '/api/track/AO-451023', method: 'GET' });
  const trackJson = JSON.parse(trackRes.body);
  const internalFields = [
    'purchaseCost', 'purchaseLocation', 'deliveryCost', 'otherCosts',
    'grossProfit', 'netProfit', 'adminNotes', 'supplier', 'password',
    'hash', 'salt', 'secret', 'token', 'phone', 'cost', 'profit'
  ];
  const leaked = internalFields.filter(f => f in (trackJson.order || {}));
  console.log(`  - Public Order Code: ${trackJson.order?.code}`);
  console.log(`  - Product Name: ${trackJson.order?.productName}`);
  console.log(`  - Client Display Name: ${trackJson.order?.clientFirstName}`);
  console.log(`  - Status: ${trackJson.order?.status}`);
  console.log(`  - Internal Confidential Fields Leaked: ${leaked.length === 0 ? 'ZERO (100% SANITIZED)' : leaked}`);

  console.log('\n================================================================');
  console.log('AUDITORIA DA FASE 7.5 CONCLUÍDA');
  console.log('================================================================');
}

runPhase75Audit().catch(console.error);
