import { Command } from 'commander';
import chalk from 'chalk';
import { getDb, disconnectDb } from '@docscope/db';
import { KeychainStore } from '@docscope/security';
import { ConfigKeySchema, ConfigValueValidators } from '@docscope/shared-types';
import { createLogger } from '@docscope/shared-utils';
import { loadWorkspaceConfig } from '../utils/workspace.js';

const log = createLogger('cli:config');

export function configCommand(): Command {
  const cmd = new Command('config').description('Manage workspace configuration');

  cmd
    .command('set <key> [value]')
    .description('Set a configuration value')
    .action(async (key: string, value: string | undefined) => {
      try {
        const validatedKey = ConfigKeySchema.parse(key);
        const workspace = await loadWorkspaceConfig();
        const db = getDb();

        let resolvedValue: string;

        // Secret keys — prompt if not provided
        if (validatedKey === 'apiKey') {
          if (!value) {
            const { default: inquirer } = await import('inquirer');
            const { apiKey } = await inquirer.prompt<{ apiKey: string }>([
              {
                type: 'password',
                name: 'apiKey',
                message: 'Enter Gemini API key:',
                validate: (v: string) => v.length > 0 || 'Required',
              },
            ]);
            resolvedValue = apiKey;
          } else {
            resolvedValue = value;
          }

          // Validate
          ConfigValueValidators.apiKey.parse(resolvedValue);

          // Store in keychain
          const keychain = new KeychainStore();
          await keychain.set(`${workspace.id}:apiKey`, resolvedValue);

          // Log to audit trail (redacted)
          await db.auditLog.create({
            data: {
              workspaceId: workspace.id,
              action: 'config.set',
              actor: 'cli',
              details: { key: validatedKey, value: '****' },
            },
          });

          console.log(chalk.green(`✓ ${validatedKey} stored securely in keychain`));
        } else {
          if (!value) {
            console.error(chalk.red(`Value required for key: ${key}`));
            process.exit(1);
          }

          // Parse typed value
          let parsedValue: unknown = value;
          if (validatedKey === 'embeddingDimension' || validatedKey === 'dashboardPort' || validatedKey === 'maxFileSizeMb') {
            parsedValue = parseInt(value, 10);
          } else if (validatedKey === 'followSymlinks') {
            parsedValue = value === 'true';
          }

          // Validate via Zod
          const validator = ConfigValueValidators[validatedKey];
          validator.parse(parsedValue);

          resolvedValue = String(parsedValue);

          // Upsert into workspace_settings
          await db.workspaceSetting.upsert({
            where: { workspaceId_key: { workspaceId: workspace.id, key: validatedKey } },
            create: { workspaceId: workspace.id, key: validatedKey, value: resolvedValue },
            update: { value: resolvedValue },
          });

          // Audit log
          await db.auditLog.create({
            data: {
              workspaceId: workspace.id,
              action: 'config.set',
              actor: 'cli',
              details: { key: validatedKey, value: resolvedValue },
            },
          });

          console.log(chalk.green(`✓ ${validatedKey} = ${resolvedValue}`));
        }
      } catch (err) {
        log.error({ err }, 'config set failed');
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      } finally {
        await disconnectDb();
      }
    });

  cmd
    .command('list')
    .description('List all configuration values')
    .action(async () => {
      try {
        const workspace = await loadWorkspaceConfig();
        const db = getDb();

        const settings = await db.workspaceSetting.findMany({
          where: { workspaceId: workspace.id },
          orderBy: { key: 'asc' },
        });

        console.log(chalk.bold('\nWorkspace Configuration:\n'));
        console.log(`  ${chalk.cyan('id:')}               ${workspace.id}`);
        console.log(`  ${chalk.cyan('name:')}             ${workspace.name}`);
        console.log(`  ${chalk.cyan('rootPath:')}         ${workspace.rootPath}`);
        console.log(`  ${chalk.cyan('embeddingModel:')}   ${workspace.embeddingModel}`);
        console.log(`  ${chalk.cyan('embeddingDim:')}     ${workspace.embeddingDimension}`);
        // Check if API key exists in keychain
        const { KeychainStore } = await import('@docscope/security');
        const keychain = new KeychainStore();
        const hasKey = await keychain.get(`${workspace.id}:apiKey`);
        console.log(`  ${chalk.cyan('apiKey:')}           ${hasKey ? '****  ' + chalk.dim('(stored in keychain)') : chalk.yellow('not set')}`);
        console.log('');

        if (settings.length > 0) {
          console.log(chalk.bold('Custom settings (overrides):'));
          for (const s of settings) {
            const display = s.key === 'apiKey' ? '****' : s.value;
            console.log(`  ${chalk.cyan(s.key + ':')} ${display}`);
          }
        } else {
          console.log(chalk.dim('  No custom settings configured.'));
        }
        console.log('');
      } catch (err) {
        log.error({ err }, 'config list failed');
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      } finally {
        await disconnectDb();
      }
    });

  return cmd;
}
