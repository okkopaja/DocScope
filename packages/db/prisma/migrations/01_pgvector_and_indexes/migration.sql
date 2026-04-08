-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector column to embeddings table
-- (Prisma manages the table structure; we add the vector column via raw SQL)
-- This migration runs AFTER the initial Prisma migration creates the embeddings table.
ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS vector vector(1536);

-- IVFFlat index for approximate nearest neighbor search using cosine distance
-- Lists = 100 is a sensible default for up to ~1M vectors
CREATE INDEX IF NOT EXISTS embeddings_vector_idx
  ON embeddings USING ivfflat (vector vector_cosine_ops)
  WITH (lists = 100);

-- Full-text search index on chunks content
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS content_tsvector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content_text)) STORED;

CREATE INDEX IF NOT EXISTS chunks_content_fts_idx
  ON chunks USING GIN (content_tsvector);
