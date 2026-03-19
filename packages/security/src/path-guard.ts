import { resolve, normalize, relative, sep } from 'node:path';
import { lstatSync, realpathSync } from 'node:fs';

/**
 * PathGuard — validates all file-system reads/writes stay inside a workspace root.
 * Rejects path traversal attacks and (by default) symlinks pointing outside the root.
 */
export class PathGuard {
  private readonly absRoot: string;
  private readonly allowSymlinks: boolean;

  constructor(rootPath: string, options: { allowSymlinks?: boolean } = {}) {
    this.absRoot = resolve(normalize(rootPath));
    this.allowSymlinks = options.allowSymlinks ?? false;
  }

  /**
   * Validates that `targetPath` is within the workspace root.
   * Returns the resolved absolute path.
   * @throws if path escapes root or is a symlink pointing outside root (unless allowSymlinks=true)
   */
  validate(targetPath: string): string {
    const abs = resolve(this.absRoot, targetPath);

    // Ensure the lexical path stays within root
    if (!abs.startsWith(this.absRoot + sep) && abs !== this.absRoot) {
      throw new Error(
        `PathGuard: path traversal rejected — "${targetPath}" resolves outside workspace root "${this.absRoot}"`,
      );
    }

    // Check symlinks
    try {
      const stat = lstatSync(abs);
      if (stat.isSymbolicLink()) {
        if (!this.allowSymlinks) {
          throw new Error(
            `PathGuard: symlinks are disabled — "${targetPath}" is a symbolic link`,
          );
        }
        
        // Harden symlink handling to verify resolved targets stay inside the workspace root.
        const real = realpathSync(abs);
        if (!real.startsWith(this.absRoot + sep) && real !== this.absRoot) {
          throw new Error(
            `PathGuard: symlink path traversal rejected — "${targetPath}" resolves outside workspace root "${this.absRoot}" to "${real}"`,
          );
        }
      }
    } catch (err) {
      if ((err as { code?: string }).code !== 'ENOENT') {
        throw err;
      }
      // File doesn't exist yet — lexical check above is sufficient
    }

    return abs;
  }

  /**
   * Returns the relative path from root to `absolutePath`.
   */
  relative(absolutePath: string): string {
    return relative(this.absRoot, absolutePath).replace(/\\/g, '/');
  }

  get root(): string {
    return this.absRoot;
  }
}
