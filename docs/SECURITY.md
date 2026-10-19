# Avaliação de Segurança - DELFILÂNDIA

> **Nota:** Este documento registra a auditoria de segurança da implementação **ATUAL** na Etapa 1. Conforme as regras da Etapa 1, **nenhuma alteração destrutiva foi feita no código**, apenas o diagnóstico estruturado das vulnerabilidades existentes para correção planejada nas etapas subsequentes.

---

## 1. Classificação Geral de Riscos Identificados

| ID | Vulnerabilidade / Achado | Severidade | Camada Afetada | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Ausência de Autenticação e Autorização em Rotas Administrativas da API Express | **CRÍTICO** | Backend (`server.ts`) | Identificado para Etapa 2/4 |
| **SEC-02** | Credenciais Administrativas / Hash e Código de Recuperação no `localStorage` | **ALTO** | Frontend (`security.ts`) | Identificado para Etapa 2 |
| **SEC-03** | Falta de Rate Limiting em Endpoints de Login e Rastreio | **ALTO** | Backend (`server.ts`) | Identificado para Etapa 2/4 |
| **SEC-04** | Geração de Tokens de Sessão com Entropia Reduzida (`Math.random`) | **MÉDIO** | Frontend/Backend | Identificado para Etapa 2 |
| **SEC-05** | CORS Irrestrito (`Access-Control-Allow-Origin: *`) | **MÉDIO** | Backend (`server.ts`) | Identificado para Etapa 2/4 |
| **SEC-06** | Regras de Segurança do Firebase (`firestore.rules`) Abertas para Leitura/Escrita Pública | **MÉDIO** | Firebase / Firestore | Identificado para Etapa 5 |
| **SEC-07** | Ausência de Sanitização e Validação Estrita de Payload no Backend | **MÉDIO** | Backend (`server.ts`) | Identificado para Etapa 4 |
| **SEC-08** | Exposição de Informações Internas no Endpoint `/api/data` | **BAIXO** | Backend (`server.ts`) | Identificado para Etapa 4 |

---

## 2. Detalhamento dos Achados

### 2.1. SEC-01 — Ausência de Middleware de Autenticação em Endpoints Administrativos
- **Classificação:** **CRÍTICO**
- **Descrição:** Rotas como `POST /api/orders`, `DELETE /api/orders/:id`, `POST /api/sync` e `POST /api/settings` aceitam requisições HTTP sem validar um token JWT ou sessão assinada no backend. A verificação atual de autenticação ocorre primordialmente no nível do frontend React (bloqueio de tela por modal de PIN).
- **Ação Planejada:** Introduzir middleware de autenticação (`server/middleware/auth.ts`) que exige Bearer token assinado para qualquer operação de escrita ou consulta administrativa.

### 2.2. SEC-02 — Armazenamento de Configurações de Segurança no LocalStorage
- **Classificação:** **ALTO**
- **Descrição:** Em `src/utils/security.ts`, os dados de hash da senha mestra, código de recuperação de emergência (`masterRecoveryCode`) e controle de tentativas são armazenados no `localStorage` do navegador do cliente. Embora use SHA-256, qualquer script executado no cliente ou inspeção física no navegador pode inspecionar essas chaves.
- **Ação Planejada:** Migrar o hash da senha e a validação de sessão exclusivamente para o backend com hash robusto (ex: bcrypt/argon2) e cookies `HttpOnly` ou tokens de curta duração.

### 2.3. SEC-03 — Ausência de Rate Limiting
- **Classificação:** **ALTO**
- **Descrição:** O endpoint `/api/auth/login` e `/api/track/:code` não possuem middleware de limitação de taxa (`express-rate-limit`). Isso permite tentativas ilimitadas de força bruta contra senhas ou códigos de rastreio de encomendas.
- **Ação Planejada:** Aplicar rate limiter específico para rotas de autenticação (ex: máx. 5 tentativas por minuto por IP) e para consultas públicas de rastreamento.

### 2.4. SEC-04 — Geração de Tokens com `Math.random()`
- **Classificação:** **MÉDIO**
- **Descrição:** Tokens de sessão temporários ou identificadores gerados no cliente utilizam funções pseudoaleatórias como `Math.random().toString(36)`, que não possuem aleatoriedade criptográfica segura.
- **Ação Planejada:** Substituir por `crypto.randomUUID()` ou `crypto.randomBytes()`.

### 2.5. SEC-05 — Configuração Permissiva de CORS
- **Classificação:** **MÉDIO**
- **Descrição:** O servidor Express define `Access-Control-Allow-Origin: *` para todas as requisições.
- **Ação Planejada:** Restringir as origens permitidas nas variáveis de ambiente em ambientes de produção.

### 2.6. SEC-06 — Regras de Segurança do Firestore
- **Classificação:** **MÉDIO**
- **Descrição:** O arquivo `firestore.rules` atual permite leitura e escrita amplas para facilitar testes e sincronização inicial.
- **Ação Planejada:** Implementar regras granulares baseadas em Firebase Auth ou consolidar o PostgreSQL como autoridade central.
