# DELFILÂNDIA — ETAPA 9 — FASE 9.2
## RUNBOOK OPERACIONAL, PROCEDIMENTOS DE SUSTENTAÇÃO E GO-LIVE CONTROLADO

---

### 1. OBJETIVO
Documentar e estabelecer os padrões operacionais definitivos, procedimentos de sustentação, guias de deploy, rollback, backup, recuperação de desastres (DR), gestão de incidentes, monitorização contínua e o checklist de **GO-LIVE CONTROLADO** do sistema **DELFILÂNDIA** (Gestão de Encomendas e Rastreamento).

---

### 2. ESTADO ATUAL
O sistema encontra-se formalmente homologado (Etapa 8 e Fase 9.1), com:
- **Testes Consolidados**: 213/213 testes aprovados (0 falhas).
- **Compilação**: TypeScript v5.8.3 com 0 erros (`npx tsc --noEmit`).
- **Build de Produção**: `npm run build` gerando `dist/` e `dist/server.cjs` (CommonJS bundling via esbuild).
- **Banco de Dados**: Google Cloud SQL (PostgreSQL v18) conectado e íntegro (1 encomenda, 6 clientes, 1 configuração, 60 logs de auditoria).
- **Segurança**: RBAC ativo com bloqueio HTTP 401 para anônimos, cookies de sessão `HttpOnly`/`SameSite=Lax` com tokens CSPRNG, cabeçalhos de segurança HTTP e sanitização de logs.
- **Rastreio Público**: Endpoint `/api/track/AO-451023` operacional e sanitizado (zero vazamento de margens ou custos).

---

### 3. ARQUITETURA OPERACIONAL
A plataforma opera em arquitetura cliente-servidor containerizada com persistência em nuvem gerenciada:
- **Camada de Apresentação (Frontend)**: React 18 SPA servido como arquivos estáticos compilados via Vite, com roteamento dinâmico e suporte a deep links. O estado local atua estritamente como camada de apresentação, sendo o PostgreSQL a única autoridade.
- **Camada de Aplicação (Backend)**: Servidor Node.js Express em TypeScript empacotado em `dist/server.cjs`, fornecendo endpoints REST sanitizados para clientes e protegidos para administração.
- **Camada de Dados (PostgreSQL)**: Instância Cloud SQL PostgreSQL acessada através de pool de conexões resiliente (`pg.Pool`) e mapeamento tipado via `drizzle-orm`.
- **Hospedagem & Execução**: Container Docker multi-stage executando em Google Cloud Run, com porta dinâmica `PORT` (padrão 3000) e graceful shutdown (`SIGTERM`/`SIGINT`).

---

### 4. INVENTÁRIO OPERACIONAL

#### 4.1 Componentes e Arquitetura
| Componente | Tecnologia | Função Operacional |
| :--- | :--- | :--- |
| **Frontend** | React 18 / Tailwind CSS / Lucide | Interface de gestão administrativa e portal público de rastreio |
| **Backend** | Express / Node.js 20+ / esbuild | APIs REST, autenticação RBAC, sanitização e proxying |
| **Container** | Docker (Alpine Linux) | Empacotamento multi-stage seguro (usuário `nodejs:1001`) |
| **Hospedagem** | Google Cloud Run | Execução serverless escalável com binding em `0.0.0.0:3000` |
| **Persistência**| Cloud SQL PostgreSQL v18 | Armazenamento relacional autoritativo com snapshots diários |

#### 4.2 Inventário de Variáveis de Ambiente e Secrets
*Nota de Segurança: Valores reais NUNCA são expostos neste documento ou no frontend.*

| Variável | Finalidade | Escopo de Execução |
| :--- | :--- | :--- |
| `SQL_HOST` | Endereço do socket/host do PostgreSQL | Exclusivo Server-side |
| `SQL_PORT` | Porta de conexão do banco (5432) | Exclusivo Server-side |
| `SQL_USER` | Usuário do banco Cloud SQL | Exclusivo Server-side |
| `SQL_PASSWORD` | Senha de autenticação do banco | Exclusivo Server-side (Secret) |
| `SQL_DB_NAME` | Nome do banco de dados relacional | Exclusivo Server-side |
| `SESSION_SECRET` | Chave de assinatura e cifragem de sessão | Exclusivo Server-side (Secret) |
| `GEMINI_API_KEY` | Chave de integração de inteligência artificial | Exclusivo Server-side (Secret) |
| `PORT` | Porta HTTP de escuta do container | Ambiente de Runtime Cloud Run |

---

### 5. PRÉ-REQUISITOS OPERACIONAIS
Para operar e manter o sistema Delfilândia:
1. Node.js LTS (v20+ ou v22+) instalado.
2. Acesso configurado ao Google Cloud Console / Cloud SQL.
3. Variáveis de ambiente declaradas no Cloud Run ou arquivo `.env` seguro.
4. Conexão TCP liberada para a instância do Cloud SQL na porta 5432.

---

### 6. GUIA DE INICIALIZAÇÃO
```bash
# 1. Instalação e validação de dependências
npm install

# 2. Verificação estrita de tipagem TypeScript
npx tsc --noEmit

# 3. Compilação de frontend e backend para produção
npm run build

# 4. Inicialização do servidor em modo produção
npm start

# 5. Verificação imediata de integridade (Health Check)
curl -s http://127.0.0.1:3000/api/health
# Esperado: {"status":"ok","postgres":"connected","timestamp":"..."}
```

---

### 7. PROCEDIMENTO DE DEPLOY (CLOUD RUN)
1. **Validação Pré-Deploy**:
   - Executar `npx tsc --noEmit` -> Deve retornar 0 erros.
   - Executar `npm run build` -> Deve gerar `dist/` e `dist/server.cjs` sem advertências.
2. **Build da Imagem Container**:
   - Construir imagem baseada no `Dockerfile` multi-stage:
     ```bash
     docker build -t gcr.io/delfilandia-prod/app:latest .
     ```
3. **Publicação no Registro**:
   - Realizar push seguro para o Artifact Registry do Google Cloud.
4. **Deploy da Revisão**:
   - Atualizar o serviço Cloud Run mantendo a porta de escuta configurada para `PORT=3000` e variáveis de ambiente injetadas via Secret Manager.
5. **Comutação de Tráfego**:
   - Direcionar 100% do tráfego para a nova revisão após o término do deploy.

---

### 8. PROCEDIMENTO PÓS-DEPLOY
Checklist de validação obrigatória imediatamente após qualquer atualização:
- [ ] Executar `GET /api/health` -> HTTP 200 e `postgres: "connected"`.
- [ ] Executar `GET /api/auth/status` -> HTTP 200 sem vazamento de segredos.
- [ ] Executar `GET /api/track/AO-451023` -> HTTP 200 com dados públicos sanitizados.
- [ ] Executar `GET /api/data` anonimamente -> HTTP 401 Unauthorized confirmado.
- [ ] Acessar rota SPA `/` -> Carregamento limpo da interface frontend.
- [ ] Verificar logs no Cloud Run -> Ausência de exceções não tratadas.

---

### 9. PROCEDIMENTO DE ROLLBACK
Em caso de anomalia crítica (HTTP 5xx contínuo ou falha de conectividade):
1. **Identificação da Falha**: Confirmar indisponibilidade via `/api/health` ou monitor de logs.
2. **Seleção da Revisão**: No painel do Google Cloud Run, identificar a última revisão estável com status *Healthy*.
3. **Reversão Imediata de Tráfego**:
   ```bash
   gcloud run services update-traffic delfilandia-service --to-revisions=REVISAO_ANTERIOR=100
   ```
4. **Validação da Revisão Restaurada**: Executar o Checklist Pós-Deploy na revisão restaurada.
5. **Auditoria Read-Only do PostgreSQL**: Confirmar integridade dos registros via queries de leitura.

---

### 10. POLÍTICA E PROCEDIMENTO DE BACKUP
- **Automático (Cloud SQL)**: Snapshots diários gerenciados automaticamente pelo Google Cloud SQL durante a janela de menor uso (03:00 UTC), com retenção de 7 a 30 dias e WAL logs habilitados para Point-in-Time Recovery (PITR).
- **Manual / Pré-Manutenção**:
  ```bash
  gcloud sql backups create --instance=delfilandia-pg-instance --description="Backup manual pre-manutencao"
  ```
- **Auditoria de Backups**: Verificar semanalmente a presença do snapshot mais recente no painel do Cloud SQL.

---

### 11. PROCEDIMENTO DE RESTORE
*Nota: Restores NUNCA devem ser executados sobre a base de produção sem prévia homologação em ambiente isolado.*
1. **Criação de Instância Temporária (Staging)**: Provisionar réplica ou instância temporária de teste.
2. **Restauração do Snapshot**: Executar restore do backup selecionado na instância temporária.
3. **Auditoria de Integridade**:
   - Verificar contagem de tabelas (`orders=1`, `clients=6`, `app_settings=1`, `audit_logs=60`).
   - Verificar encomenda canónica `AO-451023`.
4. **Comutação de Conexão**: Atualizar `SQL_HOST` no Cloud Run apontando para a base restaurada validada.

---

### 12. DISASTER RECOVERY (DR)
Procedimento homologado na Fase 8.4 (34/34 testes de resiliência aprovados):
- **Cenário de Queda do Banco**: A aplicação entra em modo de degradação graciosa (HTTP 503 `status: "degraded"`), sem vazar credenciais ou encerrar o processo.
- **Recuperação Automática**: Assim que o pool restabelece conexão com o PostgreSQL, o endpoint `/api/health` retorna imediatamente para HTTP 200 e as rotas voltam a operar normalmente sem intervenção humana.
- **RTO (Recovery Time Objective)**: < 15 minutos (tempo de provisionamento/failover do Cloud SQL).
- **RPO (Recovery Point Objective)**: < 5 minutos (garantido pelo WAL streaming do Cloud SQL).

---

### 13. MONITORIZAÇÃO OPERACIONAL
Métricas e limiares operacionais:
- **Disponibilidade**: `/api/health` deve responder com HTTP 200 continuamente (Latência esperada < 10 ms).
- **Erros HTTP 5xx**: Limiar de alerta: > 1% das requisições em janela de 5 minutos.
- **Falhas de Autenticação (401/403)**: Limiar de alerta: > 10 falhas consecutivas (possível ataque brute-force).
- **Scrubbing de Logs**: Todos os logs estruturados no stdout são filtrados pelo middleware contra exposição de tokens, senhas e chaves.

---

### 14. GESTÃO DE INCIDENTES

| Gravidade | Definição | Ação Inicial | Tempo de Resposta |
| :--- | :--- | :--- | :--- |
| **P0 (Crítico)** | Indisponibilidade total do sistema ou vazamento de dados | Executar rollback imediato ou ativar contenção; notificar liderança | < 15 minutos |
| **P1 (Alto)** | Falha em função crítica (ex: tracking indisponível ou falha no login) | Diagnosticar via logs estruturados e `/api/health`; aplicar correção | < 1 hora |
| **P2 (Médio)** | Degradação parcial de performance ou falha em relatório secundário | Analisar latências do pool PostgreSQL; reiniciar container se necessário | < 4 horas |
| **P3 (Baixo)** | Problema cosmético de UI ou dúvida operacional | Registrar no backlog pós-go-live | Próximo ciclo |

*Regra de Ouro*: Em incidentes P0/P1, NUNCA executar queries `UPDATE`/`DELETE` em produção para "testar soluções". Utilizar rollback ou ambiente isolado.

---

### 15. SEGURANÇA OPERACIONAL
- **Isolamento de Secrets**: Credenciais residem exclusivamente no runtime do container e Secret Manager.
- **Cookies**: Flags `HttpOnly`, `SameSite=Lax`, `Path=/` e `Max-Age=604800` (7 dias) ativas.
- **Headers HTTP**: `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-DNS-Prefetch-Control`, `X-Download-Options` ativos e `X-Powered-By` desabilitado.
- **Proteção Adversarial**: Imunidade comprovada contra SQL Injection, XSS e Path Traversal.

---

### 16. FLUXOS CRÍTICOS OPERACIONAIS
1. **Fluxo de Rastreio Público**:
   `Cliente acessa link -> SPA resolve deep link -> Requisição a /api/track/:code -> Backend busca no PostgreSQL -> Sanitização de margens -> Exibição limpa na tela`.
2. **Fluxo de Gestão Administrativa**:
   `Administrador autentica-se com PIN -> Cookie HttpOnly emitido -> Carregamento de dados protegidos (/api/data) -> Gestão de status, pagamentos e etiquetas PDF`.
3. **Fluxo de WhatsApp**:
   `Administrador clica em Enviar Notificação -> URL formatada com link HTTPS e código canónico -> Cliente recebe no WhatsApp`.

---

### 17. CHECKLIST DIÁRIO
- [ ] Cloud Run operacional e saudável.
- [ ] Endpoint `/api/health` respondendo HTTP 200 (`postgres: "connected"`).
- [ ] Rastreio da encomenda `AO-451023` funcional e sanitizado.
- [ ] Ausência de alertas de erros 5xx no monitor do Cloud Run.
- [ ] Snapshot de backup diário executado com sucesso no Cloud SQL.

---

### 18. CHECKLIST SEMANAL
- [ ] Revisão dos logs de auditoria administrativa (`audit_logs`).
- [ ] Verificação de tentativas de login bloqueadas por anti-brute-force.
- [ ] Verificação de uso de CPU, memória e conexões do Cloud SQL.
- [ ] Confirmação de integridade dos backups automáticos.

---

### 19. CHECKLIST MENSAL
- [ ] Teste controlado de restauração de backup em ambiente isolado (Staging).
- [ ] Revisão de dependências e avisos de segurança (`npm audit`).
- [ ] Rotação de chaves de API / segredos de sessão conforme política.
- [ ] Revisão de custos e capacidade da infraestrutura Google Cloud.

---

### 20. CHECKLIST DE GO-LIVE (20 PONTOS)

| # | Item de Verificação | Avaliação | Evidência / Status |
| :---: | :--- | :---: | :--- |
| 1 | **Build** | **APROVADO** | `npm run build` conclui com sucesso (Vite + esbuild) |
| 2 | **TypeScript** | **APROVADO** | `npx tsc --noEmit` retorna 0 erros |
| 3 | **Container** | **APROVADO** | `Dockerfile` multi-stage com usuário `nodejs:1001` |
| 4 | **Cloud Run** | **APROVADO** | Configurado para host `0.0.0.0` e porta dinâmica |
| 5 | **PostgreSQL** | **APROVADO** | Cloud SQL conectado, pool saudável, 0 erros |
| 6 | **Secrets** | **APROVADO** | Zero segredos no bundle do cliente; scrubbing ativo |
| 7 | **Health Check** | **APROVADO** | `/api/health` retorna HTTP 200 e timestamp ISO |
| 8 | **Autenticação / RBAC** | **APROVADO** | Rotas administrativas bloqueadas com HTTP 401 |
| 9 | **Tracking Público** | **APROVADO** | `/api/track/AO-451023` sanitizado e operacional |
| 10 | **Deep Links** | **APROVADO** | 9 rotas SPA testadas com fallback HTTP 200 |
| 11 | **WhatsApp** | **APROVADO** | Links HTTPS e formato internacional de Angola (+244) |
| 12 | **Mobile / Responsividade** | **APROVADO** | Viewport responsiva e touch targets >= 44px |
| 13 | **Logs Sanitizados** | **APROVADO** | Redaction de senhas, tokens e chaves ativado |
| 14 | **Backup** | **APROVADO** | Snapshots automáticos diários Cloud SQL configurados |
| 15 | **Rollback Documentado** | **APROVADO** | Guia de reversão de tráfego Cloud Run pronto |
| 16 | **Disaster Recovery** | **APROVADO** | Procedimento homologado (34/34 testes na Fase 8.4) |
| 17 | **Integridade dos Dados** | **APROVADO** | 1 order, 6 clients, 1 setting, 60 logs preservados |
| 18 | **Segurança** | **APROVADO** | Headers nosniff, referrer-policy e mitigação SQLi/XSS |
| 19 | **Monitorização** | **APROVADO** | Métricas de latência < 3ms e detecção de falhas |
| 20 | **Runbook Operacional** | **APROVADO** | Procedimentos diários, semanais e de crise documentados |

---

### 21. CRITÉRIOS DE BLOQUEIO DO GO-LIVE
Nenhum critério de bloqueio foi identificado:
- Build íntegro e testado.
- TypeScript sem divergências.
- PostgreSQL totalmente estável e conectado.
- Zero vazamentos de dados confidenciais ou segredos de ambiente.
- Dados de produção estritamente preservados.

---

### 22. INTEGRIDADE FINAL DOS DADOS DE PRODUÇÃO
Auditoria realizada antes e depois da execução da Fase 9.2:

```text
CONTAGENS DE PRODUÇÃO:
- Encomendas (orders):      1 (AO-451023)
- Clientes (clients):        6 (Aldemiro Samba + 5 cadastrados)
- Configurações (settings):  1 (global_settings)
- Logs (audit_logs):         60 registros forenses

DETALHAMENTO DA ENCOMENDA CANÓNICA AO-451023:
- Código:             AO-451023
- Cliente:            Aldemiro Samba
- Preço de Revenda:   25.000,00 Kz
- Valor Pago:         25.000,00 Kz
- Valor Pendente:     0,00 Kz
- Status Operacional: PRODUTO_COMPRADO
- Status Pagamento:   CONFIRMADO
- Método Pagamento:   EXPRESS
- Custo de Compra:    18.000,00 Kz
- Lucro Bruto:        7.000,00 Kz
- Lucro Líquido:      7.000,00 Kz
- Integridade:        100% INTACTA
```

---

### 23. EVIDÊNCIAS DE HOMOLOGAÇÃO
- **TypeScript**: `npx tsc --noEmit` -> Código 0.
- **Build**: `npm run build` -> Sucesso (`dist/server.cjs` gerado).
- **Suíte de Segurança & Gate**: `scripts/verify_phase86_gate_final.ts` -> 88/88 aprovados.
- **Suíte de Disaster Recovery**: `scripts/verify_phase84_dr.ts` -> 34/34 aprovados.
- **Suíte de Observabilidade**: `scripts/verify_phase85_observability.ts` -> 59/59 aprovados.
- **Suíte Frontend**: `scripts/verify_phase76.js` -> 32/32 aprovados.
- **Total Consolidado**: **213/213 Testes Aprovados (100%)**.

---

### 24. LIMITAÇÕES
- O banco de dados de produção foi mantido em modo estritamente read-only durante os testes operacionais para salvaguardar a integridade dos dados reais.
- Testes que envolvam mutação de dados devem ser executados em ambiente de homologação/staging com cópia sanitizada do banco.

---

### 25. PLANO DE MANUTENÇÃO
- **Janela de Manutenção Padrão**: Domingos das 02:00 às 04:00 (Horário de Luanda / WAT).
- **Atualização de Pacotes**: Ciclo mensal com validação prévia de testes em staging.
- **Auditoria Periódica**: Revisão semestral de regras de acesso e permissões no Google Cloud Console.

---

### 26. PLANO DE CONTINGÊNCIA
- **Falha de Conectividade com Banco**: O backend degrada para HTTP 503 sem travar o processo; reestabelecimento automático com reconexão do pool.
- **Degradação de Container Cloud Run**: O Cloud Run escala novas instâncias automaticamente e encerra instâncias não saudáveis.
- **Problema de Release**: Rollback em comando único comutando 100% do tráfego para a revisão anterior.

---

### 27. RESPONSABILIDADES OPERACIONAIS
- **Administrador do Sistema / Operador**: Gerenciamento de encomendas, confirmação de pagamentos e emissão de etiquetas.
- **Engenharia / DevOps**: Monitorização de logs, execução de deploys, gestão de secrets e manutenção da infraestrutura Google Cloud.

---

### 28. CRITÉRIOS DE ENCERRAMENTO DA FASE
- [X] Regra de não-destrutividade cumprida com 100% de integridade.
- [X] Runbook operacional completo e documentado.
- [X] Procedimentos de deploy, rollback, backup e DR validados.
- [X] Checklist de GO-LIVE com 20/20 itens aprovados.

---

### 29. ESTADO FINAL
O sistema **DELFILÂNDIA** está tecnicamente consolidado, estável, seguro, performante e homologado para entrada em operação controlada em produção.

---

### 30. APROVAÇÃO FINAL DO GATE

```text
================================================================
FASE 9.2 — APROVADA
SISTEMA DELFILÂNDIA — PRONTO PARA GO-LIVE CONTROLADO
================================================================
```
