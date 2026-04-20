import { prisma } from '../config/database.js';

export const sessionRepo = {
  async create(): Promise<{ id: string; createdAt: Date }> {
    return prisma.session.create({ data: {} });
  },

  async findById(id: string) {
    return prisma.session.findUnique({
      where: { id },
      include: {
        extractions: {
          orderBy: { createdAt: 'asc' },
        },
        jobs: {
          where: { status: { in: ['QUEUED', 'PROCESSING'] } },
          orderBy: { queuedAt: 'asc' },
        },
      },
    });
  },

  async exists(id: string): Promise<boolean> {
    const count = await prisma.session.count({ where: { id } });
    return count > 0;
  },
};
