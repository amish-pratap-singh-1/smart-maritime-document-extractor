import { Queue } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';

export const EXTRACTION_QUEUE_NAME = 'extraction';

export interface ExtractionJobData {
  jobId: string;
  sessionId: string;
  fileName: string;
  fileBase64: string;
  mimeType: string;
}

export const extractionQueue = new Queue<ExtractionJobData>(EXTRACTION_QUEUE_NAME, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    removeOnComplete: { count: 100 }, // Keep last 100 completed
    removeOnFail: { count: 500 },     // Keep last 500 failed
    attempts: 1,                       // We handle retries in the service layer
  },
});
