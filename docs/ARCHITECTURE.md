# Arquitetura Atual do Sistema - DELFILÂNDIA

> **Nota:** Este documento descreve a arquitetura **REAL e ATUAL** do sistema na Etapa 1. Ele documenta o estado de coexistência de camadas antes da simplificação planejada para as próximas etapas.

---

## 1. Visão Geral da Arquitetura

O sistema DELFILÂNDIA é uma plataforma de gestão e rastreamento de encomendas para Angola (AKZ). A arquitetura atual é híbrida e distribuída entre frontend SPA em React, servidor monolítico Express, armazenamento em arquivo JSON, persistência relacional em PostgreSQL com Drizzle ORM, sincronização com Firebase Firestore e cache em LocalStorage do navegador.

### Diagrama Textual do Fluxo de Dados Atual

```text
+-------------------------------------------------------------------------+
|                              FRONTEND (SPA)                             |
|                                                                         |
|  [ React State ] <---------> [ LocalStorage Cache ]                     |
|         |                           |                                   |
|         | (Direct SDK Listeners)    |                                   |
|         v                           |                                   |
|   [ Firebase Firestore ]            | (HTTP /api/*)                     |
|                                     v                                   |
+-------------------------------------+-----------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------+
|                           BACKEND (Express Monolith)                    |
|                                  server.ts                              |
|                                     |                                   |
|       +-----------------------------+-----------------------------+     |
|       |                             |                             |     |
|       v                             v                             v     |
| [ In-Memory Cache ]         [ data/store.json ]            [ PostgreSQL ]|
|  (orders/clients/etc.)       (JSON file store)             (Drizzle ORM) |
|                                                                         |
+-------------------------------------------------------------------------+
```

---

## 2. Componentes e Tecnologias

### 2.1. Frontend
- **Framework & Build:** React 18+ com TypeScript, empacotado pelo Vite.
- **Estilização:** Tailwind CSS com classes utilitárias e paleta escura (slate/blue/amber).
- **Ícones & UI:** `lucide-react`, animações com `motion/react` e componentes modais nativos.
- **Visualização & Gráficos:** Lucide icons, Recharts e D3.js.
- **Impressão e PDF:** Renderização dinâmica em iframe isolado com folhas de estilo para A4, recibos térmicos de 80mm e etiquetas de envio (`src/utils/printPdf.ts`).
- **QR Code:** Biblioteca `qrcode` para geração de imagens PNG/SVG incorporadas nos comprovativos e no modal de partilha rápida.
- **WhatsApp Integration:** Geração parametrizada de URLs `https://wa.me/...` com modelos de mensagens formais e formatadas com dados dinâmicos da encomenda (`src/utils/whatsapp.ts`).

### 2.2. Backend
- **Servidor:** Node.js com Express (`server.ts`), atuando tanto como servidor de API RESTful quanto como proxy/servidor de arquivos estáticos gerados pelo Vite em produção.
- **Compressão & Parsers:** `compression` (Gzip/Deflate) e `express.json({ limit: '50mb' })`.

### 2.3. Camadas de Persistência e Coexistência
Atualmente existem **três mecanismos de persistência ativos simultaneamente**:
1. **`data/store.json`**: Arquivo local persistido em disco pelo Express com escrita atômica (`fs.writeFileSync`).
2. **PostgreSQL via Drizzle ORM**: Conexão configurada em `src/db/index.ts` e repositório `src/db/repository.ts`.
3. **Firebase Firestore**: Inicializado no cliente (`src/lib/firebase.ts`) com listeners em tempo real em `src/App.tsx`.
4. **LocalStorage**: Persistência no navegador de pedidos (`delfilandia_orders`), clientes, sessões e configurações da empresa.

---

## 3. Fluxos Operacionais Existentes

### 3.1. Rastreamento Público de Encomendas
- Rota no frontend: `/#/track/:code` (ex: `/#/track/AO-123456`).
- O componente `src/components/PublicTracking.tsx` executa verificação de zero-latência no cache local em memória e, em paralelo, consulta o endpoint `GET /api/track/:code`.
- Não exige login nem permissões especiais.

### 3.2. Autenticação Administrativa e Sessão
- Autenticação baseada em PIN/Senha mestre definida em `src/utils/security.ts` com hash SHA-256 e código de recuperação.
- Sessão do operador mantida em `localStorage` e token de autorização básico transmitido no header HTTP.

### 3.3. Geração de Links e Comprovativos
- **Link de rastreio:** Formato canônico `[URL_BASE]/#/track/[CODIGO]`.
- **Recibos do Cliente & Etiquetas:** Gerados via manipulação de DOM/HTML formatado e impressos via janela/iframe de impressão com auto-trigger `window.print()`.

---

## 4. Responsabilidades Identificadas no `src/App.tsx` (Para Refatoração na Etapa 7)

O arquivo `src/App.tsx` contém atualmente ~1.150 linhas e acumula múltiplas responsabilidades que deverão ser decompostas:
1. **Roteamento e Visualização:** Alternância de abas (`orders`, `clients`, `reports`, `whatsapp`, `settings`, `tracking`).
2. **Gerenciamento de Estado Global:** Listas de encomendas, clientes, estatísticas financeiras e dados da empresa.
3. **Sincronização Tripla:** Coordenação entre Firebase Firestore, API Express e LocalStorage.
4. **Autenticação e Modais de Segurança:** Controle do `PinModal`, `InitialSetupModal` e `ChangePasswordModal`.
5. **Modais Operacionais:** Controle de abertura/fechamento de 10+ modais (`NewOrderModal`, `OrderDetailsModal`, `ClientReceiptModal`, `ShippingLabelModal`, etc.).
6. **Central de WhatsApp:** Estado de filtros e gatilhos de envio de mensagens.
7. **Motor de Backup & Exportação:** Importação e exportação de JSON e relatórios.

---

## 5. Responsabilidades Identificadas no `server.ts` (Para Refatoração na Etapa 4)

O arquivo `server.ts` contém atualmente ~647 linhas e acumula:
1. **Configuração do Servidor Express:** CORS, compressão, body-parser e Vite middleware.
2. **Gerenciamento do Store em Arquivo:** Leitura, gravação atômica e cache em memória de `data/store.json`.
3. **Ponte de Sincronização com PostgreSQL:** Chamadas condicionais para `src/db/repository.ts`.
4. **Autenticação e Sessão:** Endpoints `/api/auth/login`, `/api/auth/verify`, `/api/auth/change-pin`.
5. **Endpoints CRUD de Domínio:** Operações de encomendas, clientes, logs e configurações da empresa.
6. **Auditoria e Logs:** Persistência de logs de auditoria no store e no PostgreSQL.
7. **Serviço de Rastreio:** Endpoint `/api/track/:code` com busca multi-camada.
8. **Fallback SPA:** Tratamento de rotas e entrega do `index.html`.

---

## 6. Mapeamento de Inconsistências de Tipos (TypeScript)

Identificadas as seguintes inconsistências em `src/types.ts` e repositórios para padronização futura:
- **Custos / Despesas Adicionais:** Uso misto de `otherCosts` vs `additionalExpenses` entre interfaces antigas e novas do formulário financeiro.
- **Estrutura de Itens da Encomenda:** Presença de campos como `quantity`, `price`, `description` em formato de objeto vs array serializado em JSON string em certas chamadas de repositório.
- **Campos de Pagamento:** Variação entre `paidAmount` e `paymentAmount`, e status `Pendente`, `Parcial`, `Pago` vs `pending`, `partial`, `paid`.
- **Campos de Rastreamento:** Variação na tipagem da linha do tempo (`TimelineEvent` vs histórico embutido na `Order`).
