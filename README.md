# 🛍️ DELFILÂNDIA - Sistema de Gestão e Rastreamento de Encomendas

> **"DELFILÂNDIA - Um mundo de produtos à sua porta"**  
> Sistema completo e profissional de gestão de encomendas, controlo financeiro, fidelização de clientes e portal público de rastreamento em tempo real adaptado para o comércio e revenda em Angola (Kwanza - Kz).

---

## ✨ Principais Funcionalidades

### 🔍 1. Portal Público de Acompanhamento (Para Clientes)
- **Rastreamento Instantâneo:** Consulta rápida pelo código da encomenda (ex: `AO-281026`), telefone do cliente ou nome.
- **Linha do Tempo Visual (Status Flow):**
  1. *Aguardando Pagamento*
  2. *Pagamento Confirmado*
  3. *Produto Comprado*
  4. *Saiu para Entrega*
  5. *Entregue*
- **Galeria de Imagens do Artigo:** Visualização em alta resolução com pré-visualização e zoom.
- **Link Direto e QR Code:** Partilha fácil do link de rastreio para o cliente acompanhar sem necessidade de login ou conta.
- **Botão de Suporte WhatsApp:** Contacto direto com a loja pré-preenchido com o código da encomenda.

### 🛡️ 2. Painel Administrativo (Acesso Restrito)
- **Autenticação Segura por PIN/Senha:** Acesso protegido para administradores/vendedoras com opção de alteração de senha.
- **Registo e Edição Ágil de Encomendas:** Formulário limpo e intuitivo com cálculo automático de valores (Preço de Venda, Sinal Pago, Restante a Pagar e Lucro Líquido).
- **Gestão de Estados:** Atualização rápida do estado da encomenda com gravação imediata na linha do tempo.
- **Central de Notificações WhatsApp:**
  - Geração automática de mensagens personalizadas com base no estado atual da encomenda.
  - Substituição dinâmica de variáveis: `{nome}`, `{artigo}`, `{codigo}`, `{link_rastreio}`, `{status}`, `{valor_total}`, `{valor_pago}`, `{valor_pendente}`, `{local_entrega}`.
  - Envio direto para o WhatsApp Web / App com 1 clique.
- **Impressão e Exportação:**
  - 📄 **Recibo do Cliente (PDF/Impressão)**
  - 📋 **Comprovativo Interno**
  - 🏷️ **Etiqueta de Envio / Estafeta com QR Code**
  - 📊 **Exportação de Dados em CSV / JSON**
- **Relatórios Financeiros e Métricas:**
  - Total Faturado, Lucro Bruto e Líquido, Valores Pendentes a Receber.
  - Filtros por província, estado e período.
- **Gestão de Clientes:** Histórico de compras por cliente, contactos e moradas habituais.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:**
  - [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
  - [Vite 6](https://vitejs.dev/) (Build tool ultra-rápido)
  - [Tailwind CSS 4](https://tailwindcss.com/) (Design moderno, responsivo e adaptado para telemóveis e desktop)
  - [Motion (Framer Motion)](https://motion.dev/) (Transições e animações fluidas)
  - [Lucide React](https://lucide.dev/) (Conjunto de ícones vetoriais)
  - [QRCode](https://github.com/soldair/node-qrcode) & [jsPDF](https://github.com/parallax/jsPDF) (Geração de códigos e documentos)
- **Backend & Servidor:**
  - [Express.js](https://expressjs.com/) (API REST e Proxy de alto desempenho)
  - [Drizzle ORM](https://orm.drizzle.team/) + [pg](https://node-postgres.com/) (Integração com PostgreSQL / Cloud SQL)
  - *Arquitetura Memory-First Cache*: Carregamento das páginas de rastreio em menos de 10ms.

---

## 🚀 Como Executar o Projeto Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) versão 18 ou superior instalado.
- Gerenciador de pacotes `npm` ou `yarn` / `pnpm`.

### 1. Clonar o repositório
```bash
git clone https://github.com/SEU_USUARIO/delfilandia-gestao-encomendas.git
cd delfilandia-gestao-encomendas
```

### 2. Instalar as dependências
```bash
npm install
```

### 3. Configurar as Variáveis de Ambiente
Copie o ficheiro `.env.example` para `.env`:
```bash
cp .env.example .env
```
*(As configurações padrão já funcionam perfeitamente no modo local com armazenamento em cache).*

### 4. Iniciar o servidor de desenvolvimento
```bash
npm run dev
```
O projeto estará disponível em: `http://localhost:3000`

---

## 📦 Como Compilar para Produção

Para gerar os ficheiros otimizados de produção:
```bash
npm run build
```

Para iniciar a aplicação em modo de produção:
```bash
npm run start
```

---

## 🌐 Como Subir o Projeto para o GitHub

Se ainda não inicializou o repositório git na sua máquina, execute os seguintes passos no terminal:

```bash
# 1. Inicializar o repositório Git
git init

# 2. Adicionar todos os ficheiros (o .gitignore protegerá ficheiros sensíveis)
git add .

# 3. Criar o primeiro commit
git commit -m "feat: versão inicial do sistema DELFILÂNDIA pronto para produção"

# 4. Renomear a branch principal para main
git branch -M main

# 5. Associar ao seu repositório no GitHub (substitua pelo URL do seu repositório)
git remote add origin https://github.com/SEU_USUARIO/NOME_DO_REPOSITORIO.git

# 6. Enviar os ficheiros para o GitHub
git push -u origin main
```

---

## 📁 Estrutura de Pastas

```
├── data/                  # Ficheiros locais de backup e cache
├── public/                # Ficheiros estáticos públicos (logos, favicon)
├── src/
│   ├── components/        # Componentes React (Painéis, Modais, Rastreio, etc.)
│   ├── data/              # Dados padrão e estruturas iniciais
│   ├── db/                # Esquemas Drizzle ORM e Repositórios de BD
│   ├── lib/               # Clientes e utilitários de integração (Firebase/DB)
│   ├── utils/             # Formatadores de moeda (Kz), datas, WhatsApp e segurança
│   ├── types.ts           # Definições de tipos TypeScript
│   ├── App.tsx            # Componente principal e orquestrador de rotas
│   └── main.tsx           # Ponto de entrada do React
├── server.ts              # Servidor Express de produção e rotas de API
├── package.json           # Dependências e scripts do projeto
├── tsconfig.json          # Configurações do TypeScript
└── vite.config.ts         # Configurações do Vite
```

---

## 🔒 Segurança e Boas Práticas

- **Sanitização de Dados:** O portal público de clientes nunca expõe custos de compra do fornecedor, lucro da vendedora ou notas internas.
- **Proteção de Credenciais:** As chaves de API e credenciais de base de dados nunca devem ser enviadas no repositório público (já protegidas no `.gitignore`).
- **Backup Duplo:** O sistema mantém persistência segura tanto em PostgreSQL/Cloud SQL como em ficheiro estruturado local com suporte a *fallback* imediato.

---

## 📄 Licença

Este projeto é de uso privado da **DELFILÂNDIA**. Todos os direitos reservados.
