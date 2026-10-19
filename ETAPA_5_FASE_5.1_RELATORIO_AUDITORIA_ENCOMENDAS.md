# ETAPA 5 — FASE 5.1: RELATÓRIO DE AUDITORIA DO SISTEMA DE ENCOMENDAS, TIMELINE E PAGAMENTOS
## DELFILÂNDIA — Gestão de Encomendas & Logística Local (Angola)

**Data da Auditoria:** 25 de Agosto de 2026  
**Responsável Técnico:** Engenheiro Responsável / Arquiteto de Software Sénior & SRE  
**Ambiente:** Google Cloud Run (Produção Contínua)  
**Banco de Dados:** Google Cloud SQL (PostgreSQL 16) — *Única Fonte Autoritativa de Verdade*  
**Status da Auditoria:** CONCLUÍDA E APROVADA COM RIGOR TÉCNICO TOTAL

---

## 1. RESUMO EXECUTIVO E ESCOPO DA AUDITORIA

O presente relatório consolida a auditoria não-destrutiva, profunda e sistemática realizada sobre o núcleo de negócio do sistema **DELFILÂNDIA**, contemplando o ciclo completo de encomendas, transições de estado, processamento financeiro e de pagamentos, geração e renderização de timeline, auditoria e rastreabilidade operacional, integridade referencial com clientes e segurança e higienização no rastreio público.

### 1.1. Princípios Absolutos de Não-Destrutividade Respeitados
1. **Preservação de Dados Reais:** A encomenda real homologada `AO-451023` (Cliente: *Aldemiro Samba*, Luanda, 25.000,00 Kz) foi mantida 100% íntegra e inalterada.
2. **Imutabilidade Estrutural:** Nenhum schema DDL ou migration foi alterado nesta fase.
3. **Zero Poluição:** Nenhum registro fictício ou de teste foi inserido no banco de produção.
4. **Proteção ao Tracking Público:** O endpoint de higienização de rastreio (`/api/track/:code` e `sanitizeOrderForPublic`) manteve 100% de blindagem contra vazamento de margens e custos internos.

---

## 2. MAPEAMENTO ARQUITETURAL INTEGRADO

A arquitetura do sistema DELFILÂNDIA opera em um fluxo estritamente unidirecional e autoritativo:

```
+---------------------------------------------------------------------------------------------------+
|                                  CAMADA DE APRESENTAÇÃO (FRONTEND)                                 |
|  - React 18 + Vite (SPA)                                                                           |
|  - Componentes: OrdersTable, OrderForm, PublicTracking, FinanceSummary, ClientManagement           |
|  - Gestão de Estado: React State + Hooks, com cache de sessão volátil                              |
+---------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼ (Chamadas HTTP REST com Cookie HTTP-Only / Session)
+---------------------------------------------------------------------------------------------------+
|                                     CAMADA DE SERVIÇO (EXPRESS)                                   |
|  - /server.ts (Node.js ESM + Express)                                                             |
|  - Middlewares: requireAuth, requireAdmin, compression, json(50mb), CORS com credentials          |
|  - Rotas Administrativas: POST /api/orders/new, PUT /api/orders/:id, DELETE /api/orders/:id       |
|  - Rotas Públicas: GET /api/track/:code, GET /api/health                                          |
|  - Cache em Memória: memoryCache (Derivado estritamente do PostgreSQL Cloud SQL)                  |
+---------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼ (Operações Drizzle ORM + Transações ACID)
+---------------------------------------------------------------------------------------------------+
|                                CAMADA DE DADOS E PERSISTÊNCIA (REPOSITORY)                        |
|  - /src/db/repository.ts & /src/db/schema.ts                                                      |
|  - Drizzle ORM sobre Driver pg.Pool com Circuit Breaker e tratamento de códigos PostgreSQL        |
|  - Funções: saveDbOrder, getDbOrders, getDbOrderByCode, deleteDbOrder, createDbAuditLog           |
+---------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼ (Conexão TCP / UNIX Socket Cloud SQL)
+---------------------------------------------------------------------------------------------------+
|                            FONTE AUTORITATIVA DE VERDADE (POSTGRESQL 16)                          |
|  - Cloud SQL com restrições CHECK, Foreign Keys, Unique Indexes, NOT NULL                         |
|  - Tabelas: orders, clients, app_settings, audit_logs                                              |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. CICLO DE VIDA DA ENCOMENDA E MÁQUINA DE ESTADOS

### 3.1. Definição de Estados (`OrderStatus`)
O sistema define 7 estados no tipo unificado `OrderStatus` (`/src/types.ts`):

| Estado (`OrderStatus`) | Natureza | Step do Cliente | Descrição Operacional |
| :--- | :--- | :---: | :--- |
| `AGUARDANDO_PAGAMENTO` | Linear Inicial | 1 | Encomenda criada; aguarda comprovativo ou sinal do cliente. |
| `PAGAMENTO_CONFIRMADO` | Linear | 2 | Pagamento total ou parcial validado pela administração. |
| `PRODUTO_COMPRADO` | Linear | 3 | Artigo adquirido no fornecedor local em Luanda/Angola. |
| `SAIU_PARA_ENTREGA` | Linear | 4 | Estafeta despachado com o produto para o destinatário. |
| `ENTREGUE` | Linear Final | 5 | Encomenda entregue ao cliente e recebimento concluído. |
| `PROBLEMA` | Excepcional | 6 (Alerta) | Ocorrência operacional (ex: endereço incorreto, cliente ausente). |
| `CANCELADA` | Excepcional Terminal | 6 (Cancel) | Encomenda cancelada formalmente pela vendedora. |

### 3.2. Transições de Estado e Validações
1. **Fluxo Linear Padrão:**  
   `AGUARDANDO_PAGAMENTO` ➔ `PAGAMENTO_CONFIRMADO` ➔ `PRODUTO_COMPRADO` ➔ `SAIU_PARA_ENTREGA` ➔ `ENTREGUE`.
2. **Transições Excepcionais:**  
   Qualquer estado pode transicionar para `PROBLEMA` ou `CANCELADA` mediante intervenção administrativa.
3. **Consistência do Stepper Público:**  
   No componente `PublicTracking.tsx`, a função `getCustomerStatusFlow(status)` projeta os 5 passos lineares base de forma contínua e, caso a encomenda esteja em `PROBLEMA` ou `CANCELADA`, adiciona um 6º passo dinâmico correspondente, mantendo clareza para o comprador sem distorcer o histórico visual.

---

## 4. SISTEMA DE PAGAMENTOS E INTEGRIDADE FINANCEIRA

### 4.1. Estrutura de Campos Financeiros em `orders`
A tabela `orders` no PostgreSQL possui os seguintes campos numéricos e categóricos com restrições `CHECK`:

| Campo | Tipo PostgreSQL | Validação / Constraint | Significado de Negócio |
| :--- | :--- | :--- | :--- |
| `resale_price` | `NUMERIC(12,2)` | `CHECK >= 0` | Valor total de venda ao cliente (Kz) |
| `amount_paid` | `NUMERIC(12,2)` | `CHECK >= 0` | Montante já pago / liquidado pelo cliente (Kz) |
| `amount_pending` | `NUMERIC(12,2)` | `CHECK >= 0` | Saldo devedor pendente (`resale_price - amount_paid`) |
| `payment_status` | `VARCHAR(32)` | `'PENDENTE'`, `'PARCIAL'`, `'CONFIRMADO'`, `'REEMBOLSADO'` | Situação da liquidação |
| `payment_method` | `VARCHAR(32)` | `'TRANSFERENCIA'`, `'EXPRESS'`, `'TPA'`, `'DINHEIRO'`, `'OUTRO'` | Meio de pagamento |
| `purchase_cost` | `NUMERIC(12,2)` | `CHECK >= 0` | Custo de aquisição do produto no fornecedor local (Kz) |
| `delivery_cost` | `NUMERIC(12,2)` | `CHECK >= 0` | Custo de frete / estafeta local (Kz) |
| `other_costs` | `NUMERIC(12,2)` | `CHECK >= 0` | Custos adicionais / embalagem / taxas (Kz) |
| `gross_profit` | `NUMERIC(12,2)` | Calculado | Lucro Bruto (`resale_price - purchase_cost`) |
| `net_profit` | `NUMERIC(12,2)` | Calculado | Lucro Líquido Real (`resale_price - purchase_cost - delivery_cost - other_costs`) |

### 4.2. Auditoria das Fórmulas de Cálculo
- **Saldo Pendente:** $\text{amount\_pending} = \max(0, \text{resale\_price} - \text{amount\_paid})$
- **Lucro Bruto:** $\text{gross\_profit} = \text{resale\_price} - \text{purchase\_cost}$
- **Lucro Líquido:** $\text{net\_profit} = \text{resale\_price} - (\text{purchase\_cost} + \text{delivery\_cost} + \text{other\_costs})$
- **Sincronismo de Payment Status:**  
  - Se $\text{amount\_paid} == 0 \implies \text{payment\_status} = \text{'PENDENTE'}$
  - Se $0 < \text{amount\_paid} < \text{resale\_price} \implies \text{payment\_status} = \text{'PARCIAL'}$
  - Se $\text{amount\_paid} \ge \text{resale\_price} \implies \text{payment\_status} = \text{'CONFIRMADO'}$

---

## 5. TIMELINE E HISTÓRICO DA ENCOMENDA

### 5.1. Mecanismo de Timeline (`buildDefaultTimeline`)
No repositório `/src/db/repository.ts` (linhas 100-143):
- A timeline é construída com base nos 5 marcos do ciclo de vida:
  1. `AGUARDANDO_PAGAMENTO`: "Encomenda Registada" (marcado como `isCompleted: true`)
  2. `PAGAMENTO_CONFIRMADO`: "Pagamento" (`isCompleted: status !== 'AGUARDANDO_PAGAMENTO'`)
  3. `PRODUTO_COMPRADO`: "Compra Local Concluída" (`isCompleted: status in ['PRODUTO_COMPRADO', 'SAIU_PARA_ENTREGA', 'ENTREGUE']`)
  4. `SAIU_PARA_ENTREGA`: "Saiu para Entrega" (`isCompleted: status in ['SAIU_PARA_ENTREGA', 'ENTREGUE']`)
  5. `ENTREGUE`: "Entregue com Sucesso" (`isCompleted: status === 'ENTREGUE'`)

### 5.2. Projeção Segura para o Cliente
A função `sanitizeOrderForPublic` em `/src/utils/security.ts` higieniza a timeline:
- Remove quaisquer notas internas privadas ou dados de fornecedores.
- Normaliza os títulos dos eventos (`normalizeEventTitle`).
- Mantém apenas timestamps, títulos amigáveis e `publicNote` (caso preenchido pela vendedora).

---

## 6. AUDITORIA OPERACIONAL E REGISTROS DE SEGURANÇA (`audit_logs`)

### 6.1. Schema e Persistência de Logs
A tabela `audit_logs` no PostgreSQL armazena:
- `log_id` (`VARCHAR(64)` UNIQUE): Identificador único de log.
- `order_code` (`VARCHAR(32)`): Código da encomenda associada ou `'SISTEMA'`.
- `user` (`VARCHAR(100)`): Nome do usuário ou subsistema que executou a ação.
- `action` (`VARCHAR(100)`): Ação realizada (ex: `'Criação de encomenda'`, `'Alteração de estado'`, `'Login de Administrador'`).
- `details` (`TEXT`): Detalhes completos da alteração.
- `timestamp` (`TIMESTAMPTZ`): Data e hora com fuso horário.

### 6.2. Garantia Transacional
No endpoint `PUT /api/orders/:id` e na função `saveDbOrder`, a atualização da encomenda e a gravação do log de auditoria são executadas dentro de uma **transação atômica (`db.transaction`)**. Se a gravação da encomenda falhar, o log não é persistido, e vice-versa, garantindo que o histórico seja 100% confiável.

---

## 7. RELACIONAMENTO ENCOMENDA ➔ CLIENTE

### 7.1. Integridade Referencial no Schema
- Campo: `orders.client_id` (`VARCHAR(64)`) com chave estrangeira para `clients.client_id`.
- Regra de Deleção: `onDelete: 'set null'`, garantindo que, se um cadastro de cliente for ajustado, as encomendas históricas não sejam corrompidas ou apagadas em cascata.
- Índices: `index('orders_client_id_idx')` e `index('clients_client_id_idx')` criados no PostgreSQL para otimização de consultas de histórico por cliente.

### 7.2. Consistência de Totais do Cliente
Na tabela `clients`:
- `total_spent` (`NUMERIC(12,2)` com `CHECK >= 0`): Acumulado de compras do cliente.
- `order_count` (`INTEGER` com `CHECK >= 0`): Total de encomendas realizadas.

---

## 8. IMPACTO E SEGURANÇA NO TRACKING PÚBLICO

### 8.1. Higienização Rigorosa (`sanitizeOrderForPublic`)
A sanitização garante que dados estratégicos jamais saiam do backend:

| Dado da Encomenda | Visível no Painel Admin | Exposto no Tracking Público | Mecanismo de Proteção |
| :--- | :---: | :---: | :--- |
| Código de Rastreio (`code`) | Sim | Sim | Exibição necessária para busca |
| Nome do Cliente | Sim (Completo) | Sim (Apenas 1º Nome / `Cliente: Maria`) | `nameParts[0]` |
| Telefone do Cliente | Sim | **NÃO** (Omitido) | Omitido em `PublicOrderView` |
| Endereço Completo / Casa | Sim | **NÃO** (Omitido) | Apenas Província e Município |
| Nome do Produto | Sim | Sim | Exibido |
| Fotos do Produto | Sim | Sim | Array `productImageUrls` higienizado |
| Preço de Custo (`purchaseCost`) | Sim | **NUNCA** | Campo excluído da interface pública |
| Local de Compra (`purchaseLocation`) | Sim | **NUNCA** | Campo excluído da interface pública |
| Custos de Frete (`deliveryCost`) | Sim | **NUNCA** | Campo excluído da interface pública |
| Outros Custos (`otherCosts`) | Sim | **NUNCA** | Campo excluído da interface pública |
| Lucro Bruto (`grossProfit`) | Sim | **NUNCA** | Campo excluído da interface pública |
| Lucro Líquido (`netProfit`) | Sim | **NUNCA** | Campo excluído da interface pública |
| Notas Administrativas Internas | Sim | **NUNCA** | Campo excluído da interface pública |
| Preço de Venda / Sinal | Sim | Opcional (Configurável) | Controlado por `showSalesPriceToClient` |

### 8.2. Resolução Flexível de Códigos de Rastreio
A função `matchOrderCode` e a busca SQL em `getDbOrderByCode` suportam variações comuns digitadas por clientes angolanos:
1. Formato oficial: `AO-451023`
2. Sem hífen: `AO451023` ou `ao451023`
3. Troca de letra "O" por dígito zero: `A0-451023` ou `A0451023`
4. Apenas dígitos: `451023`
5. Com cardinal: `#AO-451023`

---

## 9. AUDITORIA DO REGISTRO REAL DE PRODUÇÃO (AO-451023)

A consulta ao Cloud SQL confirmou os dados da encomenda homologada:

```sql
SELECT code, client_name, client_phone, client_province, client_address,
       product_name, quantity, resale_price, amount_paid, amount_pending,
       payment_status, payment_method, status, purchase_cost, delivery_cost,
       gross_profit, net_profit
FROM orders WHERE code = 'AO-451023';
```

### 9.1. Valores Auditados
- **Código:** `AO-451023`
- **Cliente:** *Aldemiro Samba* (`cli-1787390756586`)
- **Telefone:** `935133346` (Luanda, Petrangol)
- **Artigo:** Conjunto de colha e fronhas de cor vermelha (Qtd: 1)
- **Preço de Venda:** 25.000,00 Kz
- **Valor Pago:** 25.000,00 Kz
- **Valor Pendente:** 0,00 Kz
- **Estado de Pagamento:** `CONFIRMADO` (Método: `TRANSFERENCIA`)
- **Estado da Encomenda:** `PRODUTO_COMPRADO`
- **Custo de Aquisição:** 18.000,00 Kz
- **Custo de Entrega:** 2.500,00 Kz
- **Outros Custos:** 0,00 Kz
- **Lucro Bruto:** 7.000,00 Kz (25.000 - 18.000)
- **Lucro Líquido:** 4.500,00 Kz (25.000 - 18.000 - 2.500)
- **Integridade Matemática:** 100% consistente e verificado.

---

## 10. IDENTIFICAÇÃO DE PONTOS FORTES, OPORTUNIDADES E PARECER

### 10.1. Pontos Fortes Consolidados
- PostgreSQL Cloud SQL atua como fonte autoritativa única e inquestionável.
- Blindagem total contra vazamento de margens comerciais e dados sensíveis de clientes.
- Transações ACID atômicas sincronizadas entre encomendas e logs de auditoria.
- Suporte a múltiplas fotos de produto em formato JSONB estruturado.
- Flexibilidade na resolução de códigos de rastreio para clientes em dispositivos móveis.

### 10.2. Oportunidades Mapeadas para as Próximas Fases da Etapa 5
- **Fase 5.2:** Validação e aprimoramento do fluxo de criação e edição rápida de encomendas com atualização automática do total acumulado do cliente.
- **Fase 5.3:** Refinamento dos templates de mensagens WhatsApp com base no estado atual da encomenda.
- **Fase 5.4:** Relatórios analíticos financeiros consolidados por período e produto.

---

## 11. PARECER FINAL TÉCNICO

A auditoria da **ETAPA 5 — FASE 5.1** foi executada com total sucesso, em conformidade com todas as diretrizes de não-destrutividade e rigor técnico. O sistema de encomendas, timeline e pagamentos do sistema DELFILÂNDIA encontra-se **TOTALMENTE AUDITADO, ÍNTEGRO, CONSISTENTE E APROVADO PARA AVANÇO À FASE 5.2**.
