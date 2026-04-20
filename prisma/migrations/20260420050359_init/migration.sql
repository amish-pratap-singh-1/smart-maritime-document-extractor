-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extractions" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "document_type" TEXT,
    "document_name" TEXT,
    "category" TEXT,
    "applicable_role" TEXT,
    "confidence" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "holder_name" TEXT,
    "date_of_birth" TEXT,
    "nationality" TEXT,
    "passport_number" TEXT,
    "sirb_number" TEXT,
    "rank" TEXT,
    "photo_present" TEXT,
    "fields" JSONB,
    "validity" JSONB,
    "compliance" JSONB,
    "medical_data" JSONB,
    "flags" JSONB,
    "is_expired" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETE',
    "raw_llm_response" TEXT,
    "processing_time_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "extraction_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "error_code" TEXT,
    "error_message" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validations" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extractions_session_id_idx" ON "extractions"("session_id");

-- CreateIndex
CREATE INDEX "extractions_file_hash_idx" ON "extractions"("file_hash");

-- CreateIndex
CREATE INDEX "extractions_document_type_idx" ON "extractions"("document_type");

-- CreateIndex
CREATE INDEX "extractions_status_idx" ON "extractions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "extractions_session_id_file_hash_key" ON "extractions"("session_id", "file_hash");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_extraction_id_key" ON "jobs"("extraction_id");

-- CreateIndex
CREATE INDEX "jobs_session_id_idx" ON "jobs"("session_id");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "validations_session_id_idx" ON "validations"("session_id");

-- AddForeignKey
ALTER TABLE "extractions" ADD CONSTRAINT "extractions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_extraction_id_fkey" FOREIGN KEY ("extraction_id") REFERENCES "extractions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validations" ADD CONSTRAINT "validations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
