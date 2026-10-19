/**
 * ============================================================================
 * DELFILÂNDIA - SERVER APPLICATION ENTRY (MODULAR SCAFFOLDING)
 * ============================================================================
 * 
 * Este arquivo representa a estrutura base modularizada do Express para as
 * próximas etapas da refatoração (ETAPA 4: Modularização do Backend).
 * 
 * NOTA DE ARQUITETURA (ETAPA 1):
 * O ponto de entrada em execução contínua atualmente é 'server.ts' na raiz.
 * Este scaffold prepara a injeção limpa de rotas, middlewares, controllers,
 * serviços, validadores e repositórios sem quebrar o sistema ativo.
 */

import express, { Express } from 'express';
import compression from 'compression';

export function createExpressApp(): Express {
  const app = express();

  // Middlewares essenciais
  app.use(compression());
  app.use(express.json({ limit: '50mb' }));

  // Headers de CORS e Segurança
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  return app;
}

export default createExpressApp;
