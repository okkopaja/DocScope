import { GoogleGenAI } from '@google/genai';
import { createLogger } from '@docscope/shared-utils';
import type { EmbeddingRequest, EmbeddingResult } from './types.js';

const log = createLogger('embeddings:client');

const DEFAULT_MODEL = 'gemini-embedding-2-preview';
const DEFAULT_DIMENSION = 1536;

export interface GeminiEmbeddingClientOptions {
  apiKey: string;
  model?: string;
  outputDimension?: number;
}

export class GeminiEmbeddingClient {
  private readonly ai: GoogleGenAI;
  private readonly model: string;
  private readonly outputDimension: number;

  constructor(options: GeminiEmbeddingClientOptions) {
    this.ai = new GoogleGenAI({ apiKey: options.apiKey });
    this.model = options.model ?? DEFAULT_MODEL;
    this.outputDimension = options.outputDimension ?? DEFAULT_DIMENSION;
  }

  async embedBatch(requests: EmbeddingRequest[]): Promise<EmbeddingResult[]> {
    if (requests.length === 0) return [];

    const results: EmbeddingResult[] = [];

    // Process requests — Gemini Embedding supports batch calls
    for (const req of requests) {
      const taskType = this.getTaskType(req.modality);

      const response = await this.ai.models.embedContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: req.contentText }] }],
        config: {
          taskType,
          outputDimensionality: this.outputDimension,
        },
      });

      const values = response.embeddings?.[0]?.values;
      if (!values) {
        throw new Error(`No embedding returned for idempotencyKey=${req.idempotencyKey}`);
      }

      results.push({
        idempotencyKey: req.idempotencyKey,
        vector: values,
        modelName: this.model,
        dimension: values.length,
      });

      log.debug({ key: req.idempotencyKey, dim: values.length }, 'Embedded chunk');
    }

    return results;
  }

  async embedSingle(text: string): Promise<number[]> {
    const response = await this.ai.models.embedContent({
      model: this.model,
      contents: [{ role: 'user', parts: [{ text }] }],
      config: {
        taskType: 'RETRIEVAL_QUERY',
        outputDimensionality: this.outputDimension,
      },
    });

    const values = response.embeddings?.[0]?.values;
    if (!values) {
      throw new Error('No embedding returned for query');
    }

    return values;
  }

  private getTaskType(modality: string): string {
    switch (modality) {
      case 'code':
        return 'CODE_RETRIEVAL_QUERY';
      default:
        return 'RETRIEVAL_DOCUMENT';
    }
  }
}
