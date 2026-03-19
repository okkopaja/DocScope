import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const IndexStatusSchema = z.enum(['pending', 'indexing', 'indexed', 'failed', 'deleted']);
export type IndexStatus = z.infer<typeof IndexStatusSchema>;

export const JobStateSchema = z.enum([
  'queued',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled',
]);
export type JobState = z.infer<typeof JobStateSchema>;

export const ModalitySchema = z.enum(['text', 'code', 'pdf', 'image']);
export type Modality = z.infer<typeof ModalitySchema>;

export const FileTypeSchema = z.enum([
  'txt',
  'md',
  'json',
  'csv',
  'ts',
  'js',
  'tsx',
  'jsx',
  'py',
  'java',
  'go',
  'html',
  'css',
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'webp',
]);
export type FileType = z.infer<typeof FileTypeSchema>;

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

export const WorkspaceConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  rootPath: z.string().min(1),
  embeddingModel: z.string().default('gemini-embedding-2-preview'),
  embeddingDimension: z.number().int().positive().default(1536),
  createdAt: z.string().datetime(),
});
export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export const FileRecordSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  relativePath: z.string(),
  absolutePath: z.string(),
  checksumSha256: z.string(),
  mimeType: z.string(),
  fileSizeBytes: z.number(),
  modality: ModalitySchema,
  indexStatus: IndexStatusSchema,
  lastError: z.string().nullable(),
  indexedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type FileRecord = z.infer<typeof FileRecordSchema>;

// ---------------------------------------------------------------------------
// Source Locators
// ---------------------------------------------------------------------------

export const SourceLocatorSchema = z.object({
  type: z.enum(['page', 'line_range', 'offset']),
  pageNumber: z.number().int().optional(),
  lineStart: z.number().int().optional(),
  lineEnd: z.number().int().optional(),
  charOffset: z.number().int().optional(),
});
export type SourceLocator = z.infer<typeof SourceLocatorSchema>;

// ---------------------------------------------------------------------------
// Chunks
// ---------------------------------------------------------------------------

export const ChunkRecordSchema = z.object({
  id: z.string().uuid(),
  fileId: z.string().uuid(),
  chunkIndex: z.number().int().nonnegative(),
  contentText: z.string(),
  tokenEstimate: z.number().int().positive(),
  modality: ModalitySchema,
  pageNumber: z.number().int().nullable(),
  lineStart: z.number().int().nullable(),
  lineEnd: z.number().int().nullable(),
  sourceLocatorJson: z.unknown().nullable(),
  idempotencyKey: z.string(),
  createdAt: z.string().datetime(),
});
export type ChunkRecord = z.infer<typeof ChunkRecordSchema>;

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export const SearchRequestSchema = z.object({
  query: z.string().min(1).max(2000),
  workspaceId: z.string().uuid(),
  type: ModalitySchema.optional(),
  top: z.number().int().min(1).max(100).default(10),
});
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export const SearchResultSchema = z.object({
  chunkId: z.string().uuid(),
  fileId: z.string().uuid(),
  filePath: z.string(),
  snippet: z.string(),
  score: z.number(),
  rank: z.number().int(),
  modality: ModalitySchema,
  pageNumber: z.number().int().nullable(),
  lineStart: z.number().int().nullable(),
  lineEnd: z.number().int().nullable(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

// ---------------------------------------------------------------------------
// Ask
// ---------------------------------------------------------------------------

export const AskRequestSchema = z.object({
  question: z.string().min(1).max(4000),
  workspaceId: z.string().uuid(),
  type: ModalitySchema.optional(),
  top: z.number().int().min(1).max(20).default(5),
  answerModel: z.string().default('gemini-2.5-flash'),
});
export type AskRequest = z.infer<typeof AskRequestSchema>;

export const CitationSchema = z.object({
  filePath: z.string(),
  snippet: z.string(),
  pageNumber: z.number().int().nullable(),
  lineStart: z.number().int().nullable(),
  lineEnd: z.number().int().nullable(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const AskResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(CitationSchema),
  evidence: z.array(SearchResultSchema),
  durationMs: z.number().int(),
});
export type AskResponse = z.infer<typeof AskResponseSchema>;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const ConfigKeySchema = z.enum([
  'apiKey',
  'embeddingDimension',
  'answerModel',
  'dashboardPort',
  'followSymlinks',
  'maxFileSizeMb',
]);
export type ConfigKey = z.infer<typeof ConfigKeySchema>;

export const ConfigValueValidators = {
  apiKey: z.string().min(1),
  embeddingDimension: z.number().int().refine((v) => [128, 256, 512, 768, 1536, 3072].includes(v)),
  answerModel: z.enum(['gemini-2.5-flash', 'gemini-2.5-pro']),
  dashboardPort: z.number().int().min(1024).max(65535),
  followSymlinks: z.boolean(),
  maxFileSizeMb: z.number().int().min(1).max(500),
} as const;

// ---------------------------------------------------------------------------
// API Request / Response schemas
// ---------------------------------------------------------------------------

export const ApiSearchQuerySchema = z.object({
  q: z.string().min(1),
  type: ModalitySchema.optional(),
  top: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 10)),
});

export const ApiAskBodySchema = AskRequestSchema.omit({ workspaceId: true });

export const ApiIndexBodySchema = z.object({
  force: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// Discovered File (internal, used by ingestion pipeline)
// ---------------------------------------------------------------------------

export const DiscoveredFileSchema = z.object({
  absolutePath: z.string(),
  relativePath: z.string(),
  checksumSha256: z.string(),
  mimeType: z.string(),
  fileSizeBytes: z.number(),
  modality: ModalitySchema,
  isNew: z.boolean(),
  hasChanged: z.boolean(),
});
export type DiscoveredFile = z.infer<typeof DiscoveredFileSchema>;
