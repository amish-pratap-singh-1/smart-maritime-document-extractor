import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const DocumentTypeEnum = z.enum([
  'COC', 'COP_BT', 'COP_PSCRB', 'COP_AFF', 'COP_MEFA', 'COP_MECA',
  'COP_SSO', 'COP_SDSD', 'ECDIS_GENERIC', 'ECDIS_TYPE', 'SIRB',
  'PASSPORT', 'PEME', 'DRUG_TEST', 'YELLOW_FEVER', 'ERM', 'MARPOL',
  'SULPHUR_CAP', 'BALLAST_WATER', 'HATCH_COVER', 'BRM_SSBT',
  'TRAIN_TRAINER', 'HAZMAT', 'FLAG_STATE', 'OTHER',
]);

export const CategoryEnum = z.enum([
  'IDENTITY', 'CERTIFICATION', 'STCW_ENDORSEMENT', 'MEDICAL',
  'TRAINING', 'FLAG_STATE', 'OTHER',
]);

export const RoleEnum = z.enum(['DECK', 'ENGINE', 'BOTH', 'N/A']);
export const ConfidenceEnum = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export const SeverityEnum = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
export const FieldStatusEnum = z.enum(['OK', 'EXPIRED', 'WARNING', 'MISSING', 'N/A']);
export const ImportanceEnum = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
export const FitnessEnum = z.enum(['FIT', 'UNFIT', 'N/A']);
export const DrugTestEnum = z.enum(['NEGATIVE', 'POSITIVE', 'N/A']);
export const PhotoEnum = z.enum(['PRESENT', 'ABSENT']);

export const JobStatusEnum = z.enum(['QUEUED', 'PROCESSING', 'COMPLETE', 'FAILED']);
export const ExtractionStatusEnum = z.enum(['COMPLETE', 'FAILED']);
export const OverallHealthEnum = z.enum(['OK', 'WARN', 'CRITICAL']);
export const ValidationStatusEnum = z.enum(['APPROVED', 'CONDITIONAL', 'REJECTED']);

// ─── LLM Response Schema ────────────────────────────────────────────────────

export const FieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string(),
  importance: ImportanceEnum,
  status: FieldStatusEnum,
});

export const ValiditySchema = z.object({
  dateOfIssue: z.string().nullable(),
  dateOfExpiry: z.string().nullable(),
  isExpired: z.boolean(),
  daysUntilExpiry: z.number().nullable(),
  revalidationRequired: z.boolean().nullable(),
});

export const ComplianceSchema = z.object({
  issuingAuthority: z.string().nullable().optional(),
  regulationReference: z.string().nullable().optional(),
  imoModelCourse: z.string().nullable().optional(),
  recognizedAuthority: z.boolean().nullable().optional(),
  limitations: z.string().nullable().optional(),
});

export const MedicalDataSchema = z.object({
  fitnessResult: FitnessEnum,
  drugTestResult: DrugTestEnum,
  restrictions: z.string().nullable(),
  specialNotes: z.string().nullable(),
  expiryDate: z.string().nullable(),
});

export const FlagSchema = z.object({
  severity: SeverityEnum,
  message: z.string(),
});

export const DetectionSchema = z.object({
  documentType: z.string(),
  documentName: z.string(),
  category: z.string(),
  applicableRole: z.string(),
  isRequired: z.boolean().optional(),
  confidence: ConfidenceEnum,
  detectionReason: z.string().optional(),
});

export const HolderSchema = z.object({
  fullName: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  nationality: z.string().nullable(),
  passportNumber: z.string().nullable(),
  sirbNumber: z.string().nullable(),
  rank: z.string().nullable(),
  photo: PhotoEnum.optional(),
});

export const LLMExtractionResultSchema = z.object({
  detection: DetectionSchema,
  holder: HolderSchema,
  fields: z.array(FieldSchema),
  validity: ValiditySchema,
  compliance: ComplianceSchema.optional(),
  medicalData: MedicalDataSchema.optional(),
  flags: z.array(FlagSchema),
  summary: z.string(),
});

export type LLMExtractionResult = z.infer<typeof LLMExtractionResultSchema>;
export type Field = z.infer<typeof FieldSchema>;
export type Validity = z.infer<typeof ValiditySchema>;
export type Flag = z.infer<typeof FlagSchema>;
export type MedicalData = z.infer<typeof MedicalDataSchema>;

// ─── API Response Schemas ────────────────────────────────────────────────────

export const ExtractionResponseSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  fileName: z.string(),
  documentType: z.string().nullable(),
  documentName: z.string().nullable(),
  applicableRole: z.string().nullable(),
  category: z.string().nullable(),
  confidence: z.string().nullable(),
  holderName: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  sirbNumber: z.string().nullable(),
  passportNumber: z.string().nullable(),
  fields: z.unknown(),
  validity: z.unknown(),
  compliance: z.unknown(),
  medicalData: z.unknown(),
  flags: z.unknown(),
  isExpired: z.boolean(),
  processingTimeMs: z.number().nullable(),
  summary: z.string().nullable(),
  createdAt: z.date(),
});

export const AsyncJobResponseSchema = z.object({
  jobId: z.string().uuid(),
  sessionId: z.string().uuid(),
  status: z.literal('QUEUED'),
  pollUrl: z.string(),
  estimatedWaitMs: z.number(),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  extractionId: z.string().uuid().optional(),
  retryAfterMs: z.number().nullable().optional(),
});

// ─── Validation Response Schema ──────────────────────────────────────────────

export const ConsistencyCheckSchema = z.object({
  field: z.string(),
  documents: z.array(z.string()),
  values: z.array(z.string()),
  match: z.boolean(),
  severity: SeverityEnum,
  message: z.string(),
});

export const MissingDocumentSchema = z.object({
  documentType: z.string(),
  documentName: z.string(),
  isRequired: z.boolean(),
  reason: z.string(),
});

export const ExpiringDocumentSchema = z.object({
  documentType: z.string(),
  documentName: z.string(),
  expiryDate: z.string(),
  daysUntilExpiry: z.number(),
  isExpired: z.boolean(),
  severity: SeverityEnum,
});

export const ValidationResultSchema = z.object({
  sessionId: z.string(),
  holderProfile: z.record(z.string(), z.unknown()),
  consistencyChecks: z.array(ConsistencyCheckSchema),
  missingDocuments: z.array(MissingDocumentSchema),
  expiringDocuments: z.array(ExpiringDocumentSchema),
  medicalFlags: z.array(FlagSchema),
  overallStatus: ValidationStatusEnum,
  overallScore: z.number(),
  summary: z.string(),
  recommendations: z.array(z.string()),
  validatedAt: z.string(),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

// ─── Application Error ──────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
    public readonly extractionId?: string,
    public readonly retryAfterMs?: number | null,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
