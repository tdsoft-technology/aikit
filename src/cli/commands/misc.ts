/**
 * Miscellaneous Commands
 * 
 * Contains smaller command groups:
 * - agents: Manage agents
 * - commands: Manage commands
 * - mode: Manage AIKit mode
 * - platform: Manage platform toggles (OpenCode/Claude Code)
 * - tools: Manage custom tools
 * - plugins: Manage plugins
 * - memory: Manage persistent memory
 * - beads: Beads task management
 * - status: Show AIKit status
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

import { VERSION } from '../../index.js';
import { loadConfig, PlatformType } from '../../core/config.js';
import { AgentManager } from '../../core/agents.js';
import { CommandRunner } from '../../core/commands.js';
import { ToolRegistry } from '../../core/tools.js';
import { PluginSystem } from '../../core/plugins.js';
import { MemoryManager } from '../../core/memory.js';
import { BeadsIntegration } from '../../core/beads.js';
import { SkillEngine } from '../../core/skills.js';
import { logger } from '../../utils/logger.js';
import { groupBy } from '../helpers.js';

/**
 * Register agents command group
 */
export function registerAgentsCommand(program: Command): Command {
  const agentsCmd = program
    .command('agents')
    .description('Manage agents');

  agentsCmd
    .command('list')
    .description('List available agents')
    .action(async () => {
      const config = await loadConfig();
      const manager = new AgentManager(config);
      const agents = manager.listAgents();
      
      console.log(chalk.bold('\n🤖 Available Agents:\n'));
      
      for (const agent of agents) {
        console.log(`  ${chalk.cyan(`@${agent.name}`)} - ${agent.description}`);
        console.log(chalk.gray(`    Use when: ${agent.useWhen}`));
      }
      console.log();
    });

  return agentsCmd;
}

/**
 * Register commands command group
 */
export function registerCommandsCommand(program: Command): Command {
  const commandsCmd = program
    .command('commands')
    .description('Manage commands');

  commandsCmd
    .command('list')
    .description('List available commands')
    .action(async () => {
      const config = await loadConfig();
      const runner = new CommandRunner(config);
      const commands = await runner.listCommands();
      
      console.log(chalk.bold('\n⚡ Available Commands:\n'));
      
      const groups = groupBy(commands, (c) => c.category);
      for (const [category, cmds] of Object.entries(groups)) {
        console.log(chalk.bold.yellow(`\n  ${category}:`));
        for (const cmd of cmds) {
          console.log(`    ${chalk.cyan(`/${cmd.name}`)} - ${cmd.description}`);
        }
      }
      console.log();
    });

  return commandsCmd;
}

/**
 * Register mode command group
 */
export function registerModeCommand(program: Command): Command {
  const modeCmd = program
    .command('mode')
    .description('Manage AIKit mode');

  modeCmd
    .command('get')
    .description('Get current AIKit mode')
    .action(async () => {
      const config = await loadConfig();
      const { mode } = config;
      
      console.log(chalk.bold('\n📋 Current Mode:\n'));
      console.log(`  ${chalk.cyan(mode || 'build')}`);
      console.log();
      
      console.log(chalk.bold('Available Modes:\n'));
      console.log(`  ${chalk.cyan('plan')} - Create detailed implementation plans`);
      console.log(`  ${chalk.cyan('build')} - Direct execution mode`);
      console.log(`  ${chalk.cyan('one-shot')} - End-to-end autonomous execution`);
      console.log();
      
      console.log(chalk.gray('Use "aikit mode set <mode>" to change mode.'));
    });

  modeCmd
    .command('set <mode>')
    .description('Set AIKit mode (plan, build, one-shot)')
    .action(async (mode) => {
      const config = await loadConfig();
      const configPath = config.configPath;
      
      try {
        // Validate mode
        const validModes = ['plan', 'build', 'one-shot'];
        if (!validModes.includes(mode)) {
          console.log(chalk.red(`Invalid mode. Available modes: ${validModes.join(', ')}`));
          return;
        }
        
        // Update config
        const configData = JSON.parse(await readFile(join(configPath, 'aikit.json'), 'utf-8'));
        configData.mode = mode;
        await writeFile(join(configPath, 'aikit.json'), JSON.stringify(configData, null, 2));
        
        console.log(chalk.green(`✓ Mode set to: ${mode}`));
        console.log(chalk.gray(`Configuration updated at: ${configPath}/aikit.json`));
      } catch (error) {
        console.log(chalk.red(`Failed to set mode: ${error instanceof Error ? error.message : String(error)}`));
      }
    });

  return modeCmd;
}

/**
 * Register tools command group
 */
export function registerToolsCommand(program: Command): Command {
  const toolsCmd = program
    .command('tools')
    .description('Manage custom tools');

  toolsCmd
    .command('list')
    .description('List available tools')
    .action(async () => {
      const config = await loadConfig();
      const registry = new ToolRegistry(config);
      const tools = await registry.listTools();
      
      console.log(chalk.bold('\n🔧 Available Tools:\n'));
      
      for (const tool of tools) {
        console.log(`  ${chalk.cyan(tool.name)} - ${tool.description}`);
      }
      console.log();
    });

  return toolsCmd;
}

/**
 * Register plugins command group
 */
export function registerPluginsCommand(program: Command): Command {
  const pluginsCmd = program
    .command('plugins')
    .description('Manage plugins');

  pluginsCmd
    .command('list')
    .description('List available plugins')
    .action(async () => {
      const config = await loadConfig();
      const system = new PluginSystem(config);
      const plugins = await system.listPlugins();
      
      console.log(chalk.bold('\n🔌 Available Plugins:\n'));
      
      for (const plugin of plugins) {
        const status = plugin.enabled ? chalk.green('✓') : chalk.gray('○');
        console.log(`  ${status} ${chalk.cyan(plugin.name)} - ${plugin.description}`);
      }
      console.log();
    });

  return pluginsCmd;
}

/**
 * Register memory command group
 */
export function registerMemoryCommand(program: Command): Command {
  const memoryCmd = program
    .command('memory')
    .description('Manage persistent memory');

  memoryCmd
    .command('list')
    .description('List memory entries')
    .action(async () => {
      const config = await loadConfig();
      const memory = new MemoryManager(config);
      const entries = await memory.list();
      
      console.log(chalk.bold('\n🧠 Memory Entries:\n'));
      
      for (const entry of entries) {
        console.log(`  ${chalk.cyan(entry.key)} - ${entry.summary}`);
        console.log(chalk.gray(`    Updated: ${entry.updatedAt}`));
      }
      console.log();
    });

  memoryCmd
    .command('read <key>')
    .description('Read a memory entry')
    .action(async (key: string) => {
      const config = await loadConfig();
      const memory = new MemoryManager(config);
      const content = await memory.read(key);
      
      if (!content) {
        logger.error(`Memory entry not found: ${key}`);
        process.exit(1);
      }
      
      console.log(content);
    });

  return memoryCmd;
}

/**
 * Register beads command group
 */
export function registerBeadsCommand(program: Command): Command {
  const beadsCmd = program
    .command('beads')
    .description('Beads task management integration');

  beadsCmd
    .command('status')
    .description('Show current Beads status')
    .action(async () => {
      const beads = new BeadsIntegration();
      const status = await beads.getStatus();
      
      console.log(chalk.bold('\n📿 Beads Status:\n'));
      console.log(`  Active tasks: ${status.activeTasks}`);
      console.log(`  Completed: ${status.completedTasks}`);
      console.log(`  Current: ${status.currentTask || 'None'}`);
      console.log();
    });

  return beadsCmd;
}

/**
 * Register platform command group
 * Manages which platforms (OpenCode/Claude Code) are enabled
 */
export function registerPlatformCommand(program: Command): Command {
  const platformCmd = program
    .command('platform')
    .description('Manage platform toggles (OpenCode/Claude Code)');

  platformCmd
    .command('status')
    .description('Show platform configuration status')
    .action(async () => {
      const config = await loadConfig();
      const { platform } = config;
      const enabledPlatforms = config.getEnabledPlatforms();
      
      console.log(chalk.bold('\n🖥️  Platform Configuration:\n'));
      console.log(`  Primary: ${chalk.cyan(platform.primary)}`);
      console.log();
      console.log('  Platforms:');
      console.log(`    ${platform.opencode ? chalk.green('✓') : chalk.gray('○')} OpenCode   ${platform.opencode ? chalk.green('(enabled)') : chalk.gray('(disabled)')}`);
      console.log(`    ${platform.claude ? chalk.green('✓') : chalk.gray('○')} Claude Code ${platform.claude ? chalk.green('(enabled)') : chalk.yellow('(archived)')}`);
      console.log();
      
      if (enabledPlatforms.length === 0) {
        console.log(chalk.yellow('⚠ No platforms enabled! Run "aikit platform enable opencode" to enable.'));
      } else {
        console.log(chalk.gray(`Enabled: ${enabledPlatforms.join(', ')}`));
      }
      console.log();
      
      console.log(chalk.gray('Commands:'));
      console.log(chalk.gray('  aikit platform enable <platform>   Enable a platform'));
      console.log(chalk.gray('  aikit platform disable <platform>  Disable a platform'));
      console.log(chalk.gray('  aikit platform primary <platform>  Set primary platform'));
      console.log();
    });

  platformCmd
    .command('enable <platform>')
    .description('Enable a platform (opencode, claude)')
    .action(async (platform: string) => {
      await togglePlatform(platform as PlatformType, true);
    });

  platformCmd
    .command('disable <platform>')
    .description('Disable a platform (opencode, claude)')
    .action(async (platform: string) => {
      await togglePlatform(platform as PlatformType, false);
    });

  platformCmd
    .command('primary <platform>')
    .description('Set primary platform (opencode, claude)')
    .action(async (platform: string) => {
      const validPlatforms: PlatformType[] = ['opencode', 'claude'];
      if (!validPlatforms.includes(platform as PlatformType)) {
        console.log(chalk.red(`Invalid platform. Available: ${validPlatforms.join(', ')}`));
        return;
      }
      
      const config = await loadConfig();
      const configPath = config.configPath;
      
      try {
        let configData: Record<string, unknown> = {};
        try {
          configData = JSON.parse(await readFile(join(configPath, 'aikit.json'), 'utf-8'));
        } catch {
          // No config file, create new one
        }
        
        if (!configData.platform) {
          configData.platform = {};
        }
        (configData.platform as Record<string, unknown>).primary = platform;
        
        // Ensure the primary platform is enabled
        (configData.platform as Record<string, unknown>)[platform] = true;
        
        await mkdir(configPath, { recursive: true });
        await writeFile(join(configPath, 'aikit.json'), JSON.stringify(configData, null, 2));
        
        console.log(chalk.green(`✓ Primary platform set to: ${platform}`));
        console.log(chalk.gray(`Configuration updated at: ${configPath}/aikit.json`));
        console.log();
        console.log(chalk.gray('Run "aikit install" to apply changes.'));
      } catch (error) {
        console.log(chalk.red(`Failed to set primary platform: ${error instanceof Error ? error.message : String(error)}`));
      }
    });

  return platformCmd;
}

/**
 * Helper function to toggle platform enable/disable
 */
async function togglePlatform(platform: PlatformType, enable: boolean): Promise<void> {
  const validPlatforms: PlatformType[] = ['opencode', 'claude'];
  if (!validPlatforms.includes(platform)) {
    console.log(chalk.red(`Invalid platform. Available: ${validPlatforms.join(', ')}`));
    return;
  }
  
  const config = await loadConfig();
  const configPath = config.configPath;
  
  try {
    let configData: Record<string, unknown> = {};
    try {
      configData = JSON.parse(await readFile(join(configPath, 'aikit.json'), 'utf-8'));
    } catch {
      // No config file, create new one
    }
    
    if (!configData.platform) {
      configData.platform = {
        primary: 'opencode',
        opencode: true,
        claude: false,
      };
    }
    
    (configData.platform as Record<string, unknown>)[platform] = enable;
    
    await mkdir(configPath, { recursive: true });
    await writeFile(join(configPath, 'aikit.json'), JSON.stringify(configData, null, 2));
    
    const action = enable ? 'enabled' : 'disabled';
    const emoji = enable ? '✓' : '○';
    console.log(chalk.green(`${emoji} Platform ${platform} ${action}`));
    console.log(chalk.gray(`Configuration updated at: ${configPath}/aikit.json`));
    console.log();
    
    if (enable) {
      console.log(chalk.gray('Run "aikit install" to install AIKit for this platform.'));
    } else {
      console.log(chalk.gray(`Note: Existing ${platform} files will remain but won't be updated.`));
      console.log(chalk.gray(`Use "aikit platform enable ${platform}" to re-enable later.`));
    }
  } catch (error) {
    console.log(chalk.red(`Failed to ${enable ? 'enable' : 'disable'} platform: ${error instanceof Error ? error.message : String(error)}`));
  }
}

/**
 * Register status command
 */
export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show AIKit status')
    .action(async () => {
      console.log(chalk.bold(`\n🚀 AIKit v${VERSION()}\n`));
      
      try {
        const config = await loadConfig();
        console.log(chalk.green('✓ Configuration loaded'));
        
        // Platform status
        const enabledPlatforms = config.getEnabledPlatforms();
        console.log(`  Primary Platform: ${chalk.cyan(config.getPrimaryPlatform())}`);
        console.log(`  Enabled Platforms: ${enabledPlatforms.length > 0 ? enabledPlatforms.join(', ') : chalk.yellow('none')}`);
        
        const skillEngine = new SkillEngine(config);
        const skills = await skillEngine.listSkills();
        console.log(`  Skills: ${skills.length}`);
        
        const agentManager = new AgentManager(config);
        const agents = agentManager.listAgents();
        console.log(`  Agents: ${agents.length}`);
        
        const commandRunner = new CommandRunner(config);
        const commands = await commandRunner.listCommands();
        console.log(`  Commands: ${commands.length}`);
        
        const toolRegistry = new ToolRegistry(config);
        const tools = await toolRegistry.listTools();
        console.log(`  Tools: ${tools.length}`);
        
        const beads = new BeadsIntegration();
        const beadsStatus = await beads.isInstalled();
        console.log(`  Beads: ${beadsStatus ? chalk.green('Installed') : chalk.yellow('Not installed')}`);
        
      } catch (error) {
        console.log(chalk.yellow('⚠ AIKit not initialized. Run "aikit init" to get started.'));
      }
      
      console.log();
    });
}

