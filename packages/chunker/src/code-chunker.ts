import type { Modality } from '@docscope/shared-types';
import { estimateTokens } from '@docscope/shared-utils';
import type { Chunker, ChunkerInput, Chunk } from './types.js';
import { makeChunk } from './text-chunker.js';

// Regex to detect function/class/module boundaries in common languages
const BOUNDARY_REGEX =
  /^(?:export\s+)?(?:async\s+)?(?:function|class|const\s+\w+\s*=\s*(?:async\s+)?\(|def\s|func\s|public\s+(?:static\s+)?(?:class|void|int|string)|module\s)/m;

const TARGET_TOKENS = 600;
const HARD_CAP_TOKENS = 1500;

export class CodeChunker implements Chunker {
  supports(modality: Modality): boolean {
    return modality === 'code';
  }

  chunk(input: ChunkerInput): Chunk[] {
    const { fileId, extracted } = input;
    const lines = extracted.text.split('\n');
    const chunks: Chunk[] = [];
    let chunkIndex = 0;

    // 1. Synthetic file summary chunk
    const filePath = (extracted.metadata['relativePath'] as string | undefined) ?? input.relativePath;
    const language = (extracted.metadata['language'] as string | undefined) ?? 'unknown';
    const summaryText = `File: ${filePath}\nLanguage: ${language}\nLines: ${lines.length}\n\n${lines.slice(0, 20).join('\n')}`;
    chunks.push(makeChunk(fileId, chunkIndex++, summaryText, 'code', null, 0, Math.min(19, lines.length - 1)));

    // 2. Split on function/class boundaries
    const blocks: Array<{ start: number; lines: string[] }> = [];
    let currentBlock: string[] = [];
    let currentStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (i > 0 && BOUNDARY_REGEX.test(line) && currentBlock.length > 0) {
        blocks.push({ start: currentStart, lines: currentBlock });
        currentBlock = [];
        currentStart = i;
      }
      currentBlock.push(line);
    }
    if (currentBlock.length > 0) {
      blocks.push({ start: currentStart, lines: currentBlock });
    }

    // 3. Emit chunks from blocks (merge small blocks, split large ones)
    let buffer: string[] = [];
    let bufferStart = 0;

    const flushBuffer = (end: number) => {
      if (!buffer.length) return;
      const text = buffer.join('\n');
      chunks.push(makeChunk(fileId, chunkIndex++, text, 'code', null, bufferStart, end));
      buffer = [];
    };

    for (const block of blocks) {
      const blockText = block.lines.join('\n');
      const blockTokens = estimateTokens(blockText);

      if (estimateTokens(buffer.join('\n')) + blockTokens > HARD_CAP_TOKENS && buffer.length > 0) {
        flushBuffer(block.start - 1);
        bufferStart = block.start;
      }

      if (!buffer.length) {
        bufferStart = block.start;
      }

      buffer.push(...block.lines);

      if (estimateTokens(buffer.join('\n')) >= TARGET_TOKENS) {
        flushBuffer(block.start + block.lines.length - 1);
        bufferStart = block.start + block.lines.length;
      }
    }

    if (buffer.length > 0) {
      flushBuffer(lines.length - 1);
    }

    return chunks;
  }
}
