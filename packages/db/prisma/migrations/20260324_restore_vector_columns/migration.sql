-- Restore vector column and indexes that were accidentally dropped by migration 20260323211401

-- Re-enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Re-add vector column to embeddings table
ALTER TABLE "embeddings" ADD COLUMN IF NOT EXISTS "vector" vector(1536);

-- Re-create IVFFlat cosine similarity index
CREATE INDEX IF NOT EXISTS "embeddings_vector_idx"
  ON "embeddings" USING ivfflat ("vector" vector_cosine_ops)
  WITH (lists = 100);

-- Re-add generated tsvector column for full-text search
ALTER TABLE "chunks" ADD COLUMN IF NOT EXISTS "content_tsvector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', "content_text")) STORED;

-- Re-create GIN index on tsvector column
CREATE INDEX IF NOT EXISTS "chunks_content_fts_idx"
  ON "chunks" USING GIN ("content_tsvector");
