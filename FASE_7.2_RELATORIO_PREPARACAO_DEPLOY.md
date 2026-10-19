# ETAPA 4 — FASE 7.2: RELATÓRIO DE PREPARAÇÃO E CONFIGURAÇÃO PARA DEPLOY EM PRODUÇÃO (GOOGLE CLOUD RUN)

## 1. Status
**APROVADA PARA FASE 7.3**

---

## 2. Arquivos Analisados
- `/package.json`
- `/.env.example`
- `/server.ts`
- `/src/db/index.ts`
- `/src/db/schema.ts`
- `/src/db/repository.ts`
- `/server/middleware/auth.ts`
- `/server/utils/crypto.ts`
- `/src/utils/security.ts`
- `/src/utils/formatters.ts`
- `/src/utils/settingsPreservation.ts`
- `/src/App.tsx`
- `/src/components/PublicTracking.tsx`
- `/src/lib/firebase.ts`
- `/firebase-applet-config.json`

---

## 3. Arquivos Criados
- `/Dockerfile`: Manifesto Docker multi-stage otimizado para produção no Google Cloud Run (Node 20 LTS Alpine, usuário sem privilégios `nodejs`, porta configurável e comando `node dist/server.cjs`).
- `/.dockerignore`: Exclusão estrita de `node_modules`, `dist`, `.git`, `.env*` e arquivos de log.
- `/scripts/verify_phase72.js`: Script automatizado de validação de saúde, roteamento, privacidade e normalização de códigos.
- `/FASE_7.2_RELATORIO_PREPARACAO_DEPLOY.md`: Relatório oficial de conformidade e preparação para deploy.

---

## 4. Arquivos Modificados
- `/server.ts`: Ajustado para obter a porta dinamicamente via `const PORT = Number(process.env.PORT || 3000);` mantendo bind seguro em `0.0.0.0`.
- `/.env.example`: Padronizado com placeholders limpos e sem credenciais de exemplo para produção.

---

## 5. Dockerfile
O `Dockerfile` implementa uma arquitetura em 2 estágios (Multi-Stage Build):
1. **Stage 1 (Builder)**: Utiliza `node:20-alpine`, instala todas as dependências e executa `npm run build` gerando os assets Vite em `dist/` e o servidor CommonJS empacotado em `dist/server.cjs`.
2. **Stage 2 (Runner)**: Imagem limpa e enxuta, copia apenas dependências de produção (`npm install --omit=dev`), arquivos compilados de `dist/`, arquivos de contingência/DR em `data/` e executa com usuário de sistema não-root (`nodejs:nodejs`, UID 1001).
- **Sem Secrets**: Nenhum segredo ou arquivo `.env` é embutido na imagem.

---

## 6. .dockerignore
Configurado para impedir a inclusão de:
- `node_modules/`
- `dist/`
- `.git/` e `.gitignore`
- `.env` e `.env.*`
- Logs (`npm-debug.log`, `*.log`)
- Pastas de IDE e relatórios temporários de testes.
- **Preservação de DR**: Garante que o diretório `data/` esteja disponível para contingência no container.

---

## 7. Variáveis de Ambiente
Tabela consolidada para deploy em produção no Google Cloud Run:

| Variável | Obrigatória | Finalidade | Valor em Produção |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **Sim** | Modo de execução em produção | `production` |
| `PORT` | **Automática** | Porta injetada dinamicamente pelo Cloud Run | Ex: `8080` ou `3000` |
| `SQL_HOST` | **Sim** | Host / IP / Socket do PostgreSQL Cloud SQL | Fornecido pela infraestrutura Cloud SQL |
| `SQL_PORT` | Não | Porta do PostgreSQL (Padrão: 5432) | `5432` |
| `SQL_USER` | **Sim** | Usuário da base de dados PostgreSQL | Injetado via Secret Manager / Env |
| `SQL_PASSWORD` | **Sim** | Senha do PostgreSQL | Injetado via Secret Manager / Env |
| `SQL_DB_NAME` | **Sim** | Nome do banco de dados relacional | Injetado via Env |
| `SESSION_SECRET` | Não | Chave para assinatura de sessões | Injetado via Secret Manager (ou CSPRNG) |
| `APP_URL` | Não | URL canónica do domínio público de produção | Ex: `https://delfilandia.ao` |
| `GEMINI_API_KEY` | Não | Chave de API Google GenAI (backend exclusivo) | Injetado via Secret Manager |

---

## 8. Configuração Cloud Run
- **Bind de Rede**: `0.0.0.0` em `process.env.PORT`.
- **Modo de Execução**: `node dist/server.cjs`.
- **Concorrência e Escala**: Suporta escalabilidade horizontal e scale-to-zero.
- **Efemeridade do Filesystem**: O container não depende de arquivos locais graváveis; todas as operações autoritativas são persistidas de forma síncrona no PostgreSQL Cloud SQL.

---

## 9. Configuração Cloud SQL
- **Pool de Conexões**: `pg.Pool` configurado com `max: 5`, `connectionTimeoutMillis: 2000`, `idleTimeoutMillis: 30000`.
- **Resiliência e Circuit Breaker**: Mecanismos `isSqlAvailable()`, `markSqlUnavailable()`, `markSqlAvailable()` e `closePool()` preservados.
- **Isolamento de Credenciais**: Credenciais lidas exclusivamente de `process.env` em tempo de execução.

---

## 10. Health Check
- **Endpoint**: `GET /api/health`
- **Validação Executada**:
  - PostgreSQL Conectado: `HTTP 200` com `{ "status": "ok", "postgres": "connected", "timestamp": "..." }`.
  - PostgreSQL Indisponível: `HTTP 503` com `{ "status": "degraded", "postgres": "disconnected", "timestamp": "..." }`.
- **Privacidade**: Não expõe credenciais, hosts internos ou connection strings.

---

## 11. Graceful Shutdown
- Captura de sinais `SIGTERM` e `SIGINT` implementada no servidor Express.
- Sequência:
  1. `server.close()` interrompe a aceitação de novas conexões e drena as ativas.
  2. `await closePool()` encerra o pool do PostgreSQL de forma segura.
  3. `process.exit(0)` finaliza o processo.
  4. Timeout de salvaguarda de 10s (`.unref()`) previne travamentos.

---

## 12. CORS
- Suporte a `Same-Origin` com reflexão dinâmica da origem do cliente para credenciais seguras (`Access-Control-Allow-Credentials: true`).
- Fallback para `*` sem credenciais para requisições públicas sem Origin (WhatsApp Webview, cURL, etc.).

---

## 13. Cookies
- Cookie de sessão `delfilandia_session` configurado com:
  - `HttpOnly: true` (proteção contra XSS).
  - `SameSite: Lax` (proteção contra CSRF e compatibilidade com links externos do WhatsApp).
  - `Path: /`.
  - `Max-Age: 604800` (7 dias).
  - `Secure: true` (ativo quando `NODE_ENV === 'production'`).

---

## 14. Secrets
- Nenhum segredo, connection string, chave privada ou senha administrativa encontra-se hardcoded no código ou exposto no bundle do cliente.
- `GEMINI_API_KEY` isolada estritamente no backend.

---

## 15. Frontend
- Compilado com sucesso via Vite 6 + React 19.
- Bundles otimizados gerados em `dist/`.
- Roteamento SPA resiliente com fallback para `index.html`.

---

## 16. SPA Fallback
Rotas testadas com sucesso retornando `HTTP 200` e `text/html`:
- `/track/AO-451023`
- `/acompanhar/AO-451023`
- `/r/AO-451023`
- `/rastreio/AO-451023`
- `/encomenda/AO-451023`
- `/?code=AO-451023`
- `/admin`

---

## 17. Tracking Público
- Endpoint `GET /api/track/:code` operacional e público.
- Normalização de código testada com 100% de sucesso para os formatos:
  - `AO-451023` (canónico)
  - `ao-451023` (minúsculas)
  - `AO451023` (sem hífen)
  - `ao451023` (minúsculas sem hífen)
  - `A0-451023` (letra O substituída por zero)
  - `A0451023` (zero sem hífen)
  - `451023` (apenas dígitos numéricos)
- Cabeçalhos de cache: `Cache-Control: no-store, no-cache, must-revalidate`.

---

## 18. Deep Linking
- Arquitetura validada para abertura direta de links originados no WhatsApp, Safari (iOS / iPhone) e navegadores desktop/Android.

---

## 19. Build
- **TypeScript**: `tsc --noEmit` executado com **0 erros**.
- **Vite & esbuild**: `npm run build` executado com sucesso gerando `dist/` e `dist/server.cjs` (77.0 kB) com sourcemaps.

---

## 20. Testes Executados
1. Teste de build e checagem de tipos (`lint_applet` e `npm run build`).
2. Teste de inicialização do servidor com porta dinâmica.
3. Teste de endpoint de saúde (`/api/health`).
4. Teste de bloqueio de rotas administrativas sem autenticação (`/api/data` -> 401).
5. Teste de entrega de dados públicos de rastreio (`/api/track/AO-451023`).
6. Teste de auditoria de privacidade (verificação de vazamento de campos confidenciais).
7. Teste de normalização dos 7 formatos de código de rastreio.
8. Teste de SPA Fallback e rotas de deep link.
9. Teste de integridade e contagens do banco de dados Cloud SQL.

---

## 21. Testes Aprovados
- [x] Build de Produção — Aprovado.
- [x] Tipagem TypeScript — Aprovado (0 erros).
- [x] Health Check — Aprovado (Status 200, postgres: connected).
- [x] Proteção Administrativa — Aprovado (HTTP 401).
- [x] Rastreio Público — Aprovado (HTTP 200).
- [x] Privacidade do Cliente — Aprovado (0 campos internos expostos).
- [x] Normalização de Códigos — Aprovado (7/7 formatos válidos).
- [x] Roteamento SPA / Deep Links — Aprovado (7/7 rotas com HTTP 200 text/html).
- [x] Integridade do PostgreSQL — Aprovado (100% íntegro).

---

## 22. Testes Reprovados
*Nenhum teste foi reprovado.*

---

## 23. Problemas Encontrados
- Ausência prévia de `Dockerfile` e `.dockerignore` para containerização Cloud Run.
- Variável `PORT` estava com valor fixo no escopo local da função `startServer()`.

---

## 24. Problemas Corrigidos
- Criado `Dockerfile` multi-stage com `node:20-alpine`, usuário não-root e comando de produção `node dist/server.cjs`.
- Criado `.dockerignore` protegendo secrets, dependências locais e logs.
- Ajustado `server.ts` para ler `const PORT = Number(process.env.PORT || 3000);`.
- Padronizado `.env.example` com documentação e placeholders para produção.

---

## 25. Problemas Pendentes
*Nenhum problema técnico pendente.*

---

## 26. Integridade dos Dados Reais
- **Contagens no PostgreSQL Cloud SQL**:
  - `orders`: **1**
  - `clients`: **6**
  - `app_settings`: **1**
  - `audit_logs`: **60**
- **Encomenda Real `AO-451023`**:
  - Cliente: Aldemiro Samba (935133346)
  - Produto: Conjunto de colha e fronhas de cor vermelha
  - Estado: `PRODUTO_COMPRADO`
  - Valor: 25.000,00 Kz (pago integralmente)
  - Integridade: 100% preservada.

---

## 27. Checklist de Deploy
- [x] Dockerfile validado e compatível com Cloud Run.
- [x] .dockerignore configurado.
- [x] package.json com scripts `build`, `start`, `lint`.
- [x] npm run lint = 0 erros.
- [x] npm run build = sucesso.
- [x] `dist/index.html` e `dist/server.cjs` gerados.
- [x] PORT configurável dinamicamente e bind em `0.0.0.0`.
- [x] NODE_ENV=production configurado.
- [x] PostgreSQL Cloud SQL como única fonte primária de verdade.
- [x] Secrets e credenciais devidamente isolados no servidor.
- [x] Cookies HTTP-Only, SameSite=Lax e Secure em produção.
- [x] Health check `/api/health` operacional.
- [x] Graceful shutdown implementado para SIGTERM/SIGINT.
- [x] SPA fallback ativo e deep links validados.
- [x] Tracking público sanitizado sem dados confidenciais.
- [x] API administrativa protegida por sessão.
- [x] Dados reais e contagens intactas.

---

## 28. Plano de Rollback
1. Caso ocorra qualquer falha na instância do Cloud Run, a revisão anterior do serviço no Google Cloud Run pode ser reativada imediatamente através do console ou comando `gcloud run services update-traffic`.
2. Como não foram realizadas alterações no schema do banco ou dados, o PostgreSQL permanece 100% retrocompatível com qualquer revisão.

---

## 29. Próxima Etapa
Aguardar autorização explícita do usuário para início da **FASE 7.3: Execução e Validação do Deploy Final em Produção**.
