import { prisma } from '../config/database.js';
import type { Prisma } from '@prisma/client';
import type { ValidationResult } from '../types/schemas.js';

export const validationRepo = {
  async create(sessionId: string, result: ValidationResult) {
    return prisma.validation.create({
      data: {
        sessionId,
        result: result as unknown as Prisma.InputJsonValue,
      },
    });
  },

  async findLatestBySessionId(sessionId: string) {
    return prisma.validation.findFirst({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
  },
};
