import { Command } from 'commander';
import chalk from 'chalk';
import { getDb, disconnectDb } from '@docscope/db';
import { GeminiEmbeddingClient } from '@docscope/embeddings';
import { KeychainStore } from '@docscope/security';
import { loadWorkspaceConfig } from '../utils/workspace.js';
import { existsSync, accessSync, constants } from 'node:fs';
import { join } from 'node:path';

interface CheckResult {
  name: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
  suggestion?: string;
}

function getStatusCode(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = (err as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

export function doctorCommand(): Command {
  return new Command('doctor')
    .description('Check workspace and system health')
    .action(async () => {
      const checks: CheckResult[] = [];

      console.log(chalk.bold('\n🩺 DocScope Doctor\n'));

      // 1. Workspace config
      let workspace: Awaited<ReturnType<typeof loadWorkspaceConfig>> | null = null;
      try {
        workspace = await loadWorkspaceConfig();
        checks.push({ name: 'Workspace config', status: 'ok', message: workspace.name });
      } catch (err) {
        checks.push({
          name: 'Workspace config',
          status: 'error',
          message: (err as Error).message,
          suggestion: 'Run `docscope init` to initialize a workspace',
        });
      }

      // 2. Workspace root readable
      if (workspace) {
        try {
          accessSync(workspace.rootPath, constants.R_OK);
          checks.push({ name: 'Workspace root', status: 'ok', message: workspace.rootPath });
        } catch {
          checks.push({
            name: 'Workspace root',
            status: 'error',
            message: `Cannot read: ${workspace.rootPath}`,
            suggestion: 'Check file system permissions',
          });
        }
      }

      // 3. .docscope directory
      if (workspace) {
        const docscopeDir = join(workspace.rootPath, '.docscope');
        if (existsSync(docscopeDir)) {
          checks.push({ name: '.docscope directory', status: 'ok', message: docscopeDir });
        } else {
          checks.push({
            name: '.docscope directory',
            status: 'error',
            message: 'Missing .docscope directory',
            suggestion: 'Run `docscope init`',
          });
        }
      }

      // 4. Postgres connection
      try {
        const db = getDb();
        await db.$queryRaw`SELECT 1`;
        checks.push({ name: 'Postgres connection', status: 'ok', message: 'Connected' });
      } catch (err) {
        checks.push({
          name: 'Postgres connection',
          status: 'error',
          message: (err as Error).message,
          suggestion: 'Ensure Docker is running: docker compose -f infra/docker/docker-compose.yml up -d',
        });
      }

      // 4.5 Redis connection
      try {
        const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
        const { createClient } = await import('redis');
        const client = createClient({ url: redisUrl });
        await client.connect();
        await client.ping();
        await client.disconnect();
        checks.push({ name: 'Redis connection', status: 'ok', message: 'Connected' });
      } catch (err) {
        checks.push({
          name: 'Redis connection',
          status: 'warn',
          message: (err as Error).message,
          suggestion: 'Ensure Redis is running: docker compose -f infra/docker/docker-compose.yml up -d',
        });
      }

      // 5. API key
      if (workspace) {
        const envKey = process.env['DOCSCOPE_API_KEY'] ?? process.env['GEMINI_API_KEY'];
        if (envKey) {
          // Test the key with a minimal embedding call
          try {
            const client = new GeminiEmbeddingClient({ apiKey: envKey });
            await client.embedSingle('health check');
            checks.push({ name: 'Gemini API key', status: 'ok', message: 'Valid (via env var)' });
          } catch (apiErr) {
            const status = getStatusCode(apiErr);
            const msg = status === 429
              ? 'API key valid but quota exceeded'
              : 'API key invalid or unreachable';
            checks.push({
              name: 'Gemini API key',
              status: status === 429 ? 'warn' : 'error',
              message: msg,
              suggestion: status === 429
                ? 'Wait for quota reset or upgrade at https://aistudio.google.com'
                : 'Check your Gemini API key at https://aistudio.google.com/app/apikey',
            });
          }
        } else {
          // Try keychain
          try {
            const keychain = new KeychainStore();
            const key = await keychain.get(`${workspace.id}:apiKey`);
            if (key) {
              const client = new GeminiEmbeddingClient({ apiKey: key });
              await client.embedSingle('health check');
              checks.push({ name: 'Gemini API key', status: 'ok', message: 'Valid (via keychain)' });
            } else {
              checks.push({
                name: 'Gemini API key',
                status: 'warn',
                message: 'No API key configured',
                suggestion: 'Run `docscope config set apiKey <key>` or set DOCSCOPE_API_KEY',
              });
            }
          } catch (apiErr) {
            const status = getStatusCode(apiErr);
            const msg = status === 429
              ? 'API key valid but quota exceeded'
              : 'API key invalid or unreachable';
            checks.push({
              name: 'Gemini API key',
              status: status === 429 ? 'warn' : 'error',
              message: msg,
              suggestion: status === 429
                ? 'Wait for quota reset or upgrade at https://aistudio.google.com'
                : 'Check your Gemini API key at https://aistudio.google.com/app/apikey',
            });
          }
        }
      }

      // Print results
      for (const check of checks) {
        const icon = check.status === 'ok' ? chalk.green('✓') : check.status === 'warn' ? chalk.yellow('⚠') : chalk.red('✗');
        const label = chalk.bold(check.name.padEnd(25));
        const msg =
          check.status === 'ok'
            ? chalk.green(check.message)
            : check.status === 'warn'
              ? chalk.yellow(check.message)
              : chalk.red(check.message);

        console.log(`  ${icon} ${label} ${msg}`);
        if (check.suggestion) {
          console.log(`    ${chalk.dim('→ ' + check.suggestion)}`);
        }
      }

      const errorCount = checks.filter((c) => c.status === 'error').length;
      const warnCount = checks.filter((c) => c.status === 'warn').length;
      const okCount = checks.filter((c) => c.status === 'ok').length;

      console.log('');
      console.log(
        `  ${chalk.green(`${okCount} OK`)}  ${chalk.yellow(`${warnCount} warnings`)}  ${chalk.red(`${errorCount} errors`)}\n`,
      );

      await disconnectDb();

      if (errorCount > 0) process.exit(1);
    });
}
