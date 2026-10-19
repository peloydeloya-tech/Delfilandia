import http from 'http';
import dotenv from 'dotenv';
dotenv.config();

import { getOrInitAdminRecoverySecret, hashPassword, verifyPassword } from '../server/utils/crypto';
import { getDbOrders, getDbSettings } from '../src/db/repository';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function httpRequest(path: string, options: http.RequestOptions = {}, bodyData?: any): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string; latencyMs: number }> {
  return new Promise((resolve, reject) => {
    const startTime = process.hrtime();
    const headers = { ...(options.headers || {}) };
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

    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method: options.method || 'GET',
      headers,
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
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runRecoveryVerification() {
  console.log('================================================================');
  console.log('DELFILÂNDIA — ETAPA 9 — FASE 9.4 (ISOLADA): RECUPERAÇÃO SEGURA');
  console.log('================================================================\n');

  // Obtém ou inicializa o segredo server-side de recuperação
  const TEST_RECOVERY_SECRET = getOrInitAdminRecoverySecret();

  // 1. Inspecionar status de autenticação inicial
  console.log('--- 1. AUDITORIA E STATUS DE AUTENTICAÇÃO ---');
  const statusRes = await httpRequest('/api/auth/status');
  const statusJson = JSON.parse(statusRes.body);
  const statusPass = statusRes.statusCode === 200 && statusJson.user === null && statusJson.isAuthenticated === false;
  results.push({ name: 'Auth Status: GET /api/auth/status anônimo e sem vazamento', passed: statusPass, details: `HTTP ${statusRes.statusCode}` });
  console.log(`[${statusPass ? 'PASS' : 'FAIL'}] GET /api/auth/status: configured=${statusJson.configured}, isAuthenticated=${statusJson.isAuthenticated}`);

  // 2. Testar rejeição de login com credencial inexistente
  console.log('\n--- 2. TESTE DE LOGIN NÃO AUTORIZADO (SENHA PERDIDA) ---');
  const badLoginRes = await httpRequest('/api/auth/login', { method: 'POST' }, {
    email: 'acmscorporation@gmail.com',
    password: 'WrongLostPassword123'
  });
  const badLoginJson = JSON.parse(badLoginRes.body);
  const badLoginPass = (badLoginRes.statusCode === 401 || badLoginRes.statusCode === 423) && (badLoginJson.failedAttempts >= 1 || badLoginJson.isLocked === true);
  results.push({ name: 'Login Rejeitado: Senha incorreta bloqueada com HTTP 401/423', passed: badLoginPass, details: `HTTP ${badLoginRes.statusCode}` });
  console.log(`[${badLoginPass ? 'PASS' : 'FAIL'}] Login com senha incorreta: HTTP ${badLoginRes.statusCode} (${badLoginJson.error})`);

  // 3. Testar tentativas adversariais no endpoint de recuperação
  console.log('\n--- 3. TESTES DE RECUPERAÇÃO ADVERSARIAL & PROTEÇÃO CONTRA ABUSO ---');
  
  // A) Tentativa sem secret nem código
  const emptyRecoverRes = await httpRequest('/api/auth/recover', { method: 'POST' }, {});
  const emptyRecoverPass = emptyRecoverRes.statusCode === 401;
  results.push({ name: 'Abuso: Tentativa de recuperação sem credencial (HTTP 401)', passed: emptyRecoverPass, details: `HTTP ${emptyRecoverRes.statusCode}` });
  console.log(`[${emptyRecoverPass ? 'PASS' : 'FAIL'}] Recuperação sem payload: HTTP ${emptyRecoverRes.statusCode}`);

  // B) Tentativa com código/secret incorreto
  const invalidSecretRes = await httpRequest('/api/auth/recover', { method: 'POST' }, {
    adminRecoverySecret: 'INVALID_SECRET_ATTEMPT',
    newPassword: 'SomePassword123!',
  });
  const invalidSecretPass = invalidSecretRes.statusCode === 401;
  results.push({ name: 'Abuso: Tentativa com segredo incorreto (HTTP 401)', passed: invalidSecretPass, details: `HTTP ${invalidSecretRes.statusCode}` });
  console.log(`[${invalidSecretPass ? 'PASS' : 'FAIL'}] Recuperação com segredo errado: HTTP ${invalidSecretRes.statusCode}`);

  // C) Tentativa com SQL Injection no recovery secret
  const sqliRecoverRes = await httpRequest('/api/auth/recover', { method: 'POST' }, {
    adminRecoverySecret: "' OR '1'='1' --",
    newPassword: 'SomePassword123!',
  });
  const sqliRecoverPass = sqliRecoverRes.statusCode === 401;
  results.push({ name: 'Segurança: SQL Injection no recovery secret bloqueado (HTTP 401)', passed: sqliRecoverPass, details: `HTTP ${sqliRecoverRes.statusCode}` });
  console.log(`[${sqliRecoverPass ? 'PASS' : 'FAIL'}] SQL Injection bloqueado: HTTP ${sqliRecoverRes.statusCode}`);

  // D) Tentativa usando o código da encomenda AO-451023 como segredo
  const orderCodeRecoverRes = await httpRequest('/api/auth/recover', { method: 'POST' }, {
    recoveryCode: 'AO-451023',
    newPassword: 'SomePassword123!',
  });
  const orderCodePass = orderCodeRecoverRes.statusCode === 401;
  results.push({ name: 'Segurança: Uso de código de encomenda como credencial bloqueado (HTTP 401)', passed: orderCodePass, details: `HTTP ${orderCodeRecoverRes.statusCode}` });
  console.log(`[${orderCodePass ? 'PASS' : 'FAIL'}] Tentativa com AO-451023: HTTP ${orderCodeRecoverRes.statusCode}`);

  // E) Tentativa com senha muito curta
  const shortPassRes = await httpRequest('/api/auth/recover', { method: 'POST' }, {
    adminRecoverySecret: 'INVALID_SECRET_TEST',
    newPassword: '123',
  });
  const shortPassPass = shortPassRes.statusCode === 401 || shortPassRes.statusCode === 400;
  results.push({ name: 'Validação: Tentativa inválida/curta rejeitada', passed: shortPassPass, details: `HTTP ${shortPassRes.statusCode}` });
  console.log(`[${shortPassPass ? 'PASS' : 'FAIL'}] Validação de tentativa: HTTP ${shortPassRes.statusCode}`);

  // 4. Teste de Criptografia e Validação Scrypt em Isolamento
  console.log('\n--- 4. TESTE ISOLADO DO MOTOR CRIPTOGRÁFICO SCRYPT ---');
  const testPassword = 'Isolated_Recovery_Test_2026!#';
  const hashed = await hashPassword(testPassword);
  const verifyValid = await verifyPassword(testPassword, hashed);
  const verifyInvalid = await verifyPassword('IncorrectPassword123', hashed);
  const cryptoEnginePass = hashed.startsWith('$scrypt$') && verifyValid.isValid === true && verifyInvalid.isValid === false;
  results.push({ name: 'Criptografia: Algoritmo scrypt validado isoladamente', passed: cryptoEnginePass, details: `Valid=${verifyValid.isValid}, Reject=${!verifyInvalid.isValid}` });
  console.log(`[${cryptoEnginePass ? 'PASS' : 'FAIL'}] Motor scrypt isolado testado com sucesso`);

  // 5. Teste do Guard de Mutação de Produção
  console.log('\n--- 5. TESTE DO PRODUCTION AUTH MUTATION GUARD ---');
  const guardRes = await httpRequest('/api/auth/recover', {
    method: 'POST',
    headers: { 'x-test-mutation-guard': 'true' }
  }, {
    adminRecoverySecret: TEST_RECOVERY_SECRET,
    newPassword: 'SomeNewPassword123!'
  });
  const guardJson = JSON.parse(guardRes.body);
  const guardPass = guardRes.statusCode === 403 && guardJson.blocked === true;
  results.push({ name: 'Guard: Mutação de auth bloqueada em ambiente de teste (HTTP 403)', passed: guardPass, details: `HTTP ${guardRes.statusCode}, msg="${guardJson.error}"` });
  console.log(`[${guardPass ? 'PASS' : 'FAIL'}] Mutation Guard: HTTP ${guardRes.statusCode} (${guardJson.error})`);

  // 6. Validação de Tracking Público e Sanitização de Dados
  console.log('\n--- 6. VALIDAÇÃO DE TRACKING PÚBLICO & DEEP LINKS ---');
  const trackRes = await httpRequest('/api/track/AO-451023');
  const trackJson = JSON.parse(trackRes.body);
  const order = trackJson.order || trackJson;
  const forbiddenFields = ['purchaseCost', 'purchaseLocation', 'deliveryCost', 'otherCosts', 'grossProfit', 'netProfit', 'adminNotes', 'supplier', 'clientPhone'];
  const leaked = forbiddenFields.filter(f => f in order);
  const trackPass = trackRes.statusCode === 200 && order.code === 'AO-451023' && leaked.length === 0;
  results.push({ name: 'Tracking: GET /api/track/AO-451023 intacto e 100% sanitizado', passed: trackPass, details: `Code: ${order.code}, Zero Leaks: ${leaked.length === 0}` });
  console.log(`[${trackPass ? 'PASS' : 'FAIL'}] Tracking Público: HTTP ${trackRes.statusCode}, Code=${order.code}, Leaks=${leaked.length}`);

  // 7. Não-destrutividade da base de dados
  console.log('\n--- 7. AUDITORIA DE PRESERVAÇÃO DE DADOS ---');
  const dbOrders = await getDbOrders();
  const dbSettings = await getDbSettings();
  const dbOrderAo = dbOrders.find(o => o.code === 'AO-451023');
  const dbPreserved = dbOrders.length === 1 && Boolean(dbOrderAo) && Boolean(dbSettings?.adminPasswordHash);
  results.push({ name: 'Auditoria: Dados de produção e adminPasswordHash intactos', passed: dbPreserved, details: `Orders=${dbOrders.length}, HashPresent=${Boolean(dbSettings?.adminPasswordHash)}` });
  console.log(`[${dbPreserved ? 'PASS' : 'FAIL'}] Estado do PostgreSQL: Orders=${dbOrders.length}, HashPresent=${Boolean(dbSettings?.adminPasswordHash)}`);

  console.log('\n================================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`TOTAL DE TESTES EXECUTADOS: ${total}`);
  console.log(`TESTES APROVADOS: ${passed}`);
  console.log(`TESTES FALHADOS: ${failed}`);
  console.log(`STATUS DA FASE 9.4 (ISOLADA): ${failed === 0 ? '✅ 100% APROVADA' : '❌ FALHAS DETECTADAS'}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runRecoveryVerification().catch(err => {
  console.error('Erro na execução do teste de recuperação:', err);
  process.exit(1);
});
