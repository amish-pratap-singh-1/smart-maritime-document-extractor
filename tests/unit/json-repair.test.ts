import { describe, it, expect } from 'vitest';
import { extractJSON, repairJSON, parseAndRepairJSON } from '../../src/utils/json-repair.js';

describe('extractJSON', () => {
  it('should parse valid JSON directly', () => {
    const input = '{"detection": {"documentType": "COC"}}';
    const result = extractJSON(input);
    expect(result).toEqual({ detection: { documentType: 'COC' } });
  });

  it('should extract JSON from markdown code fences', () => {
    const input = '```json\n{"detection": {"documentType": "PEME"}}\n```';
    const result = extractJSON(input);
    expect(result).toEqual({ detection: { documentType: 'PEME' } });
  });

  it('should extract JSON from code fences without language', () => {
    const input = '```\n{"key": "value"}\n```';
    const result = extractJSON(input);
    expect(result).toEqual({ key: 'value' });
  });

  it('should extract JSON with preamble text', () => {
    const input = 'Here is the extraction result:\n\n{"detection": {"documentType": "SIRB"}}';
    const result = extractJSON(input);
    expect(result).toEqual({ detection: { documentType: 'SIRB' } });
  });

  it('should extract JSON with postamble text', () => {
    const input = '{"detection": {"documentType": "PASSPORT"}}\n\nThis is a valid passport document.';
    const result = extractJSON(input);
    expect(result).toEqual({ detection: { documentType: 'PASSPORT' } });
  });

  it('should extract JSON with both preamble and postamble', () => {
    const input = 'Analysis:\n{"key": "value"}\nEnd of analysis.';
    const result = extractJSON(input);
    expect(result).toEqual({ key: 'value' });
  });

  it('should return null for non-JSON input', () => {
    const result = extractJSON('This is just plain text with no JSON');
    expect(result).toBeNull();
  });

  it('should return null for arrays (we expect objects)', () => {
    const result = extractJSON('[1, 2, 3]');
    expect(result).toBeNull();
  });

  it('should handle nested braces correctly', () => {
    const input = 'Result: {"a": {"b": {"c": 1}}}';
    const result = extractJSON(input);
    expect(result).toEqual({ a: { b: { c: 1 } } });
  });

  it('should handle whitespace around JSON', () => {
    const input = '   \n\n  {"key": "value"}  \n\n  ';
    const result = extractJSON(input);
    expect(result).toEqual({ key: 'value' });
  });
});

describe('repairJSON', () => {
  it('should fix trailing commas before closing brace', () => {
    const input = '{"key": "value",}';
    const result = repairJSON(input);
    expect(result).toEqual({ key: 'value' });
  });

  it('should fix trailing commas before closing bracket', () => {
    const input = '{"arr": [1, 2, 3,]}';
    const result = repairJSON(input);
    expect(result).toEqual({ arr: [1, 2, 3] });
  });

  it('should fix trailing commas with whitespace', () => {
    const input = '{"key": "value" , }';
    const result = repairJSON(input);
    expect(result).toEqual({ key: 'value' });
  });

  it('should return null for unrepairable input', () => {
    const result = repairJSON('totally not json at all');
    expect(result).toBeNull();
  });
});

describe('parseAndRepairJSON', () => {
  it('should handle clean JSON', () => {
    const input = '{"detection": {"documentType": "COC", "confidence": "HIGH"}}';
    const result = parseAndRepairJSON(input);
    expect(result).toEqual({
      detection: { documentType: 'COC', confidence: 'HIGH' },
    });
  });

  it('should handle code-fenced JSON with trailing comma', () => {
    const input = '```json\n{"key": "value",}\n```';
    const result = parseAndRepairJSON(input);
    expect(result).toEqual({ key: 'value' });
  });

  it('should handle preamble + malformed JSON', () => {
    const input = 'Here is the result:\n{"detection": {"documentType": "PEME",},}';
    const result = parseAndRepairJSON(input);
    expect(result).toEqual({ detection: { documentType: 'PEME' } });
  });

  it('should handle a realistic LLM response with code fence and explanation', () => {
    const input = `I've analyzed the document. Here are the results:

\`\`\`json
{
  "detection": {
    "documentType": "PEME",
    "documentName": "Pre-Employment Medical Examination",
    "category": "MEDICAL",
    "applicableRole": "BOTH",
    "confidence": "HIGH"
  },
  "holder": {
    "fullName": "John Doe",
    "dateOfBirth": "15/03/1990"
  },
  "fields": [],
  "validity": {
    "dateOfIssue": "01/01/2025",
    "dateOfExpiry": "01/01/2027",
    "isExpired": false,
    "daysUntilExpiry": 600,
    "revalidationRequired": false
  },
  "flags": [],
  "summary": "Valid PEME for John Doe."
}
\`\`\`

This appears to be a valid medical examination certificate.`;

    const result = parseAndRepairJSON(input);
    expect(result).not.toBeNull();
    expect(result!.detection).toEqual({
      documentType: 'PEME',
      documentName: 'Pre-Employment Medical Examination',
      category: 'MEDICAL',
      applicableRole: 'BOTH',
      confidence: 'HIGH',
    });
    expect((result!.holder as Record<string, unknown>).fullName).toBe('John Doe');
  });

  it('should return null for completely unrecoverable input', () => {
    const result = parseAndRepairJSON('The document could not be processed due to poor image quality.');
    expect(result).toBeNull();
  });
});
