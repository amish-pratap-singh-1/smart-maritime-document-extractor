import { prisma } from '../config/database.js';
import { Prisma } from '@prisma/client';
import type { LLMExtractionResult } from '../types/schemas.js';

export interface CreateExtractionInput {
  sessionId: string;
  fileName: string;
  fileHash: string;
  result: LLMExtractionResult;
  rawLlmResponse: string;
  processingTimeMs: number;
  status?: string;
}

export const extractionRepo = {
  async create(input: CreateExtractionInput) {
    return prisma.extraction.create({
      data: {
        sessionId: input.sessionId,
        fileName: input.fileName,
        fileHash: input.fileHash,
        documentType: input.result.detection.documentType,
        documentName: input.result.detection.documentName,
        category: input.result.detection.category,
        applicableRole: input.result.detection.applicableRole,
        confidence: input.result.detection.confidence,
        isRequired: input.result.detection.isRequired ?? false,
        holderName: input.result.holder.fullName,
        dateOfBirth: input.result.holder.dateOfBirth,
        nationality: input.result.holder.nationality,
        passportNumber: input.result.holder.passportNumber,
        sirbNumber: input.result.holder.sirbNumber,
        rank: input.result.holder.rank,
        photoPresent: input.result.holder.photo ?? null,
        fields: input.result.fields as unknown as Prisma.InputJsonValue,
        validity: input.result.validity as unknown as Prisma.InputJsonValue,
        compliance: input.result.compliance
          ? (input.result.compliance as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        medicalData: input.result.medicalData
          ? (input.result.medicalData as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        flags: input.result.flags as unknown as Prisma.InputJsonValue,
        isExpired: input.result.validity.isExpired,
        summary: input.result.summary,
        rawLlmResponse: input.rawLlmResponse,
        processingTimeMs: input.processingTimeMs,
        status: input.status ?? 'COMPLETE',
      },
    });
  },

  async createFailed(input: {
    sessionId: string;
    fileName: string;
    fileHash: string;
    rawLlmResponse: string | null;
    processingTimeMs: number;
  }) {
    return prisma.extraction.create({
      data: {
        sessionId: input.sessionId,
        fileName: input.fileName,
        fileHash: input.fileHash,
        rawLlmResponse: input.rawLlmResponse,
        processingTimeMs: input.processingTimeMs,
        status: 'FAILED',
      },
    });
  },

  async findById(id: string) {
    return prisma.extraction.findUnique({ where: { id } });
  },

  async findBySessionAndHash(sessionId: string, fileHash: string) {
    return prisma.extraction.findUnique({
      where: {
        sessionId_fileHash: { sessionId, fileHash },
      },
    });
  },

  async findBySessionId(sessionId: string) {
    return prisma.extraction.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  },
};
