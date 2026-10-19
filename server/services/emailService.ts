/**
 * ============================================================================
 * DELFILÂNDIA - TRANSACTIONAL EMAIL SERVICE
 * ============================================================================
 * 
 * Serviço de envio de emails transacionais para recuperação de senha e alertas.
 * Suporta SMTP (nodemailer) e provedores API REST via variáveis de ambiente.
 * 
 * Variáveis de ambiente suportadas:
 * - SMTP_HOST: Endereço do servidor SMTP (ex: smtp.gmail.com, smtp.mailgun.org, smtp.sendgrid.net)
 * - SMTP_PORT: Porta do servidor (padrão: 587 para STARTTLS ou 465 para SSL/TLS)
 * - SMTP_USER: Utilizador/Email de autenticação SMTP
 * - SMTP_PASSWORD: Senha de aplicação ou token SMTP
 * - SMTP_SECURE: 'true' se porta 465, 'false' se porta 587 (padrão)
 * - EMAIL_FROM: Remetente oficial (ex: "DELFILÂNDIA" <no-reply@delfilandia.com>)
 * - RESEND_API_KEY: Chave de API Resend (opcional)
 */

import nodemailer from 'nodemailer';

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}

/**
 * Cria ou obtém o transporter nodemailer configurado a partir de variáveis de ambiente
 */
function getEmailTransporter() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT?.trim() || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  });
}

/**
 * Formata e envia o email com o código de recuperação de 6 dígitos
 */
export async function sendPasswordResetEmail(
  toEmail: string,
  resetCode: string,
  adminName: string = 'Administrador'
): Promise<EmailSendResult> {
  const normalizedEmail = toEmail.trim().toLowerCase();
  const fromAddress = process.env.EMAIL_FROM?.trim() || 'DELFILÂNDIA <no-reply@delfilandia.com>';

  const subject = 'Código de Recuperação de Acesso — DELFILÂNDIA';

  const htmlContent = `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="560" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #1e293b; border-radius: 20px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: center; border-bottom: 1px solid #334155;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 2px; color: #f59e0b;">DELFILÂNDIA</h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8; letter-spacing: 0.5px; text-transform: uppercase;">Gestão e Rastreamento de Encomendas</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 36px;">
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #f8fafc;">Olá, ${adminName || 'Administrador'},</h2>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #cbd5e1;">
                Recebemos uma solicitação para redefinir a senha de acesso à conta administrativa da <strong>DELFILÂNDIA</strong>.
              </p>
              
              <!-- Code Box -->
              <div style="background-color: #0f172a; border: 2px solid #f59e0b; border-radius: 14px; padding: 24px; text-align: center; margin: 28px 0;">
                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">O seu código de verificação é:</p>
                <div style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #fbbf24; font-family: monospace; padding: 6px 0;">
                  ${resetCode}
                </div>
                <p style="margin: 8px 0 0 0; font-size: 12px; color: #f87171; font-weight: 500;">
                  ⏱️ Válido por 15 minutos • Uso único
                </p>
              </div>

              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #94a3b8;">
                Insira este código na tela de recuperação da aplicação para definir a sua nova senha de administrador.
              </p>

              <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #334155;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #64748b;">
                  🔒 <strong>Aviso de Segurança:</strong> Se você não solicitou a redefinição de senha, ignore esta mensagem. A sua senha atual permanecerá inalterada e a sua conta continua protegida.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 36px; background-color: #0f172a; text-align: center; border-top: 1px solid #334155;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                © ${new Date().getFullYear()} DELFILÂNDIA. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const textContent = `
DELFILÂNDIA — Gestão e Rastreamento de Encomendas

Olá, ${adminName || 'Administrador'},

Recebemos uma solicitação para redefinir a senha de acesso à conta administrativa da DELFILÂNDIA.

O seu código de verificação é: ${resetCode}

Este código expira em 15 minutos e só pode ser utilizado uma única vez.

Se não solicitou a redefinição da sua senha, por favor ignore este email. A sua conta continua segura.

© ${new Date().getFullYear()} DELFILÂNDIA
  `.trim();

  // 1. Tenta envio via SMTP caso configurado
  const transporter = getEmailTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to: normalizedEmail,
        subject,
        text: textContent,
        html: htmlContent,
      });

      console.log(`[EMAIL] Código de recuperação enviado com sucesso via SMTP para ${normalizedEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3')} (MessageID: ${info.messageId})`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (smtpError: any) {
      console.error(`[EMAIL] Erro no envio SMTP para ${normalizedEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3')}:`, smtpError?.message || smtpError);
      return {
        success: false,
        error: 'Falha no envio do email pelo servidor SMTP.',
      };
    }
  }

  // 2. Tenta envio via API Resend caso RESEND_API_KEY esteja definida
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: normalizedEmail,
          subject,
          text: textContent,
          html: htmlContent,
        }),
      });

      if (res.ok) {
        const data = await res.json() as any;
        console.log(`[EMAIL] Código de recuperação enviado com sucesso via Resend API para ${normalizedEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3')} (ID: ${data.id})`);
        return {
          success: true,
          messageId: data.id,
        };
      }
      const errText = await res.text();
      console.error('[EMAIL] Erro ao enviar email via Resend API:', errText);
    } catch (apiErr: any) {
      console.error('[EMAIL] Exceção ao contactar Resend API:', apiErr?.message || apiErr);
    }
  }

  // 3. Fallback seguro para ambiente de desenvolvimento local (quando SMTP não estiver configurado)
  // Registra no log do servidor que o código foi gerado sem falhar a requisição
  const maskedEmail = normalizedEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3');
  console.log(`[EMAIL_DEV_SIMULATION] Código de recuperação gerado para ${maskedEmail}. (Configure SMTP_HOST ou RESEND_API_KEY no .env para entrega em caixa de entrada).`);
  
  return {
    success: true,
    simulated: true,
  };
}
