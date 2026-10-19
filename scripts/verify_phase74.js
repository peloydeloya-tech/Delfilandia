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

async function runAudit() {
  console.log('================================================================');
  console.log('FASE 7.4: AUDITORIA OPERACIONAL E VALIDAÇÃO REAL EM PRODUÇÃO');
  console.log('================================================================\n');

  // 1. Health Check
  console.log('--- [1] Health Check (/api/health) ---');
  const health = await request({ hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET' });
  console.log(`Status: ${health.status} (${health.duration.toFixed(2)}ms)`);
  console.log(`Body: ${health.body}`);
  const healthJson = JSON.parse(health.body);
  console.log(`Health evaluation: ${health.status === 200 && healthJson.postgres === 'connected' ? 'PASS (HEALTHY)' : 'FAIL'}`);

  // 2. Auth Status & Secrets Leak Audit
  console.log('\n--- [2] Auth Status & Secrets Leak Audit (/api/auth/status) ---');
  const authStatus = await request({ hostname: 'localhost', port: 3000, path: '/api/auth/status', method: 'GET' });
  console.log(`Status: ${authStatus.status} (${authStatus.duration.toFixed(2)}ms)`);
  console.log(`Body: ${authStatus.body}`);
  const authJson = JSON.parse(authStatus.body);
  const secretKeywords = ['password', 'passwordHash', 'salt', 'secret', 'SESSION_SECRET', 'SQL_PASSWORD', 'GEMINI_API_KEY'];
  const leakedInAuth = Object.keys(authJson).filter(k => secretKeywords.includes(k.toLowerCase()) && !['isauthenticated', 'islocked', 'configured', 'failedattempts'].includes(k.toLowerCase()));
  console.log(`Secrets exposed in Auth Status: ${leakedInAuth.length === 0 ? 'ZERO (SAFE)' : leakedInAuth}`);

  // 3. Unauthorized Administrative Endpoints Audit
  console.log('\n--- [3] Unauthorized Administrative Endpoints Protection ---');
  const adminEndpoints = [
    { method: 'GET', path: '/api/data', desc: 'Read Full Database' },
    { method: 'POST', path: '/api/orders', desc: 'Create Order', data: JSON.stringify({ code: 'AO-HACK' }) },
    { method: 'PUT', path: '/api/orders/1', desc: 'Update Order', data: JSON.stringify({ notes: 'hack' }) },
    { method: 'DELETE', path: '/api/orders/1', desc: 'Delete Order' },
    { method: 'POST', path: '/api/clients', desc: 'Create Client', data: JSON.stringify({ name: 'Hacker' }) },
    { method: 'POST', path: '/api/settings', desc: 'Update Settings', data: JSON.stringify({ password: 'hack' }) },
    { method: 'POST', path: '/api/audit-logs', desc: 'Inject Audit Log', data: JSON.stringify({ action: 'hack' }) }
  ];

  for (const ep of adminEndpoints) {
    const headers = ep.data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(ep.data) } : {};
    const res = await request({ hostname: 'localhost', port: 3000, path: ep.path, method: ep.method, headers }, ep.data);
    const isProtected = res.status === 401 || res.status === 403;
    console.log(`  - ${ep.method} ${ep.path} [${ep.desc}]: HTTP ${res.status} -> ${isProtected ? 'PASS (PROTECTED)' : 'FAIL (UNPROTECTED)'}`);
  }

  // 4. Public Tracking & Privacy Sanitization Audit
  console.log('\n--- [4] Public Tracking & Privacy Sanitization (/api/track/AO-451023) ---');
  const trackRes = await request({ hostname: 'localhost', port: 3000, path: '/api/track/AO-451023', method: 'GET' });
  console.log(`Status: ${trackRes.status} (${trackRes.duration.toFixed(2)}ms)`);
  const trackData = JSON.parse(trackRes.body);
  console.log(`Product: "${trackData.order?.productName}"`);
  console.log(`Client display: "${trackData.order?.clientFirstName}"`);
  console.log(`Status: "${trackData.order?.status}"`);
  console.log(`Timeline events: ${trackData.order?.timeline?.length}`);

  const forbiddenFields = [
    'purchaseCost', 'purchaseLocation', 'deliveryCost', 'otherCosts',
    'grossProfit', 'netProfit', 'adminNotes', 'supplier', 'password',
    'hash', 'salt', 'secret', 'token', 'phone'
  ];
  const leakedFields = forbiddenFields.filter(f => f in (trackData.order || {}));
  console.log(`Confidential fields exposed: ${leakedFields.length === 0 ? 'ZERO (100% SANITIZED)' : leakedFields}`);

  // 5. Code Normalization & Edge Cases / Security Testing
  console.log('\n--- [5] Tracking Code Normalization & Edge-Case Security ---');
  const testCodes = [
    { label: 'Canónico', code: 'AO-451023', expectedStatus: 200 },
    { label: 'Minúsculas', code: 'ao-451023', expectedStatus: 200 },
    { label: 'Sem hífen', code: 'AO451023', expectedStatus: 200 },
    { label: 'Sem hífen minúsculas', code: 'ao451023', expectedStatus: 200 },
    { label: 'Dígito zero', code: 'A0-451023', expectedStatus: 200 },
    { label: 'Dígito zero sem hífen', code: 'A0451023', expectedStatus: 200 },
    { label: 'Apenas números', code: '451023', expectedStatus: 200 },
    { label: 'Código inexistente', code: 'AO-000000', expectedStatus: 404 },
    { label: 'Texto inexistente', code: 'CODIGO-INEXISTENTE', expectedStatus: 404 },
    { label: 'Tentativa SQL Injection', code: encodeURIComponent("' OR '1'='1"), expectedStatus: 404 },
    { label: 'String excessivamente longa', code: 'A'.repeat(300), expectedStatus: 404 },
    { label: 'Caracteres com espaços', code: encodeURIComponent('  AO-451023  '), expectedStatus: 200 },
    { label: 'Caracteres especiais XSS', code: encodeURIComponent('<script>alert(1)</script>'), expectedStatus: 404 }
  ];

  for (const tc of testCodes) {
    const res = await request({ hostname: 'localhost', port: 3000, path: `/api/track/${tc.code}`, method: 'GET' });
    const passed = res.status === tc.expectedStatus;
    console.log(`  - [${tc.label}] ${decodeURIComponent(tc.code).substring(0, 25)}: HTTP ${res.status} (Expected ${tc.expectedStatus}) -> ${passed ? 'PASS' : 'FAIL'}`);
  }

  // 6. SPA Fallback & Deep Links
  console.log('\n--- [6] SPA Fallback & Direct Deep Links (HTML Rendering) ---');
  const spaRoutes = [
    '/track/AO-451023',
    '/acompanhar/AO-451023',
    '/r/AO-451023',
    '/rastreio/AO-451023',
    '/encomenda/AO-451023',
    '/?code=AO-451023',
    '/admin'
  ];

  for (const route of spaRoutes) {
    const res = await request({ hostname: 'localhost', port: 3000, path: route, method: 'GET' });
    const isHtml = res.headers['content-type'] && res.headers['content-type'].includes('text/html');
    console.log(`  - GET ${route}: HTTP ${res.status}, isHTML=${isHtml} -> ${res.status === 200 && isHtml ? 'PASS' : 'FAIL'}`);
  }

  // 7. Performance Benchmarks (5 samples each)
  console.log('\n--- [7] Performance Latency Benchmarks (Averages across 5 calls) ---');
  async function benchmark(path) {
    const durations = [];
    for (let i = 0; i < 5; i++) {
      const res = await request({ hostname: 'localhost', port: 3000, path, method: 'GET' });
      durations.push(res.duration);
    }
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    return { avg, min, max };
  }

  const benchHealth = await benchmark('/api/health');
  console.log(`  - /api/health: Avg=${benchHealth.avg.toFixed(2)}ms (Min=${benchHealth.min.toFixed(2)}ms, Max=${benchHealth.max.toFixed(2)}ms)`);

  const benchAuth = await benchmark('/api/auth/status');
  console.log(`  - /api/auth/status: Avg=${benchAuth.avg.toFixed(2)}ms (Min=${benchAuth.min.toFixed(2)}ms, Max=${benchAuth.max.toFixed(2)}ms)`);

  const benchTrack = await benchmark('/api/track/AO-451023');
  console.log(`  - /api/track/AO-451023: Avg=${benchTrack.avg.toFixed(2)}ms (Min=${benchTrack.min.toFixed(2)}ms, Max=${benchTrack.max.toFixed(2)}ms)`);

  console.log('\n================================================================');
  console.log('AUDITORIA DA FASE 7.4 EXECUTADA COM SUCESSO');
  console.log('================================================================');
}

runAudit().catch(console.error);
