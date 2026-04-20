import crypto from 'node:crypto';

/**
 * Compute SHA-256 hash of a buffer.
 * Used for file deduplication within sessions.
 */
export function computeFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
