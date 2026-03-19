import type { Chunker, ChunkerInput, Chunk } from './types.js';
import { TextChunker } from './text-chunker.js';
import { CodeChunker } from './code-chunker.js';
import { PdfChunker } from './pdf-chunker.js';
import { ImageChunker } from './image-chunker.js';

export class ChunkerRegistry {
  private readonly chunkers: Chunker[];

  constructor(chunkers?: Chunker[]) {
    this.chunkers = chunkers ?? [
      new TextChunker(),
      new CodeChunker(),
      new PdfChunker(),
      new ImageChunker(),
    ];
  }

  chunk(input: ChunkerInput): Chunk[] {
    const modality = input.extracted.modality;
    const chunker = this.chunkers.find((c) => c.supports(modality));
    if (!chunker) {
      throw new Error(`No chunker found for modality: ${modality}`);
    }
    return chunker.chunk(input);
  }
}
