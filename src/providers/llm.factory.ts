import type { LLMProvider } from './llm.interface.js';
import { GroqProvider } from './groq.provider.js';
import { GeminiProvider } from './gemini.provider.js';
import { OllamaProvider } from './ollama.provider.js';
import { env } from '../config/env.js';

/**
 * Factory function to create the correct LLM provider
 * based on the LLM_PROVIDER environment variable.
 */
export function createLLMProvider(): LLMProvider {
  switch (env.LLM_PROVIDER) {
    case 'groq':
      return new GroqProvider();
    case 'gemini':
      return new GeminiProvider();
    case 'ollama':
      return new OllamaProvider();
    default:
      throw new Error(`Unknown LLM_PROVIDER: ${env.LLM_PROVIDER}. Supported: groq, gemini, ollama`);
  }
}
