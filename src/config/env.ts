import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // LLM
  LLM_PROVIDER: z.enum(['groq', 'gemini', 'ollama']),
  LLM_MODEL: z.string(),
  LLM_API_KEY: z.string().default(''),

  // Ollama
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),

  // Rate limiting
  RATE_LIMIT_MAX: z.coerce.number().default(10),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().default(60),

  // Queue
  QUEUE_CONCURRENCY: z.coerce.number().default(3),

  // LLM Timeout
  LLM_TIMEOUT_MS: z.coerce.number().default(30000),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
