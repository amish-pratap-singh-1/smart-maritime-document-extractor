import { Ollama } from 'ollama';
import type { LLMProvider, LLMResponse } from './llm.interface.js';
import { env } from '../config/env.js';

export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  private client: Ollama;

  constructor() {
    this.client = new Ollama({ host: env.OLLAMA_BASE_URL });
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
      const response = await this.client.chat({
        model: env.LLM_MODEL,
        messages: [
          {
            role: 'user',
            content: params.prompt,
            images: [params.imageBase64],
          },
        ],
        signal: controller.signal,
      } as Parameters<typeof this.client.chat>[0]);

      return {
        content: response.message.content,
        model: env.LLM_MODEL,
        usage: {
          inputTokens: response.prompt_eval_count ?? 0,
          outputTokens: response.eval_count ?? 0,
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
      const response = await this.client.chat({
        model: env.LLM_MODEL,
        messages: [
          {
            role: 'user',
            content: params.prompt,
          },
        ],
        signal: controller.signal,
      } as Parameters<typeof this.client.chat>[0]);

      return {
        content: response.message.content,
        model: env.LLM_MODEL,
        usage: {
          inputTokens: response.prompt_eval_count ?? 0,
          outputTokens: response.eval_count ?? 0,
        },
        latencyMs: Date.now() - start,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
