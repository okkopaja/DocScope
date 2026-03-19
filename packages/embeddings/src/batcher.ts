import type { EmbeddingRequest } from './types.js';

const MAX_IMAGES_PER_BATCH = 6;
const MAX_PDF_PAGES_PER_BATCH = 6;
const MAX_TEXT_PER_BATCH = 100;

export interface Batch {
  requests: EmbeddingRequest[];
}

/**
 * EmbeddingBatcher — groups EmbeddingRequests into API-compliant batches.
 * Rules: ≤6 images per batch, ≤6 PDF pages per batch, ≤100 text per batch.
 */
export class EmbeddingBatcher {
  createBatches(requests: EmbeddingRequest[]): Batch[] {
    const textBatch: EmbeddingRequest[] = [];
    const codeBatch: EmbeddingRequest[] = [];
    const pdfBatch: EmbeddingRequest[] = [];
    const imageBatch: EmbeddingRequest[] = [];
    const batches: Batch[] = [];

    const flushBatch = (items: EmbeddingRequest[], maxSize: number) => {
      for (let i = 0; i < items.length; i += maxSize) {
        batches.push({ requests: items.slice(i, i + maxSize) });
      }
    };

    for (const req of requests) {
      switch (req.modality) {
        case 'text':
          textBatch.push(req);
          break;
        case 'code':
          codeBatch.push(req);
          break;
        case 'pdf':
          pdfBatch.push(req);
          break;
        case 'image':
          imageBatch.push(req);
          break;
      }
    }

    flushBatch(textBatch, MAX_TEXT_PER_BATCH);
    flushBatch(codeBatch, MAX_TEXT_PER_BATCH);
    flushBatch(pdfBatch, MAX_PDF_PAGES_PER_BATCH);
    flushBatch(imageBatch, MAX_IMAGES_PER_BATCH);

    return batches;
  }
}
