import { Command } from 'commander';
import chalk from 'chalk';
import { getDb, disconnectDb } from '@docscope/db';
import { createLogger, formatBytes } from '@docscope/shared-utils';
import { loadWorkspaceConfig } from '../utils/workspace.js';

const log = createLogger('cli:status');

export function statusCommand(): Command {
  return new Command('status')
    .description('Show workspace index status summary')
    .action(async () => {
      try {
        const workspace = await loadWorkspaceConfig();
        const db = getDb();

        const [fileCounts, chunkCount, embeddingCount, previewCount, lastJob] = await Promise.all([
          db.file.groupBy({
            by: ['indexStatus'],
            where: { workspaceId: workspace.id },
            _count: { id: true },
            _sum: { fileSizeBytes: true },
          }),
          db.chunk.count({
            where: { file: { workspaceId: workspace.id } },
          }),
          db.embedding.count({
            where: { chunk: { file: { workspaceId: workspace.id } } },
          }),
          db.preview.count({
            where: { file: { workspaceId: workspace.id } },
          }),
          db.job.findFirst({
            where: { workspaceId: workspace.id, state: 'completed' },
            orderBy: { completedAt: 'desc' },
          }),
        ]);

        const counts: Record<string, number> = {};
        let totalBytes = 0n;
        for (const row of fileCounts) {
          counts[row.indexStatus] = row._count.id;
          totalBytes += row._sum.fileSizeBytes ?? 0n;
        }

        const totalFiles = Object.values(counts).reduce((a, b) => a + b, 0);
        const lastIndexed = lastJob?.completedAt
          ? new Date(lastJob.completedAt).toLocaleString()
          : 'Never';

        console.log(chalk.bold(`\n📊 DocScope Status — ${workspace.name}\n`));
        console.log(`  ${chalk.cyan('Workspace:')}      ${workspace.id}`);
        console.log(`  ${chalk.cyan('Root:')}           ${workspace.rootPath}`);
        console.log('');
        console.log(chalk.bold('  Files:'));
        console.log(`    ${chalk.green('Indexed:')}      ${counts['indexed'] ?? 0}`);
        console.log(`    ${chalk.yellow('Pending:')}      ${counts['pending'] ?? 0}`);
        console.log(`    ${chalk.blue('Indexing:')}     ${counts['indexing'] ?? 0}`);
        console.log(`    ${chalk.red('Failed:')}       ${counts['failed'] ?? 0}`);
        console.log(`    ${chalk.dim('Deleted:')}      ${counts['deleted'] ?? 0}`);
        console.log(`    ${chalk.bold('Total:')}        ${totalFiles}`);
        console.log('');
        console.log(`  ${chalk.cyan('Chunks:')}         ${chunkCount.toLocaleString()}`);
        console.log(`  ${chalk.cyan('Vectors:')}        ${embeddingCount.toLocaleString()}`);
        console.log(`  ${chalk.cyan('Previews:')}       ${previewCount.toLocaleString()}`);
        console.log(`  ${chalk.cyan('Storage:')}        ${formatBytes(Number(totalBytes))}`);
        console.log(`  ${chalk.cyan('Last Indexed:')}   ${lastIndexed}`);
        console.log('');
      } catch (err) {
        log.error({ err }, 'status failed');
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      } finally {
        await disconnectDb();
      }
    });
}
