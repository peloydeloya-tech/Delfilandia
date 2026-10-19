/**
 * ============================================================================
 * DELFILÂNDIA — ETAPA 9 — FASE 9.10: AUDITORIA FINAL READ-ONLY & GATE DE ENCERRAMENTO
 * ============================================================================
 */

import http from 'http';
import dotenv from 'dotenv';
dotenv.config();

import { createPool, isSqlConfigured, closePool, isSqlAvailable } from '../src/db/index.ts';
import { getOrInitAdminRecoverySecret } from '../server/utils/crypto.ts';

interface AuditResult {
  section: string;
  name: string;
  passed: boolean;
  type: 'TESTADO' | 'VALIDADO POR REGRESSÃO' | 'VALIDADO POR INSPEÇÃO';
  details: string;
}

const auditResults: AuditResult[] = [];

function httpRequest(
  path: string,
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
        path,
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

async function runPhase910Audit() {
  console.log('================================================================');
  console.log('DELFILÂNDIA — ETAPA 9 — FASE 9.10: AUDITORIA FINAL DE PRODUÇÃO');
  console.log('================================================================\n');

  // 1. Conexão PostgreSQL e Baseline Inicial (Read-Only)
  const pool = createPool();
  if (!pool) {
    console.error('ERRO FATAL: Pool PostgreSQL não disponível.');
    process.exit(1);
  }

  // 1.1 Contagens Iniciais
  const ordersCountRes = await pool.query('SELECT COUNT(*) as count FROM orders');
  const clientsCountRes = await pool.query('SELECT COUNT(*) as count FROM clients');
  const settingsCountRes = await pool.query('SELECT COUNT(*) as count FROM app_settings');
  const logsCountRes = await pool.query('SELECT COUNT(*) as count FROM audit_logs');

  const initialOrdersCount = parseInt(ordersCountRes.rows[0].count, 10);
  const initialClientsCount = parseInt(clientsCountRes.rows[0].count, 10);
  const initialSettingsCount = parseInt(settingsCountRes.rows[0].count, 10);
  const initialLogsCount = parseInt(logsCountRes.rows[0].count, 10);

  console.log('--- 1. BASELINE POSTGRESQL (READ-ONLY) ---');
  console.log(`- Encomendas: ${initialOrdersCount}`);
  console.log(`- Clientes: ${initialClientsCount}`);
  console.log(`- Configurações: ${initialSettingsCount}`);
  console.log(`- Logs de Auditoria: ${initialLogsCount}`);

  auditResults.push({
    section: 'PostgreSQL Baseline',
    name: 'Conexão e Contagens Iniciais',
    passed: initialOrdersCount === 1 && initialClientsCount >= 6 && initialSettingsCount === 1,
    type: 'TESTADO',
    details: `Orders=${initialOrdersCount}, Clients=${initialClientsCount}, Settings=${initialSettingsCount}, Logs=${initialLogsCount}`,
  });

  // 1.2 Encomenda Canónica AO-451023
  const orderRes = await pool.query("SELECT id, code, client_name, client_phone, resale_price, amount_paid, amount_pending, purchase_cost, gross_profit, status, payment_status, payment_method FROM orders WHERE code = 'AO-451023'");
  const canonicalOrder = orderRes.rows[0];
  const orderPreserved = Boolean(
    canonicalOrder &&
    canonicalOrder.client_name === 'Aldemiro Samba' &&
    Number(canonicalOrder.resale_price) === 25000 &&
    Number(canonicalOrder.amount_paid) === 25000 &&
    Number(canonicalOrder.amount_pending) === 0 &&
    Number(canonicalOrder.purchase_cost) === 18000 &&
    Number(canonicalOrder.gross_profit) === 7000 &&
    canonicalOrder.status === 'PRODUTO_COMPRADO' &&
    canonicalOrder.payment_status === 'CONFIRMADO' &&
    canonicalOrder.payment_method === 'EXPRESS'
  );

  console.log(`- Encomenda Canónica AO-451023: ${orderPreserved ? 'PRESERVADA' : 'CORROMPIDA'}`);
  auditResults.push({
    section: 'Integridade AO-451023',
    name: 'Preservação de Dados da Encomenda Canónica',
    passed: orderPreserved,
    type: 'TESTADO',
    details: `Cliente=${canonicalOrder?.client_name}, Preço=${canonicalOrder?.resale_price}, Custo=${canonicalOrder?.purchase_cost}, Lucro=${canonicalOrder?.gross_profit}, Status=${canonicalOrder?.status}`,
  });

  // 1.3 Estado da Credencial em app_settings
  const settingsRowRes = await pool.query("SELECT key, data, updated_at FROM app_settings WHERE key = 'global_settings'");
  const sData = settingsRowRes.rows[0]?.data || {};
  const isConfigured = sData.adminConfigured === true;
  const adminEmail = sData.adminEmail || '';
  const passHash = sData.adminPasswordHash || '';
  const isScrypt = passHash.startsWith('$scrypt$');
  const recoveryHash = sData.adminRecoveryCodeHash || '';

  const authStatePass = isConfigured && adminEmail === 'acmscorporation@gmail.com' && isScrypt && recoveryHash.length === 64;
  console.log(`- Autenticação Administrativa: Configurada=${isConfigured}, Email=${adminEmail}, Scrypt=${isScrypt}, RecHash=${recoveryHash.length === 64 ? 'OK' : 'MISSING'}\n`);
  auditResults.push({
    section: 'Autenticação',
    name: 'Preservação e Formato Criptográfico da Credencial',
    passed: authStatePass,
    type: 'TESTADO',
    details: `Configured=${isConfigured}, Email=${adminEmail}, ScryptFormat=${isScrypt}, Length=${passHash.length}`,
  });

  // 2. Health Check e Latência
  console.log('--- 2. OBSERVABILIDADE & HEALTH CHECK ---');
  const healthRes = await httpRequest('/api/health');
  const healthJson = JSON.parse(healthRes.body);
  const healthPass = healthRes.statusCode === 200 && healthJson.status === 'ok' && healthJson.postgres === 'connected';
  console.log(`[${healthPass ? 'PASS' : 'FAIL'}] GET /api/health: HTTP ${healthRes.statusCode}, Postgres=${healthJson.postgres}, Latência=${healthRes.latencyMs.toFixed(2)}ms`);
  auditResults.push({
    section: 'Observabilidade',
    name: 'Endpoint GET /api/health',
    passed: healthPass,
    type: 'TESTADO',
    details: `HTTP ${healthRes.statusCode}, Postgres=${healthJson.postgres}, Latência=${healthRes.latencyMs.toFixed(2)}ms`,
  });

  // 3. Auth Status
  console.log('--- 3. STATUS PÚBLICO DE AUTENTICAÇÃO ---');
  const authStatusRes = await httpRequest('/api/auth/status');
  const authStatusJson = JSON.parse(authStatusRes.body);
  const authStatusPass = authStatusRes.statusCode === 200 && authStatusJson.configured === true && authStatusJson.isAuthenticated === false && authStatusJson.user === null;
  console.log(`[${authStatusPass ? 'PASS' : 'FAIL'}] GET /api/auth/status: Configured=${authStatusJson.configured}, Auth=${authStatusJson.isAuthenticated}`);
  auditResults.push({
    section: 'Autenticação',
    name: 'Endpoint GET /api/auth/status (Anônimo & Sanitizado)',
    passed: authStatusPass,
    type: 'TESTADO',
    details: `HTTP ${authStatusRes.statusCode}, Configured=${authStatusJson.configured}, Auth=${authStatusJson.isAuthenticated}`,
  });

  // 4. RBAC: 12 Rotas Administrativas Protegidas
  console.log('--- 4. RBAC: VERIFICAÇÃO DE ROTAS ADMINISTRATIVAS PROTEGIDAS ---');
  const protectedRoutes = [
    { path: '/api/data', method: 'GET' },
    { path: '/api/orders', method: 'GET' },
    { path: '/api/orders', method: 'POST', body: { orders: [] } },
    { path: '/api/orders/1', method: 'PUT', body: { updatedOrder: {} } },
    { path: '/api/orders', method: 'DELETE' },
    { path: '/api/clients', method: 'GET' },
    { path: '/api/clients', method: 'POST', body: { clients: [] } },
    { path: '/api/settings', method: 'GET' },
    { path: '/api/settings', method: 'POST', body: { settings: {} } },
    { path: '/api/audit-logs', method: 'GET' },
    { path: '/api/audit-logs', method: 'POST', body: { auditLogs: [] } },
    { path: '/api/auth/change-credentials', method: 'POST', body: {} },
  ];

  let rbacPassCount = 0;
  for (const r of protectedRoutes) {
    const res = await httpRequest(r.path, { method: r.method }, r.body);
    if (res.statusCode === 401) {
      rbacPassCount++;
    }
  }

  const rbacPass = rbacPassCount === protectedRoutes.length;
  console.log(`[${rbacPass ? 'PASS' : 'FAIL'}] RBAC Protegido: ${rbacPassCount}/${protectedRoutes.length} rotas retornaram HTTP 401`);
  auditResults.push({
    section: 'RBAC',
    name: 'Proteção de 12 Rotas Administrativas contra Acesso Anônimo',
    passed: rbacPass,
    type: 'TESTADO',
    details: `${rbacPassCount}/${protectedRoutes.length} rotas protegidas com HTTP 401`,
  });

  // 5. Tracking Público e Sanitização
  console.log('--- 5. TRACKING PÚBLICO E SANITIZAÇÃO DE DADOS ---');
  const trackVariations = [
    'AO-451023',
    'ao-451023',
    'AO451023',
    'ao451023',
    ' AO-451023 ',
  ];

  let trackPassCount = 0;
  const privateFields = ['purchaseCost', 'purchaseLocation', 'deliveryCost', 'otherCosts', 'grossProfit', 'netProfit', 'adminNotes', 'supplier', 'clientPhone', 'adminPasswordHash', 'ADMIN_RECOVERY_SECRET'];
  let leakCount = 0;

  for (const code of trackVariations) {
    const res = await httpRequest(`/api/track/${encodeURIComponent(code)}`);
    if (res.statusCode === 200) {
      const json = JSON.parse(res.body);
      const order = json.order || json;
      if (order.code === 'AO-451023' && (order.clientFirstName?.includes('Aldemiro') || order.clientName?.includes('Aldemiro'))) {
        trackPassCount++;
      }
      for (const field of privateFields) {
        if (field in order || res.body.includes(`"${field}"`)) {
          leakCount++;
        }
      }
    }
  }

  const trackPass = trackPassCount === trackVariations.length && leakCount === 0;
  console.log(`[${trackPass ? 'PASS' : 'FAIL'}] Tracking Normalizado: ${trackPassCount}/${trackVariations.length} variações resolvidas, Leaks=${leakCount}`);
  auditResults.push({
    section: 'Tracking Público',
    name: 'Normalização Universal e Sanitização de Margens/Custos',
    passed: trackPass,
    type: 'TESTADO',
    details: `Variações=${trackPassCount}/${trackVariations.length}, Vazamentos Privados=${leakCount}`,
  });

  // 6. Deep Links SPA
  console.log('--- 6. DEEP LINKS PÚBLICOS SPA ---');
  const deepLinks = [
    '/',
    '/track/AO-451023',
    '/acompanhar/AO-451023',
    '/r/AO-451023',
    '/rastreio/AO-451023',
    '/encomenda/AO-451023',
    '/?code=AO-451023',
  ];

  let deepLinkPassCount = 0;
  for (const link of deepLinks) {
    const res = await httpRequest(link);
    const bodyLower = res.body.toLowerCase();
    if (res.statusCode === 200 && (bodyLower.includes('<!doctype html') || bodyLower.includes('<html'))) {
      deepLinkPassCount++;
    }
  }

  const deepLinkPass = deepLinkPassCount === deepLinks.length;
  console.log(`[${deepLinkPass ? 'PASS' : 'FAIL'}] Deep Links SPA: ${deepLinkPassCount}/${deepLinks.length} rotas retornaram HTML válido`);
  auditResults.push({
    section: 'Deep Links',
    name: 'Roteamento SPA de Rastreio Público',
    passed: deepLinkPass,
    type: 'TESTADO',
    details: `${deepLinkPassCount}/${deepLinks.length} deep links operacionais com fallback SPA`,
  });

  // 7. Security Headers
  console.log('--- 7. CABEÇALHOS DE SEGURANÇA HTTP ---');
  const rootRes = await httpRequest('/');
  const headers = rootRes.headers;
  const hasNoSniff = headers['x-content-type-options'] === 'nosniff';
  const hasReferrer = Boolean(headers['referrer-policy']);
  const noPoweredBy = headers['x-powered-by'] === undefined;

  const securityHeadersPass = hasNoSniff && hasReferrer && noPoweredBy;
  console.log(`[${securityHeadersPass ? 'PASS' : 'FAIL'}] Security Headers: nosniff=${hasNoSniff}, ReferrerPolicy=${hasReferrer}, HidePoweredBy=${noPoweredBy}`);
  auditResults.push({
    section: 'Segurança',
    name: 'Cabeçalhos HTTP de Segurança',
    passed: securityHeadersPass,
    type: 'TESTADO',
    details: `nosniff=${hasNoSniff}, referrer-policy=${headers['referrer-policy']}, no-x-powered-by=${noPoweredBy}`,
  });

  // 8. Resolução de ADMIN_RECOVERY_SECRET Server-Side
  console.log('--- 8. RESOLUÇÃO DE ADMIN_RECOVERY_SECRET ---');
  const masterSecret = getOrInitAdminRecoverySecret();
  const masterSecretPass = typeof masterSecret === 'string' && masterSecret.length >= 20;
  console.log(`[${masterSecretPass ? 'PASS' : 'FAIL'}] ADMIN_RECOVERY_SECRET: Comprimento=${masterSecret.length}`);
  auditResults.push({
    section: 'Recovery',
    name: 'Resolução Server-Side de ADMIN_RECOVERY_SECRET',
    passed: masterSecretPass,
    type: 'TESTADO',
    details: `Secret presente, length=${masterSecret.length}, restrito ao backend`,
  });

  // 9. Auditoria Final da Base de Dados (Não-Destrutividade)
  console.log('--- 9. AUDITORIA FINAL DE NÃO-DESTRUTIVIDADE ---');
  const finalOrdersCountRes = await pool.query('SELECT COUNT(*) as count FROM orders');
  const finalClientsCountRes = await pool.query('SELECT COUNT(*) as count FROM clients');
  const finalSettingsCountRes = await pool.query('SELECT COUNT(*) as count FROM app_settings');
  const finalLogsCountRes = await pool.query('SELECT COUNT(*) as count FROM audit_logs');

  const finalOrdersCount = parseInt(finalOrdersCountRes.rows[0].count, 10);
  const finalClientsCount = parseInt(finalClientsCountRes.rows[0].count, 10);
  const finalSettingsCount = parseInt(finalSettingsCountRes.rows[0].count, 10);
  const finalLogsCount = parseInt(finalLogsCountRes.rows[0].count, 10);

  const nonDestructivePass =
    finalOrdersCount === initialOrdersCount &&
    finalClientsCount === initialClientsCount &&
    finalSettingsCount === initialSettingsCount &&
    finalLogsCount >= initialLogsCount;

  console.log(`[${nonDestructivePass ? 'PASS' : 'FAIL'}] Não-Destrutividade Confirmada: Orders=${finalOrdersCount}, Clients=${finalClientsCount}, Settings=${finalSettingsCount}, Logs=${finalLogsCount}\n`);
  auditResults.push({
    section: 'Não-Destrutividade',
    name: 'Invariância Absoluta de Dados Comerciais e Estruturais',
    passed: nonDestructivePass,
    type: 'TESTADO',
    details: `Orders: ${initialOrdersCount}->${finalOrdersCount}, Clients: ${initialClientsCount}->${finalClientsCount}, Settings: ${initialSettingsCount}->${finalSettingsCount}, Logs: ${initialLogsCount}->${finalLogsCount}`,
  });

  await closePool();

  // Resumo Final
  console.log('================================================================');
  console.log('RESUMO FINAL DA AUDITORIA DA FASE 9.10');
  console.log('================================================================');
  let allPassed = true;
  auditResults.forEach((r, idx) => {
    const mark = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${(idx + 1).toString().padStart(2, ' ')}. [${mark}] [${r.type}] ${r.section} - ${r.name} (${r.details})`);
    if (!r.passed) allPassed = false;
  });

  console.log('\n----------------------------------------------------------------');
  if (allPassed) {
    console.log('STATUS FINAL DA AUDITORIA: 100% APROVADO');
    console.log('================================================================\n');
    process.exit(0);
  } else {
    console.error('STATUS FINAL DA AUDITORIA: FALHAS DETECTADAS');
    console.log('================================================================\n');
    process.exit(1);
  }
}

runPhase910Audit().catch((err) => {
  console.error('Erro fatal na auditoria:', err);
  process.exit(1);
});
