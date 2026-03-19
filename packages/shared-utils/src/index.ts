import process from 'node:process';
import pino, { type Logger } from 'pino';
import { createHash } from 'node:crypto';
import { createReadStream as fsCreateReadStream } from 'node:fs';
import { normalize, resolve, relative, isAbsolute, sep } from 'node:path';

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const SECRET_PATTERNS = [
  /GEMINI_API_KEY=\S+/gi,
  /DOCSCOPE_API_KEY=\S+/gi,
  /DOCSCOPE_MASTER_KEY=\S+/gi,
  /apiKey:\s*['"]?\S+['"]?/gi,
  /[A-Za-z]:\\[^\s,'"]+/g,                          // Windows absolute paths
  /\/(?:home|Users|root|var|etc|tmp)\/[^\s,'"]+/g,  // Unix absolute paths
];

export function createLogger(name: string): Logger {
  return pino({
    name,
    level: process.env['LOG_LEVEL'] ?? 'info',
    redact: {
      paths: ['apiKey', 'key', 'secret', 'token', 'password', 'authorization'],
      censor: '****',
    },
    serializers: {
      err: pino.stdSerializers.err,
    },
  });
}

// ---------------------------------------------------------------------------
// SHA-256 checksum
// ---------------------------------------------------------------------------

export async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = fsCreateReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export function sha256String(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

// ---------------------------------------------------------------------------
// Path utilities
// ---------------------------------------------------------------------------

/**
 * Resolves `target` relative to `root` and ensures the result stays within
 * `root`. Throws if the resolved path escapes the root (path traversal).
 */
export function normalizePath(root: string, target: string): string {
  const absRoot = resolve(normalize(root));
  const absTarget = isAbsolute(target) ? resolve(normalize(target)) : resolve(absRoot, target);

  if (!absTarget.startsWith(absRoot + sep) && absTarget !== absRoot) {
    throw new Error(`Path traversal detected: "${target}" escapes root "${root}"`);
  }

  return absTarget;
}

export function toRelativePath(root: string, absolutePath: string): string {
  return relative(root, absolutePath).replace(/\\/g, '/');
}

// ---------------------------------------------------------------------------
// Token estimation (rough, GPT-style ~4 chars/token)
// ---------------------------------------------------------------------------

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatBytes(n: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = n;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

// ---------------------------------------------------------------------------
// Redaction helper (for logs that bypass Pino's redact)
// ---------------------------------------------------------------------------

export function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '****');
  }
  return result;
}
