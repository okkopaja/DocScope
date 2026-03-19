import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PathGuard } from '../path-guard.js';

const isWindows = process.platform === 'win32';
const testIfSymlink = isWindows ? it.skip : it;

describe('PathGuard symlink policy', () => {
  testIfSymlink('rejects symlinks by default', () => {
    const root = mkdtempSync(join(tmpdir(), 'pg-symlink-'));
    const target = join(root, 'target.txt');
    const link = join(root, 'link.txt');
    writeFileSync(target, 'data');
    symlinkSync(target, link);

    const guard = new PathGuard(root);
    expect(() => guard.validate(link)).toThrow('symlinks are disabled');

    rmSync(root, { recursive: true, force: true });
  });

  testIfSymlink('allows symlinks when enabled and inside root', () => {
    const root = mkdtempSync(join(tmpdir(), 'pg-symlink-'));
    const target = join(root, 'target.txt');
    const link = join(root, 'link.txt');
    writeFileSync(target, 'data');
    symlinkSync(target, link);

    const guard = new PathGuard(root, { allowSymlinks: true });
    const validated = guard.validate(link);
    expect(validated).toContain(root);

    rmSync(root, { recursive: true, force: true });
  });
});
