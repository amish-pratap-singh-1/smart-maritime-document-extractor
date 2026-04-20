import Groq from 'groq-sdk';
import type { LLMProvider, LLMResponse } from './llm.interface.js';
import { env } from '../config/env.js';

export class GroqProvider implements LLMProvider {
  readonly name = 'groq';
  private client: Groq;

  constructor() {
    this.client = new Groq({ apiKey: env.LLM_API_KEY });
  }

  async extractFromImage(params: {
    imageBase64: string;
    mimeType: string;
    prompt: string;
    timeoutMs: number;
  }): Promise<LLMResponse> {
    const start = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), params.timeoutMs);

    try {
      const response = await this.client.chat.completions.create(
        {
          model: env.LLM_MODEL,
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${params.mimeType};base64,${params.imageBase64}`,
                  },
                },
                {
                  type: 'text',
                  text: params.prompt,
                },
              ],
            },
          ],
        },
        { signal: controller.signal },
      );

      return {
        content: response.choices[0]?.message?.content ?? '',
        model: response.model,
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), params.timeoutMs);

    try {
      const response = await this.client.chat.completions.create(
        {
          model: env.LLM_MODEL,
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: params.prompt,
            },
          ],
        },
        { signal: controller.signal },
      );

      return {
        content: response.choices[0]?.message?.content ?? '',
        model: response.model,
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
        },
        latencyMs: Date.now() - start,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
