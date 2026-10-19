# Documentação do Banco de Dados - DELFILÂNDIA

> **Nota:** Este documento descreve o esquema de banco de dados **ATUAL** (PostgreSQL / Drizzle ORM) definido em `src/db/schema.ts` e repositório `src/db/repository.ts`. Não foram feitas alterações no schema nesta etapa.

---

## 1. Tabelas Existentes no Schema (`src/db/schema.ts`)

### 1.1. Tabela `orders`
Armazena os registros principais de encomendas no sistema.

| Coluna | Tipo Drizzle | Tipo PostgreSQL | Descrição / Restrições |
| :--- | :--- | :--- | :--- |
| `id` | `text("id")` | `TEXT PRIMARY KEY` | Identificador único da encomenda (UUID/string) |
| `code` | `text("code")` | `TEXT NOT NULL UNIQUE` | Código de rastreio público (ex: `AO-102938`) |
| `client_name` | `text("client_name")` | `TEXT NOT NULL` | Nome completo do cliente |
| `client_phone` | `text("client_phone")` | `TEXT NOT NULL` | Telefone de contato (Angola / formato internacional) |
| `client_province` | `text("client_province")` | `TEXT` | Província de entrega (ex: Luanda, Benguela, Huíla) |
| `client_address` | `text("client_address")` | `TEXT` | Endereço ou ponto de referência |
| `client_id` | `text("client_id")` | `TEXT` | ID do cliente associado (sem foreign key formal) |
| `service_type` | `text("service_type")` | `TEXT NOT NULL` | Tipo do serviço (Normal, Expresso, Personalizado) |
| `origin` | `text("origin")` | `TEXT` | Origem da carga (ex: China, Portugal, Luanda) |
| `destination` | `text("destination")` | `TEXT` | Destino final |
| `status` | `text("status")` | `TEXT NOT NULL` | Status da encomenda |
| `payment_status` | `text("payment_status")` | `TEXT NOT NULL` | Status do pagamento (Pendente, Parcial, Pago) |
| `payment_method` | `text("payment_method")` | `TEXT` | Método (Transferência, Dinheiro, Multicaixa Express) |
| `total_value` | `doublePrecision("total_value")` | `DOUBLE PRECISION NOT NULL` | Valor total da encomenda (AKZ) |
| `paid_amount` | `doublePrecision("paid_amount")` | `DOUBLE PRECISION` | Valor já pago pelo cliente (AKZ) |
| `estimated_delivery` | `text("estimated_delivery")` | `TEXT` | Data prevista de entrega (formato string/ISO) |
| `delivered_at` | `text("delivered_at")` | `TEXT` | Data em que a entrega foi concluída |
| `delivery_person_name` | `text("delivery_person_name")` | `TEXT` | Nome do entregador responsável |
| `delivery_notes` | `text("delivery_notes")` | `TEXT` | Observações de entrega / assinatura |
| `delivery_signature` | `text("delivery_signature")` | `TEXT` | Assinatura digital do recebedor em base64 |
| `items_json` | `text("items_json")` | `TEXT` | Array de itens serializado em JSON |
| `timeline_json` | `text("timeline_json")` | `TEXT` | Histórico de eventos serializado em JSON |
| `raw_data_json` | `text("raw_data_json")` | `TEXT` | Backup completo dos dados da encomenda em JSON |
| `created_at` | `text("created_at")` | `TEXT NOT NULL` | Timestamp de criação (string ISO) |
| `updated_at` | `text("updated_at")` | `TEXT NOT NULL` | Timestamp de atualização (string ISO) |

---

### 1.2. Tabela `clients`
Armazena a base de clientes cadastrados.

| Coluna | Tipo Drizzle | Tipo PostgreSQL | Descrição / Restrições |
| :--- | :--- | :--- | :--- |
| `id` | `text("id")` | `TEXT PRIMARY KEY` | Identificador único do cliente |
| `name` | `text("name")` | `TEXT NOT NULL` | Nome completo |
| `phone` | `text("phone")` | `TEXT NOT NULL` | Telefone principal |
| `secondary_phone` | `text("secondary_phone")` | `TEXT` | Telefone alternativo |
| `email` | `text("email")` | `TEXT` | E-mail do cliente |
| `province` | `text("province")` | `TEXT` | Província de residência |
| `address` | `text("address")` | `TEXT` | Endereço completo |
| `notes` | `text("notes")` | `TEXT` | Observações sobre o cliente |
| `total_orders` | `integer("total_orders")` | `INTEGER` | Contador acumulado de pedidos |
| `total_spent` | `doublePrecision("total_spent")` | `DOUBLE PRECISION` | Total gasto acumulado em AKZ |
| `created_at` | `text("created_at")` | `TEXT NOT NULL` | Timestamp de criação |
| `updated_at` | `text("updated_at")` | `TEXT NOT NULL` | Timestamp de atualização |

---

### 1.3. Tabela `audit_logs`
Registros de auditoria de operações do sistema.

| Coluna | Tipo Drizzle | Tipo PostgreSQL | Descrição / Restrições |
| :--- | :--- | :--- | :--- |
| `id` | `text("id")` | `TEXT PRIMARY KEY` | Identificador do log |
| `action` | `text("action")` | `TEXT NOT NULL` | Ação realizada (ex: CREATE_ORDER, UPDATE_STATUS) |
| `entity_type` | `text("entity_type")` | `TEXT NOT NULL` | Tipo da entidade (`order`, `client`, `settings`) |
| `entity_id` | `text("entity_id")` | `TEXT` | ID da entidade modificada |
| `details` | `text("details")` | `TEXT` | Descrição em texto ou JSON dos detalhes da alteração |
| `ip_address` | `text("ip_address")` | `TEXT` | Endereço IP de origem da requisição |
| `created_at` | `text("created_at")` | `TEXT NOT NULL` | Timestamp da ocorrência |

---

### 1.4. Tabela `company_settings`
Configurações corporativas, identidade visual e dados de contacto.

| Coluna | Tipo Drizzle | Tipo PostgreSQL | Descrição / Restrições |
| :--- | :--- | :--- | :--- |
| `id` | `text("id")` | `TEXT PRIMARY KEY` | Chave única (geralmente `'default'`) |
| `name` | `text("name")` | `TEXT NOT NULL` | Razão Social / Nome da Empresa |
| `tagline` | `text("tagline")` | `TEXT` | Slogan da empresa |
| `nif` | `text("nif")` | `TEXT` | NIF angolano |
| `phone` | `text("phone")` | `TEXT NOT NULL` | Telefone corporativo |
| `phone2` | `text("phone2")` | `TEXT` | Telefone de suporte |
| `email` | `text("email")` | `TEXT` | E-mail oficial |
| `address` | `text("address")` | `TEXT NOT NULL` | Endereço físico da sede |
| `iban` | `text("iban")` | `TEXT` | IBAN bancário para pagamentos |
| `bank_name` | `text("bank_name")` | `TEXT` | Nome do banco comercial |
| `currency` | `text("currency")` | `TEXT NOT NULL` | Moeda (`AOA` / `AKZ`) |
| `currency_symbol` | `text("currency_symbol")` | `TEXT NOT NULL` | Símbolo monetário (`Kz`) |
| `logo_url` | `text("logo_url")` | `TEXT` | URL ou Base64 do logotipo |
| `signature_url` | `text("signature_url")` | `TEXT` | Assinatura institucional |
| `stamp_url` | `text("stamp_url")` | `TEXT` | Carimbo digital da empresa |
| `terms_and_conditions`| `text("terms_and_conditions")` | `TEXT` | Termos e condições impressos nos recibos |
| `whatsapp_notification` | `text("whatsapp_notification")` | `TEXT` | Flag/configuração de notificações |
| `updated_at` | `text("updated_at")` | `TEXT NOT NULL` | Timestamp da última atualização |

---

## 2. Problemas Identificados para a ETAPA 3 (Refatoração de Banco de Dados)

Durante a auditoria da Etapa 1, foram mapeadas as seguintes oportunidades de melhoria técnica para tratamento específico na Etapa 3:

1. **Uso de `doublePrecision` para Valores Monetários:**  
   Valores financeiros (`total_value`, `paid_amount`, `total_spent`) estão usando ponto flutuante de precisão dupla, o que pode acumular imprecisões de arredondamento em operações contábeis. Recomenda-se migração para tipo `numeric(15, 2)` ou inteiros representando cêntimos.
2. **Datas Armazenadas como `text`:**  
   Campos temporais (`created_at`, `updated_at`, `estimated_delivery`, `delivered_at`) estão como string de texto simples em vez de `timestamp with time zone` (`timestamptz`), dificultando filtros por período nativos no SQL.
3. **Ausência de Foreign Keys Formais:**  
   `client_id` na tabela `orders` não possui constraint de chave estrangeira com `clients.id` com política `ON DELETE SET NULL` ou `CASCADE`.
4. **Ausência de Tabela `order_timeline` Dedicada:**  
   Os eventos da linha do tempo estão serializados em `timeline_json`, impossibilitando consultas e relatórios detalhados de histórico de movimentações diretamente via SQL.
5. **Sincronização de Listas Completas (Bulk Overwrite):**  
   O repositório e o servidor frequentemente enviam coleções completas de encomendas em substituição integral em vez de operações atômicas por registro.
6. **Múltiplas Fontes de Verdade:**  
   Existência paralela de `store.json`, `PostgreSQL` e `Firebase Firestore`, gerando risco de divergência de estado em ambientes de alta concorrência.
