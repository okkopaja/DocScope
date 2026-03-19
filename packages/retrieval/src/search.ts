import type { PrismaClient } from '@docscope/db';
import type { GeminiEmbeddingClient } from '@docscope/embeddings';
import type { SearchRequest, SearchResult } from '@docscope/shared-types';
import { createLogger } from '@docscope/shared-utils';
import { rerank } from './reranker.js';

const log = createLogger('retrieval:search');

export class SearchEngine {
  constructor(
    private readonly db: PrismaClient,
    private readonly embeddingClient: GeminiEmbeddingClient,
  ) {}

  async search(request: SearchRequest): Promise<SearchResult[]> {
    const start = Date.now();

    // 1. Embed the query
    const queryVector = await this.embeddingClient.embedSingle(request.query);
    const vectorStr = `[${queryVector.join(',')}]`;

    // 2. Vector similarity search using pgvector cosine distance
    const top = request.top ?? 10;
    type RawResult = {
      chunk_id: string;
      file_id: string;
      relative_path: string;
      content_text: string;
      modality: string;
      page_number: number | null;
      line_start: number | null;
      line_end: number | null;
      score: number;
    };

    const vectorResults: RawResult[] = request.type
      ? await this.db.$queryRaw<RawResult[]>`
          SELECT
            c.id as chunk_id,
            c.file_id,
            f.relative_path,
            c.content_text,
            c.modality,
            c.page_number,
            c.line_start,
            c.line_end,
            1 - (e.vector <=> ${vectorStr}::vector) as score
          FROM embeddings e
          JOIN chunks c ON c.id = e.chunk_id
          JOIN files f ON f.id = c.file_id
          WHERE f.workspace_id = ${request.workspaceId}
            AND f.index_status = 'indexed'
            AND c.modality = ${request.type}::"Modality"
          ORDER BY e.vector <=> ${vectorStr}::vector
          LIMIT ${top * 2}
        `
      : await this.db.$queryRaw<RawResult[]>`
          SELECT
            c.id as chunk_id,
            c.file_id,
            f.relative_path,
            c.content_text,
            c.modality,
            c.page_number,
            c.line_start,
            c.line_end,
            1 - (e.vector <=> ${vectorStr}::vector) as score
          FROM embeddings e
          JOIN chunks c ON c.id = e.chunk_id
          JOIN files f ON f.id = c.file_id
          WHERE f.workspace_id = ${request.workspaceId}
            AND f.index_status = 'indexed'
          ORDER BY e.vector <=> ${vectorStr}::vector
          LIMIT ${top * 2}
        `;

    // 3. Full-text keyword search
    const ftsResults: RawResult[] = request.type
      ? await this.db.$queryRaw<RawResult[]>`
          SELECT
            c.id as chunk_id,
            c.file_id,
            f.relative_path,
            c.content_text,
            c.modality,
            c.page_number,
            c.line_start,
            c.line_end,
            ts_rank(c.content_tsvector, plainto_tsquery('english', ${request.query})) as score
          FROM chunks c
          JOIN files f ON f.id = c.file_id
          WHERE f.workspace_id = ${request.workspaceId}
            AND f.index_status = 'indexed'
            AND c.content_tsvector @@ plainto_tsquery('english', ${request.query})
            AND c.modality = ${request.type}::"Modality"
          ORDER BY score DESC
          LIMIT ${top * 2}
        `
      : await this.db.$queryRaw<RawResult[]>`
          SELECT
            c.id as chunk_id,
            c.file_id,
            f.relative_path,
            c.content_text,
            c.modality,
            c.page_number,
            c.line_start,
            c.line_end,
            ts_rank(c.content_tsvector, plainto_tsquery('english', ${request.query})) as score
          FROM chunks c
          JOIN files f ON f.id = c.file_id
          WHERE f.workspace_id = ${request.workspaceId}
            AND f.index_status = 'indexed'
            AND c.content_tsvector @@ plainto_tsquery('english', ${request.query})
          ORDER BY score DESC
          LIMIT ${top * 2}
        `;

    // 4. Merge + RRF rerank
    const merged = rerank(
      vectorResults.map((r) => ({
        chunkId: r.chunk_id,
        fileId: r.file_id,
        score: r.score,
        source: 'vector' as const,
      })),
      ftsResults.map((r) => ({
        chunkId: r.chunk_id,
        fileId: r.file_id,
        score: r.score,
        source: 'fts' as const,
      })),
    );

    // 5. Build final results
    const chunkMap = new Map(
      [...vectorResults, ...ftsResults].map((r) => [r.chunk_id, r]),
    );

    const finalResults: SearchResult[] = merged.slice(0, top).map((item, idx: number) => {
      const chunk = chunkMap.get(item.chunkId);
      const snippet = chunk?.content_text?.slice(0, 300) ?? '';
      return {
        chunkId: item.chunkId,
        fileId: item.fileId,
        filePath: chunk?.relative_path ?? '',
        snippet: snippet + (snippet.length === 300 ? '…' : ''),
        score: item.rrfScore,
        rank: idx + 1,
        modality: (chunk?.modality ?? 'text') as SearchResult['modality'],
        pageNumber: chunk?.page_number ?? null,
        lineStart: chunk?.line_start ?? null,
        lineEnd: chunk?.line_end ?? null,
      };
    });

    const durationMs = Date.now() - start;
    log.info({ query: request.query, results: finalResults.length, durationMs }, 'Search complete');

    // Persist search telemetry (non-fatal)
    try {
      const queryRecord = await this.db.searchQuery.create({
        data: {
          workspaceId: request.workspaceId,
          queryText: request.query,
          queryType: 'search',
          filters: request.type ? { modality: request.type } : undefined,
          resultCount: finalResults.length,
          durationMs: durationMs,
        },
      });
      if (finalResults.length > 0) {
        await this.db.searchResult.createMany({
          data: finalResults.map((r) => ({
            queryId: queryRecord.id,
            chunkId: r.chunkId,
            rank: r.rank,
            score: r.score,
            snippet: r.snippet,
          })),
        });
      }
    } catch {
      // Telemetry is non-fatal
    }

    return finalResults;
  }
}
