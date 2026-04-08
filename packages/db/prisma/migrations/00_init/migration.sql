-- CreateEnum
CREATE TYPE "IndexStatus" AS ENUM ('pending', 'indexing', 'indexed', 'failed', 'deleted');

-- CreateEnum
CREATE TYPE "JobState" AS ENUM ('queued', 'running', 'paused', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "Modality" AS ENUM ('text', 'code', 'pdf', 'image');

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "root_path" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "embedding_model" TEXT NOT NULL DEFAULT 'gemini-embedding-2-preview',
    "embedding_dimension" INTEGER NOT NULL DEFAULT 1536,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_settings" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "relative_path" TEXT NOT NULL,
    "absolute_path" TEXT NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "modality" "Modality" NOT NULL,
    "index_status" "IndexStatus" NOT NULL DEFAULT 'pending',
    "last_error" TEXT,
    "indexed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_versions" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chunks" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content_text" TEXT NOT NULL,
    "token_estimate" INTEGER NOT NULL,
    "modality" "Modality" NOT NULL,
    "page_number" INTEGER,
    "line_start" INTEGER,
    "line_end" INTEGER,
    "source_locator_json" JSONB,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embeddings" (
    "id" TEXT NOT NULL,
    "chunk_id" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "dimension" INTEGER NOT NULL DEFAULT 1536,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "state" "JobState" NOT NULL DEFAULT 'queued',
    "total_files" INTEGER NOT NULL DEFAULT 0,
    "indexed" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_events" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_queries" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "query_text" TEXT NOT NULL,
    "query_type" TEXT NOT NULL DEFAULT 'search',
    "filters" JSONB,
    "result_count" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_results" (
    "id" TEXT NOT NULL,
    "query_id" TEXT NOT NULL,
    "chunk_id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "snippet" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'cli',
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "previews" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "preview_type" TEXT NOT NULL,
    "cache_path" TEXT NOT NULL,
    "width_px" INTEGER,
    "height_px" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "previews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_filters" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_filters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_settings_workspace_id_key_key" ON "workspace_settings"("workspace_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "files_workspace_id_relative_path_key" ON "files"("workspace_id", "relative_path");

-- CreateIndex
CREATE UNIQUE INDEX "chunks_idempotency_key_key" ON "chunks"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "embeddings_chunk_id_key" ON "embeddings"("chunk_id");

-- AddForeignKey
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "previews" ADD CONSTRAINT "previews_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_filters" ADD CONSTRAINT "saved_filters_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
