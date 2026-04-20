import { extractionRepo } from '../repositories/extraction.repo.js';
import { validationRepo } from '../repositories/validation.repo.js';
import { sessionRepo } from '../repositories/session.repo.js';
import { AppError } from '../types/schemas.js';

interface ReportDocument {
  documentType: string | null;
  documentName: string | null;
  category: string | null;
  holderName: string | null;
  confidence: string | null;
  isExpired: boolean;
  validity: {
    dateOfIssue?: string | null;
    dateOfExpiry?: string | null;
    daysUntilExpiry?: number | null;
  } | null;
  flags: Array<{ severity: string; message: string }>;
  medicalSummary?: {
    fitnessResult?: string;
    drugTestResult?: string;
    restrictions?: string | null;
    specialNotes?: string | null;
  } | null;
}

interface ComplianceReport {
  sessionId: string;
  generatedAt: string;

  // Seafarer profile (aggregated from all documents)
  seafarerProfile: {
    name: string | null;
    dateOfBirth: string | null;
    nationality: string | null;
    passportNumber: string | null;
    sirbNumber: string | null;
    rank: string | null;
    detectedRole: string;
  };

  // Document inventory
  documentSummary: {
    totalDocuments: number;
    validDocuments: number;
    expiredDocuments: number;
    expiringWithin90Days: number;
    failedExtractions: number;
  };

  // Individual documents
  documents: ReportDocument[];

  // Compliance assessment (from latest validation, if available)
  complianceAssessment: {
    overallStatus: string;
    overallScore: number | null;
    summary: string | null;
    recommendations: string[];
    missingDocuments: Array<{
      documentType: string;
      documentName: string;
      isRequired: boolean;
      reason: string;
    }>;
    expiringDocuments: Array<{
      documentType: string;
      expiryDate: string;
      daysUntilExpiry: number;
      isExpired: boolean;
    }>;
    medicalFlags: Array<{ severity: string; message: string }>;
    consistencyIssues: Array<{
      field: string;
      values: string[];
      message: string;
    }>;
  } | null;

  // Decision support
  decision: {
    recommendation: 'HIRE' | 'CONDITIONAL_HIRE' | 'DO_NOT_HIRE' | 'PENDING_REVIEW';
    reasons: string[];
    requiredActions: string[];
  };
}

export class ReportService {
  async generateReport(sessionId: string): Promise<ComplianceReport> {
    // 1. Verify session
    const exists = await sessionRepo.exists(sessionId);
    if (!exists) {
      throw new AppError(404, 'SESSION_NOT_FOUND', `Session ${sessionId} does not exist`);
    }

    // 2. Get all extractions
    const extractions = await extractionRepo.findBySessionId(sessionId);
    const completed = extractions.filter(e => e.status === 'COMPLETE');
    const failed = extractions.filter(e => e.status === 'FAILED');

    // 3. Get latest validation (if any)
    const latestValidation = await validationRepo.findLatestBySessionId(sessionId);

    // 4. Build seafarer profile (most common values)
    const seafarerProfile = buildSeafarerProfile(completed);

    // 5. Build document summary
    const expiredDocs = completed.filter(e => e.isExpired);
    const expiringDocs = completed.filter(e => {
      const v = e.validity as { daysUntilExpiry?: number | null } | null;
      return v?.daysUntilExpiry != null && v.daysUntilExpiry > 0 && v.daysUntilExpiry <= 90;
    });

    // 6. Build individual document details
    const documents: ReportDocument[] = completed.map(e => ({
      documentType: e.documentType,
      documentName: e.documentName,
      category: e.category,
      holderName: e.holderName,
      confidence: e.confidence,
      isExpired: e.isExpired,
      validity: e.validity as ReportDocument['validity'],
      flags: (Array.isArray(e.flags) ? e.flags : []) as Array<{ severity: string; message: string }>,
      medicalSummary: e.medicalData
        ? (e.medicalData as ReportDocument['medicalSummary'])
        : null,
    }));

    // 7. Build compliance assessment from validation result
    let complianceAssessment: ComplianceReport['complianceAssessment'] = null;
    if (latestValidation?.result) {
      const v = latestValidation.result as Record<string, unknown>;
      complianceAssessment = {
        overallStatus: (v.overallStatus as string) ?? 'PENDING',
        overallScore: (v.overallScore as number) ?? null,
        summary: (v.summary as string) ?? null,
        recommendations: (v.recommendations as string[]) ?? [],
        missingDocuments: (v.missingDocuments as ComplianceReport['complianceAssessment'] extends null ? never : NonNullable<ComplianceReport['complianceAssessment']>['missingDocuments']) ?? [],
        expiringDocuments: (v.expiringDocuments as Array<{ documentType: string; expiryDate: string; daysUntilExpiry: number; isExpired: boolean }>) ?? [],
        medicalFlags: (v.medicalFlags as Array<{ severity: string; message: string }>) ?? [],
        consistencyIssues: ((v.consistencyChecks as Array<{ field: string; values: string[]; message: string; match: boolean }>) ?? [])
          .filter(c => !c.match)
          .map(c => ({ field: c.field, values: c.values, message: c.message })),
      };
    }

    // 8. Build decision support
    const decision = buildDecision(completed, complianceAssessment);

    return {
      sessionId,
      generatedAt: new Date().toISOString(),
      seafarerProfile,
      documentSummary: {
        totalDocuments: completed.length,
        validDocuments: completed.length - expiredDocs.length,
        expiredDocuments: expiredDocs.length,
        expiringWithin90Days: expiringDocs.length,
        failedExtractions: failed.length,
      },
      documents,
      complianceAssessment,
      decision,
    };
  }
}

function buildSeafarerProfile(
  extractions: Array<{
    holderName: string | null;
    dateOfBirth: string | null;
    nationality: string | null;
    passportNumber: string | null;
    sirbNumber: string | null;
    rank: string | null;
    applicableRole: string | null;
  }>,
) {
  const names = extractions.map(e => e.holderName).filter(Boolean);
  const dobs = extractions.map(e => e.dateOfBirth).filter(Boolean);
  const nationalities = extractions.map(e => e.nationality).filter(Boolean);
  const passports = extractions.map(e => e.passportNumber).filter(Boolean);
  const sirbs = extractions.map(e => e.sirbNumber).filter(Boolean);
  const ranks = extractions.map(e => e.rank).filter(Boolean);
  const roles = extractions.map(e => e.applicableRole).filter(Boolean);

  return {
    name: mostCommon(names as string[]),
    dateOfBirth: mostCommon(dobs as string[]),
    nationality: mostCommon(nationalities as string[]),
    passportNumber: mostCommon(passports as string[]),
    sirbNumber: mostCommon(sirbs as string[]),
    rank: mostCommon(ranks as string[]),
    detectedRole: detectRole(roles as string[]),
  };
}

function mostCommon(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const counts = new Map<string, number>();
  for (const val of arr) {
    counts.set(val, (counts.get(val) ?? 0) + 1);
  }
  let max = 0;
  let result = arr[0];
  for (const [val, count] of counts) {
    if (count > max) {
      max = count;
      result = val;
    }
  }
  return result ?? null;
}

function detectRole(roles: string[]): string {
  const set = new Set(roles);
  if (set.has('DECK') && set.has('ENGINE')) return 'BOTH';
  if (set.has('DECK')) return 'DECK';
  if (set.has('ENGINE')) return 'ENGINE';
  if (set.has('BOTH')) return 'BOTH';
  return 'N/A';
}

function buildDecision(
  extractions: Array<{ isExpired: boolean; flags: unknown; documentType: string | null }>,
  assessment: ComplianceReport['complianceAssessment'],
): ComplianceReport['decision'] {
  const reasons: string[] = [];
  const requiredActions: string[] = [];

  // Check expired documents
  const expired = extractions.filter(e => e.isExpired);
  if (expired.length > 0) {
    reasons.push(`${expired.length} document(s) are expired`);
    for (const e of expired) {
      requiredActions.push(`Renew expired ${e.documentType ?? 'document'}`);
    }
  }

  // Check critical flags
  let criticalCount = 0;
  for (const e of extractions) {
    if (Array.isArray(e.flags)) {
      for (const f of e.flags as Array<{ severity: string }>) {
        if (f.severity === 'CRITICAL') criticalCount++;
      }
    }
  }
  if (criticalCount > 0) {
    reasons.push(`${criticalCount} critical flag(s) found`);
  }

  // Use validation assessment if available
  if (assessment) {
    if (assessment.missingDocuments.length > 0) {
      const required = assessment.missingDocuments.filter(d => d.isRequired);
      if (required.length > 0) {
        reasons.push(`${required.length} required document(s) missing`);
        for (const d of required) {
          requiredActions.push(`Obtain ${d.documentName}`);
        }
      }
    }

    if (assessment.overallStatus === 'REJECTED') {
      return { recommendation: 'DO_NOT_HIRE', reasons, requiredActions };
    }
    if (assessment.overallStatus === 'CONDITIONAL') {
      return { recommendation: 'CONDITIONAL_HIRE', reasons, requiredActions };
    }
    if (assessment.overallStatus === 'APPROVED' && reasons.length === 0) {
      return {
        recommendation: 'HIRE',
        reasons: ['All documents valid and consistent'],
        requiredActions: [],
      };
    }
  }

  // No validation done yet
  if (!assessment) {
    return {
      recommendation: 'PENDING_REVIEW',
      reasons: ['Cross-document validation has not been performed yet'],
      requiredActions: ['Run POST /api/sessions/:sessionId/validate'],
    };
  }

  if (criticalCount > 0 || expired.length > 0) {
    return { recommendation: 'DO_NOT_HIRE', reasons, requiredActions };
  }

  if (reasons.length > 0) {
    return { recommendation: 'CONDITIONAL_HIRE', reasons, requiredActions };
  }

  return {
    recommendation: 'HIRE',
    reasons: ['All checks passed'],
    requiredActions: [],
  };
}
