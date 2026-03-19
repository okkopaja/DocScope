import type { Extractor, FileInput, ExtractedDocument } from './types.js';
import { TextExtractor } from './text.js';
import { CodeExtractor } from './code.js';
import { PdfExtractor } from './pdf.js';
import { ImageExtractor } from './image.js';
import { createLogger } from '@docscope/shared-utils';

const log = createLogger('extractor:registry');

/**
 * ExtractorRegistry — auto-selects the correct extractor for a given file.
 *
 * Extractors are tried in registration order; the first `supports()` match wins.
 */
export class ExtractorRegistry {
  private readonly extractors: Extractor[];

  constructor(extractors?: Extractor[]) {
    this.extractors = extractors ?? [
      new CodeExtractor(),
      new PdfExtractor(),
      new ImageExtractor(),
      new TextExtractor(), // Fallback — broadest support
    ];
  }

  find(mimeType: string, filePath: string): Extractor | null {
    return this.extractors.find((e) => e.supports(mimeType, filePath)) ?? null;
  }

  async extract(input: FileInput): Promise<ExtractedDocument> {
    const extractor = this.find(input.mimeType, input.absolutePath);
    if (!extractor) {
      throw new Error(
        `No extractor found for mime=${input.mimeType}, path=${input.absolutePath}`,
      );
    }
    log.debug({ path: input.relativePath, mime: input.mimeType }, 'Extracting file');
    return extractor.extract(input);
  }
}
