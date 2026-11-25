import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { configRouter } from './routes/config.routes.js';
import { cronRouter } from './routes/cron.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { ocrRouter } from './routes/ocr.routes.js';
import { pantryRouter } from './routes/pantry.routes.js';
import { webhooksRouter } from './routes/webhooks.routes.js';

export function createApp() {
  const app = express();

  const allowedOrigins = env.FRONTEND_URL.split(',').map((o) => o.trim());

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || env.NODE_ENV === 'development') {
          callback(null, true);
          return;
        }
        callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
      },
    })
  );

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  app.get('/', (_req, res) => {
    res.json({
      name: 'Smart Pantry Assistant MVP API',
      version: '1.0.0',
      docs: '/api/health',
    });
  });

  app.use('/api', healthRouter);
  app.use('/api', configRouter);
  app.use('/api', pantryRouter);
  app.use('/api', ocrRouter);
  app.use('/api', cronRouter);
  app.use('/api', webhooksRouter);

  // Tratamento centralizado de erros
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: 'Payload inválido.',
        issues: err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }

    const message = err instanceof Error ? err.message : 'Erro interno do servidor.';
    console.error('[API Error]', err);
    res.status(500).json({ error: message });
  });

  return app;
}
