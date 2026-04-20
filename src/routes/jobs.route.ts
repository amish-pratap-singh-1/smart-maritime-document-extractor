import type { FastifyInstance } from 'fastify';
import { jobRepo } from '../repositories/job.repo.js';
import { AppError } from '../types/schemas.js';

export function registerJobRoutes(app: FastifyInstance): void {
  app.get('/api/jobs/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };

    const job = await jobRepo.findById(jobId);
    if (!job) {
      throw new AppError(404, 'JOB_NOT_FOUND', `Job ${jobId} does not exist`);
    }

    if (job.status === 'QUEUED') {
      const queuePosition = await jobRepo.countQueuedBefore(jobId);
      reply.send({
        jobId: job.id,
        status: 'QUEUED',
        queuePosition,
        queuedAt: job.queuedAt,
        estimatedCompleteMs: (queuePosition + 1) * 5000,
      });
      return;
    }

    if (job.status === 'PROCESSING') {
      reply.send({
        jobId: job.id,
        status: 'PROCESSING',
        queuePosition: 0,
        startedAt: job.startedAt,
        estimatedCompleteMs: 3200,
      });
      return;
    }

    if (job.status === 'COMPLETE') {
      reply.send({
        jobId: job.id,
        status: 'COMPLETE',
        extractionId: job.extractionId,
        result: job.extraction
          ? {
              id: job.extraction.id,
              sessionId: job.extraction.sessionId,
              fileName: job.extraction.fileName,
              documentType: job.extraction.documentType,
              documentName: job.extraction.documentName,
              applicableRole: job.extraction.applicableRole,
              category: job.extraction.category,
              confidence: job.extraction.confidence,
              holderName: job.extraction.holderName,
              dateOfBirth: job.extraction.dateOfBirth,
              sirbNumber: job.extraction.sirbNumber,
              passportNumber: job.extraction.passportNumber,
              fields: job.extraction.fields,
              validity: job.extraction.validity,
              compliance: job.extraction.compliance,
              medicalData: job.extraction.medicalData,
              flags: job.extraction.flags,
              isExpired: job.extraction.isExpired,
              processingTimeMs: job.extraction.processingTimeMs,
              summary: job.extraction.summary,
              createdAt: job.extraction.createdAt,
            }
          : null,
        completedAt: job.completedAt,
      });
      return;
    }

    // FAILED
    reply.send({
      jobId: job.id,
      status: 'FAILED',
      error: job.errorCode,
      message: job.errorMessage,
      failedAt: job.completedAt,
      retryable: job.retryable,
    });
  });
}
