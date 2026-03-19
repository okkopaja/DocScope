import { createHash } from 'node:crypto';
import { estimateTokens } from '@docscope/shared-utils';
import type { Modality } from '@docscope/shared-types';
import type { Chunker, ChunkerInput, Chunk } from './types.js';

const TARGET_TOKENS = 600;
const OVERLAP_TOKENS = 100;
const HARD_CAP_TOKENS = 1500;

export class TextChunker implements Chunker {
  supports(modality: Modality): boolean {
    return modality === 'text';
  }

  chunk(input: ChunkerInput): Chunk[] {
    const { fileId, extracted } = input;
    const text = extracted.text;
    const chunks: Chunk[] = [];

    // Split on double newlines (paragraph boundaries) or heading markers
    const paragraphs = text.split(/\n{2,}/).filter((p: string) => p.trim().length > 0);

    let chunkIndex = 0;
    let buffer = '';
    let bufferLineStart = 0;

    const flush = (lineStart: number, lineEnd: number) => {
      if (!buffer.trim()) return;
      const trimmed = buffer.trim();
      chunks.push(makeChunk(fileId, chunkIndex++, trimmed, 'text', null, lineStart, lineEnd));
      buffer = '';
    };

    let currentLine = 0;
    for (const paragraph of paragraphs) {
      const paraLines = paragraph.split('\n').length;
      const paraTokens = estimateTokens(paragraph);

      // If adding this paragraph would exceed hard cap, flush first with overlap
      if (estimateTokens(buffer) + paraTokens > HARD_CAP_TOKENS && buffer.trim()) {
        const lineEnd = currentLine - 1;
        flush(bufferLineStart, lineEnd);
        // Overlap: start new buffer with partial content of flushed chunk
        const words = buffer.split(' ');
        const overlapWords = words.slice(-Math.round(OVERLAP_TOKENS / 4));
        buffer = overlapWords.join(' ') + '\n\n';
        bufferLineStart = Math.max(0, lineEnd - 3);
      }

      if (!buffer) {
        bufferLineStart = currentLine;
      }

      buffer += paragraph + '\n\n';
      currentLine += paraLines + 1;

      // Flush if we've reached target size
      if (estimateTokens(buffer) >= TARGET_TOKENS) {
        flush(bufferLineStart, currentLine - 1);
        bufferLineStart = currentLine;
      }
    }

    // Flush remainder
    if (buffer.trim()) {
      const totalLines = text.split('\n').length;
      flush(bufferLineStart, totalLines - 1);
    }

    return chunks;
  }
}

export function makeChunk(
  fileId: string,
  chunkIndex: number,
  contentText: string,
  modality: Modality,
  pageNumber: number | null,
  lineStart: number | null,
  lineEnd: number | null,
): Chunk {
  const idempotencyKey = createHash('sha256')
    .update(`${fileId}:${chunkIndex}:${contentText.slice(0, 200)}`)
    .digest('hex');

  return {
    fileId,
    chunkIndex,
    contentText,
    tokenEstimate: estimateTokens(contentText),
    modality,
    pageNumber,
    lineStart,
    lineEnd,
    sourceLocatorJson:
      pageNumber !== null
        ? { type: 'page', pageNumber }
        : lineStart !== null
          ? { type: 'line_range', lineStart, lineEnd }
          : null,
    idempotencyKey,
  };
}
