import type { Modality, SourceLocator } from '@docscope/shared-types';

export interface FileInput {
  absolutePath: string;
  relativePath: string;
  mimeType: string;
  fileSizeBytes: number;
}

export interface PreviewHint {
  type: 'thumbnail' | 'page_image';
  pageNumber?: number;
  widthPx?: number;
  heightPx?: number;
}

export interface ExtractedDocument {
  text: string;
  metadata: Record<string, unknown>;
  modality: Modality;
  locators: SourceLocator[];
  previewHints: PreviewHint[];
}

export interface Extractor {
  supports(mime: string, path: string): boolean;
  extract(input: FileInput): Promise<ExtractedDocument>;
}
