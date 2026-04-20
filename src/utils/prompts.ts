/**
 * The extraction prompt as specified in the assignment.
 * Do NOT modify — consistent prompt usage across candidates.
 */
export const EXTRACTION_PROMPT = `You are an expert maritime document analyst with deep knowledge of STCW, MARINA, IMO, and international seafarer certification standards.

A document has been provided. Perform the following in a single pass:
1. IDENTIFY the document type from the taxonomy below
2. DETERMINE if this belongs to a DECK officer, ENGINE officer, BOTH, or is role-agnostic (N/A)
3. EXTRACT all fields that are meaningful for this specific document type
4. FLAG any compliance issues, anomalies, or concerns

Document type taxonomy (use these exact codes):
COC | COP_BT | COP_PSCRB | COP_AFF | COP_MEFA | COP_MECA | COP_SSO | COP_SDSD | ECDIS_GENERIC | ECDIS_TYPE | SIRB | PASSPORT | PEME | DRUG_TEST | YELLOW_FEVER | ERM | MARPOL | SULPHUR_CAP | BALLAST_WATER | HATCH_COVER | BRM_SSBT | TRAIN_TRAINER | HAZMAT | FLAG_STATE | OTHER

Return ONLY a valid JSON object. No markdown. No code fences. No preamble.

{
  "detection": {
    "documentType": "SHORT_CODE",
    "documentName": "Full human-readable document name",
    "category": "IDENTITY | CERTIFICATION | STCW_ENDORSEMENT | MEDICAL | TRAINING | FLAG_STATE | OTHER",
    "applicableRole": "DECK | ENGINE | BOTH | N/A",
    "isRequired": true,
    "confidence": "HIGH | MEDIUM | LOW",
    "detectionReason": "One sentence explaining how you identified this document"
  },
  "holder": {
    "fullName": "string or null",
    "dateOfBirth": "DD/MM/YYYY or null",
    "nationality": "string or null",
    "passportNumber": "string or null",
    "sirbNumber": "string or null",
    "rank": "string or null",
    "photo": "PRESENT | ABSENT"
  },
  "fields": [
    {
      "key": "snake_case_key",
      "label": "Human-readable label",
      "value": "extracted value as string",
      "importance": "CRITICAL | HIGH | MEDIUM | LOW",
      "status": "OK | EXPIRED | WARNING | MISSING | N/A"
    }
  ],
  "validity": {
    "dateOfIssue": "string or null",
    "dateOfExpiry": "string | 'No Expiry' | 'Lifetime' | null",
    "isExpired": false,
    "daysUntilExpiry": null,
    "revalidationRequired": null
  },
  "compliance": {
    "issuingAuthority": "string",
    "regulationReference": "e.g. STCW Reg VI/1 or null",
    "imoModelCourse": "e.g. IMO 1.22 or null",
    "recognizedAuthority": true,
    "limitations": "string or null"
  },
  "medicalData": {
    "fitnessResult": "FIT | UNFIT | N/A",
    "drugTestResult": "NEGATIVE | POSITIVE | N/A",
    "restrictions": "string or null",
    "specialNotes": "string or null",
    "expiryDate": "string or null"
  },
  "flags": [
    {
      "severity": "CRITICAL | HIGH | MEDIUM | LOW",
      "message": "Description of issue or concern"
    }
  ],
  "summary": "Two-sentence plain English summary of what this document confirms about the holder."
}`;

/**
 * Enhanced retry prompt for LOW confidence results.
 * Includes file metadata hints.
 */
export function getLowConfidenceRetryPrompt(fileName: string, mimeType: string): string {
  return `${EXTRACTION_PROMPT}

ADDITIONAL CONTEXT:
- File name: ${fileName}
- File type: ${mimeType}
- A previous extraction attempt returned LOW confidence. Please examine the document more carefully and provide a HIGH confidence extraction. Pay special attention to the document type identification and field extraction.`;
}

/**
 * Prompt for asking the LLM to repair malformed JSON output.
 */
export function getJSONRepairPrompt(rawResponse: string): string {
  return `The following text was supposed to be a valid JSON object matching a specific schema, but it has formatting issues. Please extract and return ONLY the valid JSON object. Fix any syntax errors. Do not add any explanation.

Raw text:
${rawResponse}

Return ONLY the corrected JSON object. No markdown. No code fences. No explanation.`;
}

/**
 * Cross-document validation prompt — custom design.
 * This is intentionally our own design per the assignment instructions.
 */
export function getValidationPrompt(extractionSummaries: string): string {
  return `You are a senior maritime compliance officer conducting a pre-employment document review for a seafarer.

You have been provided with extraction data from multiple documents belonging to the same seafarer. Your task is to perform a comprehensive cross-document compliance assessment.

DOCUMENT DATA:
${extractionSummaries}

Perform the following checks:

1. IDENTITY CONSISTENCY
   - Compare holder name, date of birth, passport number, and SIRB number across all documents
   - Flag any mismatches with severity level

2. MISSING REQUIRED DOCUMENTS
   - Based on the detected role (DECK/ENGINE), identify any standard required documents that are missing
   - Required for ALL: COC, SIRB, PASSPORT, PEME, DRUG_TEST, YELLOW_FEVER
   - Required for DECK: ECDIS_GENERIC or ECDIS_TYPE, BRM_SSBT
   - Required for ENGINE: ERM
   - Common: COP_BT, COP_PSCRB, COP_AFF, COP_MEFA

3. EXPIRING/EXPIRED DOCUMENTS
   - List all documents with expiry dates, noting which are expired or expiring within 90 days

4. MEDICAL FLAGS
   - Review PEME and DRUG_TEST results for any concerns
   - Flag positive drug tests, UNFIT results, or any medical restrictions

5. OVERALL ASSESSMENT
   - APPROVED: All required docs present, valid, consistent, no critical issues
   - CONDITIONAL: Minor issues that can be resolved before boarding
   - REJECTED: Critical issues that prevent employment

Return ONLY a valid JSON object with this structure:
{
  "sessionId": "the session ID from the data",
  "holderProfile": {
    "name": "most frequently appearing name",
    "dateOfBirth": "most frequently appearing DOB",
    "nationality": "string or null",
    "passportNumber": "string or null",
    "sirbNumber": "string or null",
    "detectedRole": "DECK | ENGINE | BOTH",
    "rank": "string or null"
  },
  "consistencyChecks": [
    {
      "field": "field name being compared",
      "documents": ["list of document types compared"],
      "values": ["list of values found"],
      "match": true,
      "severity": "CRITICAL | HIGH | MEDIUM | LOW",
      "message": "explanation"
    }
  ],
  "missingDocuments": [
    {
      "documentType": "SHORT_CODE",
      "documentName": "Full name",
      "isRequired": true,
      "reason": "Why this document is needed"
    }
  ],
  "expiringDocuments": [
    {
      "documentType": "SHORT_CODE",
      "documentName": "Full name",
      "expiryDate": "date string",
      "daysUntilExpiry": 0,
      "isExpired": false,
      "severity": "CRITICAL | HIGH | MEDIUM | LOW"
    }
  ],
  "medicalFlags": [
    {
      "severity": "CRITICAL | HIGH | MEDIUM | LOW",
      "message": "description"
    }
  ],
  "overallStatus": "APPROVED | CONDITIONAL | REJECTED",
  "overallScore": 74,
  "summary": "Two-sentence overall assessment",
  "recommendations": ["list of action items"],
  "validatedAt": "ISO timestamp"
}

Return ONLY the JSON. No markdown. No code fences. No preamble.`;
}
