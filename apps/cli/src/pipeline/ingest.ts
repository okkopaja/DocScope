import { join, extname } from 'node:path';
import pLimit from 'p-limit';
import { mkdir } from 'node:fs/promises';
import { readdirSync, statSync, lstatSync } from 'node:fs';
import type { PrismaClient } from '@docscope/db';
import { GeminiEmbeddingClient, EmbeddingBatcher, RetryPolicy, QuotaLimiter } from '@docscope/embeddings';
import { ExtractorRegistry } from '@docscope/extractor';
import { ChunkerRegistry } from '@docscope/chunker';
import { IgnoreEngine, PathGuard } from '@docscope/security';
import { sha256File, createLogger, formatBytes } from '@docscope/shared-utils';
import type { WorkspaceConfig, DiscoveredFile } from '@docscope/shared-types';
import * as mimeTypes from 'mime-types';

const log = createLogger('pipeline:ingest');

// Supported extensions for Phase 1
const SUPPORTED_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.csv',
  '.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go',
  '.html', '.css',
  '.pdf',
  '.png', '.jpg', '.jpeg', '.webp',
]);

const MODALITY_MAP: Record<string, string> = {
  '.txt': 'text', '.md': 'text', '.json': 'text', '.csv': 'text',
  '.html': 'text', '.css': 'text',
  '.ts': 'code', '.js': 'code', '.tsx': 'code', '.jsx': 'code',
  '.py': 'code', '.java': 'code', '.go': 'code',
  '.pdf': 'pdf',
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.webp': 'image',
};

export interface IngestionOptions {
  workspace: WorkspaceConfig;
  db: PrismaClient;
  apiKey: string;
  targetPath: string;
  force?: boolean;
  concurrency?: number;
  onProgress?: (msg: string) => void;
}

export interface IngestionResult {
  indexed: number;
  skipped: number;
  failed: number;
  durationMs: number;
  errors: Array<{ path: string; message: string }>;
}

export async function runIngestionPipeline(options: IngestionOptions): Promise<IngestionResult> {
  const { workspace, db, apiKey, targetPath, force = false } = options;
  const onProgress = options.onProgress ?? (() => {});
  const concurrency = options.concurrency ?? 3;
  const startTime = Date.now();

  const ignoreEngine = IgnoreEngine.fromWorkspace(workspace.rootPath);
  const extractor = new ExtractorRegistry();
  const chunker = new ChunkerRegistry();
  const batcher = new EmbeddingBatcher();
  const retryPolicy = new RetryPolicy();
  const quotaLimiter = new QuotaLimiter();
  const embeddingClient = new GeminiEmbeddingClient({
    apiKey,
    model: workspace.embeddingModel,
    outputDimension: workspace.embeddingDimension,
  });

  // Create job record
  const job = await db.job.create({
    data: {
      workspaceId: workspace.id,
      jobType: force ? 'reindex_force' : 'index',
      state: 'running',
      startedAt: new Date(),
    },
  });

  // Ensure preview cache dir exists
  await mkdir(join(workspace.rootPath, '.docscope', 'cache', 'previews'), { recursive: true });

  // 1. Discover files
  onProgress('Discovering files...');
  
  const maxFileSetting = await db.workspaceSetting.findUnique({
    where: { workspaceId_key: { workspaceId: workspace.id, key: 'maxFileSizeMb' } },
  });
  const maxFileSizeMb = maxFileSetting ? parseInt(maxFileSetting.value, 10) : 50;

  const followSymSetting = await db.workspaceSetting.findUnique({
    where: { workspaceId_key: { workspaceId: workspace.id, key: 'followSymlinks' } },
  });
  const followSymlinks = followSymSetting?.value === 'true';

  const pathGuard = new PathGuard(workspace.rootPath, { allowSymlinks: followSymlinks });
  const targetPathResolved = pathGuard.validate(targetPath);

  const discovered = await discoverFiles(workspace.rootPath, targetPathResolved, ignoreEngine, pathGuard, db, workspace.id, force, options.workspace, maxFileSizeMb, followSymlinks);

  await db.job.update({
    where: { id: job.id },
    data: { totalFiles: discovered.length },
  });

  log.info({ count: discovered.length }, 'Files discovered');

  const result: IngestionResult = {
    indexed: 0,
    skipped: 0,
    failed: 0,
    durationMs: 0,
    errors: [],
  };

  // Tombstoning
  const discoveredMap = new Set(discovered.map((f: DiscoveredFile) => f.relativePath));
  const allExistingFiles = await db.file.findMany({
    where: { workspaceId: workspace.id, indexStatus: { not: 'deleted' } },
    select: { id: true, relativePath: true }
  });
  const missingFiles = allExistingFiles.filter((f: { id: string; relativePath: string }) =>
    !discoveredMap.has(f.relativePath),
  );

  if (missingFiles.length > 0) {
    onProgress(`Tombstoning ${missingFiles.length} missing files...`);
    const missingFileIds = missingFiles.map((f: { id: string }) => f.id);
    await db.file.updateMany({
      where: { id: { in: missingFileIds } },
      data: { indexStatus: 'deleted' }
    });
    // Remove tombstoned files from active chunks/embeddings
    await db.chunk.deleteMany({
      where: { fileId: { in: missingFileIds } }
    });
  }

  // Filter to actually process vs skip
  const toProcess = discovered.filter((f: DiscoveredFile) => f.isNew || f.hasChanged);
  const skippedFiles = discovered.filter((f: DiscoveredFile) => !f.isNew && !f.hasChanged);
  result.skipped = skippedFiles.length;

  onProgress(`Processing ${toProcess.length} files (${skippedFiles.length} unchanged)...`);

  // 2. Process files with limited concurrency
  const queue = [...toProcess];

  const processFile = async (file: DiscoveredFile) => {
    try {
      onProgress(`Indexing: ${file.relativePath}`);

      // Upsert file record
      const fileRecord = await db.file.upsert({
        where: { workspaceId_relativePath: { workspaceId: workspace.id, relativePath: file.relativePath } },
        create: {
          workspaceId: workspace.id,
          relativePath: file.relativePath,
          absolutePath: file.absolutePath,
          checksumSha256: file.checksumSha256,
          mimeType: file.mimeType,
          fileSizeBytes: BigInt(file.fileSizeBytes),
          modality: file.modality as 'text' | 'code' | 'pdf' | 'image',
          indexStatus: 'indexing',
        },
        update: {
          checksumSha256: file.checksumSha256,
          mimeType: file.mimeType,
          fileSizeBytes: BigInt(file.fileSizeBytes),
          indexStatus: 'indexing',
          lastError: null,
        },
      });

      // Delete old chunks and embeddings for re-indexing
      if (!file.isNew) {
        await db.chunk.deleteMany({ where: { fileId: fileRecord.id } });
      }

      // a. Extract
      const extracted = await extractor.extract({
        absolutePath: file.absolutePath,
        relativePath: file.relativePath,
        mimeType: file.mimeType,
        fileSizeBytes: file.fileSizeBytes,
      });

      // b. Chunk
      const chunks = chunker.chunk({
        fileId: fileRecord.id,
        extracted,
        relativePath: file.relativePath,
      });

      // c. Insert chunks
      const chunkRecords = (await db.$transaction(
        chunks.map((c) =>
          db.chunk.create({
            data: {
              fileId: fileRecord.id,
              chunkIndex: c.chunkIndex,
              contentText: c.contentText,
              tokenEstimate: c.tokenEstimate,
              modality: c.modality as 'text' | 'code' | 'pdf' | 'image',
              pageNumber: c.pageNumber,
              lineStart: c.lineStart,
              lineEnd: c.lineEnd,
              sourceLocatorJson: c.sourceLocatorJson ?? undefined,
              idempotencyKey: c.idempotencyKey,
            },
          }),
        ),
      )) as Array<{ id: string; idempotencyKey: string }>;

      // d. Batch-embed
      const embeddingRequests = chunks.map((c) => ({
        idempotencyKey: c.idempotencyKey,
        contentText: c.contentText,
        modality: c.modality,
      }));

      const batches = batcher.createBatches(embeddingRequests);

      for (const batch of batches) {
        await quotaLimiter.acquire();
        const results = await retryPolicy.execute(
          () => embeddingClient.embedBatch(batch.requests),
          `embed batch for ${file.relativePath}`,
        );

        // e. Insert embeddings
        for (const embResult of results) {
          const chunkRecord = chunkRecords.find((cr: { idempotencyKey: string }) =>
            cr.idempotencyKey === embResult.idempotencyKey,
          );
          if (!chunkRecord) continue;

          // Insert embedding row
          await db.embedding.upsert({
            where: { chunkId: chunkRecord.id },
            create: {
              chunkId: chunkRecord.id,
              modelName: embResult.modelName,
              dimension: embResult.dimension,
            },
            update: { modelName: embResult.modelName, dimension: embResult.dimension },
          });

          // Update the vector column via raw SQL
          const vectorStr = `[${embResult.vector.join(',')}]`;
          await db.$executeRawUnsafe(
            `UPDATE embeddings SET vector = $1::vector WHERE chunk_id = $2`,
            vectorStr,
            chunkRecord.id,
          );
        }
      }

      // Generate previews
      if (file.modality === 'image') {
        try {
          const sharp = (await import('sharp')).default;
          const previewName = `${fileRecord.id}_thumb.webp`;
          const previewPath = join(workspace.rootPath, '.docscope', 'cache', 'previews', previewName);
          await sharp(file.absolutePath).resize(256, 256, { fit: 'inside' }).webp().toFile(previewPath);
          await db.preview.create({
            data: {
              fileId: fileRecord.id,
              previewType: 'thumbnail',
              cachePath: previewPath,
              widthPx: 256,
              heightPx: 256,
            },
          });
        } catch (previewErr) {
          log.warn({ path: file.relativePath, err: previewErr }, 'Preview generation failed');
        }
      } else if (file.modality === 'pdf') {
        try {
          // For PDFs, store a metadata-only preview entry (actual rendering deferred)
          await db.preview.create({
            data: {
              fileId: fileRecord.id,
              previewType: 'pdf_metadata',
              cachePath: '',
            },
          });
        } catch (previewErr) {
          log.warn({ path: file.relativePath, err: previewErr }, 'Preview metadata failed');
        }
      }

      // f. Update file status
      await db.file.update({
        where: { id: fileRecord.id },
        data: {
          indexStatus: 'indexed',
          indexedAt: new Date(),
        },
      });

      // g. Record file version
      await db.fileVersion.create({
        data: {
          fileId: fileRecord.id,
          checksumSha256: file.checksumSha256,
          fileSizeBytes: BigInt(file.fileSizeBytes),
        },
      });

      result.indexed++;
      await db.job.update({
        where: { id: job.id },
        data: { indexed: result.indexed },
      });

      await db.jobEvent.create({
        data: {
          jobId: job.id,
          event: 'file_indexed',
          data: { relativePath: file.relativePath, chunks: chunkRecords.length },
        },
      });

      log.debug({ path: file.relativePath, chunks: chunkRecords.length }, 'File indexed');
    } catch (err) {
      const message = (err as Error).message;
      log.error({ path: file.relativePath, err }, 'File indexing failed');
      result.failed++;
      result.errors.push({ path: file.relativePath, message });

      // Mark file as failed
      try {
        await db.file.updateMany({
          where: {
            workspaceId: workspace.id,
            relativePath: file.relativePath,
          },
          data: {
            indexStatus: 'failed',
            lastError: message.slice(0, 1000),
          },
        });
      } catch {
        // Non-fatal
      }

      await db.job.update({
        where: { id: job.id },
        data: { failed: result.failed },
      });

      await db.jobEvent.create({
        data: {
          jobId: job.id,
          event: 'file_failed',
          data: { relativePath: file.relativePath, error: message.slice(0, 500) },
        },
      }).catch(() => {}); // non-fatal
    }
  };

  // Concurrency-limited processing
  const limit = pLimit(concurrency);
  const promises = queue.map((file) => limit(() => processFile(file)));
  await Promise.allSettled(promises);

  // Finalize job
  result.durationMs = Date.now() - startTime;
  await db.job.update({
    where: { id: job.id },
    data: {
      state: result.failed > 0 && result.indexed === 0 ? 'failed' : 'completed',
      completedAt: new Date(),
      indexed: result.indexed,
      skipped: result.skipped,
      failed: result.failed,
    },
  });

  return result;
}

async function discoverFiles(
  rootPath: string,
  targetPath: string,
  ignoreEngine: IgnoreEngine,
  pathGuard: PathGuard,
  db: PrismaClient,
  workspaceId: string,
  force: boolean,
  workspace: WorkspaceConfig,
  maxFileSizeMb: number,
  followSymlinks: boolean,
): Promise<DiscoveredFile[]> {
  const discovered: DiscoveredFile[] = [];
  const maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;

  // Get existing checksums from DB for incremental detection
  const existingFiles = await db.file.findMany({
    where: { workspaceId },
    select: { relativePath: true, checksumSha256: true },
  });
  const existingMap = new Map(
    existingFiles.map((f: { relativePath: string; checksumSha256: string }) => [
      f.relativePath,
      f.checksumSha256,
    ]),
  );

  function walkDir(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const abs = join(dir, entry);

      // Check symlinks
      let stat;
      try {
        stat = lstatSync(abs);
      } catch {
        continue;
      }

      if (stat.isSymbolicLink()) {
        if (!followSymlinks) continue;
        try {
          stat = statSync(abs);
        } catch {
          continue;
        }
      }

      let validatedAbs: string;
      try {
        validatedAbs = pathGuard.validate(abs);
      } catch (err) {
        log.warn({ path: abs, err }, 'Path escaped workspace, skipping');
        continue;
      }

      const rel = pathGuard.relative(validatedAbs);

      if (ignoreEngine.ignores(rel)) continue;

      if (stat.isDirectory()) {
        // Skip hidden dirs
        if (entry.startsWith('.')) continue;
        walkDir(abs);
        continue;
      }

      if (!stat.isFile()) continue;

      const ext = extname(entry).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(ext)) continue;
      if (stat.size > maxFileSizeBytes) {
        log.warn({ path: rel, size: formatBytes(stat.size) }, 'File too large, skipping');
        continue;
      }

      discovered.push({
        absolutePath: abs,
        relativePath: rel,
        checksumSha256: '', // Filled below
        mimeType: mimeTypes.lookup(entry) || 'application/octet-stream',
        fileSizeBytes: stat.size,
        modality: (MODALITY_MAP[ext] ?? 'text') as DiscoveredFile['modality'],
        isNew: false,
        hasChanged: false,
      });
    }
  }

  walkDir(targetPath);

  // Compute checksums and detect changes
  await Promise.all(
    discovered.map(async (file) => {
      file.checksumSha256 = await sha256File(file.absolutePath);
      const existingHash = existingMap.get(file.relativePath);
      file.isNew = !existingHash;
      file.hasChanged = force || (!file.isNew && existingHash !== file.checksumSha256);
    }),
  );

  return discovered;
}
