import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { WorkspaceConfigSchema, type WorkspaceConfig } from '@docscope/shared-types';

export async function loadWorkspaceConfig(cwd: string = process.cwd()): Promise<WorkspaceConfig> {
  const configPath = join(cwd, '.docscope', 'workspace.json');
  try {
    const raw = await readFile(configPath, 'utf8');
    return WorkspaceConfigSchema.parse(JSON.parse(raw));
  } catch (err) {
    const msg = (err as { code?: string }).code === 'ENOENT'
      ? 'Not a DocScope workspace. Run `docscope init` first.'
      : `Failed to read workspace config: ${(err as Error).message}`;
    throw new Error(msg);
  }
}

export async function resolveApiKey(workspaceId: string): Promise<string> {
  // Priority: env var > keychain
  const envKey = process.env['DOCSCOPE_API_KEY'] ?? process.env['GEMINI_API_KEY'];
  if (envKey) return envKey;

  const { KeychainStore } = await import('@docscope/security');
  const keychain = new KeychainStore();
  const key = await keychain.get(`${workspaceId}:apiKey`);

  if (!key) {
    throw new Error(
      'No API key found. Run `docscope config set apiKey <key>` or set DOCSCOPE_API_KEY environment variable.',
    );
  }

  return key;
}
