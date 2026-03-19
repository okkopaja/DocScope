import { Command } from 'commander';
import chalk from 'chalk';
import { getDb, disconnectDb } from '@docscope/db';
import { GeminiEmbeddingClient } from '@docscope/embeddings';
import { SearchEngine } from '@docscope/retrieval';
import { createLogger, formatDuration } from '@docscope/shared-utils';
import { loadWorkspaceConfig, resolveApiKey } from '../utils/workspace.js';
import type { Modality } from '@docscope/shared-types';
import { ModalitySchema } from '@docscope/shared-types';

const log = createLogger('cli:search');

export function searchCommand(): Command {
  return new Command('search')
    .description('Semantic search across indexed files')
    .argument('<query>', 'Search query')
    .option('--type <type>', 'Filter by modality: text, code, pdf, image')
    .option('--top <n>', 'Number of results to return', '10')
    .action(async (query: string, options: { type?: string; top: string }) => {
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
        const engine = new SearchEngine(db, embeddingClient);

        const start = Date.now();
        const results = await engine.search({
          query,
          workspaceId: workspace.id,
          type: options.type as Modality | undefined,
          top: parseInt(options.top, 10),
        });

        const duration = formatDuration(Date.now() - start);

        if (results.length === 0) {
          console.log(chalk.yellow('\nNo results found.\n'));
          process.exit(0);
        }

        console.log(
          chalk.bold(`\n${results.length} result(s) for "${query}" `) +
            chalk.dim(`[${duration}]\n`),
        );

        for (const r of results) {
          const loc =
            r.pageNumber !== null
              ? chalk.dim(`Page ${r.pageNumber}`)
              : r.lineStart !== null
                ? chalk.dim(`Lines ${r.lineStart}-${r.lineEnd}`)
                : '';

          const modalityBadge = {
            text: chalk.blue('[text]'),
            code: chalk.magenta('[code]'),
            pdf: chalk.red('[pdf]'),
            image: chalk.green('[image]'),
          }[r.modality] ?? '';

          console.log(
            `${chalk.bold(String(r.rank).padStart(2, ' '))}. ${chalk.cyan(r.filePath)} ${modalityBadge} ${loc}`,
          );
          console.log(
            `    ${chalk.dim('Score:')} ${r.score.toFixed(4)}  │  ${chalk.dim(r.snippet.replace(/\n/g, ' ').slice(0, 120))}`,
          );
          console.log('');
        }
      } catch (err) {
        log.error({ err }, 'search failed');
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      } finally {
        await disconnectDb();
      }
    });
}
