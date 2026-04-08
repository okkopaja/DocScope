import { Router } from 'express';
import { getDb } from '@docscope/db';
import { GeminiEmbeddingClient } from '@docscope/embeddings';
import { SearchEngine, AskEngine } from '@docscope/retrieval';
import { KeychainStore } from '@docscope/security';
import {
  ApiSearchQuerySchema,
  ApiAskBodySchema,
} from '@docscope/shared-types';
import { NotFoundError, asyncHandler } from '../middleware/error-handler.js';

export const workspacesRouter: Router = Router();

async function getApiKey(workspaceId: string): Promise<string> {
  const keychain = new KeychainStore();
  const key =
    (await keychain.get(`${workspaceId}:apiKey`)) ??
    process.env['DOCSCOPE_API_KEY'] ??
    process.env['GEMINI_API_KEY'];
  if (!key) throw new Error('API key not configured in keychain and no fallback environment variable found');
  return key;
}

// GET /workspaces/:id
workspacesRouter.get('/:id', asyncHandler(async (req, res) => {
  const db = getDb();
  const id = req.params['id'] as string;
  const workspace = await db.workspace.findUnique({ where: { id } });
  if (!workspace) throw new NotFoundError(`Workspace ${id} not found`);
  res.json(workspace);
}));

// GET /workspaces/:id/status
workspacesRouter.get('/:id/status', asyncHandler(async (req, res) => {
  const db = getDb();
  const id = req.params['id'] as string;

  const workspace = await db.workspace.findUnique({ where: { id } });
  if (!workspace) throw new NotFoundError(`Workspace ${id} not found`);

  const [fileCounts, chunkCount] = await Promise.all([
    db.file.groupBy({
      by: ['indexStatus'],
      where: { workspaceId: id },
      _count: { id: true },
    }),
    db.chunk.count({ where: { file: { workspaceId: id } } }),
  ]);

  const counts: Record<string, number> = {};
  for (const row of fileCounts) {
    counts[row.indexStatus] = row._count.id;
  }

  res.json({ workspaceId: id, files: counts, chunks: chunkCount });
}));

// Routes removed per P0: Replace placeholder /index and /reindex responses with real job-trigger behavior or remove the routes until implemented.

// GET /workspaces/:id/search
workspacesRouter.get('/:id/search', asyncHandler(async (req, res) => {
  const id = req.params['id'] as string;
  const { q, type, top } = ApiSearchQuerySchema.parse(req.query);

  const db = getDb();
  const workspace = await db.workspace.findUnique({ where: { id } });
  if (!workspace) throw new NotFoundError(`Workspace ${id} not found`);

  const apiKey = await getApiKey(id);
  const embeddingClient = new GeminiEmbeddingClient({ apiKey });
  const engine = new SearchEngine(db, embeddingClient);

  const results = await engine.search({ query: q, workspaceId: id, type, top });
  res.json({ results, count: results.length });
}));

// POST /workspaces/:id/ask
workspacesRouter.post('/:id/ask', asyncHandler(async (req, res) => {
  const id = req.params['id'] as string;
  const body = ApiAskBodySchema.parse(req.body);

  const db = getDb();
  const workspace = await db.workspace.findUnique({ where: { id } });
  if (!workspace) throw new NotFoundError(`Workspace ${id} not found`);

  const apiKey = await getApiKey(id);
  const embeddingClient = new GeminiEmbeddingClient({ apiKey });
  const engine = new AskEngine(db, embeddingClient, apiKey);

  const response = await engine.ask({ ...body, workspaceId: id });
  res.json(response);
  try {
    await db.auditLog.create({
      data: { workspaceId: id, action: 'ask', actor: 'api', details: { question: body.question } },
    });
  } catch { /* non-fatal */ }
}));

// GET /workspaces/:id/files
workspacesRouter.get('/:id/files', asyncHandler(async (req, res) => {
  const id = req.params['id'] as string;
  const page = parseInt((req.query['page'] as string | undefined) ?? '1', 10);
  const pageSizeRaw = parseInt((req.query['pageSize'] as string | undefined) ?? '50', 10);

  if (!Number.isFinite(page) || page < 1 || !Number.isFinite(pageSizeRaw) || pageSizeRaw < 1) {
    res.status(400).json({ error: 'Invalid pagination parameters' });
    return;
  }

  const pageSize = Math.min(pageSizeRaw, 100);

  const db = getDb();
  const workspace = await db.workspace.findUnique({ where: { id } });
  if (!workspace) throw new NotFoundError(`Workspace ${id} not found`);

  const [files, total] = await Promise.all([
    db.file.findMany({
      where: { workspaceId: id },
      orderBy: { relativePath: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.file.count({ where: { workspaceId: id } }),
  ]);

  res.json({ files, total, page, pageSize });
}));

// GET /workspaces/:id/files/:fileId
workspacesRouter.get('/:id/files/:fileId', asyncHandler(async (req, res) => {
  const db = getDb();
  const file = await db.file.findFirst({
    where: { id: req.params['fileId'] as string, workspaceId: req.params['id'] as string },
    include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 20 } },
  });
  if (!file) throw new NotFoundError('File not found');
  res.json(file);
}));
