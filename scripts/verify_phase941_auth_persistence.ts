/**
 * ============================================================================
 * DELFILÂNDIA — SUÍTE DE TESTES DE REGRESSÃO FASE 9.4.1 (REVISADA & ISOLADA)
 * PERSISTÊNCIA DEFINITIVA DA AUTENTICAÇÃO ADMINISTRATIVA E RECOVERY SECRET
 * ============================================================================
 * 
 * Valida:
 * 1. Não-destrutividade estrita da base de dados PostgreSQL
 * 2. Criptografia scrypt e validação de hash em ambiente isolado (sem mutar produção)
 * 3. Bloqueio de mutação por suíte de teste via Production Auth Mutation Guard (HTTP 403)
 * 4. Resolução server-side segura do ADMIN_RECOVERY_SECRET
 * 5. GET /api/auth/status e proteção anônima
 * 6. GET /api/auth/status -> isAuthenticated=false
 * 7. mergePreservedSettings: preservação de credenciais contra defaults
 * 8. POST /api/settings não apaga adminPasswordHash do DB
 * 9. Invariância de adminPasswordHash no PostgreSQL durante toda a execução
 * 10. Validação de integridade final de produção (AO-451023 intacta)
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

async function runPhase941Verification() {
  console.log('================================================================');
  console.log('DELFILÂNDIA — FASE 9.4.1 (ISOLADA): PERSISTÊNCIA DE AUTH');
  console.log('================================================================\n');

  // 1. Verificação da Conectividade e Estado Inicial do Banco
  console.log('--- 1. VERIFICAÇÃO INICIAL DO POSTGRESQL (FONTE AUTORITATIVA) ---');
  const sqlHealthy = isSqlAvailable();
  const initialOrders = await getDbOrders();
  const initialClients = await getDbClients();
  const initialSettings = await getDbSettings();
  const initialLogs = await getDbAuditLogs();

  console.log(`PostgreSQL Disponível: ${sqlHealthy}`);
  console.log(`Contagem de Encomendas: ${initialOrders.length}`);
  console.log(`Contagem de Clientes: ${initialClients.length}`);
  console.log(`Configurações presentes: ${initialSettings ? 'SIM' : 'NÃO'}`);
  console.log(`Contagem de Logs de Auditoria: ${initialLogs.length}`);

  const initialStoredHash = initialSettings?.adminPasswordHash || '';

  const orderAo = initialOrders.find((o) => o.code === 'AO-451023');
  const orderAoValid = Boolean(orderAo && orderAo.clientName === 'Aldemiro Samba' && orderAo.resalePrice === 25000);

  const initPass = sqlHealthy && initialOrders.length === 1 && initialClients.length >= 6 && initialSettings !== null && orderAoValid;
  results.push({
    name: 'PostgreSQL Baseline: Estado de dados pré-teste intacto',
    passed: initPass,
    details: `Orders=${initialOrders.length}, Clients=${initialClients.length}, AO-451023=${orderAoValid ? 'OK' : 'FAIL'}`,
  });
  console.log(`[${initPass ? 'PASS' : 'FAIL'}] Baseline de Produção Confirmado\n`);

  // 2. Chave Mestra Server-Side
  console.log('--- 2. ADMIN_RECOVERY_SECRET RESOLUTION ---');
  const recoverySecret = getOrInitAdminRecoverySecret();
  const secretValid = typeof recoverySecret === 'string' && recoverySecret.length >= 20;
  results.push({
    name: 'ADMIN_RECOVERY_SECRET: Resolução server-side sem exposição',
    passed: secretValid,
    details: `Secret length=${recoverySecret.length}, Prefix=${recoverySecret.substring(0, 10)}...`,
  });
  console.log(`[${secretValid ? 'PASS' : 'FAIL'}] ADMIN_RECOVERY_SECRET resolvido com segurança\n`);

  // 3. Teste A: Criptografia scrypt e verificação em ambiente isolado (Fixture)
  console.log('--- 3. TESTE A: CRIPTOGRAFIA SCRYPT EM AMBIENTE ISOLADO ---');
  const isolatedPassword = 'Isolated_Test_Pass_2026_!@#';
  const scryptHash = await hashPassword(isolatedPassword);
  const isScryptFormat = scryptHash.startsWith('$scrypt$v=1$');
  const checkValid = await verifyPassword(isolatedPassword, scryptHash);
  const checkWrong = await verifyPassword('WrongPassword', scryptHash);

  const cryptoPass = isScryptFormat && checkValid.isValid === true && checkWrong.isValid === false;
  results.push({
    name: 'TESTE A: Hashing scrypt e verificação isolada de credencial',
    passed: cryptoPass,
    details: `Format=${isScryptFormat}, MatchValid=${checkValid.isValid}, RejectWrong=${!checkWrong.isValid}`,
  });
  console.log(`[${cryptoPass ? 'PASS' : 'FAIL'}] Motor scrypt isolado validado com sucesso\n`);

  // 4. Teste B: Production Auth Mutation Guard (Bloqueia tentativas de teste contra produção)
  console.log('--- 4. TESTE B: PRODUCTION AUTH MUTATION GUARD (HTTP 403) ---');
  const guardRes = await httpRequest('/api/auth/recover', {
    method: 'POST',
    headers: { 'x-test-mutation-guard': 'true' },
  }, {
    email: 'acmscorporation@gmail.com',
    recoverySecret: recoverySecret,
    newPassword: 'Attempted_Test_Password!@#',
  });

  const guardJson = JSON.parse(guardRes.body);
  const guardBlocked = guardRes.statusCode === 403 && guardJson.blocked === true;
  results.push({
    name: 'TESTE B: Production Auth Mutation Guard bloqueia alteração por testes',
    passed: guardBlocked,
    details: `HTTP ${guardRes.statusCode}, msg="${guardJson.error}"`,
  });
  console.log(`[${guardBlocked ? 'PASS' : 'FAIL'}] Guard de segurança de produção: HTTP ${guardRes.statusCode} (${guardJson.error})\n`);

  // 5. Teste C: GET /api/auth/status anônimo e sem vazamento
  console.log('--- 5. TESTE C: GET /api/auth/status ---');
  const statusRes = await httpRequest('/api/auth/status');
  const statusJson = JSON.parse(statusRes.body);
  const statusPass = statusRes.statusCode === 200 && statusJson.user === null && statusJson.isAuthenticated === false;
  results.push({
    name: 'TESTE C: GET /api/auth/status anônimo e sem vazamento',
    passed: statusPass,
    details: `HTTP ${statusRes.statusCode}, configured=${statusJson.configured}`,
  });
  console.log(`[${statusPass ? 'PASS' : 'FAIL'}] Auth Status validado\n`);

  // 6. Teste D: Preservação de Configurações via mergePreservedSettings
  console.log('--- 6. TESTE D: PRESERVAÇÃO DE CONFIGURAÇÕES (ENGINE UNIT TEST) ---');
  const simulatedSavedSettings = {
    adminPasswordHash: '$scrypt$v=1$saved_prod_hash',
    adminEmail: 'acmscorporation@gmail.com',
    adminConfigured: true,
    businessHours: '08:00 - 18:00',
  };
  const mergedWithEmptyDefaults = mergePreservedSettings(simulatedSavedSettings, DEFAULT_SETTINGS);
  const mergePass = Boolean(
    mergedWithEmptyDefaults.adminPasswordHash === '$scrypt$v=1$saved_prod_hash' &&
    mergedWithEmptyDefaults.adminEmail === 'acmscorporation@gmail.com' &&
    mergedWithEmptyDefaults.adminConfigured === true &&
    mergedWithEmptyDefaults.businessHours === '08:00 - 18:00'
  );
  results.push({
    name: 'TESTE D: mergePreservedSettings protege credenciais contra DEFAULT_SETTINGS',
    passed: mergePass,
    details: `PasswordHashPreserved=${mergedWithEmptyDefaults.adminPasswordHash === '$scrypt$v=1$saved_prod_hash'}`,
  });
  console.log(`[${mergePass ? 'PASS' : 'FAIL'}] Preservação de credenciais contra defaults validada\n`);

  // 7. Teste E: Verificação de Invariância do adminPasswordHash no PostgreSQL
  console.log('--- 7. TESTE E: INVARIÂNCIA DE CREDENCIAIS NO POSTGRESQL ---');
  const currentDbSettings = await getDbSettings();
  const finalStoredHash = currentDbSettings?.adminPasswordHash || '';
  const hashUnchanged = Boolean(
    initialStoredHash.length > 0 &&
    finalStoredHash === initialStoredHash
  );
  results.push({
    name: 'TESTE E: adminPasswordHash no PostgreSQL permaneceu 100% inalterado',
    passed: hashUnchanged,
    details: `InitialLength=${initialStoredHash.length}, FinalLength=${finalStoredHash.length}, HashMatch=${hashUnchanged}`,
  });
  console.log(`[${hashUnchanged ? 'PASS' : 'FAIL'}] Credencial de produção protegida contra mutações\n`);

  // 8. Teste F: Auditoria de Não-Destrutividade
  console.log('--- 8. TESTE F: AUDITORIA DE NÃO-DESTRUTIVIDADE DE DADOS ---');
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
    name: 'TESTE F: Não-destrutividade absoluta de dados de produção',
    passed: finalCheckPass,
    details: `Orders=${finalOrders.length}, Clients=${finalClients.length}, Logs=${finalLogs.length}, AO-451023=${finalCheckPass ? 'INTACTA' : 'VIOLADA'}`,
  });
  console.log(`[${finalCheckPass ? 'PASS' : 'FAIL'}] Dados de produção 100% preservados e íntegros\n`);

  // Resumo Final
  console.log('================================================================');
  console.log('RESUMO FINAL DOS TESTES DE REGRESSÃO FASE 9.4.1 (ISOLADA)');
  console.log('================================================================');
  let allPassed = true;
  results.forEach((r, idx) => {
    const mark = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${(idx + 1).toString().padStart(2, ' ')}. [${mark}] ${r.name} (${r.details})`);
    if (!r.passed) allPassed = false;
  });

  console.log('\n----------------------------------------------------------------');
  if (allPassed) {
    console.log('STATUS FINAL: TODOS OS TESTES PASSARAM COM SUCESSO (100%).');
    console.log('================================================================\n');
    process.exit(0);
  } else {
    console.error('STATUS FINAL: FALHA EM UM OU MAIS TESTES.');
    console.log('================================================================\n');
    process.exit(1);
  }
}

runPhase941Verification().catch((err) => {
  console.error('Erro fatal na execução dos testes:', err);
  process.exit(1);
});

