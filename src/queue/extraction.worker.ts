import { Worker, type Job } from 'bullmq';
import { EXTRACTION_QUEUE_NAME, type ExtractionJobData } from './extraction.queue.js';
import { createRedisConnection } from '../config/redis.js';
import { ExtractionService } from '../services/extraction.service.js';
import { jobRepo } from '../repositories/job.repo.js';
import { createLLMProvider } from '../providers/llm.factory.js';
import { AppError } from '../types/schemas.js';
import { env } from '../config/env.js';

let worker: Worker<ExtractionJobData> | null = null;

export function startExtractionWorker(): Worker<ExtractionJobData> {
  const llmProvider = createLLMProvider();
  const extractionService = new ExtractionService(llmProvider);

  worker = new Worker<ExtractionJobData>(
    EXTRACTION_QUEUE_NAME,
    async (job: Job<ExtractionJobData>) => {
      const { jobId, sessionId, fileName, fileBase64, mimeType } = job.data;

      // Mark job as PROCESSING
      await jobRepo.markProcessing(jobId);

      try {
        const fileBuffer = Buffer.from(fileBase64, 'base64');

        const { extraction } = await extractionService.processDocument({
          sessionId,
          fileName,
          fileBuffer,
          mimeType,
        });

        // Mark job as COMPLETE
        await jobRepo.markComplete(jobId, extraction.id);

        return { extractionId: extraction.id };
      } catch (error) {
        const isAppError = error instanceof AppError;
        const errorCode = isAppError ? error.errorCode : 'INTERNAL_ERROR';
        const errorMessage = isAppError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Unknown error';

        const retryable = isAppError
          ? error.errorCode === 'LLM_TIMEOUT'
          : false;

        const extractionId = isAppError ? error.extractionId : undefined;

        await jobRepo.markFailed(jobId, errorCode, errorMessage, retryable, extractionId);

        // Don't throw — we've handled the error by updating the job record
        // BullMQ would retry if we threw, but we manage retries ourselves
        return undefined;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: env.QUEUE_CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed unexpectedly:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err.message);
  });

  console.log(`[Worker] Extraction worker started (concurrency: ${env.QUEUE_CONCURRENCY})`);

  return worker;
}

export async function stopExtractionWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('[Worker] Extraction worker stopped');
  }
}
