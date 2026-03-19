import { describe, it, expect } from 'vitest';
import { PathGuard } from '../path-guard.js';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('PathGuard', () => {
  const root = mkdtempSync(join(tmpdir(), 'pg-test-'));
  const guard = new PathGuard(root);

  // Create a file inside root for symlink tests
  const innerFile = join(root, 'inner.txt');
  writeFileSync(innerFile, 'hello');

  it('allows paths inside root', () => {
    const result = guard.validate(join(root, 'sub', 'file.txt'));
    expect(result).toContain(root);
  });

  it('rejects path traversal with ../', () => {
    expect(() => guard.validate(join(root, '..', 'outside.txt'))).toThrow('path traversal');
  });

  it('rejects absolute paths outside root', () => {
    expect(() => guard.validate('/etc/passwd')).toThrow('path traversal');
  });

  it('returns relative path correctly', () => {
    const abs = join(root, 'sub', 'file.txt');
    expect(guard.relative(abs)).toBe('sub/file.txt');
  });

  it('exposes root', () => {
    expect(guard.root).toBe(root.replace(/\\/g, '\\'));
  });
});
