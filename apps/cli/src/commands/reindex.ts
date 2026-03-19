import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getDb, disconnectDb } from '@docscope/db';
import { createLogger } from '@docscope/shared-utils';
import { loadWorkspaceConfig, resolveApiKey } from '../utils/workspace.js';
import { runIngestionPipeline } from '../pipeline/ingest.js';

const log = createLogger('cli:reindex');

export function reindexCommand(): Command {
  return new Command('reindex')
    .description('Re-index changed files (or all with --force)')
    .option('--force', 'Force re-index every file regardless of checksum')
    .option('--concurrency <n>', 'Number of files to process in parallel', '3')
    .action(async (options: { force: boolean; concurrency: string }) => {
      try {
        const workspace = await loadWorkspaceConfig();
        const apiKey = await resolveApiKey(workspace.id);
        const db = getDb();

        const label = options.force ? 'Force re-indexing all files...' : 'Re-indexing changed files...';
        const spinner = ora(label).start();

        const result = await runIngestionPipeline({
          workspace,
          db,
          apiKey,
          targetPath: workspace.rootPath,
          force: options.force,
          concurrency: parseInt(options.concurrency, 10),
          onProgress: (msg: string) => {
            spinner.text = msg;
          },
        });

        spinner.succeed(chalk.green('Re-index complete'));

        console.log('\n' + chalk.bold('Summary:'));
        console.log(`  ${chalk.green('Indexed:')}  ${result.indexed}`);
        console.log(`  ${chalk.yellow('Skipped:')}  ${result.skipped}`);
        console.log(`  ${chalk.red('Failed:')}   ${result.failed}`);
        console.log(`  ${chalk.cyan('Duration:')} ${result.durationMs}ms\n`);
      } catch (err) {
        log.error({ err }, 'reindex failed');
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      } finally {
        await disconnectDb();
      }
    });
}
