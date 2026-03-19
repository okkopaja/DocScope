import { readFile } from 'node:fs/promises';
import { extname, basename } from 'node:path';
import type { Extractor, FileInput, ExtractedDocument } from './types.js';

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescriptreact',
  '.js': 'javascript',
  '.jsx': 'javascriptreact',
  '.py': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.c': 'c',
  '.cpp': 'cpp',
  '.cs': 'csharp',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.sh': 'bash',
  '.bash': 'bash',
};

const SUPPORTED_EXTENSIONS = new Set(Object.keys(LANGUAGE_MAP));

export class CodeExtractor implements Extractor {
  supports(mime: string, path: string): boolean {
    const ext = extname(path).toLowerCase();
    return (
      SUPPORTED_EXTENSIONS.has(ext) ||
      mime === 'application/typescript' ||
      mime === 'text/javascript' ||
      mime === 'application/javascript' ||
      mime === 'text/x-python'
    );
  }

  async extract(input: FileInput): Promise<ExtractedDocument> {
    const raw = await readFile(input.absolutePath, 'utf8');
    const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const ext = extname(input.absolutePath).toLowerCase();
    const language = LANGUAGE_MAP[ext] ?? 'unknown';

    return {
      text,
      metadata: {
        language,
        fileName: basename(input.absolutePath),
        relativePath: input.relativePath,
        lineCount: text.split('\n').length,
      },
      modality: 'code',
      locators: [],
      previewHints: [],
    };
  }
}
