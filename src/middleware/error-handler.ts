import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../types/schemas.js';

/**
 * Global error handler — ensures consistent error response shape.
 */
export function errorHandler(
  error: FastifyError | AppError | Error,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  // Handle our application errors
  if (error instanceof AppError) {
    reply.status(error.statusCode).send({
      error: error.errorCode,
      message: error.message,
      extractionId: error.extractionId ?? null,
      retryAfterMs: error.retryAfterMs ?? null,
    });
    return;
  }

  // Handle Fastify validation errors
  if ('validation' in error && error.validation) {
    reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: error.message,
      retryAfterMs: null,
    });
    return;
  }

  // Handle multipart missing content type
  if ((error as any).code === 'FST_INVALID_MULTIPART_CONTENT_TYPE' || (error as any).code === 'FST_REQ_FILE_TOO_LARGE') {
    reply.status(400).send({
      error: 'UNSUPPORTED_FORMAT',
      message: 'No file uploaded. Send a multipart/form-data request with a document field.',
      retryAfterMs: null,
    });
    return;
  }

  // Handle file too large
  if (error.message?.includes('File too large') || error.message?.includes('request entity too large')) {
    reply.status(413).send({
      error: 'FILE_TOO_LARGE',
      message: 'File exceeds the maximum allowed size of 10MB.',
      retryAfterMs: null,
    });
    return;
  }

  // Unexpected errors
  console.error('Unhandled error:', error);
  reply.status(500).send({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred.',
    retryAfterMs: null,
  });
}
