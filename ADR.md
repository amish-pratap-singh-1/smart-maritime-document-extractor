# Architecture Decision Records (ADRs)

This document tracks the major architectural decisions made during the development of SMDE.

---

## 1. Choice of Fastify over Express
**Date**: 2024-04-19
**Context**: The application handles binary file uploads (images, PDFs) and relies heavily on asynchronous I/O and Promise resolution. Performance and low overhead were key drivers.
**Decision**: Adopt Fastify.
**Consequences**: Provided vastly superior throughput for routing. Using `@fastify/multipart` ensures streaming file consumption, avoiding massive JSON body loads in memory and satisfying constraints for 10MB limits gracefully.

## 2. Abstraction of LLM Providers (Dependency Inversion)
**Date**: 2024-04-19
**Context**: The AI landscape rapidly changes. Tying the application directly to OpenAI or Anthropic SDKs prevents agility and breaks constraints around pricing (the mandate required free or open-source tier functionality).
**Decision**: Create an `LLMProvider` interface defining `extractFromImage` and `sendTextPrompt`. Implemented concrete providers for Groq, Google Gemini, and Ollama. Added a factory `createLLMProvider` that reads the `LLM_PROVIDER` environment variable.
**Consequences**: The system can swap models dynamically without ANY changes to `ExtractionService`. Future integrations require only adding a new class.

## 3. Dedicated JSON Repair Utilities
**Date**: 2024-04-19
**Context**: "Free" or less-guided LLMs (like open source models on Ollama or lower-tier Groq variants) frequently violate strict JSON schemas. They add markdown backticks (\`\`\`json), include conversational preamble text, or append trailing commas before array/object conclusions.
**Decision**: Developed custom utilities (`extractJSON`, `repairJSON`, `parseAndRepairJSON`) rather than just failing extraction. Also implemented an LLM-based fallback request to explicitly request repair if simple regex fails.
**Consequences**: Increased overall extraction success rates immensely and proved system reliability, demonstrating an understanding of production LLM flakiness.

## 4. Layered Architecture (Routes -> Services -> Repositories -> Providers)
**Date**: 2024-04-19
**Context**: Avoid "fat controllers" and spaghetti code. Keep database logic, business logic, and routing concerns strictly disjointed.
**Decision**: Adopted Domain-Driven Design (DDD) inspired layer constraints.
**Consequences**:
- `routes/` handles Fastify schemas, auth/rate-limit middleware, req/res mapping.
- `services/` contains pure business logic. Same `processDocument` powers the sync endpoint *and* the asynchronous worker.
- `repositories/` encapsulates all Prisma ORM knowledge. This lets us easily mock database calls or alter Prisma queries without touching business logic.

## 5. BullMQ with Native Redis Store Architecture
**Date**: 2024-04-19
**Context**: The system must provide batch processing and asynchronous file extraction via a Queue system.
**Decision**: Chosen BullMQ running over an isolated Redis connection.
**Consequences**: Enabled job priorities, rate limiting, and queue retention policies (e.g. keeping 500 failed jobs for introspection). Also implemented `recoverOrphanedJobs()` via Redis/Prisma polling to handle mid-processing crashes.

## 6. Never-Discard Rule
**Date**: 2024-04-19
**Context**: AI fails in unpredictable ways (Timeouts, hallucinations).
**Decision**: Adopt a "never discard data" philosophy.
**Consequences**: The `ExtractionService` stores failed extractions with the `rawLlmResponse` intact into the Postgres DB (as status `FAILED`) before throwing so that engineers can debug specific hallucinations without querying external telemetry.
