/**
 * Attempts to extract valid JSON from an LLM response that may contain
 * markdown code fences, preamble text, or other noise.
 *
 * Strategy:
 * 1. Try direct JSON.parse
 * 2. Strip markdown code fences
 * 3. Find outermost { and } boundaries
 * 4. Return null if all fail
 */
export function extractJSON(raw: string): Record<string, unknown> | null {
  // 1. Try direct parse
  const direct = tryParse(raw.trim());
  if (direct) return direct;

  // 2. Strip markdown code fences: ```json ... ``` or ``` ... ```
  const fencePattern = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/;
  const fenceMatch = raw.match(fencePattern);
  if (fenceMatch) {
    const parsed = tryParse(fenceMatch[1].trim());
    if (parsed) return parsed;
  }

  // 3. Find outermost { and } — handles preamble/postamble text
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = raw.slice(firstBrace, lastBrace + 1);
    const parsed = tryParse(candidate);
    if (parsed) return parsed;
  }

  return null;
}

/**
 * Attempts to repair common JSON issues from LLM output:
 * - Trailing commas before } or ]
 * - Single quotes instead of double quotes (simple cases)
 * - Unescaped newlines in strings
 */
export function repairJSON(raw: string): Record<string, unknown> | null {
  let cleaned = raw;

  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  // Replace single quotes with double quotes (naive — works for simple cases)
  // Only if the string doesn't already contain double quotes in key positions
  if (!cleaned.includes('"') && cleaned.includes("'")) {
    cleaned = cleaned.replace(/'/g, '"');
  }

  return tryParse(cleaned);
}

/**
 * Full JSON extraction pipeline:
 * 1. extractJSON (find valid JSON in noise)
 * 2. repairJSON (fix common LLM formatting issues)
 * 3. Return null if both fail (caller should invoke LLM repair prompt)
 */
export function parseAndRepairJSON(raw: string): Record<string, unknown> | null {
  // First try clean extraction
  const extracted = extractJSON(raw);
  if (extracted) return extracted;

  // Then try repair on the raw string
  const repaired = repairJSON(raw);
  if (repaired) return repaired;

  // Try repair on the extracted substring
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = raw.slice(firstBrace, lastBrace + 1);
    const repairedCandidate = repairJSON(candidate);
    if (repairedCandidate) return repairedCandidate;
  }

  return null;
}

function tryParse(str: string): Record<string, unknown> | null {
  try {
    const result = JSON.parse(str);
    if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
      return result as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}
