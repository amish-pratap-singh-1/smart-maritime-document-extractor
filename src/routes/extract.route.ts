import type { FastifyInstance } from 'fastify';
import { ExtractionService } from '../services/extraction.service.js';
import { jobRepo } from '../repositories/job.repo.js';
import { extractionQueue } from '../queue/extraction.queue.js';
import { rateLimitMiddleware } from '../middleware/rate-limiter.js';
import { AppError } from '../types/schemas.js';
import type { LLMProvider } from '../providers/llm.interface.js';

const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function registerExtractRoutes(app: FastifyInstance, llmProvider: LLMProvider): void {
  const extractionService = new ExtractionService(llmProvider);

  app.post('/api/extract', {
    preHandler: rateLimitMiddleware,
    handler: async (request, reply) => {
      const mode = (request.query as { mode?: string }).mode ?? 'sync';

      // Parse multipart
      const data = await request.file();
      if (!data) {
        throw new AppError(400, 'UNSUPPORTED_FORMAT', 'No file uploaded. Send a document field.');
      }

      const fileName = data.filename;
      const mimeType = data.mimetype;

      // Validate MIME type
      if (!ACCEPTED_MIME_TYPES.includes(mimeType)) {
        throw new AppError(
          400,
          'UNSUPPORTED_FORMAT',
          `File type ${mimeType} is not accepted. Accepted: ${ACCEPTED_MIME_TYPES.join(', ')}`,
        );
      }

      // Read file buffer
      const chunks: Buffer[] = [];
      let totalSize = 0;

      for await (const chunk of data.file) {
        totalSize += chunk.length;
        if (totalSize > MAX_FILE_SIZE) {
          throw new AppError(413, 'FILE_TOO_LARGE', 'File exceeds the maximum allowed size of 10MB.');
        }
        chunks.push(chunk);
      }

      const fileBuffer = Buffer.concat(chunks);

      // Get or create session
      const sessionId = await extractionService.ensureSession(
        (data.fields as Record<string, { value?: string }>)?.sessionId?.value || undefined,
      );

      if (mode === 'async') {
        // ── ASYNC MODE ──────────────────────────────────────────────
        // Create a job record in the database
        const job = await jobRepo.create({ sessionId });

        // Enqueue the job in BullMQ
        await extractionQueue.add(
          `extract-${job.id}`,
          {
            jobId: job.id,
            sessionId,
            fileName,
            fileBase64: fileBuffer.toString('base64'),
            mimeType,
          },
        );

        reply.status(202).send({
          jobId: job.id,
          sessionId,
          status: 'QUEUED',
          pollUrl: `/api/jobs/${job.id}`,
          estimatedWaitMs: 6000,
        });
      } else {
        // ── SYNC MODE ───────────────────────────────────────────────
        const { extraction, deduplicated } = await extractionService.processDocument({
          sessionId,
          fileName,
          fileBuffer,
          mimeType,
        });

        if (deduplicated) {
          reply.header('X-Deduplicated', 'true');
        }

        reply.status(200).send({
          id: extraction.id,
          sessionId: extraction.sessionId,
          fileName: extraction.fileName,
          documentType: extraction.documentType,
          documentName: extraction.documentName,
          applicableRole: extraction.applicableRole,
          category: extraction.category,
          confidence: extraction.confidence,
          holderName: extraction.holderName,
          dateOfBirth: extraction.dateOfBirth,
          sirbNumber: extraction.sirbNumber,
          passportNumber: extraction.passportNumber,
          fields: extraction.fields,
          validity: extraction.validity,
          compliance: extraction.compliance,
          medicalData: extraction.medicalData,
          flags: extraction.flags,
          isExpired: extraction.isExpired,
          processingTimeMs: extraction.processingTimeMs,
          summary: extraction.summary,
          createdAt: extraction.createdAt,
        });
      }
    },
  });
}
