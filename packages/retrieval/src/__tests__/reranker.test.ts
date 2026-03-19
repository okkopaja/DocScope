import { describe, it, expect } from 'vitest';
import { rerank } from '../reranker.js';

describe('rerank (RRF)', () => {
  it('returns empty for empty inputs', () => {
    expect(rerank([], [])).toEqual([]);
  });

  it('merges two disjoint lists', () => {
    const v = [{ chunkId: 'a', fileId: 'f1', score: 0.9, source: 'vector' as const }];
    const f = [{ chunkId: 'b', fileId: 'f2', score: 0.8, source: 'fts' as const }];
    const result = rerank(v, f);
    expect(result).toHaveLength(2);
    expect(result[0]!.rrfScore).toBeGreaterThan(0);
  });

  it('boosts items appearing in both lists', () => {
    const v = [
      { chunkId: 'shared', fileId: 'f1', score: 0.9, source: 'vector' as const },
      { chunkId: 'only-v', fileId: 'f2', score: 0.8, source: 'vector' as const },
    ];
    const f = [
      { chunkId: 'shared', fileId: 'f1', score: 0.7, source: 'fts' as const },
      { chunkId: 'only-f', fileId: 'f3', score: 0.6, source: 'fts' as const },
    ];
    const result = rerank(v, f);
    expect(result[0]!.chunkId).toBe('shared');
  });

  it('is deterministic', () => {
    const v = [{ chunkId: 'a', fileId: 'f1', score: 1, source: 'vector' as const }];
    const f = [{ chunkId: 'a', fileId: 'f1', score: 1, source: 'fts' as const }];
    const r1 = rerank(v, f);
    const r2 = rerank(v, f);
    expect(r1).toEqual(r2);
  });
});
