import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMProvider, LLMResponse } from './llm.interface.js';
import { env } from '../config/env.js';

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  private client: GoogleGenerativeAI;

  constructor() {
    this.client = new GoogleGenerativeAI(env.LLM_API_KEY);
  }

  async extractFromImage(params: {
    imageBase64: string;
    mimeType: string;
    prompt: string;
    timeoutMs: number;
  }): Promise<LLMResponse> {
    const start = Date.now();

    const model = this.client.getGenerativeModel({ model: env.LLM_MODEL });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), params.timeoutMs);

    try {
      const result = await model.generateContent(
        {
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: params.mimeType,
                    data: params.imageBase64,
                  },
                },
                {
                  text: params.prompt,
                },
              ],
            },
          ],
        },
        { signal: controller.signal },
      );

      const response = result.response;
      const text = response.text();
      const usage = response.usageMetadata;

      return {
        content: text,
        model: env.LLM_MODEL,
        usage: {
          inputTokens: usage?.promptTokenCount ?? 0,
          outputTokens: usage?.candidatesTokenCount ?? 0,
        },
        latencyMs: Date.now() - start,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async sendTextPrompt(params: {
    prompt: string;
    timeoutMs: number;
  }): Promise<LLMResponse> {
    const start = Date.now();

    const model = this.client.getGenerativeModel({ model: env.LLM_MODEL });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), params.timeoutMs);

    try {
      const result = await model.generateContent(
        {
          contents: [
            {
              role: 'user',
              parts: [{ text: params.prompt }],
            },
          ],
        },
        { signal: controller.signal },
      );

      const response = result.response;
      const text = response.text();
      const usage = response.usageMetadata;

      return {
        content: text,
        model: env.LLM_MODEL,
        usage: {
          inputTokens: usage?.promptTokenCount ?? 0,
          outputTokens: usage?.candidatesTokenCount ?? 0,
        },
        latencyMs: Date.now() - start,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
