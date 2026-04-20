import type { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import { env } from '../config/env.js';

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get('/api/health', async (_request, reply) => {
    const startTime = process.uptime();

    // Check database
    let dbStatus = 'OK';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'ERROR';
    }

    // Check Redis
    let redisStatus = 'OK';
    try {
      await redis.ping();
    } catch {
      redisStatus = 'ERROR';
    }

    // Check LLM provider (just check if configured, not actual connection)
    const llmStatus = env.LLM_PROVIDER && env.LLM_MODEL ? 'OK' : 'NOT_CONFIGURED';

    const overallStatus = dbStatus === 'OK' && redisStatus === 'OK' ? 'OK' : 'DEGRADED';

    reply.send({
      status: overallStatus,
      version: '1.0.0',
      uptime: Math.floor(startTime),
      dependencies: {
        database: dbStatus,
        llmProvider: llmStatus,
        queue: redisStatus,
      },
      timestamp: new Date().toISOString(),
    });
  });
}
