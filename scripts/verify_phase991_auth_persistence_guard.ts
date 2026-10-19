/**
 * ============================================================================
 * DELFILÂNDIA — SUÍTE DE TESTES DA ETAPA 9 — FASE 9.9.1
 * GUARDA DE MUTATIVIDADE DE AUTENTICAÇÃO E CORREÇÃO DEFINITIVA DE PERSISTÊNCIA
 * ============================================================================
 */

import http from 'http';
import dotenv from 'dotenv';
dotenv.config();

import { getDbOrders, getDbClients, getDbSettings, getDbAuditLogs } from '../src/db/repository';
import { isSqlAvailable } from '../src/db';
import { getOrInitAdminRecoverySecret, hashPassword, verifyPassword } from '../server/utils/crypto';
import { mergePreservedSettings } from '../src/utils/settingsPreservation';
import { DEFAULT_SETTINGS } from '../src/data/mockData';

interface TestResult {
  section: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

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

async function runPhase991Suite() {
  console.log('================================================================');
  console.log('DELFILÂNDIA — FASE 9.9.1: GUARDA DE MUTATIVIDADE E PERSISTÊNCIA');
  console.log('================================================================\n');

  // 1. Conectividade & Baseline de Dados
  console.log('--- 1. CONECTIVIDADE E BASELINE DE DADOS ---');
  const sqlAvailable = isSqlAvailable();
  const initialOrders = await getDbOrders();
  const initialClients = await getDbClients();
  const initialSettings = await getDbSettings();
  const initialLogs = await getDbAuditLogs();

  const orderAo = initialOrders.find((o) => o.code === 'AO-451023');
  const orderAoValid = Boolean(
    orderAo &&
    orderAo.clientName === 'Aldemiro Samba' &&
    orderAo.resalePrice === 25000 &&
    orderAo.amountPaid === 25000
  );

  const baselinePass = sqlAvailable && initialOrders.length === 1 && initialClients.length >= 6 && orderAoValid && initialSettings !== null;
  results.push({
    section: 1,
    name: 'PostgreSQL Baseline: Estado de dados pré-teste intacto',
    passed: baselinePass,
    details: `SQL=${sqlAvailable}, Orders=${initialOrders.length}, Clients=${initialClients.length}, AO-451023=${orderAoValid ? 'OK' : 'FAIL'}`,
  });
  console.log(`[${baselinePass ? 'PASS' : 'FAIL'}] Baseline de dados validado\n`);

  // 2. Integridade e Presença do adminPasswordHash no PostgreSQL
  console.log('--- 2. INTEGRIDADE DA CREDENCIAL PERSISTIDA ---');
  const initialHash = initialSettings?.adminPasswordHash || '';
  const hashPresentAndScrypt = Boolean(initialHash && initialHash.startsWith('$scrypt$'));
  results.push({
    section: 2,
    name: 'Credencial Persistida: adminPasswordHash scrypt existente no PostgreSQL',
    passed: hashPresentAndScrypt,
    details: `Hash Presente=${Boolean(initialHash)}, IsScrypt=${hashPresentAndScrypt}, Length=${initialHash.length}`,
  });
  console.log(`[${hashPresentAndScrypt ? 'PASS' : 'FAIL'}] Credencial administrativa scrypt detectada no PostgreSQL\n`);

  // 3. Resolução Server-Side do ADMIN_RECOVERY_SECRET
  console.log('--- 3. RESOLUÇÃO DE ADMIN_RECOVERY_SECRET ---');
  const masterSecret = getOrInitAdminRecoverySecret();
  const secretValid = typeof masterSecret === 'string' && masterSecret.length >= 20;
  results.push({
    section: 3,
    name: 'ADMIN_RECOVERY_SECRET: Resolução server-side segura',
    passed: secretValid,
    details: `Secret length=${masterSecret.length}`,
  });
  console.log(`[${secretValid ? 'PASS' : 'FAIL'}] Segredo mestre resolvido\n`);

  // 4. Production Auth Mutation Guard (Bloqueio de Testes Automatizados)
  console.log('--- 4. PRODUCTION AUTH MUTATION GUARD ---');
  const guardHeaders = [
    { 'x-test-mutation-guard': 'true' },
    { 'x-delfilandia-test-suite': 'true' },
  ];

  let guardPassCount = 0;
  for (const h of guardHeaders) {
    const res = await httpRequest('/api/auth/recover', {
      method: 'POST',
      headers: h,
    }, {
      email: 'acmscorporation@gmail.com',
      recoverySecret: masterSecret,
      newPassword: 'Attempted_Test_Mutation_2026!#',
    });

    const json = JSON.parse(res.body);
    if (res.statusCode === 403 && json.blocked === true) {
      guardPassCount++;
    }
  }

  const guardPass = guardPassCount === guardHeaders.length;
  results.push({
    section: 4,
    name: 'Production Auth Mutation Guard: Bloqueio de mutações originadas por testes (HTTP 403)',
    passed: guardPass,
    details: `${guardPassCount}/${guardHeaders.length} cabeçalhos de teste bloqueados com sucesso`,
  });
  console.log(`[${guardPass ? 'PASS' : 'FAIL'}] Production Auth Mutation Guard validado (${guardPassCount}/${guardHeaders.length})\n`);

  // 5. Rejeição de Tentativas Inválidas / Adversariais
  console.log('--- 5. REJEIÇÃO DE TENTATIVAS ADVERSARIAIS ---');
  const badLoginRes = await httpRequest('/api/auth/login', { method: 'POST' }, {
    email: 'acmscorporation@gmail.com',
    password: 'DefinitelyWrongPassword123!',
  });
  const badSecretRes = await httpRequest('/api/auth/recover', { method: 'POST' }, {
    adminRecoverySecret: 'INVALID_RECOVERY_SECRET_ATTEMPT',
    newPassword: 'SomePassword123!',
  });
  const emptyPayloadRes = await httpRequest('/api/auth/recover', { method: 'POST' }, {});

  const rejectionPass =
    badLoginRes.statusCode === 401 &&
    badSecretRes.statusCode === 401 &&
    emptyPayloadRes.statusCode === 401;

  results.push({
    section: 5,
    name: 'Segurança & Rejeição: Credenciais incorretas bloqueadas (HTTP 401)',
    passed: rejectionPass,
    details: `BadLogin=${badLoginRes.statusCode}, BadSecret=${badSecretRes.statusCode}, Empty=${emptyPayloadRes.statusCode}`,
  });
  console.log(`[${rejectionPass ? 'PASS' : 'FAIL'}] Tentativas não autorizadas rejeitadas com HTTP 401\n`);

  // 6. RBAC: Rotas Administrativas Bloqueadas para Anônimos
  console.log('--- 6. RBAC: ROTAS ADMINISTRATIVAS ---');
  const protectedRoutes = [
    { path: '/api/data', method: 'GET' },
    { path: '/api/orders', method: 'GET' },
    { path: '/api/clients', method: 'GET' },
    { path: '/api/settings', method: 'GET' },
    { path: '/api/audit-logs', method: 'GET' },
  ];

  let rbacCount = 0;
  for (const r of protectedRoutes) {
    const res = await httpRequest(r.path, { method: r.method });
    if (res.statusCode === 401) {
      rbacCount++;
    }
  }

  const rbacPass = rbacCount === protectedRoutes.length;
  results.push({
    section: 6,
    name: 'RBAC: Proteção de rotas administrativas contra acesso anônimo (HTTP 401)',
    passed: rbacPass,
    details: `${rbacCount}/${protectedRoutes.length} rotas protegidas`,
  });
  console.log(`[${rbacPass ? 'PASS' : 'FAIL'}] RBAC validado (${rbacCount}/${protectedRoutes.length})\n`);

  // 7. Tracking Público e Sanitização de Dados
  console.log('--- 7. TRACKING PÚBLICO E SANITIZAÇÃO DE DADOS ---');
  const trackRes = await httpRequest('/api/track/AO-451023');
  const trackJson = JSON.parse(trackRes.body);
  const trackOrder = trackJson.order || trackJson;
  const privateFields = ['purchaseCost', 'purchaseLocation', 'deliveryCost', 'otherCosts', 'grossProfit', 'netProfit', 'adminNotes', 'supplier', 'clientPhone'];
  const leakFound = privateFields.filter((f) => f in trackOrder);

  const trackPass = trackRes.statusCode === 200 && trackOrder.code === 'AO-451023' && leakFound.length === 0;
  results.push({
    section: 7,
    name: 'Tracking Público: Consulta por código sem vazamento de margens ou custos',
    passed: trackPass,
    details: `HTTP ${trackRes.statusCode}, Code=${trackOrder.code}, Leaks=${leakFound.length}`,
  });
  console.log(`[${trackPass ? 'PASS' : 'FAIL'}] Tracking público validado\n`);

  // 8. Teste Unitário do Motor scrypt em Isolamento
  console.log('--- 8. MOTOR SCRYPT EM ISOLAMENTO ---');
  const fixturePassword = 'Isolated_Fixture_Pass_2026!#';
  const hashedFixture = await hashPassword(fixturePassword);
  const checkFixtureValid = await verifyPassword(fixturePassword, hashedFixture);
  const checkFixtureInvalid = await verifyPassword('Wrong_Fixture_Pass', hashedFixture);

  const scryptPass =
    hashedFixture.startsWith('$scrypt$v=1$') &&
    checkFixtureValid.isValid === true &&
    checkFixtureInvalid.isValid === false;

  results.push({
    section: 8,
    name: 'Criptografia: Motor scrypt validado isoladamente (Hashing e Verificação)',
    passed: scryptPass,
    details: `IsScrypt=${hashedFixture.startsWith('$scrypt$')}, ValidMatch=${checkFixtureValid.isValid}, RejectWrong=${!checkFixtureInvalid.isValid}`,
  });
  console.log(`[${scryptPass ? 'PASS' : 'FAIL'}] Motor scrypt isolado validado com sucesso\n`);

  // 9. Preservação de Configurações e Não-Sobrescrita por Defaults
  console.log('--- 9. ENGINE DE PRESERVAÇÃO DE CONFIGURAÇÕES ---');
  const mockSaved = {
    adminPasswordHash: '$scrypt$v=1$mock_persisted_hash',
    adminEmail: 'acmscorporation@gmail.com',
    adminConfigured: true,
    businessHours: '08:00 - 18:00',
  };
  const mergedResult = mergePreservedSettings(mockSaved, DEFAULT_SETTINGS);

  const mergePass =
    mergedResult.adminPasswordHash === '$scrypt$v=1$mock_persisted_hash' &&
    mergedResult.adminEmail === 'acmscorporation@gmail.com' &&
    mergedResult.adminConfigured === true;

  results.push({
    section: 9,
    name: 'Preservação: mergePreservedSettings impede que DEFAULT_SETTINGS apaguem credenciais',
    passed: mergePass,
    details: `HashPreserved=${mergedResult.adminPasswordHash === '$scrypt$v=1$mock_persisted_hash'}`,
  });
  console.log(`[${mergePass ? 'PASS' : 'FAIL'}] Engine de preservação validado\n`);

  // 10. Verificação Final de Invariância da Credencial no PostgreSQL
  console.log('--- 10. INVARIÂNCIA DA CREDENCIAL DE PRODUÇÃO ---');
  const finalSettings = await getDbSettings();
  const finalHash = finalSettings?.adminPasswordHash || '';
  const hashUnmutated = Boolean(
    initialHash.length > 0 &&
    finalHash.length > 0 &&
    finalHash === initialHash
  );

  results.push({
    section: 10,
    name: 'Invariância de Produção: adminPasswordHash permaneceu 100% inalterado',
    passed: hashUnmutated,
    details: `Initial=${initialHash.substring(0, 15)}..., Final=${finalHash.substring(0, 15)}..., Match=${hashUnmutated}`,
  });
  console.log(`[${hashUnmutated ? 'PASS' : 'FAIL'}] Credencial de produção 100% invariante\n`);

  // 11. Auditoria Final de Não-Destrutividade
  console.log('--- 11. AUDITORIA FINAL DE NÃO-DESTRUTIVIDADE ---');
  const finalOrders = await getDbOrders();
  const finalClients = await getDbClients();
  const finalLogs = await getDbAuditLogs();
  const finalOrderAo = finalOrders.find((o) => o.code === 'AO-451023');

  const finalCheckPass = Boolean(
    finalOrders.length === 1 &&
    finalClients.length >= 6 &&
    finalOrderAo &&
    finalOrderAo.clientName === 'Aldemiro Samba' &&
    finalOrderAo.resalePrice === 25000 &&
    finalLogs.length >= initialLogs.length
  );

  results.push({
    section: 11,
    name: 'Não-Destrutividade Final: Todos os dados de produção permanecem intactos',
    passed: finalCheckPass,
    details: `Orders=${finalOrders.length}, Clients=${finalClients.length}, Logs=${finalLogs.length}, AO-451023=${finalCheckPass ? 'INTACTA' : 'VIOLADA'}`,
  });
  console.log(`[${finalCheckPass ? 'PASS' : 'FAIL'}] Não-destrutividade final confirmada\n`);

  // Relatório Final
  console.log('================================================================');
  console.log('RESUMO FINAL DOS TESTES DA FASE 9.9.1');
  console.log('================================================================');
  let allPassed = true;
  results.forEach((r, idx) => {
    const mark = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${(idx + 1).toString().padStart(2, ' ')}. [${mark}] ${r.name} (${r.details})`);
    if (!r.passed) allPassed = false;
  });

  console.log('\n----------------------------------------------------------------');
  if (allPassed) {
    console.log('STATUS FINAL DA FASE 9.9.1: TODOS OS TESTES PASSARAM COM SUCESSO (100%).');
    console.log('================================================================\n');
    process.exit(0);
  } else {
    console.error('STATUS FINAL DA FASE 9.9.1: FALHA EM UM OU MAIS TESTES.');
    console.log('================================================================\n');
    process.exit(1);
  }
}

runPhase991Suite().catch((err) => {
  console.error('Erro fatal na execução dos testes da Fase 9.9.1:', err);
  process.exit(1);
});
