import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getDb, disconnectDb } from '@docscope/db';
import { createLogger } from '@docscope/shared-utils';
import { loadWorkspaceConfig, resolveApiKey } from '../utils/workspace.js';
import { runIngestionPipeline } from '../pipeline/ingest.js';

const log = createLogger('cli:index');

export function indexCommand(): Command {
  return new Command('index')
    .description('Index files in the workspace (or a specific path)')
    .argument('[path]', 'Path to index (defaults to workspace root)')
    .option('--force', 'Force re-index even if checksum unchanged')
    .option('--concurrency <n>', 'Number of files to process in parallel', '3')
    .action(async (targetPath: string | undefined, options: { force: boolean; concurrency: string }) => {
      try {
        const workspace = await loadWorkspaceConfig();
        const apiKey = await resolveApiKey(workspace.id);
        const db = getDb();

        const concurrencyNum = parseInt(options.concurrency, 10);
        if (isNaN(concurrencyNum) || concurrencyNum < 1 || concurrencyNum > 20) {
          console.error(chalk.red('--concurrency must be a number between 1 and 20'));
          process.exit(1);
        }

        // Check if consent already given
        const consentSetting = await db.workspaceSetting.findUnique({
          where: { workspaceId_key: { workspaceId: workspace.id, key: 'uploadConsent' } },
        });

        if (!consentSetting) {
          const { default: inquirer } = await import('inquirer');
          const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
            {
              type: 'confirm',
              name: 'confirmed',
              message: chalk.yellow(
                `This will send file contents to the Gemini API for embedding. Proceed?`,
              ),
              default: true,
            },
          ]);

          if (!confirmed) {
            console.log(chalk.dim('Cancelled.'));
            await disconnectDb();
            process.exit(0);
          }

          await db.workspaceSetting.create({
            data: { workspaceId: workspace.id, key: 'uploadConsent', value: 'true' },
          });
        }

        const spinner = ora('Discovering files...').start();

        const result = await runIngestionPipeline({
          workspace,
          db,
          apiKey,
          targetPath: targetPath ?? workspace.rootPath,
          force: options.force,
          concurrency: parseInt(options.concurrency, 10),
          onProgress: (msg: string) => {
            spinner.text = msg;
          },
        });

        spinner.succeed(chalk.green('Indexing complete'));

        console.log('\n' + chalk.bold('Summary:'));
        console.log(`  ${chalk.green('Indexed:')}  ${result.indexed}`);
        console.log(`  ${chalk.yellow('Skipped:')}  ${result.skipped}`);
        console.log(`  ${chalk.red('Failed:')}   ${result.failed}`);
        console.log(`  ${chalk.cyan('Duration:')} ${result.durationMs}ms\n`);

        if (result.errors.length > 0) {
          console.log(chalk.yellow('Failed files:'));
          for (const e of result.errors) {
            console.log(`  ${chalk.red('✗')} ${e.path}: ${e.message}`);
          }
          console.log('');
        }
      } catch (err) {
        log.error({ err }, 'index failed');
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      } finally {
        await disconnectDb();
      }
    });
}
