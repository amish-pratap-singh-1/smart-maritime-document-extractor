/**
 * LLM Provider Interface
 * All providers implement this — swap via LLM_PROVIDER env var.
 */
export interface LLMProvider {
  readonly name: string;

  /**
   * Send an image to the LLM for document extraction.
   */
  extractFromImage(params: {
    imageBase64: string;
    mimeType: string;
    prompt: string;
    timeoutMs: number;
  }): Promise<LLMResponse>;

  /**
   * Send a text-only prompt (for JSON repair or validation).
   */
  sendTextPrompt(params: {
    prompt: string;
    timeoutMs: number;
  }): Promise<LLMResponse>;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  latencyMs: number;
}
