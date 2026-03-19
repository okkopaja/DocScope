import type { Modality } from '@docscope/shared-types';
import { estimateTokens } from '@docscope/shared-utils';
import type { Chunker, ChunkerInput, Chunk } from './types.js';
import { makeChunk } from './text-chunker.js';

const TARGET_TOKENS = 600;
const HARD_CAP_TOKENS = 1500;

export class PdfChunker implements Chunker {
  supports(modality: Modality): boolean {
    return modality === 'pdf';
  }

  chunk(input: ChunkerInput): Chunk[] {
    const { fileId, extracted } = input;
    const chunks: Chunk[] = [];
    let chunkIndex = 0;

    // Split by form-feed characters (page breaks in pdf-parse output)
    const pages = extracted.text.split('\f');

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const pageNumber = pageIdx + 1;
      const pageText = (pages[pageIdx] ?? '').trim();
      if (!pageText) continue;

      const pageTokens = estimateTokens(pageText);

      if (pageTokens <= HARD_CAP_TOKENS) {
        // Page fits in one chunk
        chunks.push(makeChunk(fileId, chunkIndex++, pageText, 'pdf', pageNumber, null, null));
      } else {
        // Long page: split into semantic blocks (paragraphs)
        const paragraphs = pageText.split(/\n{2,}/).filter((p: string) => p.trim().length > 0);
        let buffer = '';

        for (const para of paragraphs) {
          if (estimateTokens(buffer) + estimateTokens(para) > HARD_CAP_TOKENS && buffer.trim()) {
            chunks.push(makeChunk(fileId, chunkIndex++, buffer.trim(), 'pdf', pageNumber, null, null));
            buffer = '';
          }
          buffer += para + '\n\n';

          if (estimateTokens(buffer) >= TARGET_TOKENS) {
            chunks.push(makeChunk(fileId, chunkIndex++, buffer.trim(), 'pdf', pageNumber, null, null));
            buffer = '';
          }
        }

        if (buffer.trim()) {
          chunks.push(makeChunk(fileId, chunkIndex++, buffer.trim(), 'pdf', pageNumber, null, null));
        }
      }
    }

    return chunks;
  }
}
