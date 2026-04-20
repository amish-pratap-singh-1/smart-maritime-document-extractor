import type { LLMProvider } from '../providers/llm.interface.js';
import { extractionRepo } from '../repositories/extraction.repo.js';
import { sessionRepo } from '../repositories/session.repo.js';
import { parseAndRepairJSON } from '../utils/json-repair.js';
import { computeFileHash } from '../utils/hash.js';
import { pdfToFirstImage } from '../utils/pdf-to-image.js';
import { EXTRACTION_PROMPT, getLowConfidenceRetryPrompt, getJSONRepairPrompt } from '../utils/prompts.js';
import { LLMExtractionResultSchema, AppError } from '../types/schemas.js';
import type { LLMExtractionResult } from '../types/schemas.js';
import { env } from '../config/env.js';

export class ExtractionService {
  constructor(private llmProvider: LLMProvider) {}

  /**
   * Process a document extraction — the core pipeline.
   * Used by both sync mode and the async queue worker.
   */
  async processDocument(input: {
    sessionId: string;
    fileName: string;
    fileBuffer: Buffer;
    mimeType: string;
  }): Promise<{
    extraction: Awaited<ReturnType<typeof extractionRepo.create>>;
    deduplicated: boolean;
  }> {
    const { sessionId, fileName, fileBuffer, mimeType } = input;
    const fileHash = computeFileHash(fileBuffer);

    // 1. Deduplication check
    const existing = await extractionRepo.findBySessionAndHash(sessionId, fileHash);
    if (existing && existing.status === 'COMPLETE') {
      return { extraction: existing, deduplicated: true };
    }

    // 2. Convert to base64 image for LLM
    let imageBase64: string;
    let imageMimeType: string;

    if (mimeType === 'application/pdf') {
      const imageBuffer = await pdfToFirstImage(fileBuffer);
      imageBase64 = imageBuffer.toString('base64');
      imageMimeType = 'image/png';
    } else {
      imageBase64 = fileBuffer.toString('base64');
      imageMimeType = mimeType;
    }

    const startTime = Date.now();
    let rawLlmResponse = '';

    try {
      // 3. Call LLM
      const llmResponse = await this.llmProvider.extractFromImage({
        imageBase64,
        mimeType: imageMimeType,
        prompt: EXTRACTION_PROMPT,
        timeoutMs: env.LLM_TIMEOUT_MS,
      });

      rawLlmResponse = llmResponse.content;

      // 4. Parse JSON from LLM response
      let parsed = parseAndRepairJSON(rawLlmResponse);

      // 5. If parse fails, send repair prompt
      if (!parsed) {
        const repairResponse = await this.llmProvider.sendTextPrompt({
          prompt: getJSONRepairPrompt(rawLlmResponse),
          timeoutMs: env.LLM_TIMEOUT_MS,
        });
        rawLlmResponse += '\n---REPAIR---\n' + repairResponse.content;
        parsed = parseAndRepairJSON(repairResponse.content);
      }

      if (!parsed) {
        // Total parse failure — store as FAILED
        const processingTimeMs = Date.now() - startTime;
        const failedExtraction = await extractionRepo.createFailed({
          sessionId,
          fileName,
          fileHash,
          rawLlmResponse,
          processingTimeMs,
        });

        throw new AppError(
          422,
          'LLM_JSON_PARSE_FAIL',
          'Document extraction failed after retry. The raw response has been stored for review.',
          failedExtraction.id,
        );
      }

      // 6. Validate against schema
      const validationResult = LLMExtractionResultSchema.safeParse(parsed);
      let result: LLMExtractionResult;

      if (validationResult.success) {
        result = validationResult.data;
      } else {
        // Schema validation failed but we have JSON — use it loosely
        result = parsed as unknown as LLMExtractionResult;
      }

      // 7. LOW confidence retry
      if (result.detection?.confidence === 'LOW') {
        const retryResponse = await this.llmProvider.extractFromImage({
          imageBase64,
          mimeType: imageMimeType,
          prompt: getLowConfidenceRetryPrompt(fileName, mimeType),
          timeoutMs: env.LLM_TIMEOUT_MS,
        });

        rawLlmResponse += '\n---LOW_CONF_RETRY---\n' + retryResponse.content;

        const retryParsed = parseAndRepairJSON(retryResponse.content);
        if (retryParsed) {
          const retryValidation = LLMExtractionResultSchema.safeParse(retryParsed);
          if (retryValidation.success) {
            const retryResult = retryValidation.data;
            // Use the higher-confidence result
            if (retryResult.detection.confidence !== 'LOW') {
              result = retryResult;
            }
          }
        }
      }

      // 8. Store extraction
      const processingTimeMs = Date.now() - startTime;
      const extraction = await extractionRepo.create({
        sessionId,
        fileName,
        fileHash,
        result,
        rawLlmResponse,
        processingTimeMs,
      });

      return { extraction, deduplicated: false };
    } catch (error) {
      if (error instanceof AppError) throw error;

      // Handle timeout
      const isTimeout = error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('abort'));

      const processingTimeMs = Date.now() - startTime;

      // Never discard — store failed extraction
      const failedExtraction = await extractionRepo.createFailed({
        sessionId,
        fileName,
        fileHash,
        rawLlmResponse: rawLlmResponse || null,
        processingTimeMs,
      });

      if (isTimeout) {
        throw new AppError(
          500,
          'LLM_TIMEOUT',
          'LLM request timed out after 30 seconds.',
          failedExtraction.id,
        );
      }

      throw new AppError(
        500,
        'INTERNAL_ERROR',
        `Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        failedExtraction.id,
      );
    }
  }

  /**
   * Ensure a session exists, creating one if no sessionId is provided.
   */
  async ensureSession(sessionId?: string): Promise<string> {
    if (sessionId) {
      const exists = await sessionRepo.exists(sessionId);
      if (!exists) {
        throw new AppError(404, 'SESSION_NOT_FOUND', `Session ${sessionId} does not exist`);
      }
      return sessionId;
    }

    const session = await sessionRepo.create();
    return session.id;
  }
}
