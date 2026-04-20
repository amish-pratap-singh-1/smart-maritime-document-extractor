import type { LLMProvider } from '../providers/llm.interface.js';
import { extractionRepo } from '../repositories/extraction.repo.js';
import { validationRepo } from '../repositories/validation.repo.js';
import { sessionRepo } from '../repositories/session.repo.js';
import { parseAndRepairJSON } from '../utils/json-repair.js';
import { getValidationPrompt, getJSONRepairPrompt } from '../utils/prompts.js';
import { AppError, ValidationResultSchema } from '../types/schemas.js';
import type { ValidationResult } from '../types/schemas.js';
import { env } from '../config/env.js';

export class ValidationService {
  constructor(private llmProvider: LLMProvider) {}

  async validateSession(sessionId: string): Promise<ValidationResult> {
    // 1. Verify session exists
    const exists = await sessionRepo.exists(sessionId);
    if (!exists) {
      throw new AppError(404, 'SESSION_NOT_FOUND', `Session ${sessionId} does not exist`);
    }

    // 2. Get all completed extractions
    const extractions = await extractionRepo.findBySessionId(sessionId);
    const completed = extractions.filter(e => e.status === 'COMPLETE');

    if (completed.length < 2) {
      throw new AppError(
        400,
        'INSUFFICIENT_DOCUMENTS',
        'Validation requires at least 2 completed document extractions in the session.',
      );
    }

    // 3. Build extraction summaries for the LLM
    const summaries = completed.map(e => ({
      documentType: e.documentType,
      documentName: e.documentName,
      category: e.category,
      applicableRole: e.applicableRole,
      holderName: e.holderName,
      dateOfBirth: e.dateOfBirth,
      nationality: e.nationality,
      passportNumber: e.passportNumber,
      sirbNumber: e.sirbNumber,
      rank: e.rank,
      validity: e.validity,
      medicalData: e.medicalData,
      flags: e.flags,
      isExpired: e.isExpired,
      confidence: e.confidence,
    }));

    const extractionSummaries = JSON.stringify(
      { sessionId, documents: summaries },
      null,
      2,
    );

    // 4. Call LLM for cross-document validation
    const prompt = getValidationPrompt(extractionSummaries);

    const llmResponse = await this.llmProvider.sendTextPrompt({
      prompt,
      timeoutMs: env.LLM_TIMEOUT_MS,
    });

    // 5. Parse response
    let parsed = parseAndRepairJSON(llmResponse.content);

    if (!parsed) {
      // Try repair prompt
      const repairResponse = await this.llmProvider.sendTextPrompt({
        prompt: getJSONRepairPrompt(llmResponse.content),
        timeoutMs: env.LLM_TIMEOUT_MS,
      });
      parsed = parseAndRepairJSON(repairResponse.content);
    }

    if (!parsed) {
      throw new AppError(
        422,
        'LLM_JSON_PARSE_FAIL',
        'Cross-document validation failed — LLM returned unparseable response.',
      );
    }

    // 6. Validate schema
    const validation = ValidationResultSchema.safeParse(parsed);
    let result: ValidationResult;

    if (validation.success) {
      result = validation.data;
    } else {
      // Use parsed result loosely — best effort
      result = {
        ...parsed,
        sessionId,
        validatedAt: new Date().toISOString(),
      } as unknown as ValidationResult;
    }

    // Ensure sessionId and timestamp are set
    result.sessionId = sessionId;
    result.validatedAt = new Date().toISOString();

    // 7. Store validation result
    await validationRepo.create(sessionId, result);

    return result;
  }
}
