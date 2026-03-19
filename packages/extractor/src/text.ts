import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type { Extractor, FileInput, ExtractedDocument } from './types.js';

const SUPPORTED_EXTENSIONS = new Set(['.txt', '.md', '.json', '.csv', '.html', '.css', '.xml', '.yaml', '.yml', '.toml']);
const SUPPORTED_MIMES = new Set([
  'text/plain',
  'text/markdown',
  'application/json',
  'text/csv',
  'text/html',
  'text/css',
  'text/xml',
  'application/xml',
  'text/yaml',
]);

export class TextExtractor implements Extractor {
  supports(mime: string, path: string): boolean {
    const ext = extname(path).toLowerCase();
    return SUPPORTED_MIMES.has(mime) || SUPPORTED_EXTENSIONS.has(ext) || mime.startsWith('text/');
  }

  async extract(input: FileInput): Promise<ExtractedDocument> {
    const raw = await readFile(input.absolutePath, 'utf8');
    // Normalize line endings
    const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    return {
      text,
      metadata: {
        encoding: 'utf-8',
        lineCount: text.split('\n').length,
        extension: extname(input.absolutePath).toLowerCase(),
      },
      modality: 'text',
      locators: [],
      previewHints: [],
    };
  }
}
