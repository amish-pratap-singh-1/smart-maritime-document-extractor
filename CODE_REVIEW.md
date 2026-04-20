# Code Review & Self-Reflection

This document serves as a critical overview of the implemented solution, identifying technical debt and strategies for future improvements before promotion to a strict production environment.

## What is Good / Strengths

1. **LLM Fault Tolerance**: The extraction pipeline is impressively defensive. It accommodates markdown wrappings, preemptive/postamble chat texts, checks JSON trailing commas, and has two levels of retry (a prompt-directed repair of malformed output, and an explicit low-confidence targeted retry).
2. **True Separation of Concerns**: Because the business logic exists entirely within `ExtractionService` and is decoupled from HTTP concerns (Fastify) and Data concerns (Prisma repos), the worker queue can utilize exactly the same code as the synchronous endpoint.
3. **Graceful Degradation**: Both Prisma DB connections and BullMQ workers are properly shut down via `process.on('SIGTERM')`. 
4. **Idempotency**: The `computeFileHash` guarantees that duplicate documents uploaded sequentially do not burn LLM rate limits or incur unnecessary processing time.
5. **No Blind Casts**: Types are consistently propagated manually down to Prisma using `Prisma.InputJsonValue` to guarantee strict Postgres typing.

## Identified Technical Debt

### 1. Document Storage (Blob Strategy)
**Problem**: Currently, when an asynchronous job is enqueued, we pass the binary Base64 representation of the image directly inside the BullMQ Redis payload.
**Impact**: Redis memory bloat. If large volumes of 10MB files arrive, Redis RAM limits will be saturated very rapidly. Base64 encoding also bloats payload sizes by ~33%.
**Solution**: Adopt S3 or MinIO. The API should dump the file to block storage and simply pass an `s3://` URI to BullMQ.

### 2. Lack of PDF Splitting
**Problem**: We currently use `pdf-to-image` via `pdf-poppler` but arbitrarily extract only the first page.
**Impact**: Multi-page seafarer documents (like certain PEME medical tests) will lose trailing data or fail outright if the primary data sits on page two.
**Solution**: Integrate OCR chunking. Split arbitrary PDFs into image batches, pass multiple images to Gemini/Groq vision simultaneously if supported, or reduce/summarize pages.

### 3. Zod vs Fastify Native Validation
**Problem**: The application uses Zod for type safety internally, but Fastify natively relies on `fluent-schema` / `ajv` (JSON schema defaults).
**Impact**: For API body validations, we're catching the multipart error manually rather than defining strict JSON Schema inputs on route validation. 
**Solution**: Integrate `fastify-type-provider-zod` to seamlessly compile our existing zod types (`schemas.ts`) directly into Fastify’s internal router compiler for maximum performance and auto-scaling OpenAPI generation.

### 4. Limited Metric Telemetry
**Problem**: Extraction latency and consumed tokens are captured and tracked minimally or loosely via stdout logging.
**Impact**: We cannot auto-scale workers based on specific model latency degradation.
**Solution**: Wire `prometheus-client` or OpenTelemetry traces straight into the `createLLMProvider` factory wrapper to record histograms of LLM latency curves cleanly.

## Conclusion

The architecture successfully implements a sophisticated, multi-modal LLM extraction and validation pipeline. While some state-management technical debt remains around BLOB storage for queues, the core application logic is incredibly structurally sound, type-safe, and thoroughly documented.
