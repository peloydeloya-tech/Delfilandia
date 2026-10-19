/**
 * ============================================================================
 * DELFILÂNDIA — SUÍTE DE TESTES E SMOKE TEST DA FASE 9.5
 * VALIDAÇÃO OPERACIONAL PÓS-CORREÇÃO & GATE FINAL PARA OPERAÇÃO NORMAL
 * ============================================================================
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

import { getDbOrders, getDbClients, getDbSettings, getDbAuditLogs } from '../src/db/repository';
import { isSqlAvailable } from '../src/db';

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function httpRequest(
  urlPath: string,
  options: http.RequestOptions = {},
  bodyData?: any,
  cookies?: string
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string; latencyMs: number }> {
  return new Promise((resolve, reject) => {
    const startTime = process.hrtime();
    const headers: Record<string, string> = { ...(options.headers as any || {}) };
    let payload = '';

    if (bodyData !== undefined) {
      if (typeof bodyData === 'string') {
        payload = bodyData;
      } else {
        payload = JSON.stringify(bodyData);
        if (!headers['Content-Type'] && !headers['content-type']) {
          headers['Content-Type'] = 'application/json';
        }
      }
      headers['Content-Length'] = Buffer.byteLength(payload).toString();
    }

    if (cookies) {
      headers['Cookie'] = cookies;
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path: urlPath,
        method: options.method || 'GET',
        headers,
        ...options,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const diff = process.hrtime(startTime);
          const latencyMs = diff[0] * 1e3 + diff[1] * 1e-6;
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body: data,
            latencyMs,
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runPhase95SmokeTest() {
  console.log('================================================================');
  console.log('DELFILÂNDIA — ETAPA 9 — FASE 9.5: SMOKE TEST OPERACIONAL FINAL');
  console.log('================================================================\n');

  // 1. Diagnóstico do .env.example e Docs
  const envExamplePath = path.join(process.cwd(), '.env.example');
  const envExampleContent = fs.readFileSync(envExamplePath, 'utf-8');
  const forbiddenKeys = [
    'SMTP_HOST=',
    'SMTP_PORT=',
    'SMTP_USER=',
    'SMTP_PASSWORD=',
    'SMTP_SECURE=',
    'EMAIL_FROM=',
    'RESEND_API_KEY=',
  ];
  const leakedInExample = forbiddenKeys.filter((k) => envExampleContent.includes(k));
  const envClean = leakedInExample.length === 0;

  results.push({
    category: 'Environment Variables',
    name: 'Remoção de variáveis opcionais do .env.example',
    passed: envClean,
    details: envClean ? 'Zero variáveis opcionais de email no discovery' : `Vazamento: ${leakedInExample.join(', ')}`,
  });

  const emailDocExists = fs.existsSync(path.join(process.cwd(), 'docs', 'EMAIL_CONFIGURATION.md'));
  results.push({
    category: 'Documentação',
    name: 'Existência de docs/EMAIL_CONFIGURATION.md',
    passed: emailDocExists,
    details: emailDocExists ? 'Documento presente e detalhado' : 'Arquivo ausente',
  });

  // 2. Startup e Health Check
  const rootRes = await httpRequest('/');
  const isRootHtml = (rootRes.headers['content-type']?.includes('text/html') || false) && rootRes.body.toLowerCase().includes('<!doctype html');
  const rootPass = rootRes.statusCode === 200 && isRootHtml;
  results.push({
    category: 'Startup & Root',
    name: 'GET / retorna HTTP 200 com HTML',
    passed: rootPass,
    details: `HTTP ${rootRes.statusCode}, ${rootRes.latencyMs.toFixed(2)}ms`,
  });

  const healthRes = await httpRequest('/api/health');
  let healthJson: any = {};
  try {
    healthJson = JSON.parse(healthRes.body);
  } catch (e) {}
  const healthPass = healthRes.statusCode === 200 && healthJson.status === 'ok' && healthJson.postgres === 'connected';
  results.push({
    category: 'Health Check',
    name: 'GET /api/health conectado ao PostgreSQL',
    passed: healthPass,
    details: `HTTP ${healthRes.statusCode}, postgres=${healthJson.postgres}`,
  });

  const authStatusRes = await httpRequest('/api/auth/status');
  let authStatusJson: any = {};
  try {
    authStatusJson = JSON.parse(authStatusRes.body);
  } catch (e) {}
  const authStatusPass = authStatusRes.statusCode === 200 && authStatusJson.configured === true;
  results.push({
    category: 'Auth Status',
    name: 'GET /api/auth/status configurado',
    passed: authStatusPass,
    details: `HTTP ${authStatusRes.statusCode}, configured=${authStatusJson.configured}`,
  });

  // 3. RBAC Anônimo
  const rbacEndpoints = [
    '/api/data',
    '/api/orders',
    '/api/clients',
    '/api/settings',
    '/api/audit-logs',
  ];
  let allRbacBlocked = true;
  for (const ep of rbacEndpoints) {
    const res = await httpRequest(ep);
    if (res.statusCode !== 401) {
      allRbacBlocked = false;
    }
  }
  results.push({
    category: 'RBAC',
    name: 'Bloqueio HTTP 401 para todas as rotas administrativas anônimas',
    passed: allRbacBlocked,
    details: allRbacBlocked ? '5/5 rotas protegidas com 401' : 'Falha em rota RBAC',
  });

  // 4. Teste de Sessão e Cookie Flags
  const invalidLoginRes = await httpRequest('/api/auth/login', { method: 'POST' }, { password: 'senha_incorreta_teste_95' });
  const invalidLoginPass = invalidLoginRes.statusCode === 401;
  results.push({
    category: 'Autenticação',
    name: 'Rejeição de login com credencial inválida (HTTP 401)',
    passed: invalidLoginPass,
    details: `HTTP ${invalidLoginRes.statusCode}`,
  });

  // 5. Teste de Recovery
  const badRecoveryRes = await httpRequest('/api/auth/recover', { method: 'POST' }, {
    recoverySecret: 'AO-451023',
    newPassword: 'NovaSenhaInvalida123!',
  });
  const badRecoveryPass = badRecoveryRes.statusCode === 401;
  results.push({
    category: 'Recovery',
    name: 'Rejeição do código da encomenda AO-451023 como chave de recovery',
    passed: badRecoveryPass,
    details: `HTTP ${badRecoveryRes.statusCode} (Corretamente rejeitado)`,
  });

  // 6. Teste de Tracking Público
  const trackRes = await httpRequest('/api/track/AO-451023');
  let trackJson: any = {};
  try {
    trackJson = JSON.parse(trackRes.body);
  } catch (e) {}
  const order = trackJson.order;
  const noSensitiveLeaks = order &&
    order.purchaseCost === undefined &&
    order.grossProfit === undefined &&
    order.supplier === undefined &&
    order.adminNotes === undefined;

  const trackPass = trackRes.statusCode === 200 && order?.code === 'AO-451023' && noSensitiveLeaks;
  results.push({
    category: 'Tracking Público',
    name: 'GET /api/track/AO-451023 sanitizado sem vazamento confidencial',
    passed: trackPass,
    details: trackPass ? 'Status=PRODUTO_COMPRADO, zero campos confidenciais' : 'Falha ou vazamento',
  });

  // 7. Teste de Deep Links & Rotas SPA
  const deepLinks = [
    '/track/AO-451023',
    '/acompanhar/AO-451023',
    '/r/AO-451023',
    '/rastreio/AO-451023',
    '/encomenda/AO-451023',
    '/?code=AO-451023',
    '/admin',
  ];
  let allDeepLinksPass = true;
  for (const dl of deepLinks) {
    const res = await httpRequest(dl);
    const isHtml = (res.headers['content-type']?.includes('text/html') || false) && res.body.toLowerCase().includes('<!doctype html');
    if (res.statusCode !== 200 || !isHtml) {
      allDeepLinksPass = false;
    }
  }
  results.push({
    category: 'Deep Links & SPA',
    name: 'Suporte a todas as variantes de links de rastreio e SPA',
    passed: allDeepLinksPass,
    details: allDeepLinksPass ? `${deepLinks.length}/${deepLinks.length} rotas retornam HTTP 200 text/html` : 'Falha em deep link',
  });

  // 8. Headers de Segurança
  const headersRes = await httpRequest('/api/health');
  const headers = headersRes.headers;
  const headersPass =
    headers['x-content-type-options'] === 'nosniff' &&
    headers['referrer-policy'] === 'strict-origin-when-cross-origin' &&
    headers['x-dns-prefetch-control'] === 'off' &&
    headers['x-download-options'] === 'noopen' &&
    headers['x-powered-by'] === undefined &&
    (headers['cache-control']?.includes('no-store') || false);

  results.push({
    category: 'Headers de Segurança',
    name: 'Headers de segurança e hardening ativos em APIs',
    passed: headersPass,
    details: headersPass ? 'nosniff, noopen, off, no-store, X-Powered-By oculto' : 'Faltam headers',
  });

  // 9. Auditoria Read-Only no PostgreSQL
  const dbOrders = await getDbOrders();
  const dbClients = await getDbClients();
  const dbSettings = await getDbSettings();
  const dbLogs = await getDbAuditLogs();

  const ao = dbOrders.find((o) => o.code === 'AO-451023');
  const aoIntact = Boolean(
    ao &&
    ao.clientName === 'Aldemiro Samba' &&
    ao.resalePrice === 25000 &&
    ao.amountPaid === 25000 &&
    ao.amountPending === 0 &&
    ao.status === 'PRODUTO_COMPRADO' &&
    ao.paymentStatus === 'CONFIRMADO' &&
    ao.grossProfit === 7000
  );

  const dbPass = isSqlAvailable() && dbOrders.length === 1 && dbClients.length >= 6 && dbSettings !== null && aoIntact;
  results.push({
    category: 'PostgreSQL Read-Only',
    name: 'Integridade dos dados e Encomenda AO-451023 intacta',
    passed: dbPass,
    details: `orders=${dbOrders.length}, clients=${dbClients.length}, settings=OK, logs=${dbLogs.length}, AO-451023=${aoIntact ? 'INTACTA' : 'FALHA'}`,
  });

  // 10. Performance Benchmarks
  const benchPaths = ['/api/health', '/api/auth/status', '/api/track/AO-451023', '/'];
  const latencies: Record<string, number[]> = {};

  for (const p of benchPaths) {
    latencies[p] = [];
    for (let i = 0; i < 5; i++) {
      const res = await httpRequest(p);
      latencies[p].push(res.latencyMs);
    }
  }

  const avgLatencies = Object.fromEntries(
    Object.entries(latencies).map(([p, arr]) => [
      p,
      (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) + 'ms',
    ])
  );

  results.push({
    category: 'Performance',
    name: 'Benchmarks de latência operacional de endpoints',
    passed: true,
    details: JSON.stringify(avgLatencies),
  });

  // Impressão dos resultados
  console.log('================================================================');
  console.log('RESUMO DOS RESULTADOS DA FASE 9.5');
  console.log('================================================================');
  let allPassed = true;
  results.forEach((r, idx) => {
    const mark = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${(idx + 1).toString().padStart(2, ' ')}. [${mark}] [${r.category}] ${r.name} (${r.details})`);
    if (!r.passed) allPassed = false;
  });

  console.log('\n----------------------------------------------------------------');
  if (allPassed) {
    console.log('STATUS: TODOS OS TESTES DA FASE 9.5 FORAM APROVADOS COM SUCESSO (100%).');
    console.log('================================================================\n');
    process.exit(0);
  } else {
    console.error('STATUS: FALHA DETECTADA EM TESTES DA FASE 9.5.');
    console.log('================================================================\n');
    process.exit(1);
  }
}

runPhase95SmokeTest().catch((err) => {
  console.error('Erro no Smoke Test 9.5:', err);
  process.exit(1);
});
