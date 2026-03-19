import { Command } from 'commander';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join, basename, resolve } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { getDb, disconnectDb } from '@docscope/db';
import { KeychainStore } from '@docscope/security';
import { WorkspaceConfigSchema } from '@docscope/shared-types';
import { createLogger } from '@docscope/shared-utils';

const log = createLogger('cli:init');

const DEFAULT_DOCSCOPEIGNORE = `# DocScope ignore rules
# .docscopeignore wins over .gitignore on conflict

# Dependency directories
node_modules/
.pnpm-store/
.yarn/

# Build output
dist/
build/
out/
.next/
.nuxt/

# Cache
.cache/
.turbo/
.vite/

# Environment files (never index these)
.env
.env.*
*.env

# Coverage / test artifacts
coverage/
.nyc_output/

# IDE
.idea/
.vscode/

# OS files
.DS_Store
Thumbs.db

# DocScope internal
.docscope/
`;

export function initCommand(): Command {
  return new Command('init')
    .description('Initialize a DocScope workspace in the current directory')
    .option('--name <name>', 'Workspace name (defaults to directory name)')
    .option('--no-keychain', 'Skip keychain prompt and use env var DOCSCOPE_API_KEY instead')
    .action(async (options: { name?: string; keychain: boolean }) => {
      const cwd = process.cwd();
      const defaultName = options.name ?? basename(cwd);

      console.log(chalk.bold.cyan('\n🔍 DocScope — Workspace Initialization\n'));

      // Check if already initialized
      try {
        await access(join(cwd, '.docscope', 'workspace.json'));
        console.log(chalk.yellow('⚠️  This directory is already a DocScope workspace.'));
        console.log(chalk.dim('   Run `docscope doctor` to check its health.\n'));
        process.exit(0);
      } catch {
        // Not yet initialized — proceed
      }

      // If no --name flag, prompt interactively
      let workspaceName = defaultName;
      if (!options.name) {
        const { default: inquirer } = await import('inquirer');
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Workspace name:',
            default: defaultName,
            validate: (v: string) => v.trim().length > 0 || 'Name cannot be empty',
          },
        ]);
        workspaceName = (answers as { name: string }).name;
      }

      const spinner = ora('Creating workspace...').start();

      try {
        // 1. Create .docscope directory
        const docscopeDir = join(cwd, '.docscope');
        await mkdir(docscopeDir, { recursive: true });
        await mkdir(join(docscopeDir, 'cache', 'previews'), { recursive: true });

        // 2. Write workspace.json
        const workspaceId = randomUUID();
        const config = WorkspaceConfigSchema.parse({
          id: workspaceId,
          name: workspaceName,
          rootPath: resolve(cwd),
          embeddingModel: 'gemini-embedding-2-preview',
          embeddingDimension: 1536,
          createdAt: new Date().toISOString(),
        });

        await writeFile(
          join(docscopeDir, 'workspace.json'),
          JSON.stringify(config, null, 2) + '\n',
          'utf8',
        );

        // 3. Write .docscopeignore
        const ignorePath = join(cwd, '.docscopeignore');
        try {
          await access(ignorePath);
          // File already exists — skip
        } catch {
          await writeFile(ignorePath, DEFAULT_DOCSCOPEIGNORE, 'utf8');
        }

        // 4. Insert workspace row in DB
        const db = getDb();
        await db.workspace.create({
          data: {
            id: workspaceId,
            name: workspaceName,
            rootPath: resolve(cwd),
            status: 'active',
            embeddingModel: config.embeddingModel,
            embeddingDimension: config.embeddingDimension,
          },
        });

        await db.auditLog.create({
          data: {
            workspaceId: workspaceId,
            action: 'workspace.init',
            actor: 'cli',
            details: { name: workspaceName, rootPath: resolve(cwd) },
          },
        });

        spinner.succeed(chalk.green('Workspace created!'));

        // 5. API key setup
        if (options.keychain !== false) {
          const { default: inquirer } = await import('inquirer');
          const { storeKey } = await inquirer.prompt<{ storeKey: boolean }>([
            {
              type: 'confirm',
              name: 'storeKey',
              message: 'Store Gemini API key in OS keychain?',
              default: true,
            },
          ]);

          if (storeKey) {
            const { apiKey } = await inquirer.prompt<{ apiKey: string }>([
              {
                type: 'password',
                name: 'apiKey',
                message: 'Enter your Gemini API key:',
                validate: (v: string) => v.trim().length > 0 || 'API key cannot be empty',
              },
            ]);

            const keychain = new KeychainStore();
            await keychain.set(`${workspaceId}:apiKey`, apiKey.trim());
            console.log(chalk.green('  ✓ API key stored securely in OS keychain'));
          } else {
            console.log(
              chalk.dim(
                '  ℹ️  Set DOCSCOPE_API_KEY environment variable or run `docscope config set apiKey <key>`',
              ),
            );
          }
        }

        // 6. Summary
        console.log('\n' + chalk.bold('Workspace Summary:'));
        console.log(`  ${chalk.cyan('Name:')}     ${workspaceName}`);
        console.log(`  ${chalk.cyan('ID:')}       ${workspaceId}`);
        console.log(`  ${chalk.cyan('Root:')}     ${resolve(cwd)}`);
        console.log(`  ${chalk.cyan('Model:')}    gemini-embedding-2-preview (1536d)`);
        console.log('');
        console.log(chalk.dim('Next steps:'));
        console.log(chalk.dim(`  docscope index .    # Index files in this directory`));
        console.log(chalk.dim(`  docscope search "..." # Semantic search`));
        console.log(chalk.dim(`  docscope ask "..."    # Grounded Q&A\n`));
      } catch (err) {
        spinner.fail(chalk.red('Initialization failed'));
        log.error({ err }, 'init failed');
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      } finally {
        await disconnectDb();
      }
    });
}
