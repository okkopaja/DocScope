#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { configCommand } from './commands/config.js';
import { indexCommand } from './commands/index.js';
import { reindexCommand } from './commands/reindex.js';
import { searchCommand } from './commands/search.js';
import { askCommand } from './commands/ask.js';
import { statusCommand } from './commands/status.js';
import { doctorCommand } from './commands/doctor.js';

const program = new Command();

program
  .name('docscope')
  .description('Local-first document semantic search and Q&A tool')
  .version('0.1.0');

program.addCommand(initCommand());
program.addCommand(configCommand());
program.addCommand(indexCommand());
program.addCommand(reindexCommand());
program.addCommand(searchCommand());
program.addCommand(askCommand());
program.addCommand(statusCommand());
program.addCommand(doctorCommand());

program.parse(process.argv);
