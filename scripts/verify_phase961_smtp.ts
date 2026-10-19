/**
 * ============================================================================
 * DELFILÂNDIA — FASE 9.6.1: AUDITORIA E VALIDAÇÃO DE CONECTIVIDADE SMTP
 * ============================================================================
 */

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import http from 'http';
dotenv.config();

async function runSmtpAudit() {
  console.log('================================================================');
  console.log('DELFILÂNDIA — ETAPA 9 — FASE 9.6.1: VALIDAÇÃO DE TRANSPORTE SMTP');
  console.log('================================================================\n');

  // 1. Verificação de variáveis de ambiente (somente presença)
  const envVars = {
    SMTP_HOST: Boolean(process.env.SMTP_HOST?.trim()),
    SMTP_PORT: Boolean(process.env.SMTP_PORT?.trim()),
    SMTP_USER: Boolean(process.env.SMTP_USER?.trim()),
    SMTP_PASSWORD: Boolean(process.env.SMTP_PASSWORD?.trim()),
    SMTP_SECURE: Boolean(process.env.SMTP_SECURE !== undefined),
    EMAIL_FROM: Boolean(process.env.EMAIL_FROM?.trim()),
  };

  console.log('--- [1] Auditoria de Variáveis de Ambiente ---');
  Object.entries(envVars).forEach(([k, v]) => {
    console.log(`${k}: ${v ? 'CONFIGURADO' : 'NÃO CONFIGURADO'}`);
  });

  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT?.trim() || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!host || !user || !pass) {
    console.error('\n[ERRO] Variáveis essenciais de SMTP ausentes.');
    process.exit(1);
  }

  // 2. Teste de Conexão e Handshake SMTP
  console.log('\n--- [2] Teste de Conexão e Autenticação SMTP (Nodemailer Verify) ---');
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
  });

  let connectionSuccess = false;
  let connectionError: string | null = null;

  try {
    const verifyResult = await transporter.verify();
    if (verifyResult === true) {
      connectionSuccess = true;
      console.log('SMTP CONNECTION: APROVADA (Conexão e autenticação com servidor SMTP validadas com sucesso)');
    }
  } catch (err: any) {
    connectionError = err?.message || String(err);
    console.error('SMTP CONNECTION: REJEITADA');
    console.error('Detalhe sanitizado:', connectionError?.replace(pass, '***'));
  }

  // 3. Teste do Endpoint HTTP POST /api/auth/recover/request-code
  console.log('\n--- [3] Teste Operacional de Requisição de Código de Recuperação ---');
  
  const payload = JSON.stringify({ email: 'acmscorporation@gmail.com' });

  const httpResult = await new Promise<{ statusCode: number; body: any }>((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path: '/api/auth/recover/request-code',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode || 0, body: JSON.parse(body) });
          } catch (e) {
            resolve({ statusCode: res.statusCode || 0, body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });

  console.log(`Endpoint HTTP Status: ${httpResult.statusCode}`);
  console.log(`Endpoint Resposta Lógica: ${httpResult.body?.success ? 'SUCCESS' : 'FAILURE'}`);

  // 4. Teste Direto do Serviço sendPasswordResetEmail para confirmação de entrega real
  console.log('\n--- [4] Teste de Despacho de E-mail Transacional Real ---');
  const { sendPasswordResetEmail } = await import('../server/services/emailService');
  
  const testCode = '839201'; // Código de teste para disparo isolado
  const sendResult = await sendPasswordResetEmail('acmscorporation@gmail.com', testCode, 'Administrador');

  console.log(`Email Send Success: ${sendResult.success}`);
  console.log(`Email Mode: ${sendResult.simulated ? 'SIMULATED (EMAIL_DEV_SIMULATION)' : 'REAL (SMTP DISPATCHED)'}`);
  if (sendResult.messageId) {
    console.log(`MessageID Gerado pelo Servidor SMTP: SIM (Presente)`);
  }

  // 5. Verificação da Conclusão
  console.log('\n================================================================');
  console.log('RESULTADOS FINAIS DA AUDITORIA FASE 9.6.1:');
  console.log('================================================================');
  console.log(`SMTP_HOST: ${envVars.SMTP_HOST ? 'CONFIGURADO' : 'NÃO CONFIGURADO'}`);
  console.log(`SMTP_PORT: ${envVars.SMTP_PORT ? 'CONFIGURADO' : 'NÃO CONFIGURADO'}`);
  console.log(`SMTP_USER: ${envVars.SMTP_USER ? 'CONFIGURADO' : 'NÃO CONFIGURADO'}`);
  console.log(`SMTP_PASSWORD: ${envVars.SMTP_PASSWORD ? 'CONFIGURADO' : 'NÃO CONFIGURADO'}`);
  console.log(`SMTP_SECURE: ${envVars.SMTP_SECURE ? 'CONFIGURADO' : 'NÃO CONFIGURADO'}`);
  console.log(`EMAIL_FROM: ${envVars.EMAIL_FROM ? 'CONFIGURADO' : 'NÃO CONFIGURADO'}`);
  console.log('');
  console.log(`SMTP TRANSPORT: ${host && user && pass ? 'ATIVO' : 'INATIVO'}`);
  console.log(`SMTP CONNECTION: ${connectionSuccess ? 'APROVADA' : 'REJEITADA'}`);
  console.log(`EMAIL DELIVERY MODE: ${!sendResult.simulated && sendResult.success ? 'REAL' : 'SIMULATED'}`);
  console.log(`RECOVERY EMAIL: ${connectionSuccess && sendResult.success && !sendResult.simulated ? 'OPERACIONAL' : 'NÃO OPERACIONAL'}`);
  console.log('================================================================\n');

  if (connectionSuccess && sendResult.success && !sendResult.simulated) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runSmtpAudit().catch((err) => {
  console.error('Erro na auditoria SMTP:', err);
  process.exit(1);
});
