import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { openapi } from './openapi.js';
import { savingsAccountRouter } from './routes/savings-account.js';
import { currentAccountRouter } from './routes/current-account.js';
import { error } from './lib/response.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // upgrade-insecure-requests desactivado para que Swagger UI funcione por HTTP
  app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } }, hsts: false }));
  app.use(cors());
  app.use(morgan(process.env.LOG_FORMAT ?? 'combined'));

  app.get('/health', (_req, res) => res.json({ status: 'UP' }));
  app.get('/openapi.json', (_req, res) => res.json(openapi));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'cuentas-api' }));
  app.get('/', (_req, res) => res.redirect('/docs'));

  app.use('/savings-account/v1', savingsAccountRouter);
  app.use('/current-account/v1', currentAccountRouter);

  app.use((req, res) => error(res, 404, 'NOT_FOUND', `El recurso ${req.method} ${req.path} no existe`));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    error(res, 500, 'INTERNAL_ERROR', 'Error interno del servidor');
  });
  return app;
}
