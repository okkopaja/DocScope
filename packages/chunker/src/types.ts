import type { Modality } from '@docscope/shared-types';
import type { ExtractedDocument } from '@docscope/extractor';

export interface ChunkerInput {
  fileId: string;
  extracted: ExtractedDocument;
  relativePath: string;
}

export interface Chunk {
  fileId: string;
  chunkIndex: number;
  contentText: string;
  tokenEstimate: number;
  modality: Modality;
  pageNumber: number | null;
  lineStart: number | null;
  lineEnd: number | null;
  sourceLocatorJson: unknown;
  idempotencyKey: string;
}

export interface Chunker {
  supports(modality: Modality): boolean;
  chunk(input: ChunkerInput): Chunk[];
}
