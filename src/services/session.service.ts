import { sessionRepo } from '../repositories/session.repo.js';
import { AppError } from '../types/schemas.js';

export class SessionService {
  async getSession(sessionId: string) {
    const session = await sessionRepo.findById(sessionId);
    if (!session) {
      throw new AppError(404, 'SESSION_NOT_FOUND', `Session ${sessionId} does not exist`);
    }

    const documents = session.extractions
      .filter(e => e.status === 'COMPLETE')
      .map(e => ({
        id: e.id,
        fileName: e.fileName,
        documentType: e.documentType,
        applicableRole: e.applicableRole,
        holderName: e.holderName,
        confidence: e.confidence,
        isExpired: e.isExpired,
        flagCount: Array.isArray(e.flags) ? (e.flags as unknown[]).length : 0,
        criticalFlagCount: Array.isArray(e.flags)
          ? (e.flags as Array<{ severity: string }>).filter(
              (f) => f.severity === 'CRITICAL',
            ).length
          : 0,
        createdAt: e.createdAt,
      }));

    const pendingJobs = session.jobs.map(j => ({
      jobId: j.id,
      status: j.status,
      queuedAt: j.queuedAt,
    }));

    // Derive overallHealth
    const overallHealth = deriveOverallHealth(session.extractions);

    // Detect role from documents
    const detectedRole = detectRole(session.extractions);

    return {
      sessionId: session.id,
      documentCount: documents.length,
      detectedRole,
      overallHealth,
      documents,
      pendingJobs,
    };
  }
}

function deriveOverallHealth(
  extractions: Array<{ isExpired: boolean; flags: unknown; validity: unknown }>,
): 'OK' | 'WARN' | 'CRITICAL' {
  let hasCritical = false;
  let hasWarning = false;

  for (const e of extractions) {
    if (e.isExpired) {
      hasCritical = true;
    }

    if (Array.isArray(e.flags)) {
      for (const flag of e.flags as Array<{ severity: string }>) {
        if (flag.severity === 'CRITICAL') hasCritical = true;
        if (flag.severity === 'HIGH' || flag.severity === 'MEDIUM') hasWarning = true;
      }
    }

    // Check expiring within 90 days
    const validity = e.validity as { daysUntilExpiry?: number | null } | null;
    if (validity?.daysUntilExpiry != null && validity.daysUntilExpiry <= 90) {
      hasWarning = true;
    }
  }

  if (hasCritical) return 'CRITICAL';
  if (hasWarning) return 'WARN';
  return 'OK';
}

function detectRole(extractions: Array<{ applicableRole: string | null }>): string {
  const roles = new Set(
    extractions.map(e => e.applicableRole).filter(Boolean),
  );

  if (roles.has('DECK') && roles.has('ENGINE')) return 'BOTH';
  if (roles.has('DECK')) return 'DECK';
  if (roles.has('ENGINE')) return 'ENGINE';
  if (roles.has('BOTH')) return 'BOTH';
  return 'N/A';
}
