import { RateLimiterRedis } from 'rate-limiter-flexible';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../config/redis.js';
import { env } from '../config/env.js';

const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl_extract',
  points: env.RATE_LIMIT_MAX,
  duration: env.RATE_LIMIT_WINDOW_SECONDS,
});

/**
 * Rate limiting middleware for POST /api/extract.
 * Uses sliding window via Redis (atomic Lua scripts).
 * Returns 429 with Retry-After header when limit exceeded.
 */
export async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const key = request.ip;

  try {
    const result = await rateLimiter.consume(key);

    // Set rate limit headers
    reply.header('X-RateLimit-Limit', env.RATE_LIMIT_MAX);
    reply.header('X-RateLimit-Remaining', result.remainingPoints);
    reply.header('X-RateLimit-Reset', Math.ceil(result.msBeforeNext / 1000));
  } catch (rejRes: unknown) {
    const rejection = rejRes as { msBeforeNext: number; remainingPoints: number };

    const retryAfterMs = rejection.msBeforeNext;
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

    reply.header('Retry-After', retryAfterSeconds);
    reply.header('X-RateLimit-Limit', env.RATE_LIMIT_MAX);
    reply.header('X-RateLimit-Remaining', 0);
    reply.header('X-RateLimit-Reset', retryAfterSeconds);

    reply.status(429).send({
      error: 'RATE_LIMITED',
      message: `Too many requests. Try again in ${retryAfterSeconds} seconds.`,
      retryAfterMs,
    });
  }
}
