# Smart Maritime Document Extractor (SMDE) Backend

This is the backend service for the Smart Maritime Document Extractor, built to achieve high reliability and performance under constraints. It provides both low-latency synchronous extraction for immediate UI feedback and asynchronous job-based processing for batch scenarios.

## 🚀 Features

- **Multi-LLM Abstraction**: Supports Groq (default), Gemini, and Ollama via a unified interface.
- **Auto-Repair JSON**: robust `parseAndRepairJSON` utility handles malformed LLM outputs, trailing commas, and preamble text.
- **Confidence Retries**: Automatically retries extractions with a targeted prompt if the LLM reports `LOW` confidence.
- **Idempotency & Deduplication**: Fast-path returns previously extracted data if the exact same file (via SHA-256 hash) is uploaded in the same session.
- **Resilient Background Processing**: BullMQ and Redis power an asynchronous queue, with recovery hooks to handle orphaned jobs if the server crashes.
- **Cross-Document Compliance Assessment**: Uses an LLM agent to review multiple seafarer documents within a session and determine an overall "HIRE" or "DO_NOT_HIRE" decision.

## 🏗️ Technology Stack

- **Runtime**: Node.js 22 LTS
- **Framework**: Fastify
- **Database**: PostgreSQL 18 (via Docker Compose)
- **ORM**: Prisma 7 (with `@prisma/adapter-pg`)
- **Queueing Engine**: BullMQ
- **Caching & Rate Limiting**: Redis 8
- **Validation**: Zod
- **Testing**: Vitest + Supertest

## 📦 Setting Up

1. **Prerequisites**
   - Node.js >= 22 (using `pnpm` as package manager)
   - Docker and Docker Compose
   - An API key for Groq or Gemini (or local Ollama instance)

2. **Installation**
   ```bash
   pnpm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env and supply your LLM_API_KEY and LLM_PROVIDER
   ```

4. **Start Infrastructure**
   ```bash
   # Starts Postgres and Redis via Docker Compose
   pnpm db:up
   ```

5. **Database Migration**
   ```bash
   pnpm db:push
   ```

6. **Running the Server**
   ```bash
   pnpm dev
   ```

## 🧪 Testing

```bash
# Run unit and integration tests
pnpm test
```

## 🏛️ Project Structure

A clean, domain-driven layer architecture:
- `src/app.ts`: Fastify app builder.
- `src/server.ts`: Entry point, starts the Fastify server and BullMQ worker.
- `src/routes/`: API endpoint definitions.
- `src/controllers/` (Implicit within routes for brevity): Request handling.
- `src/services/`: Core business logic (Extraction, Session, Validation, Reporting).
- `src/repositories/`: Data access layer encapsulating Prisma logic.
- `src/providers/`: Factory and implementations for external LLM API clients.
- `src/queue/`: BullMQ configuration and background worker logic.
- `src/utils/`: Pure utility functions (Hashing, JSON Repair, PDF-to-Image, Prompts).

## 📡 Core API Endpoints

- **`POST /api/extract`**: Upload a file. Use `?mode=sync` (default) for immediate results, or `?mode=async` to enqueue a job.
- **`GET /api/jobs/:jobId`**: Poll the status of an asynchronous extraction job.
- **`GET /api/sessions/:sessionId`**: Retrieve all data associated with a session.
- **`POST /api/sessions/:sessionId/validate`**: Trigger cross-document compliance validation using an LLM.
- **`GET /api/sessions/:sessionId/report`**: Generate a structured compliance report.
- **`GET /api/health`**: Dependency status checks (DB, Redis, LLM).
