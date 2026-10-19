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

async function runHomologationAudit() {
  console.log('================================================================');
  console.log('ETAPA 4 — FASE 7.6: HOMOLOGAÇÃO FINAL DE PRODUÇÃO');
  console.log('================================================================\n');

  // 1. Health Check
  console.log('--- [1] Health Check (/api/health) ---');
  const health = await request({ hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET' });
  console.log(`Status: ${health.status} (${health.duration.toFixed(2)}ms)`);
  console.log(`Body: ${health.body}`);
  const healthJson = JSON.parse(health.body);
  const healthPass = health.status === 200 && healthJson.postgres === 'connected' && healthJson.status === 'ok';
  console.log(`Health Evaluation: ${healthPass ? 'PASS (HEALTHY & CONNECTED)' : 'FAIL'}`);

  // 2. Auth Status & Secrets Protection
  console.log('\n--- [2] Auth Status & Leak Audit (/api/auth/status) ---');
  const authStatus = await request({ hostname: 'localhost', port: 3000, path: '/api/auth/status', method: 'GET' });
  console.log(`Status: ${authStatus.status} (${authStatus.duration.toFixed(2)}ms)`);
  console.log(`Body: ${authStatus.body}`);
  const authJson = JSON.parse(authStatus.body);
  const dangerousKeys = ['password', 'passwordHash', 'salt', 'secret', 'SESSION_SECRET', 'SQL_PASSWORD', 'GEMINI_API_KEY'];
  const leakedInAuth = Object.keys(authJson).filter(k => dangerousKeys.includes(k.toLowerCase()) && !['isauthenticated', 'islocked', 'configured', 'failedattempts'].includes(k.toLowerCase()));
  console.log(`Dangerous Secrets in Auth Response: ${leakedInAuth.length === 0 ? 'ZERO (100% PROTECTED)' : leakedInAuth}`);

  // 3. Administrative Protection (401 Unauthorized for Anonymous)
  console.log('\n--- [3] Administrative Protection Audit (401 Unauthorized for Anonymous) ---');
  const adminEndpoints = [
    { method: 'GET', path: '/api/data', desc: 'Read Full Database' },
    { method: 'POST', path: '/api/orders', desc: 'Batch Create Orders', data: JSON.stringify({ orders: [] }) },
    { method: 'POST', path: '/api/orders/new', desc: 'Create Order Alt', data: JSON.stringify({ newOrder: { code: 'AO-HACK' } }) },
    { method: 'PUT', path: '/api/orders/1', desc: 'Update Order', data: JSON.stringify({ updatedOrder: { code: 'AO-HACK' } }) },
    { method: 'DELETE', path: '/api/orders/AO-451023', desc: 'Delete Order Real' },
    { method: 'DELETE', path: '/api/orders', desc: 'Purge All Orders' },
    { method: 'POST', path: '/api/clients', desc: 'Create/Save Client', data: JSON.stringify({ client: { id: 'c-hack', name: 'Hacker' } }) },
    { method: 'POST', path: '/api/settings', desc: 'Update Settings', data: JSON.stringify({ settings: {} }) },
    { method: 'POST', path: '/api/audit-logs', desc: 'Inject Audit Log', data: JSON.stringify({ auditLog: { id: 'aud-hack' } }) }
  ];

  let adminPass = true;
  for (const ep of adminEndpoints) {
    const headers = ep.data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(ep.data) } : {};
    const res = await request({ hostname: 'localhost', port: 3000, path: ep.path, method: ep.method, headers }, ep.data);
    const isProtected = res.status === 401 || res.status === 403;
    if (!isProtected) adminPass = false;
    console.log(`  - ${ep.method} ${ep.path} [${ep.desc}]: HTTP ${res.status} -> ${isProtected ? 'PASS (PROTECTED)' : 'FAIL'}`);
  }

  // 4. Public Tracking & Privacy Sanitization
  console.log('\n--- [4] Public Tracking & Privacy Sanitization (/api/track/AO-451023) ---');
  const trackRes = await request({ hostname: 'localhost', port: 3000, path: '/api/track/AO-451023', method: 'GET' });
  console.log(`Status: ${trackRes.status} (${trackRes.duration.toFixed(2)}ms)`);
  const trackData = JSON.parse(trackRes.body);
  console.log(`Product Name: "${trackData.order?.productName}"`);
  console.log(`Client First Name Display: "${trackData.order?.clientFirstName}"`);
  console.log(`Status: "${trackData.order?.status}"`);
  console.log(`Timeline Count: ${trackData.order?.timeline?.length}`);

  const forbiddenFields = [
    'purchaseCost', 'purchaseLocation', 'deliveryCost', 'otherCosts',
    'grossProfit', 'netProfit', 'adminNotes', 'supplier', 'password',
    'hash', 'salt', 'secret', 'token', 'phone', 'cost', 'profit'
  ];
  const leakedFields = forbiddenFields.filter(f => f in (trackData.order || {}));
  console.log(`Confidential Fields Exposed: ${leakedFields.length === 0 ? 'ZERO (100% SANITIZED)' : leakedFields}`);

  // 5. Normalization Formats
  console.log('\n--- [5] Tracking Code Normalization Formats ---');
  const testFormats = [
    { label: 'Canónico', code: 'AO-451023' },
    { label: 'Minúsculas', code: 'ao-451023' },
    { label: 'Sem hífen', code: 'AO451023' },
    { label: 'Sem hífen minúsculas', code: 'ao451023' },
    { label: 'Dígito zero', code: 'A0-451023' },
    { label: 'Dígito zero sem hífen', code: 'A0451023' },
    { label: 'Apenas números', code: '451023' },
    { label: 'Espaços extras', code: encodeURIComponent('  AO-451023  ') }
  ];

  let normPass = true;
  for (const fmt of testFormats) {
    const res = await request({ hostname: 'localhost', port: 3000, path: `/api/track/${fmt.code}`, method: 'GET' });
    const isOk = res.status === 200;
    if (!isOk) normPass = false;
    console.log(`  - [${fmt.label}] ${decodeURIComponent(fmt.code)}: HTTP ${res.status} -> ${isOk ? 'PASS' : 'FAIL'}`);
  }

  // 6. Security Input Resistance
  console.log('\n--- [6] Security Inputs & Malicious Payloads ---');
  const securityTests = [
    { label: 'SQL Injection: \' OR \'1\'=\'1', code: encodeURIComponent("' OR '1'='1"), expected: 404 },
    { label: 'SQL Injection: \' OR 1=1 --', code: encodeURIComponent("' OR 1=1 --"), expected: 404 },
    { label: 'SQL Injection: UNION SELECT', code: encodeURIComponent("AO-451023' UNION SELECT * FROM app_settings --"), expected: 404 },
    { label: 'XSS: <script>', code: encodeURIComponent("<script>alert(1)</script>"), expected: 404 },
    { label: 'XSS: <svg onload=alert(1)>', code: encodeURIComponent("<svg onload=alert(1)>"), expected: 404 },
    { label: 'Path Traversal: ../../etc/passwd', code: encodeURIComponent("../../etc/passwd"), expected: 404 },
    { label: 'Buffer Overflow: 400 chars', code: 'A'.repeat(400), expected: 400 },
    { label: 'Non-existent Code: AO-000000', code: 'AO-000000', expected: 404 },
    { label: 'Invalid String: CODIGO-INVALIDO', code: 'CODIGO-INVALIDO', expected: 404 },
  ];

  let secPass = true;
  for (const st of securityTests) {
    const res = await request({ hostname: 'localhost', port: 3000, path: `/api/track/${st.code}`, method: 'GET' });
    const isExpected = res.status === st.expected;
    if (!isExpected) secPass = false;
    console.log(`  - ${st.label}: HTTP ${res.status} (Expected ${st.expected}) -> ${isExpected ? 'PASS (RESILIENT)' : 'FAIL'}`);
  }

  // 7. Deep Links & SPA Fallback
  console.log('\n--- [7] Deep Links & SPA Fallback (HTTP 200 text/html) ---');
  const deepLinks = [
    { path: '/track/AO-451023', desc: 'Direct Path' },
    { path: '/acompanhar/AO-451023', desc: 'Direct PT-PT Path' },
    { path: '/r/AO-451023', desc: 'Shortened Link' },
    { path: '/rastreio/AO-451023', desc: 'Tracking Path' },
    { path: '/encomenda/AO-451023', desc: 'Order Path' },
    { path: '/?code=AO-451023', desc: 'Query Param Deep Link' },
    { path: '/', desc: 'Hash Deep Link Base HTML (Fragment resolved by browser)' },
    { path: '/admin', desc: 'Admin Dashboard Route' }
  ];

  let deepPass = true;
  for (const dl of deepLinks) {
    const res = await request({ hostname: 'localhost', port: 3000, path: dl.path, method: 'GET' });
    const isHtml = res.headers['content-type'] && res.headers['content-type'].includes('text/html');
    const passed = res.status === 200 && isHtml;
    if (!passed) deepPass = false;
    console.log(`  - GET ${dl.path} [${dl.desc}]: HTTP ${res.status}, isHTML=${isHtml} -> ${passed ? 'PASS' : 'FAIL'}`);
  }

  // 8. Performance Benchmarks
  console.log('\n--- [8] Performance & Latency Benchmarks (10 iterations each) ---');
  const benchEndpoints = [
    { label: '/api/health', path: '/api/health' },
    { label: '/api/auth/status', path: '/api/auth/status' },
    { label: '/api/track/AO-451023', path: '/api/track/AO-451023' },
    { label: '/api/data (401)', path: '/api/data' },
    { label: '/track/AO-451023 (SPA HTML)', path: '/track/AO-451023' },
  ];

  for (const ep of benchEndpoints) {
    const latencies = [];
    for (let i = 0; i < 10; i++) {
      const res = await request({ hostname: 'localhost', port: 3000, path: ep.path, method: 'GET' });
      latencies.push(res.duration);
    }
    const stats = calculatePercentiles(latencies);
    console.log(`  * ${ep.label}: Mean=${stats.mean.toFixed(2)}ms (Min=${stats.min.toFixed(2)}ms, Max=${stats.max.toFixed(2)}ms, p95=${stats.p95.toFixed(2)}ms)`);
  }

  console.log('\n================================================================');
  const allPassed = healthPass && adminPass && leakedFields.length === 0 && normPass && secPass && deepPass;
  console.log(`STATUS GLOBAL DA FASE 7.6: ${allPassed ? 'APROVADA PARA PRODUÇÃO CONTÍNUA' : 'REPROVADA'}`);
  console.log('================================================================');
  process.exit(allPassed ? 0 : 1);
}

runHomologationAudit().catch(console.error);
