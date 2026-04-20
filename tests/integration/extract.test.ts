import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/config/database.js';
import { redis } from '../../src/config/redis.js';
import * as llmFactory from '../../src/providers/llm.factory.js';
import type { LLMProvider, LLMResponse } from '../../src/providers/llm.interface.js';
import path from 'path';
import fs from 'fs';

// Mock LLM Provider
class MockLLMProvider implements LLMProvider {
  readonly name = 'mock';

  async extractFromImage(): Promise<LLMResponse> {
    const mockResult = {
      detection: {
        documentType: 'COC',
        documentName: 'Certificate of Competency',
        category: 'CERTIFICATION',
        applicableRole: 'DECK',
        isRequired: true,
        confidence: 'HIGH'
      },
      holder: {
        fullName: 'Test Seafarer',
        dateOfBirth: '01/01/1990',
        nationality: null,
        passportNumber: null,
        sirbNumber: null,
        rank: null
      },
      fields: [],
      validity: {
        dateOfIssue: '01/01/2020',
        dateOfExpiry: '01/01/2025',
        isExpired: true,
        daysUntilExpiry: -365,
        revalidationRequired: true
      },
      flags: [],
      summary: 'Mock COC extraction.'
    };

    return {
      content: JSON.stringify(mockResult),
      model: 'mock-model',
      usage: { inputTokens: 10, outputTokens: 20 },
      latencyMs: 100
    };
  }

  async sendTextPrompt(): Promise<LLMResponse> {
    return {
      content: '{"status": "mock"}',
      model: 'mock-model',
      usage: { inputTokens: 10, outputTokens: 20 },
      latencyMs: 100
    };
  }
}

describe('Integration: Extract Route', () => {
  let app: any;
  let server: any;

  beforeAll(async () => {
    // Override the LLM factory to use our mock
    vi.spyOn(llmFactory, 'createLLMProvider').mockReturnValue(new MockLLMProvider());

    app = buildApp();
    await app.ready();
    server = app.server;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    redis.disconnect();
    vi.restoreAllMocks();
  });

  it('should process a valid document synchronously', async () => {
    // Create a dummy image file
    const testFilePath = path.join(__dirname, 'test-doc.png');
    fs.writeFileSync(testFilePath, Buffer.from('dummy image content'));

    try {
      const response = await request(server)
        .post('/api/extract?mode=sync')
        .attach('document', testFilePath);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body.documentType).toBe('COC');
      expect(response.body.holderName).toBe('Test Seafarer');
      expect(response.body.isExpired).toBe(true);
    } finally {
      // Clean up
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });

  it('should dedup if the same file is uploaded again', async () => {
    const testFilePath = path.join(__dirname, 'test-doc-dedup.png');
    fs.writeFileSync(testFilePath, Buffer.from('dummy dedup content'));

    try {
      // First request to get sessionId
      const res1 = await request(server)
        .post('/api/extract?mode=sync')
        .attach('document', testFilePath);

      expect(res1.status).toBe(200);
      const sessionId = res1.body.sessionId;

      // Second request with same file and sessionId
      const res2 = await request(server)
        .post('/api/extract?mode=sync')
        .field('sessionId', sessionId)
        .attach('document', testFilePath);

      expect(res2.status).toBe(200);
      expect(res2.headers['x-deduplicated']).toBe('true');
      expect(res2.body.id).toBe(res1.body.id);
    } finally {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });

  it('should return 400 if no file is provided', async () => {
    const response = await request(server)
      .post('/api/extract?mode=sync');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('UNSUPPORTED_FORMAT');
  });
});
