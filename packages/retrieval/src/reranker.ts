interface RankItem {
  chunkId: string;
  fileId: string;
  score: number;
  source: 'vector' | 'fts';
}

interface RRFResult {
  chunkId: string;
  fileId: string;
  rrfScore: number;
}

const RRF_K = 60; // Standard RRF constant

/**
 * Reciprocal Rank Fusion — merges vector and FTS result lists into a single
 * unified ranking. Each item's score = Σ 1/(k + rank_i) across all lists.
 */
export function rerank(vectorResults: RankItem[], ftsResults: RankItem[]): RRFResult[] {
  const scores = new Map<string, { chunkId: string; fileId: string; rrfScore: number }>();

  const addList = (items: RankItem[]) => {
    items.forEach((item, index) => {
      const rank = index + 1;
      const rrfContribution = 1 / (RRF_K + rank);
      const entry = scores.get(item.chunkId);
      if (entry) {
        entry.rrfScore += rrfContribution;
      } else {
        scores.set(item.chunkId, {
          chunkId: item.chunkId,
          fileId: item.fileId,
          rrfScore: rrfContribution,
        });
      }
    });
  };

  addList(vectorResults);
  addList(ftsResults);

  return Array.from(scores.values()).sort((a, b) => b.rrfScore - a.rrfScore);
}
