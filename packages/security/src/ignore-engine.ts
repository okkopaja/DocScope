import ignore, { type Ignore, type Options } from 'ignore';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Default patterns always ignored regardless of user config. */
const BUILTIN_IGNORES = [
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.cache',
  '.parcel-cache',
  '.turbo',
  'coverage',
  '.nyc_output',
  '*.log',
  '*.tsbuildinfo',
  '.env',
  '.env.*',
  '.docscope',
  '.DS_Store',
  'Thumbs.db',
];

/**
 * IgnoreEngine — merges builtin + .gitignore + .docscopeignore rules.
 * .docscopeignore wins over .gitignore on conflict (last-write-wins in `ignore` lib).
 *
 * Usage:
 *   const engine = IgnoreEngine.fromWorkspace('/path/to/workspace');
 *   if (!engine.ignores('src/foo.ts')) { // process file }
 */
export class IgnoreEngine {
  private readonly ig: Ignore;
  private readonly root: string;

  constructor(root: string, patterns: string[]) {
    this.root = root;
    this.ig = createIgnore();
    this.ig.add(patterns);
  }

  static fromWorkspace(root: string): IgnoreEngine {
    const patterns: string[] = [...BUILTIN_IGNORES];

    // Layer 1: .gitignore
    const gitignorePath = join(root, '.gitignore');
    if (existsSync(gitignorePath)) {
      const content = readFileSync(gitignorePath, 'utf8');
      patterns.push(...parseIgnoreFile(content));
    }

    // Layer 2: .docscopeignore (wins on conflict because added last)
    const docscopeignorePath = join(root, '.docscopeignore');
    if (existsSync(docscopeignorePath)) {
      const content = readFileSync(docscopeignorePath, 'utf8');
      patterns.push(...parseIgnoreFile(content));
    }

    return new IgnoreEngine(root, patterns);
  }

  /**
   * Returns `true` if the relative path should be ignored.
   * @param relativePath - Path relative to workspace root (forward slashes preferred)
   */
  ignores(relativePath: string): boolean {
    const normalized = relativePath.replace(/\\/g, '/');
    return this.ig.ignores(normalized);
  }

  /**
   * Filters an array of relative paths, returning only those NOT ignored.
   */
  filter(relativePaths: string[]): string[] {
    return relativePaths.filter((p) => !this.ignores(p));
  }
}

function parseIgnoreFile(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

function createIgnore(options?: Options): Ignore {
  const factory =
    (ignore as unknown as { default?: (opts?: Options) => Ignore }).default ??
    (ignore as unknown as (opts?: Options) => Ignore);
  return factory(options);
}
