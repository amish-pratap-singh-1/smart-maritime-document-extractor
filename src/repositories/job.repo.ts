import { prisma } from '../config/database.js';

export const jobRepo = {
  async create(input: { sessionId: string }) {
    return prisma.job.create({
      data: {
        sessionId: input.sessionId,
        status: 'QUEUED',
      },
    });
  },

  async findById(id: string) {
    return prisma.job.findUnique({
      where: { id },
      include: { extraction: true },
    });
  },

  async markProcessing(jobId: string) {
    return prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'PROCESSING',
        startedAt: new Date(),
      },
    });
  },

  async markComplete(jobId: string, extractionId: string) {
    return prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETE',
        extractionId,
        completedAt: new Date(),
      },
    });
  },

  async markFailed(jobId: string, errorCode: string, errorMessage: string, retryable: boolean, extractionId?: string) {
    return prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        errorCode,
        errorMessage,
        retryable,
        extractionId: extractionId ?? null,
        completedAt: new Date(),
      },
    });
  },

  async countQueuedBefore(jobId: string): Promise<number> {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return 0;

    return prisma.job.count({
      where: {
        status: 'QUEUED',
        queuedAt: { lt: job.queuedAt },
      },
    });
  },

  async findPendingBySessionId(sessionId: string) {
    return prisma.job.findMany({
      where: {
        sessionId,
        status: { in: ['QUEUED', 'PROCESSING'] },
      },
      orderBy: { queuedAt: 'asc' },
    });
  },

  /**
   * Find orphaned jobs that were PROCESSING when the server crashed.
   * Mark them as FAILED with retryable: true.
   */
  async recoverOrphanedJobs(): Promise<number> {
    const result = await prisma.job.updateMany({
      where: { status: 'PROCESSING' },
      data: {
        status: 'FAILED',
        errorCode: 'SERVER_RESTART',
        errorMessage: 'Job was interrupted by server restart. Retryable.',
        retryable: true,
        completedAt: new Date(),
      },
    });
    return result.count;
  },
};
