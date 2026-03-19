import type { Modality } from '@docscope/shared-types';

export interface EmbeddingRequest {
  idempotencyKey: string;
  contentText: string;
  modality: Modality;
}

export interface EmbeddingResult {
  idempotencyKey: string;
  vector: number[];
  modelName: string;
  dimension: number;
}
