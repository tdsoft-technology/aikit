/**
 * AIKit CLI - Main Entry Point
 *
 * Open-source AI coding agent toolkit for OpenCode
 */

import { Command } from 'commander';
import { VERSION } from '../index.js';
import { checkForUpdatesAsync } from '../core/update-manager.js';

import {
  registerInitCommand,
  registerInstallCommand,
  registerSyncCommand,
  registerSkillsCommand,
  registerAgentsCommand,
  registerCommandsCommand,
  registerModeCommand,
  registerPlatformCommand,
  registerToolsCommand,
  registerPluginsCommand,
  registerMemoryCommand,
  registerBeadsCommand,
  registerStatusCommand,
  registerSessionCommand,
} from './commands/index.js';

const program = new Command();

program
  .name('aikit')
  .description('Open-source AI coding agent toolkit for OpenCode')
  .version(VERSION());

// Register all commands
registerInitCommand(program);
registerInstallCommand(program);
registerSyncCommand(program);
registerSkillsCommand(program);
registerAgentsCommand(program);
registerCommandsCommand(program);
registerModeCommand(program);
registerPlatformCommand(program);
registerToolsCommand(program);
registerPluginsCommand(program);
registerMemoryCommand(program);
registerBeadsCommand(program);
registerSessionCommand(program);
registerStatusCommand(program);

// Run CLI
program.parse();

// Non-blocking update check
checkForUpdatesAsync().catch(err => {
  if (process.env.AIKIT_DEBUG) {
    console.error('Update check failed:', err);
  }
});




