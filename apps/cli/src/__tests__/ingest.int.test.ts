import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { getDb, disconnectDb } from '@docscope/db';
import type { WorkspaceConfig } from '@docscope/shared-types';
import { SearchEngine } from '@docscope/retrieval';

const hasTestDb = process.env['DOCSCOPE_TEST_DB'] === '1';
const prismaClientDir = join(process.cwd(), 'node_modules', '.prisma', 'client');
const hasPrismaClient =
  existsSync(prismaClientDir) &&
  existsSync(join(prismaClientDir, 'schema.prisma')) &&
  readdirSync(prismaClientDir).some(
    (name) => name.startsWith('query_engine') || name.startsWith('libquery_engine'),
  );
const describeDb = hasTestDb && hasPrismaClient ? describe : describe.skip;

const vector = new Array(1536).fill(0);

vi.mock('@docscope/embeddings', () => {
  class GeminiEmbeddingClient {
    async embedBatch(requests: Array<{ idempotencyKey: string }>) {
      return requests.map((r) => ({
        idempotencyKey: r.idempotencyKey,
        vector,
        modelName: 'test-model',
        dimension: vector.length,
      }));
    }
    async embedSingle() {
      return vector;
    }
  }
  class EmbeddingBatcher {
    createBatches(requests: Array<{ idempotencyKey: string }>) {
      return [{ requests }];
    }
  }
  class RetryPolicy {
    async execute<T>(fn: () => Promise<T>) {
      return await fn();
    }
  }
  class QuotaLimiter {
    async acquire() {}
  }
  return { GeminiEmbeddingClient, EmbeddingBatcher, RetryPolicy, QuotaLimiter };
});

import { runIngestionPipeline } from '../pipeline/ingest.js';

describeDb('ingest pipeline (integration)', () => {
  let db: ReturnType<typeof getDb>;
  let workspaceRoot: string;
  let workspace: WorkspaceConfig;

  beforeAll(async () => {
    db = getDb();
    workspaceRoot = mkdtempSync(join(tmpdir(), 'docscope-ingest-'));
    const workspaceId = randomUUID();
    workspace = {
      id: workspaceId,
      name: 'Test Workspace',
      rootPath: workspaceRoot,
      embeddingModel: 'gemini-embedding-2-preview',
      embeddingDimension: 1536,
      createdAt: new Date().toISOString(),
    };

    await db.workspace.create({
      data: {
        id: workspace.id,
        name: workspace.name,
        rootPath: workspace.rootPath,
        status: 'active',
        embeddingModel: workspace.embeddingModel,
        embeddingDimension: workspace.embeddingDimension,
      },
    });

    await db.workspaceSetting.createMany({
      data: [
        { workspaceId: workspace.id, key: 'maxFileSizeMb', value: '50' },
        { workspaceId: workspace.id, key: 'followSymlinks', value: 'false' },
      ],
    });
  });

  afterAll(async () => {
    await db.searchResult.deleteMany();
    await db.searchQuery.deleteMany();
    await db.preview.deleteMany();
    await db.embedding.deleteMany();
    await db.chunk.deleteMany();
    await db.fileVersion.deleteMany();
    await db.file.deleteMany();
    await db.jobEvent.deleteMany();
    await db.job.deleteMany();
    await db.workspaceSetting.deleteMany();
    await db.workspace.deleteMany();
    await disconnectDb();
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('tombstones deleted files and removes their chunks', async () => {
    const filePath = join(workspaceRoot, 'a.txt');
    writeFileSync(filePath, 'hello world', 'utf8');

    await runIngestionPipeline({
      workspace,
      db,
      apiKey: 'test-key',
      targetPath: workspaceRoot,
    });

    rmSync(filePath, { force: true });

    await runIngestionPipeline({
      workspace,
      db,
      apiKey: 'test-key',
      targetPath: workspaceRoot,
    });

    const file = await db.file.findFirst({
      where: { workspaceId: workspace.id, relativePath: 'a.txt' },
    });
    const chunkCount = await db.chunk.count({
      where: { file: { workspaceId: workspace.id, relativePath: 'a.txt' } },
    });

    expect(file?.indexStatus).toBe('deleted');
    expect(chunkCount).toBe(0);
  });

  it('search excludes deleted files', async () => {
    const filePath = join(workspaceRoot, 'b.txt');
    writeFileSync(filePath, 'unique search term', 'utf8');

    await runIngestionPipeline({
      workspace,
      db,
      apiKey: 'test-key',
      targetPath: workspaceRoot,
    });

    rmSync(filePath, { force: true });

    await runIngestionPipeline({
      workspace,
      db,
      apiKey: 'test-key',
      targetPath: workspaceRoot,
    });

    const { GeminiEmbeddingClient } = await import('@docscope/embeddings');
    const engine = new SearchEngine(db, new GeminiEmbeddingClient({ apiKey: 'test-key' }));
    const results = await engine.search({
      query: 'unique search term',
      workspaceId: workspace.id,
      top: 5,
    });

    expect(results).toHaveLength(0);
  });
});
