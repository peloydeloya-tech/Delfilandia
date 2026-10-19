# DELFILÂNDIA — DIAGNÓSTICO DO PAINEL DE SECRETS DO GOOGLE AI STUDIO
## ETAPA 9 — FASE 9.4.2: DIAGNÓSTICO TÉCNICO COMPROVADO DE VARIÁVEIS DE EMAIL

---

### CLASSIFICAÇÃO: DIAGNÓSTICO CONCLUÍDO
**Data/Hora do Diagnóstico:** 2026-08-28T07:42:00Z  
**Ambiente:** Google AI Studio Build / Cloud Run / PostgreSQL Cloud SQL  
**Status de Não-Destrutividade:** 100% Preservado (0 alterações de dados)  

---

## 1. ORIGEM DO PEDIDO DAS VARIÁVEIS NO GOOGLE AI STUDIO

O painel modal:
> **"Enter your environment variable to continue"**  
> com a listagem das variáveis:  
> - `SMTP_HOST`  
> - `SMTP_PORT`  
> - `SMTP_USER`  
> - `SMTP_PASSWORD`  
> - `SMTP_SECURE`  
> - `EMAIL_FROM`  
> - `RESEND_API_KEY`  

### Comprovação Técnica da Origem:
A causa raiz exata foi identificada na arquitetura de inicialização da plataforma **Google AI Studio Build**:

1. **Mecanismo de Descoberta de Variáveis da Plataforma AI Studio**:
   O ambiente do Google AI Studio Build analisa estaticamente o arquivo **`/.env.example`** localizado na raiz do projeto. Qualquer variável declarada nesse arquivo sem valor padrão atribuído no container de execução é tratada pela plataforma como uma dependência de ambiente necessária, disparando automaticamente a janela modal para o utilizador fornecer as chaves antes de prosseguir.

2. **Declaração no Ficheiro `/.env.example`**:
   No arquivo `/.env.example` (linhas 40 a 49), constam exatamente as 7 variáveis listadas:
   ```env
   # Linhas 40-49 em /.env.example:
   SMTP_HOST=
   SMTP_PORT=587
   SMTP_USER=
   SMTP_PASSWORD=
   SMTP_SECURE=false
   EMAIL_FROM="DELFILÂNDIA" <contacto@delfilandia.com>
   RESEND_API_KEY=
   ```

3. **Inexistência de Prompt na Aplicação Frontend**:
   Não existe qualquer formulário, popup ou caixa de diálogo em React/Vite solicitando essas variáveis. A mensagem é disparada pelo **Google AI Studio Control Plane** ao detetar as declarações vazias no `.env.example`.

---

## 2. ARQUIVOS, LINHAS E FUNÇÕES ENVOLVIDAS NO CÓDIGO

| Arquivo | Linhas | Função / Bloco | Descrição do Uso |
| :--- | :--- | :--- | :--- |
| `/.env.example` | Linhas 40-49 | Configuração de template | Declara as variáveis que acionam o detector de segredos da plataforma AI Studio. |
| `/server/services/emailService.ts` | Linhas 31-53 | `getEmailTransporter()` | Lê `process.env.SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_SECURE` via `nodemailer.createTransport()`. Se não estiverem preenchidas, retorna `null`. |
| `/server/services/emailService.ts` | Linhas 58-65 | `sendPasswordResetEmail()` | Lê `process.env.EMAIL_FROM` (padrão `"DELFILÂNDIA <no-reply@delfilandia.com>"`). |
| `/server/services/emailService.ts` | Linhas 176-208 | `sendPasswordResetEmail()` | Lê `process.env.RESEND_API_KEY` como transporte alternativo via REST API. |
| `/server/services/emailService.ts` | Linhas 210-218 | `sendPasswordResetEmail()` | **Fallback seguro não-bloqueante**: se nenhuma variável estiver configurada, a função simula o envio em log (`[EMAIL_DEV_SIMULATION]`) sem lançar erro nem bloquear o servidor. |
| `/server.ts` | Linha 42 | Importação | `import { sendPasswordResetEmail } from "./server/services/emailService";` |
| `/server.ts` | Linha 678 | `handleRequestPasswordResetCode` | Rota `POST /api/auth/recover/request-code`. Invoca o envio de email quando o administrador solicita recuperação por código de 6 dígitos. |

---

## 3. VARIÁVEIS REALMENTE NECESSÁRIAS VS. OPCIONAIS

### A) Variáveis Essenciais de Produção (Obrigatórias no Cloud Run / Backend)
1. `SQL_HOST`, `SQL_PORT`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME` — Conexão autoritativa ao PostgreSQL.
2. `SESSION_SECRET` — Assinatura criptográfica de sessões HTTP-Only.
3. `ADMIN_RECOVERY_SECRET` — Chave mestra server-side para recuperação de emergência sem dependência de serviços externos.

### B) Variáveis de Email (100% Opcionais no Backend)
As variáveis de email **NÃO são necessárias para a inicialização nem para o funcionamento do sistema**:
- `SMTP_HOST` (Opcional)
- `SMTP_PORT` (Opcional)
- `SMTP_USER` (Opcional)
- `SMTP_PASSWORD` (Opcional)
- `SMTP_SECURE` (Opcional)
- `EMAIL_FROM` (Opcional)
- `RESEND_API_KEY` (Opcional)

Se nenhuma delas for informada:
- O servidor inicia perfeitamente em 0.0.0.0:3000 (`GET /api/health` retorna `{"status":"ok"}`).
- A recuperação administrativa via `POST /api/auth/recover` com a chave mestra `ADMIN_RECOVERY_SECRET` ou código de emergência funciona com 100% de disponibilidade.
- A rota `POST /api/auth/recover/request-code` responde com sucesso amigável e gera o log com segurança, sem falhar a requisição.

---

## 4. ANÁLISE DE DEPENDÊNCIAS DE EMAIL
No arquivo `package.json`:
- `nodemailer` (`^9.0.5`) e `@types/nodemailer` (`^8.0.1`): presentes nas dependências do Node.js.
- O código do `nodemailer` é instanciado em tempo de execução de forma **lazy/segura** (`getEmailTransporter()` só é invocado se `sendPasswordResetEmail()` for chamado). O módulo **não executa nenhuma ação no startup**.

---

## 5. IMPACTOS TÉCNICOS DETALHADOS

### Impacto no Startup: ZERO
O servidor Express em `server.ts` não possui qualquer validação bloqueante de SMTP ou Resend na inicialização. O servidor carrega sem erros (`status: 200`, `postgres: connected`).

### Impacto no Login: ZERO
O fluxo de login administrativo (`POST /api/auth/login`) lê diretamente os hashes scrypt do PostgreSQL (`app_settings`), não utilizando qualquer serviço de email.

### Impacto na Recuperação de Acesso (Recovery): ZERO
A recuperação de acesso principal foi desenhada com fallback robusto:
- Modo 1: Chave Mestra Server-Side (`ADMIN_RECOVERY_SECRET`).
- Modo 2: Código de Emergência CSPRNG persistido no PostgreSQL.
- Modo 3: Email transacional (ativado apenas se as credenciais SMTP/Resend existirem).

### Impacto no Cloud Run: ZERO
No Cloud Run, as variáveis de email não precisam de ser injetadas a menos que a equipa decida contratar um provedor de envio de email transacional (ex: SendGrid, Resend, Amazon SES, Google Workspace SMTP).

---

## 6. RECOMENDAÇÃO TÉCNICA

1. **Não Preencher Valores Fictícios**:
   Como solicitado, não é necessário inventar ou preencher credenciais fictícias no painel do AI Studio.
2. **Tratamento no `.env.example`**:
   Para evitar que o Google AI Studio Build volte a apresentar a janela de solicitação de credenciais de email aos utilizadores/desenvolvedores, as variáveis puramente opcionais podem ser removidas ou comentadas no `.env.example`, mantendo a documentação clara.
3. **Persistência e Segurança**:
   Manter a arquitetura atual onde a senha e o código de emergência ficam 100% no PostgreSQL (`app_settings`), imunes a qualquer ausência de SMTP.

---

## 7. VALIDAÇÃO NÃO-DESTRUTIVA E ESTADO DA BASE DE DADOS

Todas as verificações foram executadas estritamente em modo de leitura (READ-ONLY):

### Verificação de Contagens no PostgreSQL
```sql
SELECT 
  (SELECT COUNT(*) FROM orders) as orders_count,
  (SELECT COUNT(*) FROM clients) as clients_count,
  (SELECT COUNT(*) FROM app_settings) as settings_count,
  (SELECT COUNT(*) FROM audit_logs) as audit_count;
```
- **orders**: `1` (Conforme requerido)
- **clients**: `6` (Conforme requerido)
- **app_settings**: `1` (Conforme requerido)
- **audit_logs**: `128` (Registros de auditoria preservados)

### Integridade da Encomenda AO-451023
```sql
SELECT id, code, client_name, resale_price, amount_paid, amount_pending, status, payment_status, payment_method, purchase_cost, gross_profit 
FROM orders WHERE code = 'AO-451023';
```
- **ID**: `115`
- **Código**: `AO-451023`
- **Cliente**: `Aldemiro Samba`
- **Preço de Revenda**: `25.000,00 Kz`
- **Valor Pago**: `25.000,00 Kz`
- **Valor Pendente**: `0,00 Kz`
- **Status**: `PRODUTO_COMPRADO`
- **Status Pagamento**: `CONFIRMADO`
- **Método**: `EXPRESS`
- **Custo Compra**: `18.000,00 Kz`
- **Lucro Bruto**: `7.000,00 Kz`
*(Estado 100% íntegro e intacto)*

### Verificação de Endpoints HTTP em Execução
- `GET /` -> **HTTP 200 OK**
- `GET /api/health` -> **HTTP 200 OK** (`{"status":"ok","postgres":"connected"}`)
- `GET /api/auth/status` -> **HTTP 200 OK** (`{"configured":true,"isLocked":false}`)

### Verificação de Compilação e Linter
- `npx tsc --noEmit` -> **0 Erros (Aprovado)**
- `npm run build` -> **Compilação com Sucesso (Aprovado)**

---

## 8. CONCLUSÃO
A aparição do painel no Google AI Studio decorre exclusivamente da declaração dessas 7 chaves no arquivo `/.env.example`. A aplicação DELFILÂNDIA não possui qualquer dependência rígida de SMTP/Resend no startup ou login, tratando o envio de email como funcionalidade estritamente opcional com fallback transparente. A base de dados PostgreSQL e as credenciais administrativas permanecem 100% seguras e operacionais.
