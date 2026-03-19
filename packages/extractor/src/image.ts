import { extname } from 'node:path';
import type { Extractor, FileInput, ExtractedDocument } from './types.js';

const SUPPORTED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

export class ImageExtractor implements Extractor {
  supports(mime: string, path: string): boolean {
    const ext = extname(path).toLowerCase();
    return SUPPORTED_MIMES.has(mime) || SUPPORTED_EXTENSIONS.has(ext);
  }

  async extract(input: FileInput): Promise<ExtractedDocument> {
    // Lazy-import sharp to avoid startup cost
    const sharp = (await import('sharp')).default;

    const image = sharp(input.absolutePath);
    const metadata = await image.metadata();

    const description = [
      `Image file: ${input.relativePath}`,
      metadata.width && metadata.height ? `Dimensions: ${metadata.width}x${metadata.height}px` : '',
      metadata.format ? `Format: ${metadata.format}` : '',
      metadata.space ? `Color space: ${metadata.space}` : '',
      metadata.channels ? `Channels: ${metadata.channels}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    // Thumbnail generation is handled by the ingest pipeline, not during extraction.

    return {
      text: description,
      metadata: {
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        format: metadata.format ?? null,
        colorSpace: metadata.space ?? null,
        channels: metadata.channels ?? null,
        hasAlpha: metadata.hasAlpha ?? false,
        fileSizeBytes: input.fileSizeBytes,
      },
      modality: 'image',
      locators: [],
      previewHints: [
        {
          type: 'thumbnail',
          widthPx: 256,
          heightPx: 256,
        },
      ],
    };
  }
}
