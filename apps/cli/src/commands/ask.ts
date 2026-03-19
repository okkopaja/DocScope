import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getDb, disconnectDb } from '@docscope/db';
import { GeminiEmbeddingClient } from '@docscope/embeddings';
import { AskEngine } from '@docscope/retrieval';
import { createLogger, formatDuration } from '@docscope/shared-utils';
import { loadWorkspaceConfig, resolveApiKey } from '../utils/workspace.js';
import type { Modality } from '@docscope/shared-types';
import { ModalitySchema } from '@docscope/shared-types';

const log = createLogger('cli:ask');

export function askCommand(): Command {
  return new Command('ask')
    .description('Ask a grounded question about the indexed documents')
    .argument('<question>', 'Your question')
    .option('--type <type>', 'Filter by modality: text, code, pdf, image')
    .option('--top <n>', 'Number of evidence chunks', '5')
    .option('--model <model>', 'Answer model', 'gemini-2.5-flash')
    .action(async (question: string, options: { type?: string; top: string; model: string }) => {
      const spinner = ora('Searching for evidence...').start();

      try {
        if (options.type) {
          const parsed = ModalitySchema.safeParse(options.type);
          if (!parsed.success) {
            console.error(chalk.red(`Invalid modality: "${options.type}". Must be one of: text, code, pdf, image`));
            process.exit(1);
          }
        }

        const workspace = await loadWorkspaceConfig();
        const apiKey = await resolveApiKey(workspace.id);
        const db = getDb();

        const embeddingClient = new GeminiEmbeddingClient({ apiKey });
        const engine = new AskEngine(db, embeddingClient, apiKey);

        spinner.text = 'Generating answer...';
        const start = Date.now();

        const response = await engine.ask({
          question,
          workspaceId: workspace.id,
          type: options.type as Modality | undefined,
          top: parseInt(options.top, 10),
          answerModel: options.model,
        });

        spinner.stop();
        const duration = formatDuration(Date.now() - start);

        console.log(chalk.bold(`\n💬 Answer`) + chalk.dim(` [${duration}]\n`));
        console.log(response.answer);

        if (response.citations.length > 0) {
          console.log(`\n${chalk.bold('📎 Sources:')}`);
          for (const c of response.citations) {
            const loc =
              c.pageNumber !== null
                ? `Page ${c.pageNumber}`
                : c.lineStart !== null
                  ? `Lines ${c.lineStart}-${c.lineEnd}`
                  : '';
            console.log(`  ${chalk.cyan(c.filePath)}${loc ? chalk.dim(` (${loc})`) : ''}`);
          }
        }

        console.log('');
      } catch (err) {
        spinner.fail('Failed');
        log.error({ err }, 'ask failed');
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      } finally {
        await disconnectDb();
      }
    });
}
