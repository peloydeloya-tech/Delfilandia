import http from 'http';

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log('FASE 7.2: VERIFICAÇÃO TÉCNICA E TESTES DE PRODUÇÃO');
  console.log('====================================================\n');

  // 1. Health Check
  const health = await request({ hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET' });
  console.log('[1] Health Check (/api/health): Status', health.status);
  console.log('    Response body:', health.body);

  // 2. Proteção de Rota Administrativa sem Sessão
  const adminData = await request({ hostname: 'localhost', port: 3000, path: '/api/data', method: 'GET' });
  console.log('\n[2] Protected Admin Route (/api/data): Status', adminData.status, '(Expected 401 Unauthorized)');

  // 3. Consulta de Rastreio Público da Encomenda Real AO-451023
  console.log('\n[3] Public Tracking Endpoint (/api/track/AO-451023):');
  const trackRes = await request({ hostname: 'localhost', port: 3000, path: '/api/track/AO-451023', method: 'GET' });
  console.log('    Status:', trackRes.status);
  const trackJson = JSON.parse(trackRes.body);
  console.log('    Product Name:', trackJson.order?.productName);
  console.log('    Client First Name:', trackJson.order?.clientFirstName);
  console.log('    Status:', trackJson.order?.status);
  console.log('    Timeline events:', trackJson.order?.timeline?.length);

  // 4. Auditoria Rigorosa de Privacidade (Campos Proibidos)
  const forbiddenFields = ['purchaseCost', 'deliveryCost', 'otherCosts', 'grossProfit', 'netProfit', 'adminNotes', 'purchaseLocation', 'supplier'];
  const detectedLeaks = forbiddenFields.filter(field => field in (trackJson.order || {}));
  console.log('\n[4] Privacy Audit in Public Payload:');
  console.log('    Forbidden Fields Leaked:', detectedLeaks.length === 0 ? 'ZERO (100% SEGURO)' : detectedLeaks);

  // 5. Teste de Normalização de Códigos de Rastreio
  console.log('\n[5] Tracking Code Normalization Formats:');
  const codeVariants = [
    { label: 'Canónico (AO-451023)', code: 'AO-451023' },
    { label: 'Minúsculas (ao-451023)', code: 'ao-451023' },
    { label: 'Sem hífen (AO451023)', code: 'AO451023' },
    { label: 'Sem hífen minúsculas (ao451023)', code: 'ao451023' },
    { label: 'Dígito zero (A0-451023)', code: 'A0-451023' },
    { label: 'Dígito zero sem hífen (A0451023)', code: 'A0451023' },
    { label: 'Dígitos apenas (451023)', code: '451023' },
  ];

  for (const variant of codeVariants) {
    const res = await request({ hostname: 'localhost', port: 3000, path: `/api/track/${variant.code}`, method: 'GET' });
    const isSuccess = res.status === 200;
    console.log(`    - ${variant.label}: HTTP ${res.status} -> ${isSuccess ? 'PASS' : 'FAIL'}`);
  }

  // 6. Teste de SPA Fallback e Rotas de Navegador / Deep Link
  console.log('\n[6] SPA Fallback & Deep Link Navigation Routes:');
  const deepLinkRoutes = [
    '/track/AO-451023',
    '/acompanhar/AO-451023',
    '/r/AO-451023',
    '/rastreio/AO-451023',
    '/encomenda/AO-451023',
    '/?code=AO-451023',
    '/admin',
  ];

  for (const route of deepLinkRoutes) {
    const res = await request({ hostname: 'localhost', port: 3000, path: route, method: 'GET' });
    const isHtml = res.headers['content-type'] && res.headers['content-type'].includes('text/html');
    console.log(`    - GET ${route}: HTTP ${res.status}, isHTML=${isHtml} -> ${res.status === 200 && isHtml ? 'PASS' : 'FAIL'}`);
  }

  console.log('\n====================================================');
  console.log('TODOS OS TESTES TÉCNICOS DA FASE 7.2 FORAM EXECUTADOS');
  console.log('====================================================');
}

run().catch(console.error);
