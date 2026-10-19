# DELFILÂNDIA — GUIA DE CONFIGURAÇÃO DE E-MAIL (OPCIONAL)

Este documento descreve como configurar o envio de e-mails transacionais (ex: envio de códigos de verificação de 6 dígitos) na plataforma **DELFILÂNDIA**.

---

## 1. Natureza Opcional do Serviço de E-mail

O serviço de envio de e-mail é **100% opcional** e **não bloqueante**:
- A aplicação inicia normalmente sem qualquer variável de e-mail configurada.
- O login administrativo, a gestão de encomendas, clientes e configurações operam independentemente de e-mail.
- A recuperação de acesso administrativo conta com mecanismos prioritários e autoritativos:
  1. **Chave Mestra Server-Side (`ADMIN_RECOVERY_SECRET`)**
  2. **Código de Emergência CSPRNG** gerado e persistido no PostgreSQL (`app_settings`)
  3. **Simulação segura em log (`[EMAIL_DEV_SIMULATION]`)** caso nenhum provedor de email esteja ativo.

---

## 2. Variáveis de Ambiente Suportadas

Caso a organização deseje ativar a entrega de e-mails em caixas de entrada de clientes ou administradores, defina as seguintes variáveis no seu ambiente de execução (ex: Cloud Run Secrets ou arquivo `.env` local):

### Opção A: Servidor SMTP (Recomendado para Provedores Corporativos)

| Variável | Tipo | Padrão | Descrição | Exemplo |
| :--- | :--- | :--- | :--- | :--- |
| `SMTP_HOST` | String | - | Endereço do servidor SMTP | `smtp.gmail.com`, `smtp.sendgrid.net`, `smtp.mailgun.org` |
| `SMTP_PORT` | Número | `587` | Porta do servidor SMTP | `587` (STARTTLS) ou `465` (SSL/TLS) |
| `SMTP_USER` | String | - | Utilizador / E-mail de autenticação SMTP | `contacto@delfilandia.com` |
| `SMTP_PASSWORD`| String | - | Senha de aplicativo ou token SMTP | `xxxx-xxxx-xxxx-xxxx` |
| `SMTP_SECURE` | Booleano | `false` | Forçar SSL/TLS direto | `true` se porta 465, `false` se porta 587 |
| `EMAIL_FROM` | String | `"DELFILÂNDIA" <no-reply@delfilandia.com>` | Endereço remetente exibido | `"DELFILÂNDIA Suporte" <suporte@delfilandia.com>` |

### Opção B: Provedor Resend (API REST)

| Variável | Tipo | Padrão | Descrição | Exemplo |
| :--- | :--- | :--- | :--- | :--- |
| `RESEND_API_KEY` | String | - | Chave de API da plataforma Resend | `re_123456789abcdef` |
| `EMAIL_FROM` | String | `"DELFILÂNDIA" <no-reply@delfilandia.com>` | Remetente com domínio verificado no Resend | `encomendas@seudominio.com` |

---

## 3. Arquitetura e Segurança

* **Isolamento de Segredos**: As variáveis de e-mail e SMTP são lidas **exclusivamente no servidor** em `server/services/emailService.ts` via `process.env`.
* **Zero Leaks**: Nenhuma credencial SMTP ou de e-mail é exposta ao frontend (Vite/React).
* **Tratamento de Falhas**: Falhas na rede SMTP ou credenciais incorretas não provocam pane (`crash`) no servidor Express, registrando apenas um log de advertência estruturado.
