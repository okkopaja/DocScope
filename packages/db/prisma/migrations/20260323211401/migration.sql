/*
  Warnings:

  - You are about to drop the column `content_tsvector` on the `chunks` table. All the data in the column will be lost.
  - You are about to drop the column `vector` on the `embeddings` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "chunks_content_fts_idx";

-- DropIndex
DROP INDEX "embeddings_vector_idx";

-- AlterTable
ALTER TABLE "chunks" DROP COLUMN "content_tsvector";

-- AlterTable
ALTER TABLE "embeddings" DROP COLUMN "vector";

-- AddForeignKey
ALTER TABLE "search_results" ADD CONSTRAINT "search_results_query_id_fkey" FOREIGN KEY ("query_id") REFERENCES "search_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
