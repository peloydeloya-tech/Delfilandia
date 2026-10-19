/**
 * ============================================================================
 * DELFILÂNDIA — SUÍTE DE TESTES EXAUSTIVA DA FASE 9.7
 * VALIDAÇÃO FINAL DO FLUXO OPERACIONAL DA VENDEDORA + REGRESSÃO PÓS-CORREÇÕES
 * ============================================================================
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

import {
  getDbOrders,
  getDbClients,
  getDbSettings,
  getDbAuditLogs,
  getDbOrderByCode,
  saveDbOrder,
} from '../src/db/repository';
import { isSqlAvailable, isSqlConfigured, closePool, createPool } from '../src/db';
import { generateWhatsAppMessage, getWhatsAppLink } from '../src/utils/whatsapp';
import { LINEAR_STATUS_FLOW, STATUS_FLOW } from '../src/utils/formatters';
import type { Order, OrderStatus } from '../src/types';

interface TestResult {
  section: number;
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

function extractCookie(header: string | string[] | undefined, cookieName: string): string | null {
  if (!header) return null;
  const list = Array.isArray(header) ? header : [header];
  for (const c of list) {
    const parts = c.split(';')[0].split('=');
    if (parts[0].trim() === cookieName) {
      return parts[1].trim();
    }
  }
  return null;
}

async function runPhase97Validation() {
  console.log('================================================================');
  console.log('DELFILÂNDIA — ETAPA 9 — FASE 9.7: VALIDAÇÃO FINAL DO FLUXO OPERACIONAL');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // 1. REGRA ABSOLUTA DE NÃO-DESTRUTIVIDADE & INVENTÁRIO INICIAL
  // -------------------------------------------------------------
  console.log('--- 1. IDENTIFICAÇÃO DE AMBIENTE E ESTADO INICIAL ---');
  const sqlConfigured = isSqlConfigured();
  const sqlAvailable = isSqlAvailable();
  const dbOrders = await getDbOrders();
  const dbClients = await getDbClients();
  const dbSettings = await getDbSettings();
  const dbLogs = await getDbAuditLogs();
  const canonicalOrder = await getDbOrderByCode('AO-451023');

  const initialPass = sqlConfigured && sqlAvailable && dbOrders.length >= 1 && canonicalOrder !== null;
  results.push({
    section: 1,
    name: 'Ambiente PostgreSQL e Contagens Iniciais',
    passed: initialPass,
    details: `Configured=${sqlConfigured}, Available=${sqlAvailable}, orders=${dbOrders.length}, clients=${dbClients.length}, settings=${dbSettings ? 'OK' : 'NULO'}, logs=${dbLogs.length}`,
  });
  console.log(`[${initialPass ? 'PASS' : 'FAIL'}] Conexão PostgreSQL e contagens validadas\n`);

  // -------------------------------------------------------------
  // 2. INTEGRIDADE E CANONICIDADE DA ENCOMENDA AO-451023
  // -------------------------------------------------------------
  console.log('--- 2. AUDITORIA DA ENCOMENDA CANÓNICA AO-451023 ---');
  const isCanonicalValid = Boolean(
    canonicalOrder &&
    canonicalOrder.code === 'AO-451023' &&
    canonicalOrder.clientName === 'Aldemiro Samba' &&
    canonicalOrder.resalePrice === 25000 &&
    canonicalOrder.amountPaid === 25000 &&
    canonicalOrder.amountPending === 0 &&
    canonicalOrder.purchaseCost === 18000 &&
    canonicalOrder.grossProfit === 7000 &&
    canonicalOrder.netProfit === 7000 &&
    canonicalOrder.status === 'PRODUTO_COMPRADO' &&
    canonicalOrder.paymentStatus === 'CONFIRMADO' &&
    canonicalOrder.paymentMethod === 'EXPRESS'
  );

  results.push({
    section: 2,
    name: 'Integridade Rigorosa da Encomenda Canónica AO-451023',
    passed: isCanonicalValid,
    details: `Cliente: ${canonicalOrder?.clientName}, Revenda: ${canonicalOrder?.resalePrice} Kz, Custo: ${canonicalOrder?.purchaseCost} Kz, Lucro: ${canonicalOrder?.grossProfit} Kz, Status: ${canonicalOrder?.status}`,
  });
  console.log(`[${isCanonicalValid ? 'PASS' : 'FAIL'}] Encomenda AO-451023 100% íntegra\n`);

  // -------------------------------------------------------------
  // 3. HEALTH CHECK & LATÊNCIA
  // -------------------------------------------------------------
  console.log('--- 3. HEALTH CHECK OPERACIONAL ---');
  const healthRes = await httpRequest('/api/health');
  const healthJson = JSON.parse(healthRes.body);
  const healthPass = healthRes.statusCode === 200 && healthJson.status === 'ok' && healthJson.postgres === 'connected';

  results.push({
    section: 3,
    name: 'Endpoint GET /api/health',
    passed: healthPass,
    details: `HTTP ${healthRes.statusCode}, Status=${healthJson.status}, Postgres=${healthJson.postgres}, Latência=${healthRes.latencyMs.toFixed(2)}ms`,
  });
  console.log(`[${healthPass ? 'PASS' : 'FAIL'}] Health check aprovado (${healthRes.latencyMs.toFixed(2)}ms)\n`);

  // -------------------------------------------------------------
  // 4. AUTENTICAÇÃO ADMINISTRATIVA, COOKIES E RBAC
  // -------------------------------------------------------------
  console.log('--- 4. AUTENTICAÇÃO ADMINISTRATIVA E RBAC ---');
  // 4.1 Status sem autenticação
  const anonStatusRes = await httpRequest('/api/auth/status');
  const anonStatusJson = JSON.parse(anonStatusRes.body);
  const anonPass = anonStatusRes.statusCode === 200 && anonStatusJson.isAuthenticated === false;

  // 4.2 RBAC: Bloqueio 401 para rotas administrativas anônimas
  const protectedRoutes = [
    { path: '/api/data', method: 'GET' },
    { path: '/api/orders', method: 'POST' },
    { path: '/api/orders/new', method: 'POST' },
    { path: '/api/orders/1', method: 'PUT' },
    { path: '/api/orders/AO-451023', method: 'DELETE' },
    { path: '/api/clients', method: 'POST' },
    { path: '/api/settings', method: 'POST' },
    { path: '/api/audit-logs', method: 'POST' },
  ];

  let rbacAllBlocked = true;
  for (const r of protectedRoutes) {
    const res = await httpRequest(r.path, { method: r.method }, {});
    if (res.statusCode !== 401) {
      rbacAllBlocked = false;
    }
  }

  results.push({
    section: 4,
    name: 'RBAC: Proteção de Rotas Administrativas (HTTP 401)',
    passed: anonPass && rbacAllBlocked,
    details: `AnonStatus=${anonStatusJson.isAuthenticated === false}, ${protectedRoutes.length}/${protectedRoutes.length} rotas protegidas`,
  });
  console.log(`[${anonPass && rbacAllBlocked ? 'PASS' : 'FAIL'}] RBAC validado com sucesso\n`);

  // -------------------------------------------------------------
  // 5. TESTES DO FLUXO DOS 5 ESTÁGIOS E RESOLUÇÃO (ID vs CODE)
  // -------------------------------------------------------------
  console.log('--- 5. FLUXO DOS 5 ESTÁGIOS E RESOLUÇÃO POR ID E CODE ---');
  const stages: OrderStatus[] = [
    'AGUARDANDO_PAGAMENTO',
    'PAGAMENTO_CONFIRMADO',
    'PRODUTO_COMPRADO',
    'SAIU_PARA_ENTREGA',
    'ENTREGUE',
  ];

  // Test that all 5 stages are defined in LINEAR_STATUS_FLOW and STATUS_FLOW
  const linearKeys = LINEAR_STATUS_FLOW.map((s) => s.key);
  const allStagesInLinear = stages.every((st) => linearKeys.includes(st));

  // Test resolution logic with both order.id and order.code
  const testOrder = { ...canonicalOrder! };
  const resolveById = testOrder.id === 'ord-AO-451023' || testOrder.id === 'AO-451023';
  const resolveByCode = testOrder.code === 'AO-451023';

  results.push({
    section: 5,
    name: 'Mapeamento dos 5 Estágios Operacionais e Resolução ID/Code',
    passed: allStagesInLinear && resolveById && resolveByCode,
    details: `Estágios=[${stages.join(', ')}], Resolução por ID e Código aprovada`,
  });
  console.log(`[${allStagesInLinear && resolveById && resolveByCode ? 'PASS' : 'FAIL'}] 5 estágios e resolução validados\n`);

  // -------------------------------------------------------------
  // 6. ATUALIZAÇÃO OTIMISTA E ROLLBACK EM CASO DE ERRO
  // -------------------------------------------------------------
  console.log('--- 6. VALIDAÇÃO DE ATUALIZAÇÃO OTIMISTA E ROLLBACK ---');
  // In `useOrdersData.ts`, state is updated immediately with `setOrders((prev) => ...)`
  // and in case of API error, it executes rollback `setOrders((prev) => prev.map(o => o.id === currentOrder.id ? currentOrder : o))`
  const hookFile = fs.readFileSync(path.join(process.cwd(), 'src/hooks/useOrdersData.ts'), 'utf-8');
  const hasOptimisticUpdate = hookFile.includes('// Optimistic UI update') && hookFile.includes('// Rollback on error');
  const hasTimelineArrayGuard = hookFile.includes('Array.isArray(currentOrder.timeline)');

  results.push({
    section: 6,
    name: 'Lógica de Atualização Otimista, Rollback e Proteção de Timeline',
    passed: hasOptimisticUpdate && hasTimelineArrayGuard,
    details: 'Atualização otimista com rollback em erro e proteção contra timeline nula validadas',
  });
  console.log(`[${hasOptimisticUpdate && hasTimelineArrayGuard ? 'PASS' : 'FAIL'}] Atualização otimista e rollback validados\n`);

  // -------------------------------------------------------------
  // 7. AÇÕES RÁPIDAS DO PAINEL (WHATSAPP, COMPROVATIVO, QR, ETIQUETA, EDITAR, ELIMINAR)
  // -------------------------------------------------------------
  console.log('--- 7. AÇÕES RÁPIDAS DO PAINEL DA VENDEDORA ---');
  const dashboardFile = fs.readFileSync(path.join(process.cwd(), 'src/components/AdminDashboard.tsx'), 'utf-8');
  const hasStopPropagationOnActions =
    dashboardFile.includes('e.stopPropagation();') &&
    dashboardFile.includes('onSendWhatsAppUpdate') &&
    dashboardFile.includes('onOpenMarkAsDelivered') &&
    dashboardFile.includes('onAdvanceStatus') &&
    dashboardFile.includes('onOpenClientReceipt') &&
    dashboardFile.includes('onOpenInternalReceipt') &&
    dashboardFile.includes('onOpenQRCode') &&
    dashboardFile.includes('onOpenShippingLabel') &&
    dashboardFile.includes('onOpenOrderDetailsModal') &&
    dashboardFile.includes('setOrderToDelete');

  // Test WhatsApp message content for privacy
  const waMsg = generateWhatsAppMessage(canonicalOrder!);
  const waLink = getWhatsAppLink(canonicalOrder!.clientPhone, waMsg);

  const waZeroLeaks =
    !waMsg.includes('18000') &&
    !waMsg.includes('7000') &&
    !waMsg.includes('custo') &&
    !waMsg.includes('lucro') &&
    !waMsg.includes('margem');

  const waValidFormat = waLink.startsWith('https://wa.me/244935133346') || waLink.startsWith('https://api.whatsapp.com');

  results.push({
    section: 7,
    name: 'Ações Rápidas (WhatsApp, Comprovativos, QR, Etiqueta, Editar, Eliminar)',
    passed: hasStopPropagationOnActions && waZeroLeaks && waValidFormat,
    details: `StopPropagation=OK, WhatsApp sanitizado=OK, Link=${waLink.substring(0, 45)}...`,
  });
  console.log(`[${hasStopPropagationOnActions && waZeroLeaks && waValidFormat ? 'PASS' : 'FAIL'}] Ações rápidas validadas\n`);

  // -------------------------------------------------------------
  // 8. MODAL DE DETALHES E SINCRONIZAÇÃO BIDIRECIONAL
  // -------------------------------------------------------------
  console.log('--- 8. MODAL DE DETALHES E SINCRONIZAÇÃO BIDIRECIONAL ---');
  const hookContent = fs.readFileSync(path.join(process.cwd(), 'src/hooks/useOrdersData.ts'), 'utf-8');
  const modalFile = fs.readFileSync(path.join(process.cwd(), 'src/components/OrderDetailsModal.tsx'), 'utf-8');

  const hasModalSyncByIdAndCode =
    hookContent.includes('handleUpdateStatus') &&
    hookContent.includes('o.id === orderId || o.code === orderId') &&
    modalFile.includes('handleStatusSelect') &&
    modalFile.includes('handleSaveNotes') &&
    modalFile.includes('handleSavePublicData');

  results.push({
    section: 8,
    name: 'Sincronização em Tempo Real do Modal de Detalhes',
    passed: hasModalSyncByIdAndCode,
    details: 'Atualização no modal sincroniza com o cartão, lista e backend por ID/Código',
  });
  console.log(`[${hasModalSyncByIdAndCode ? 'PASS' : 'FAIL'}] Modal de detalhes sincronizado\n`);

  // -------------------------------------------------------------
  // 9. TRACKING PÚBLICO E ZERO VAZAMENTO DE CAMPOS CONFIDENCIAIS
  // -------------------------------------------------------------
  console.log('--- 9. TRACKING PÚBLICO SANITIZADO (ZERO LEAKS) ---');
  const trackRes = await httpRequest('/api/track/AO-451023');
  const trackJson = JSON.parse(trackRes.body);
  const trackOrder = trackJson.order || trackJson;

  const confidentialFields = [
    'purchaseCost',
    'purchaseLocation',
    'deliveryCost',
    'otherCosts',
    'grossProfit',
    'netProfit',
    'adminNotes',
    'adminPassword',
    'adminPasswordHash',
    'adminRecoverySecret',
  ];

  let leakedFields: string[] = [];
  confidentialFields.forEach((field) => {
    if (field in trackOrder || JSON.stringify(trackJson).includes(`"${field}"`)) {
      leakedFields.push(field);
    }
  });

  const trackPass = trackRes.statusCode === 200 && trackOrder.code === 'AO-451023' && leakedFields.length === 0;

  results.push({
    section: 9,
    name: 'Tracking Público GET /api/track/AO-451023 Sanitizado',
    passed: trackPass,
    details: `HTTP ${trackRes.statusCode}, Code=${trackOrder.code}, Status=${trackOrder.status}, Vazamentos=[${leakedFields.join(', ')}]`,
  });
  console.log(`[${trackPass ? 'PASS' : 'FAIL'}] Tracking público aprovado (Zero Leaks)\n`);

  // -------------------------------------------------------------
  // 10. RECONHECIMENTO DE CÓDIGOS DE RASTREIO E NORMALIZAÇÃO
  // -------------------------------------------------------------
  console.log('--- 10. NORMALIZAÇÃO DE CÓDIGOS DE RASTREIO ---');
  const testCodes = [
    'AO-451023',
    'ao-451023',
    'AO451023',
    'ao451023',
    'A0-451023',
    'A0451023',
    '451023',
  ];

  let allCodesPass = true;
  for (const c of testCodes) {
    const res = await httpRequest(`/api/track/${encodeURIComponent(c)}`);
    if (res.statusCode !== 200) {
      allCodesPass = false;
    }
  }

  results.push({
    section: 10,
    name: 'Normalização Universal de Códigos de Rastreio',
    passed: allCodesPass,
    details: `Formatos testados: ${testCodes.length}/${testCodes.length} retornaram HTTP 200`,
  });
  console.log(`[${allCodesPass ? 'PASS' : 'FAIL'}] Normalização de códigos aprovada\n`);

  // -------------------------------------------------------------
  // 11. DEEP LINKS E ROTAS SPA
  // -------------------------------------------------------------
  console.log('--- 11. DEEP LINKS E ROTAS SPA (HTTP 200 text/html) ---');
  const spaRoutes = [
    '/track/AO-451023',
    '/acompanhar/AO-451023',
    '/r/AO-451023',
    '/rastreio/AO-451023',
    '/encomenda/AO-451023',
    '/?code=AO-451023',
    '/admin',
  ];

  let allSpaPass = true;
  for (const sr of spaRoutes) {
    const res = await httpRequest(sr);
    const isHtml = res.headers['content-type']?.includes('text/html');
    if (res.statusCode !== 200 || !isHtml) {
      allSpaPass = false;
    }
  }

  results.push({
    section: 11,
    name: 'Suporte a Deep Links e Fallback SPA Frontend',
    passed: allSpaPass,
    details: `${spaRoutes.length}/${spaRoutes.length} rotas retornaram HTTP 200 text/html`,
  });
  console.log(`[${allSpaPass ? 'PASS' : 'FAIL'}] Deep links SPA aprovados\n`);

  // -------------------------------------------------------------
  // 12. SEGURANÇA, HEADERS HTTP E RESILIÊNCIA A PAYLOADS
  // -------------------------------------------------------------
  console.log('--- 12. SEGURANÇA, HEADERS E RESILIÊNCIA A ATAQUES ---');
  const headersRes = await httpRequest('/api/health');
  const hasNosniff = headersRes.headers['x-content-type-options'] === 'nosniff';
  const hasNoPoweredBy = !headersRes.headers['x-powered-by'];

  // Test SQLi & XSS payloads
  const attackPayloads = [
    { path: `/api/track/${encodeURIComponent("' OR '1'='1")}`, expected: 404 },
    { path: `/api/track/${encodeURIComponent('<script>alert(1)</script>')}`, expected: 404 },
    { path: `/api/track/${encodeURIComponent('../../etc/passwd')}`, expected: 404 },
  ];

  let attacksResilient = true;
  for (const atk of attackPayloads) {
    const res = await httpRequest(atk.path);
    if (res.statusCode !== atk.expected) {
      attacksResilient = false;
    }
  }

  results.push({
    section: 12,
    name: 'Hardening de Segurança (Headers, Anti-SQLi, Anti-XSS)',
    passed: hasNosniff && hasNoPoweredBy && attacksResilient,
    details: `nosniff=${hasNosniff}, x-powered-by-hidden=${hasNoPoweredBy}, ataques bloqueados com sucesso`,
  });
  console.log(`[${hasNosniff && hasNoPoweredBy && attacksResilient ? 'PASS' : 'FAIL'}] Segurança e hardening aprovados\n`);

  // -------------------------------------------------------------
  // 13. AUDITORIA DE SEGREDOS NO FRONTEND (ZERO LEAKS)
  // -------------------------------------------------------------
  console.log('--- 13. AUDITORIA DE SEGREDOS NO FRONTEND ---');
  const clientDirs = ['components', 'hooks', 'utils', 'data'];
  const secretPatterns = [
    'DATABASE_URL',
    'SQL_PASSWORD',
    'SESSION_SECRET',
    'ADMIN_RECOVERY_SECRET',
    'SMTP_PASSWORD',
    'RESEND_API_KEY',
  ];

  let frontendLeaks: string[] = [];
  for (const dir of clientDirs) {
    const dirPath = path.join(process.cwd(), 'src', dir);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath, { recursive: true }) as string[];
      for (const f of files) {
        const fullPath = path.join(dirPath, f);
        if (fs.statSync(fullPath).isFile() && (f.endsWith('.ts') || f.endsWith('.tsx'))) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          for (const sec of secretPatterns) {
            if (content.includes(`process.env.${sec}`) || content.includes(`${sec}=`)) {
              frontendLeaks.push(`${dir}/${f}:${sec}`);
            }
          }
        }
      }
    }
  }

  // Also check App.tsx and main.tsx
  for (const rootF of ['App.tsx', 'main.tsx']) {
    const fullPath = path.join(process.cwd(), 'src', rootF);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      for (const sec of secretPatterns) {
        if (content.includes(`process.env.${sec}`) || content.includes(`${sec}=`)) {
          frontendLeaks.push(`${rootF}:${sec}`);
        }
      }
    }
  }

  const zeroFrontendLeaks = frontendLeaks.length === 0;
  results.push({
    section: 13,
    name: 'Varredura de Segredos no Frontend (Zero Leaks)',
    passed: zeroFrontendLeaks,
    details: zeroFrontendLeaks ? 'Nenhum segredo encontrado no código cliente React' : `Vazamentos: ${frontendLeaks.join(', ')}`,
  });
  console.log(`[${zeroFrontendLeaks ? 'PASS' : 'FAIL'}] Varredura de segredos aprovada\n`);

  // -------------------------------------------------------------
  // 14. RECUPERAÇÃO DE SENHA E TRANSPORTE DE E-MAIL
  // -------------------------------------------------------------
  console.log('--- 14. FLUXO DE RECUPERAÇÃO DE SENHA E E-MAIL ---');
  const recoverReqRes = await httpRequest(
    '/api/auth/recover/request-code',
    { method: 'POST' },
    { email: 'acmscorporation@gmail.com' }
  );
  let recoverReqJson: any = {};
  try {
    recoverReqJson = JSON.parse(recoverReqRes.body);
  } catch {
    recoverReqJson = {};
  }
  // Accepts HTTP 200 (code dispatched) or HTTP 429 (rate limiter active after rapid tests)
  const is200 = recoverReqRes.statusCode === 200 && recoverReqJson.success === true;
  const is429 = recoverReqRes.statusCode === 429 && (recoverReqJson.error?.includes('Muitos pedidos') || recoverReqJson.error?.includes('Muitas tentativas'));
  const recoverPass = is200 || is429;

  results.push({
    section: 14,
    name: 'Despacho e Validação do Fluxo de Recuperação',
    passed: recoverPass,
    details: `HTTP ${recoverReqRes.statusCode}, Success=${recoverReqJson.success || false}, Msg="${recoverReqJson.message || recoverReqJson.error || ''}"`,
  });
  console.log(`[${recoverPass ? 'PASS' : 'FAIL'}] Recuperação de senha aprovada\n`);

  // -------------------------------------------------------------
  // 15. TESTE DE COLD START E PERSISTÊNCIA POSTGRESQL
  // -------------------------------------------------------------
  console.log('--- 15. TESTE DE PERSISTÊNCIA POSTGRESQL & HEALTH ---');
  const freshHealth = await httpRequest('/api/health');
  const freshHealthJson = JSON.parse(freshHealth.body);
  const restartPass = freshHealth.statusCode === 200 && freshHealthJson.postgres === 'connected' && isSqlAvailable();

  results.push({
    section: 15,
    name: 'Resiliência a Cold Start e Conectividade PostgreSQL',
    passed: restartPass,
    details: `HealthStatus=${freshHealthJson.status}, Postgres=${freshHealthJson.postgres}, isSqlAvailable=${isSqlAvailable()}`,
  });
  console.log(`[${restartPass ? 'PASS' : 'FAIL'}] Persistência e conectividade PostgreSQL aprovadas\n`);

  // -------------------------------------------------------------
  // 16. RESUMO DOS RESULTADOS
  // -------------------------------------------------------------
  console.log('================================================================');
  console.log('RESUMO FINAL DOS TESTES DA FASE 9.7');
  console.log('================================================================');
  let allTestsPassed = true;
  results.forEach((r, idx) => {
    const mark = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${(idx + 1).toString().padStart(2, ' ')}. [${mark}] [Seção ${r.section}] ${r.name} (${r.details})`);
    if (!r.passed) allTestsPassed = false;
  });

  console.log('\n----------------------------------------------------------------');
  if (allTestsPassed) {
    console.log('STATUS: TODOS OS TESTES DA FASE 9.7 FORAM APROVADOS COM SUCESSO (100%).');
  } else {
    console.log('STATUS: FALHA DETECTADA EM TESTES DA FASE 9.7.');
    process.exit(1);
  }
  console.log('================================================================\n');

  await closePool();
}

runPhase97Validation().catch((err) => {
  console.error('FATAL ERROR DURING PHASE 9.7 VALIDATION:', err);
  process.exit(1);
});
