import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

process.env['DOCSCOPE_DISABLE_LISTEN'] = '1';
process.env['DOCSCOPE_API_KEY'] = 'test-key';

vi.mock('@docscope/db', () => {
  return {
    getDb() {
      return {
        workspace: {
          findUnique: vi.fn().mockResolvedValue({
            id: '11111111-1111-1111-1111-111111111111',
            name: 'Test',
            rootPath: '/tmp',
            embeddingModel: 'gemini-embedding-2-preview',
            embeddingDimension: 1536,
          }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      };
    },
  };
});

vi.mock('@docscope/retrieval', () => {
  class SearchEngine {
    async search() {
      return [
        {
          chunkId: 'c1',
          fileId: 'f1',
          filePath: 'doc.txt',
          snippet: 'hello world',
          score: 1,
          rank: 1,
          modality: 'text',
          pageNumber: null,
          lineStart: 1,
          lineEnd: 2,
        },
      ];
    }
  }
  class AskEngine {
    async ask() {
      return {
        answer: 'ok',
        citations: [],
        evidence: [],
        durationMs: 1,
      };
    }
  }
  return { SearchEngine, AskEngine };
});

vi.mock('@docscope/embeddings', () => {
  class GeminiEmbeddingClient {
    constructor() {}
  }
  return { GeminiEmbeddingClient };
});

describe('API search/ask', () => {
  let app: Express;

  beforeAll(async () => {
    app = (await import('../index.js')).app;
  });

  it('GET /workspaces/:id/search returns results', async () => {
    const res = await request(app)
      .get('/workspaces/11111111-1111-1111-1111-111111111111/search')
      .query({ q: 'hello', top: '5' });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
  });

  it('POST /workspaces/:id/ask returns answer', async () => {
    const res = await request(app)
      .post('/workspaces/11111111-1111-1111-1111-111111111111/ask')
      .send({ question: 'hello', top: 5, type: 'text' });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBe('ok');
  });
});
