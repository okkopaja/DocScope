import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type { Extractor, FileInput, ExtractedDocument } from './types.js';
import type { SourceLocator } from '@docscope/shared-types';

export class PdfExtractor implements Extractor {
  supports(mime: string, path: string): boolean {
    return mime === 'application/pdf' || extname(path).toLowerCase() === '.pdf';
  }

  async extract(input: FileInput): Promise<ExtractedDocument> {
    // Lazy-import pdf-parse to avoid startup cost
    const pdfParse = (await import('pdf-parse')).default;

    const buffer = await readFile(input.absolutePath);
    const data = await pdfParse(buffer);

    // pdf-parse doesn't expose per-page text natively; we use the full text
    // and build locators from estimated page boundaries.
    const fullText = data.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const pageCount = data.numpages;

    // Build per-page locators by splitting on form-feed characters (\f)
    const pages = fullText.split('\f');
    const locators: SourceLocator[] = pages.map((_, i) => ({
      type: 'page',
      pageNumber: i + 1,
    }));

    return {
      text: fullText,
      metadata: {
        pageCount,
        author: data.info?.Author ?? null,
        title: data.info?.Title ?? null,
        producer: data.info?.Producer ?? null,
      },
      modality: 'pdf',
      locators,
      previewHints: Array.from({ length: Math.min(pageCount, 5) }, (_, i) => ({
        type: 'page_image' as const,
        pageNumber: i + 1,
      })),
    };
  }
}
