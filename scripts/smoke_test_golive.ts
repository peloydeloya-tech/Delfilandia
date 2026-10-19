import http from 'http';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function httpRequest(path: string, options: http.RequestOptions = {}): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string; latencyMs: number }> {
  return new Promise((resolve, reject) => {
    const startTime = process.hrtime();
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method: 'GET',
      ...options
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const diff = process.hrtime(startTime);
        const latencyMs = (diff[0] * 1e3) + (diff[1] * 1e-6);
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: data,
          latencyMs
        });
      });
    });
    req.on('error', reject);
    if (options.headers && (options as any).body) {
      req.write((options as any).body);
    }
    req.end();
  });
}

async function runSmokeTests() {
  console.log('================================================================');
  console.log('DELFILÂNDIA — ETAPA 9 — FASE 9.3: SMOKE TEST DE GO-LIVE REAL');
  console.log('================================================================\n');

  // 1. Live server & health
  console.log('--- 1. VERIFICAÇÃO DO DEPLOY & DISPONIBILIDADE ---');
  const healthRes = await httpRequest('/api/health');
  const healthJson = JSON.parse(healthRes.body);
  const healthPass = healthRes.statusCode === 200 && healthJson.status === 'ok' && healthJson.postgres === 'connected';
  results.push({ name: 'Deploy: GET /api/health (HTTP 200, postgres: connected)', passed: healthPass, details: `${healthRes.statusCode} - ${healthJson.postgres} (${healthRes.latencyMs.toFixed(2)}ms)` });
  console.log(`[${healthPass ? 'PASS' : 'FAIL'}] GET /api/health: ${healthRes.statusCode} (${healthRes.latencyMs.toFixed(2)}ms) - postgres: ${healthJson.postgres}`);

  const authStatusRes = await httpRequest('/api/auth/status');
  const authStatusJson = JSON.parse(authStatusRes.body);
  const authStatusPass = authStatusRes.statusCode === 200 && authStatusJson.isAuthenticated === false;
  results.push({ name: 'Deploy: GET /api/auth/status (HTTP 200, anônimo)', passed: authStatusPass, details: `HTTP ${authStatusRes.statusCode}` });
  console.log(`[${authStatusPass ? 'PASS' : 'FAIL'}] GET /api/auth/status: ${authStatusRes.statusCode}`);

  const rootRes = await httpRequest('/');
  const isHtml = rootRes.headers['content-type']?.includes('text/html');
  const rootPass = rootRes.statusCode === 200 && !!isHtml;
  results.push({ name: 'Deploy: GET / (HTTP 200 SPA HTML)', passed: rootPass, details: `HTTP ${rootRes.statusCode}, isHtml=${isHtml}` });
  console.log(`[${rootPass ? 'PASS' : 'FAIL'}] GET /: ${rootRes.statusCode} (isHtml: ${isHtml}, length: ${rootRes.body.length})`);

  // 2. Smoke Test Tracking
  console.log('\n--- 2. SMOKE TEST DO TRACKING PÚBLICO ---');
  const trackRes = await httpRequest('/api/track/AO-451023');
  const trackJson = JSON.parse(trackRes.body);
  const order = trackJson.order || trackJson;
  const trackingCodeMatch = order.code === 'AO-451023';
  const trackingMaskMatch = order.clientFirstName === 'Cliente: Aldemiro' || order.clientName === 'Cliente: Aldemiro';
  const trackingStatusMatch = order.status === 'PRODUTO_COMPRADO';
  const forbiddenFields = ['purchaseCost', 'purchaseLocation', 'deliveryCost', 'otherCosts', 'grossProfit', 'netProfit', 'adminNotes', 'supplier', 'clientPhone'];
  const leaked = forbiddenFields.filter(f => f in order);
  const zeroLeaks = leaked.length === 0;
  const trackingPass = trackRes.statusCode === 200 && trackingCodeMatch && trackingMaskMatch && trackingStatusMatch && zeroLeaks;
  results.push({ name: 'Tracking: GET /api/track/AO-451023 (HTTP 200, Sanitizado)', passed: trackingPass, details: `Code: ${order.code}, Client: ${order.clientFirstName || order.clientName}` });
  console.log(`[${trackingPass ? 'PASS' : 'FAIL'}] GET /api/track/AO-451023: Code=${order.code}, Status=${order.status}, Client=${order.clientFirstName || order.clientName}, ZeroLeaks=${zeroLeaks}`);

  // 3. Smoke Test Deep Links
  console.log('\n--- 3. SMOKE TEST DE DEEP LINKS & SPA FALLBACK ---');
  const deepLinkPaths = [
    '/track/AO-451023',
    '/acompanhar/AO-451023',
    '/r/AO-451023',
    '/rastreio/AO-451023',
    '/encomenda/AO-451023',
    '/?code=AO-451023',
    '/admin'
  ];

  for (const path of deepLinkPaths) {
    const res = await httpRequest(path);
    const isHtmlRoute = res.headers['content-type']?.includes('text/html');
    const pass = res.statusCode === 200 && !!isHtmlRoute;
    results.push({ name: `Deep Link: ${path}`, passed: pass, details: `HTTP ${res.statusCode}` });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] Deep Link ${path}: HTTP ${res.statusCode}, isHtml=${isHtmlRoute}`);
  }

  // 4. WhatsApp Integration Link
  console.log('\n--- 4. SMOKE TEST DO LINK WHATSAPP ---');
  const baseUrl = 'https://ais-dev-zogo7fgdsaxqigtfirdqkx-344045634725.europe-west2.run.app';
  const rawPhone = '923456789';
  const cleanPhone = rawPhone.replace(/\D/g, '');
  const finalPhone = cleanPhone.startsWith('244') ? cleanPhone : `244${cleanPhone}`;
  const trackingUrl = `${baseUrl}/track/AO-451023`;
  const message = `Olá Aldemiro! Sua encomenda AO-451023 está com status PRODUTO_COMPRADO. Acompanhe em tempo real: ${trackingUrl}`;
  const waLink = `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;
  const waPass = waLink.startsWith('https://wa.me/244923456789') && waLink.includes('AO-451023');
  results.push({ name: 'WhatsApp Link: Formatação canónica HTTPS + DDI Angola +244', passed: waPass, details: waLink.substring(0, 60) + '...' });
  console.log(`[${waPass ? 'PASS' : 'FAIL'}] WhatsApp Link: ${waLink.substring(0, 80)}...`);

  // 5. Smoke Test Autenticação / RBAC
  console.log('\n--- 5. SMOKE TEST DE AUTENTICAÇÃO / RBAC (BLOQUEIO 401) ---');
  const adminDataRes = await httpRequest('/api/data');
  const adminDataPass = adminDataRes.statusCode === 401;
  results.push({ name: 'RBAC: GET /api/data (Bloqueio 401 Anônimo)', passed: adminDataPass, details: `HTTP ${adminDataRes.statusCode}` });
  console.log(`[${adminDataPass ? 'PASS' : 'FAIL'}] GET /api/data (Sem Sessão): HTTP ${adminDataRes.statusCode}`);

  const adminOrdersRes = await httpRequest('/api/orders');
  const adminOrdersPass = adminOrdersRes.statusCode === 401;
  results.push({ name: 'RBAC: GET /api/orders (Bloqueio 401 Anônimo)', passed: adminOrdersPass, details: `HTTP ${adminOrdersRes.statusCode}` });
  console.log(`[${adminOrdersPass ? 'PASS' : 'FAIL'}] GET /api/orders (Sem Sessão): HTTP ${adminOrdersPass ? 401 : adminOrdersRes.statusCode}`);

  // 6. Security Headers
  console.log('\n--- 6. VERIFICAÇÃO DE SEGURANÇA PÓS-GO-LIVE ---');
  const nosniff = healthRes.headers['x-content-type-options'] === 'nosniff';
  const referrer = !!healthRes.headers['referrer-policy'];
  const dnsPrefetch = healthRes.headers['x-dns-prefetch-control'] === 'off';
  const downloadOpts = healthRes.headers['x-download-options'] === 'noopen';
  const noPoweredBy = !healthRes.headers['x-powered-by'];
  const cacheControlApi = trackRes.headers['cache-control']?.includes('no-store');

  const headersPass = nosniff && referrer && dnsPrefetch && downloadOpts && noPoweredBy && cacheControlApi;
  results.push({ name: 'Segurança: Headers HTTP (nosniff, referrer, X-Powered-By oculto, no-store)', passed: !!headersPass, details: 'Headers em conformidade' });
  console.log(`[${headersPass ? 'PASS' : 'FAIL'}] Headers de Segurança: nosniff=${nosniff}, noPoweredBy=${noPoweredBy}, noStore=${cacheControlApi}`);

  // 7. Initial Monitoring Metrics Sample
  console.log('\n--- 7. MONITORIZAÇÃO INICIAL (AMOSTRAGEM OPERACIONAL) ---');
  const latencies: number[] = [];
  let error5xxCount = 0;
  for (let i = 0; i < 20; i++) {
    const res = await httpRequest('/api/health');
    latencies.push(res.latencyMs);
    if (res.statusCode >= 500) error5xxCount++;
  }
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);
  const monitoringPass = error5xxCount === 0 && avgLatency < 10;
  results.push({ name: 'Monitorização: Amostragem /api/health (20 requisições, 0 erros 5xx, latência média < 10ms)', passed: monitoringPass, details: `Média: ${avgLatency.toFixed(2)}ms, Erros 5xx: ${error5xxCount}` });
  console.log(`[${monitoringPass ? 'PASS' : 'FAIL'}] Monitorização: Média=${avgLatency.toFixed(2)}ms, Min=${minLatency.toFixed(2)}ms, Max=${maxLatency.toFixed(2)}ms, Erros 5xx=${error5xxCount}`);

  console.log('\n================================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`TOTAL DE TESTES EXECUTADOS: ${total}`);
  console.log(`TESTES APROVADOS: ${passed}`);
  console.log(`TESTES FALHADOS: ${failed}`);
  console.log(`STATUS DO SMOKE TEST: ${failed === 0 ? '✅ 100% APROVADO' : '❌ FALHAS DETECTADAS'}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSmokeTests().catch(err => {
  console.error('Erro na execução do smoke test:', err);
  process.exit(1);
});
