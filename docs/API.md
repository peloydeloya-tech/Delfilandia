# Especificação da API REST - DELFILÂNDIA

> **Nota:** Este documento lista **TODOS** os endpoints que realmente existem no servidor Express atual (`server.ts`). Nenhuma rota foi inventada ou omitida.

---

## 1. Tabela Geral de Endpoints Existentes

| Método | Rota | Autenticação Atual | Descrição / Finalidade |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Pública | Healthcheck do servidor (retorna status, timestamp, uptime) |
| `GET` | `/api/data` | Pública (ou Bearer opcional) | Obtém o conjunto completo de dados (encomendas, clientes, logs, configs) |
| `POST` | `/api/sync` | Pública | Salva em lote todo o estado da aplicação (`orders`, `clients`, etc.) |
| `GET` | `/api/orders` | Pública | Lista todas as encomendas cadastradas |
| `POST` | `/api/orders` | Pública | Cria uma nova encomenda ou substitui lote |
| `PUT` | `/api/orders/:id` | Pública | Atualiza uma encomenda específica pelo ID |
| `DELETE`| `/api/orders/:id` | Pública | Remove uma encomenda pelo ID |
| `GET` | `/api/track/:code` | Pública | Consulta pública de rastreio de encomenda por código (ex: `AO-102938`) |
| `GET` | `/api/clients` | Pública | Lista todos os clientes cadastrados |
| `POST` | `/api/clients` | Pública | Cria um novo cliente |
| `PUT` | `/api/clients/:id` | Pública | Atualiza dados de um cliente existente |
| `DELETE`| `/api/clients/:id` | Pública | Remove um cliente pelo ID |
| `GET` | `/api/logs` | Pública | Lista os registros de logs de auditoria |
| `POST` | `/api/logs` | Pública | Adiciona um novo registro de log |
| `GET` | `/api/settings` | Pública | Obtém as configurações institucionais da empresa |
| `POST` | `/api/settings` | Pública | Atualiza as configurações institucionais da empresa |
| `POST` | `/api/auth/login` | Pública | Valida PIN/Senha de acesso administrativo |
| `POST` | `/api/auth/verify` | Pública | Valida a validade de uma sessão ativa |
| `POST` | `/api/auth/change-pin`| Pública | Altera o PIN/Senha de acesso |

---

## 2. Detalhamento dos Endpoints

### 2.1. `GET /api/health`
- **Finalidade:** Verificação de disponibilidade e integridade do backend.
- **Parâmetros:** Nenhum.
- **Resposta Sucesso (200):**
  ```json
  {
    "status": "ok",
    "timestamp": "2026-08-23T14:10:00.000Z",
    "uptime": 120.45,
    "database": "connected"
  }
  ```

### 2.2. `GET /api/data`
- **Finalidade:** Carregamento inicial de todo o estado operacional do painel administrativo.
- **Parâmetros:** Nenhum.
- **Resposta Sucesso (200):**
  ```json
  {
    "orders": [...],
    "clients": [...],
    "companySettings": {...},
    "auditLogs": [...]
  }
  ```
- **Possíveis Problemas:** Retorna todo o volume de dados da base em um único payload sem paginação; com milhares de registros, pode gerar lentidão e consumo excessivo de memória.

### 2.3. `POST /api/sync`
- **Finalidade:** Sincronização em massa enviada pelo frontend.
- **Body:**
  ```json
  {
    "orders": [...],
    "clients": [...],
    "companySettings": {...},
    "auditLogs": [...]
  }
  ```
- **Resposta Sucesso (200):** `{ "success": true, "timestamp": "..." }`
- **Possíveis Problemas:** Permite substituição em lote sem verificação de concorrência ou bloqueio pessimista/otimista, arriscando sobrescrever alterações simultâneas.

### 2.4. `GET /api/track/:code`
- **Finalidade:** Rastreamento público de uma encomenda pelo código alfanumérico.
- **Parâmetros de URL:** `code` (string, ex: `AO-102938`).
- **Resposta Sucesso (200):**
  ```json
  {
    "success": true,
    "order": {
      "id": "uuid",
      "code": "AO-102938",
      "clientName": "...",
      "status": "A Caminho",
      "timeline": [...]
    }
  }
  ```
- **Resposta Não Encontrada (404):** `{ "success": false, "message": "Encomenda não encontrada" }`
- **Possíveis Problemas:** Deve garantir que dados privados sensíveis (ex: margem de lucro, notas internas de fornecedores) não vazem no payload público.

### 2.5. Endpoints de Autenticação (`/api/auth/*`)
- **`POST /api/auth/login`**: Recebe `{ "pin": "..." }` ou `{ "password": "..." }`, valida hash e retorna token de sessão simples.
- **`POST /api/auth/verify`**: Recebe o token atual e verifica se a sessão expirou.
- **`POST /api/auth/change-pin`**: Recebe `{ "currentPin": "...", "newPin": "..." }` para atualizar a credencial.
- **Possíveis Problemas:** Ausência de rate-limiting (proteção contra força bruta) implementado no nível do servidor Express; tokens são gerados de forma simplificada sem expiração criptográfica assimétrica.
