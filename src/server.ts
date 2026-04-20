import { buildApp } from './app.js';
import { env } from './config/env.js';
import { startExtractionWorker, stopExtractionWorker } from './queue/extraction.worker.js';
import { jobRepo } from './repositories/job.repo.js';
import { prisma } from './config/database.js';
import { redis } from './config/redis.js';

async function main() {
  const app = buildApp();

  // ── Recover orphaned jobs from previous crashes ───────────────────────
  const orphanedCount = await jobRepo.recoverOrphanedJobs();
  if (orphanedCount > 0) {
    app.log.warn(`Recovered ${orphanedCount} orphaned job(s) from previous run`);
  }

  // ── Start the BullMQ worker ────────────────────────────────────────────
  startExtractionWorker();

  // ── Start the server ───────────────────────────────────────────────────
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`🚀 SMDE server listening on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // ── Graceful shutdown ──────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    app.log.info(`${signal} received — shutting down gracefully...`);

    await stopExtractionWorker();
    await app.close();
    await prisma.$disconnect();
    redis.disconnect();

    app.log.info('Server shut down successfully');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
