/**
 * ============================================================================
 * DELFILÂNDIA — SUÍTE DE TESTES DA FASE 9.4.3
 * CORREÇÃO DEFINITIVA DO PAINEL DE ENVIRONMENT VARIABLES DO AI STUDIO
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

async function runPhase943Verification() {
  console.log('================================================================');
  console.log('DELFILÂNDIA — FASE 9.4.3: VALIDAÇÃO DE ENVIRONMENT VARIABLES & SEGURANÇA');
  console.log('================================================================\n');

  // 1. Verificação do .env.example
  console.log('--- 1. AUDITORIA DO ARQUIVO /.env.example ---');
  const envExamplePath = path.join(process.cwd(), '.env.example');
  const envExampleContent = fs.readFileSync(envExamplePath, 'utf-8');

  const optionalVars = [
    'SMTP_HOST=',
    'SMTP_PORT=',
    'SMTP_USER=',
    'SMTP_PASSWORD=',
    'SMTP_SECURE=',
    'EMAIL_FROM=',
    'RESEND_API_KEY=',
  ];

  const foundVarsInExample = optionalVars.filter((v) => envExampleContent.includes(v));
  const envExampleClean = foundVarsInExample.length === 0;

  results.push({
    name: 'Auditoria .env.example: Remoção de variáveis opcionais de email do discovery',
    passed: envExampleClean,
    details: envExampleClean ? 'Nenhuma variável opcional de email presente' : `Encontradas: ${foundVarsInExample.join(', ')}`,
  });
  console.log(`[${envExampleClean ? 'PASS' : 'FAIL'}] .env.example limpo para o AI Studio: ${envExampleClean ? 'OK' : 'FAIL'}\n`);

  // 2. Verificação de docs/EMAIL_CONFIGURATION.md
  console.log('--- 2. VERIFICAÇÃO DA DOCUMENTAÇÃO DE E-MAIL SEPARADA ---');
  const emailDocsPath = path.join(process.cwd(), 'docs', 'EMAIL_CONFIGURATION.md');
  const emailDocsExist = fs.existsSync(emailDocsPath);
  const emailDocsContent = emailDocsExist ? fs.readFileSync(emailDocsPath, 'utf-8') : '';
  const emailDocsValid = emailDocsExist && emailDocsContent.includes('SMTP_HOST') && emailDocsContent.includes('RESEND_API_KEY');

  results.push({
    name: 'Documentação Opcional: docs/EMAIL_CONFIGURATION.md criado e completo',
    passed: emailDocsValid,
    details: emailDocsValid ? `Ficheiro existente com ${emailDocsContent.length} bytes` : 'Ficheiro ausente ou incompleto',
  });
  console.log(`[${emailDocsValid ? 'PASS' : 'FAIL'}] Documentação de email isolada: ${emailDocsValid ? 'OK' : 'FAIL'}\n`);

  // 3. Auditoria de Segredos no Frontend
  console.log('--- 3. AUDITORIA DE SEGREDOS NO FRONTEND ---');
  const srcFiles = [
    'src/App.tsx',
    'src/main.tsx',
    'src/types.ts',
    'src/services/api.ts',
    'src/components/PinModal.tsx',
    'src/components/SettingsPanel.tsx',
    'src/hooks/useOrdersData.ts',
    'src/hooks/useAuth.ts',
  ];

  let frontendLeak = false;
  for (const relFile of srcFiles) {
    const fullPath = path.join(process.cwd(), relFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (
        content.includes('SMTP_') ||
        content.includes('RESEND_') ||
        content.includes('ADMIN_RECOVERY_SECRET') ||
        content.includes('SESSION_SECRET') ||
        content.includes('SQL_PASSWORD')
      ) {
        frontendLeak = true;
        console.error(`Vazamento detectado em ${relFile}`);
      }
    }
  }

  results.push({
    name: 'Auditoria Frontend: Zero secrets server-side expostos no código cliente',
    passed: !frontendLeak,
    details: !frontendLeak ? 'Nenhum segredo encontrado em componentes/hooks do React' : 'Vazamento detectado',
  });
  console.log(`[${!frontendLeak ? 'PASS' : 'FAIL'}] Isolamento de segredos no frontend: ${!frontendLeak ? 'OK' : 'FAIL'}\n`);

  // 4. Teste de Endpoints do Servidor (Sem SMTP configurado)
  console.log('--- 4. TESTE DE ENDPOINTS DO SERVIDOR SEM SMTP CONFIGURADO ---');
  const healthRes = await httpRequest('/api/health');
  const healthJson = JSON.parse(healthRes.body);
  const healthPass = healthRes.statusCode === 200 && healthJson.status === 'ok' && healthJson.postgres === 'connected';

  results.push({
    name: 'GET /api/health: Servidor online e conectado ao PostgreSQL',
    passed: healthPass,
    details: `HTTP ${healthRes.statusCode}, status=${healthJson.status}`,
  });

  const authStatusRes = await httpRequest('/api/auth/status');
  const authStatusJson = JSON.parse(authStatusRes.body);
  const authStatusPass = authStatusRes.statusCode === 200 && authStatusJson.configured === true;

  results.push({
    name: 'GET /api/auth/status: Status de autenticação ativo sem depender de email',
    passed: authStatusPass,
    details: `HTTP ${authStatusRes.statusCode}, configured=${authStatusJson.configured}`,
  });

  const trackRes = await httpRequest('/api/track/AO-451023');
  const trackJson = JSON.parse(trackRes.body);
  const trackPass = trackRes.statusCode === 200 && Boolean(trackJson.order && trackJson.order.code === 'AO-451023');

  results.push({
    name: 'GET /api/track/AO-451023: Tracking público de encomenda operacional',
    passed: trackPass,
    details: `HTTP ${trackRes.statusCode}, code=${trackJson.order?.code}, status=${trackJson.order?.status}`,
  });

  console.log(`[${healthPass && authStatusPass && trackPass ? 'PASS' : 'FAIL'}] Endpoints operacionais sem SMTP\n`);

  // 5. Teste do Fluxo de Pedido de Código de Recuperação (Não-bloqueante)
  console.log('--- 5. TESTE DE FALLBACK DA RECUPERAÇÃO VIA EMAIL ---');
  const requestCodeRes = await httpRequest('/api/auth/recover/request-code', { method: 'POST' }, {
    email: 'acmscorporation@gmail.com',
  });
  const requestCodeJson = JSON.parse(requestCodeRes.body);
  const requestCodePass = requestCodeRes.statusCode === 200 && requestCodeJson.success === true;

  results.push({
    name: 'POST /api/auth/recover/request-code: Fallback gracioso sem bloquear servidor',
    passed: requestCodePass,
    details: `HTTP ${requestCodeRes.statusCode}, msg="${requestCodeJson.message}"`,
  });
  console.log(`[${requestCodePass ? 'PASS' : 'FAIL'}] Fallback de recuperação via email validado com sucesso\n`);

  // 6. Verificação de Não-Destrutividade no PostgreSQL
  console.log('--- 6. VERIFICAÇÃO DE NÃO-DESTRUTIVIDADE NO POSTGRESQL ---');
  const orders = await getDbOrders();
  const clients = await getDbClients();
  const settings = await getDbSettings();
  const logs = await getDbAuditLogs();

  const ao = orders.find((o) => o.code === 'AO-451023');
  const aoValid = Boolean(
    ao &&
    ao.clientName === 'Aldemiro Samba' &&
    ao.resalePrice === 25000 &&
    ao.amountPaid === 25000 &&
    ao.amountPending === 0 &&
    ao.status === 'PRODUTO_COMPRADO' &&
    ao.paymentStatus === 'CONFIRMADO' &&
    ao.grossProfit === 7000
  );

  const dbIntegrityPass = isSqlAvailable() && orders.length === 1 && clients.length >= 6 && settings !== null && aoValid;

  results.push({
    name: 'PostgreSQL Read-Only Integrity: Dados de negócio 100% intactos',
    passed: dbIntegrityPass,
    details: `orders=${orders.length}, clients=${clients.length}, settings=${settings ? 'OK' : 'NULO'}, logs=${logs.length}, AO-451023=${aoValid ? 'INTACTA' : 'VIOLADA'}`,
  });
  console.log(`[${dbIntegrityPass ? 'PASS' : 'FAIL'}] Integridade de dados de produção confirmada\n`);

  // Resumo
  console.log('================================================================');
  console.log('RESUMO DOS RESULTADOS DA FASE 9.4.3');
  console.log('================================================================');
  let allPassed = true;
  results.forEach((r, idx) => {
    const mark = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${(idx + 1).toString().padStart(2, ' ')}. [${mark}] ${r.name} (${r.details})`);
    if (!r.passed) allPassed = false;
  });

  console.log('\n----------------------------------------------------------------');
  if (allPassed) {
    console.log('STATUS: TODOS OS TESTES DA FASE 9.4.3 FORAM APROVADOS (100%).');
    console.log('================================================================\n');
    process.exit(0);
  } else {
    console.error('STATUS: FALHA DETECTADA EM TESTES DA FASE 9.4.3.');
    console.log('================================================================\n');
    process.exit(1);
  }
}

runPhase943Verification().catch((err) => {
  console.error('Erro na execução do teste 9.4.3:', err);
  process.exit(1);
});
