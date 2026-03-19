import type { Modality } from '@docscope/shared-types';
import type { Chunker, ChunkerInput, Chunk } from './types.js';
import { makeChunk } from './text-chunker.js';

export class ImageChunker implements Chunker {
  supports(modality: Modality): boolean {
    return modality === 'image';
  }

  chunk(input: ChunkerInput): Chunk[] {
    const { fileId, extracted } = input;
    // Images always produce a single primary chunk containing the textual description
    return [makeChunk(fileId, 0, extracted.text, 'image', null, null, null)];
  }
}
