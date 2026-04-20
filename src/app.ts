import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { registerExtractRoutes } from './routes/extract.route.js';
import { registerJobRoutes } from './routes/jobs.route.js';
import { registerSessionRoutes } from './routes/sessions.route.js';
import { registerHealthRoutes } from './routes/health.route.js';
import { errorHandler } from './middleware/error-handler.js';
import { createLLMProvider } from './providers/llm.factory.js';

export function buildApp() {
  const app = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    },
  });

  // ── Plugins ─────────────────────────────────────────────────────────────
  app.register(cors, { origin: true });
  app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  // ── Error handler ───────────────────────────────────────────────────────
  app.setErrorHandler(errorHandler);

  // ── LLM Provider ────────────────────────────────────────────────────────
  const llmProvider = createLLMProvider();
  app.log.info(`LLM provider: ${llmProvider.name} (model: ${process.env.LLM_MODEL})`);

  // ── Routes ──────────────────────────────────────────────────────────────
  registerExtractRoutes(app, llmProvider);
  registerJobRoutes(app);
  registerSessionRoutes(app, llmProvider);
  registerHealthRoutes(app);

  return app;
}
