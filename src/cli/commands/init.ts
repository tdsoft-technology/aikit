/**
 * Init Command
 *
 * Initialize AIKit configuration for a specific platform
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';

import { loadConfig, PlatformType } from '../../core/config.js';
import { SkillEngine } from '../../core/skills.js';
import { BeadsIntegration } from '../../core/beads.js';
import { CliDetector, CliTool, CliPlatform } from '../../utils/cli-detector.js';
import { logger } from '../../utils/logger.js';
import { paths } from '../../utils/paths.js';
import { initializeConfig, installCliTool } from '../helpers.js';
import { AgentManager } from '../../core/agents.js';
import { CommandRunner } from '../../core/commands.js';
import { SessionManager } from '../../core/sessions.js';
import { getEnabledAdapters } from '../../platform/adapters.js';

/**
 * Platform choice for user selection
 */
type PlatformChoice = 'opencode' | 'claude' | 'both';

/**
 * Map user choice to platform config
 */
function getPlatformConfig(choice: PlatformChoice): { opencode: boolean; claude: boolean; primary: PlatformType } {
  switch (choice) {
    case 'opencode':
      return { opencode: true, claude: false, primary: 'opencode' };
    case 'claude':
      return { opencode: false, claude: true, primary: 'claude' };
    case 'both':
      return { opencode: true, claude: true, primary: 'opencode' };
  }
}

export function registerInitCommand(program: Command): void {
  program
    .command('init [platform]')
    .description('Initialize AIKit configuration for a specific platform')
    .option('-g, --global', 'Initialize global configuration')
    .option('-p, --project', 'Initialize project-level configuration')
    .option('--opencode', 'Use OpenCode only')
    .option('--claude', 'Use Claude Code only')
    .option('--both', 'Use both OpenCode and Claude Code')
    .action(async (platformArg, options) => {
      const configDir = options.global ? paths.globalConfig() : paths.projectConfig();

      console.log(chalk.bold('\n🚀 AIKit Setup\n'));
      logger.info(`Initializing AIKit in ${configDir}...`);

      try {
        // Determine platform choice from flags or prompt
        let platformChoice: PlatformChoice;

        if (options.opencode) {
          platformChoice = 'opencode';
        } else if (options.claude) {
          platformChoice = 'claude';
        } else if (options.both) {
          platformChoice = 'both';
        } else if (platformArg) {
          // Legacy support: map platform arg to choice
          const mapped = CliDetector.matchPlatform(platformArg);
          platformChoice = mapped === CliPlatform.CLAUDE ? 'claude' : 'opencode';
        } else {
          // Interactive platform selection
          console.log(chalk.bold('\n📦 Select Your AI Coding Platform\n'));
          
          const { choice } = await inquirer.prompt([
            {
              type: 'list',
              name: 'choice',
              message: 'Which platform(s) do you want to use?',
              choices: [
                {
                  name: `${chalk.green('●')} OpenCode ${chalk.gray('(recommended)')}`,
                  value: 'opencode',
                },
                {
                  name: `${chalk.yellow('●')} Claude Code ${chalk.yellow('(Beta)')}`,
                  value: 'claude',
                },
                {
                  name: `${chalk.cyan('●')} Both Platforms ${chalk.gray('(OpenCode + Claude Code)')}`,
                  value: 'both',
                },
              ],
              default: 'opencode',
            },
          ]);

          platformChoice = choice;

          // Show beta warning for Claude Code
          if (platformChoice === 'claude' || platformChoice === 'both') {
            console.log(chalk.yellow('\n⚠️  Claude Code support is in Beta'));
            console.log(chalk.gray('   Some features may be limited or experimental.\n'));
          }
        }

        // Get platform config based on choice
        const platformConfig = getPlatformConfig(platformChoice);

        // Step 1: Initialize config with platform settings
        await initializeConfig(configDir, options.global, platformConfig);
        logger.success('✓ Configuration created');

        // Show selected platforms
        console.log(chalk.bold('\n📋 Platform Configuration:'));
        console.log(`   OpenCode:    ${platformConfig.opencode ? chalk.green('enabled') : chalk.gray('disabled')}`);
        console.log(`   Claude Code: ${platformConfig.claude ? chalk.yellow('enabled (Beta)') : chalk.gray('disabled')}`);
        console.log(`   Primary:     ${chalk.cyan(platformConfig.primary)}\n`);

        if (!options.global) {
          // Step 2: Load config and sync skills
          const config = await loadConfig();
          const engine = new SkillEngine(config);
          const result = await engine.syncSkillsToProject();
          if (result.count > 0) {
            logger.success(`✓ Synced ${result.count} skills`);
          }

          // Step 3: Install CLI tools if needed
          if (platformConfig.claude) {
            const cliTools = await CliDetector.checkAll();
            const claudeTool = cliTools.find(t => t.name === CliTool.CLAUDE);
            if (claudeTool && !claudeTool.installed) {
              const { installClaude } = await inquirer.prompt([
                {
                  type: 'confirm',
                  name: 'installClaude',
                  message: 'Claude Code CLI is not installed. Install now?',
                  default: true,
                },
              ]);

              if (installClaude) {
                await installCliTool(claudeTool);
              }
            }
          }

          // Step 4: Initialize beads
          const beads = new BeadsIntegration();
          const beadsStatus = await beads.getStatus();

          if (!beadsStatus.initialized) {
            logger.info('Initializing .beads directory...');
            await beads.initLocal();
            logger.success('✓ .beads directory created');

            if (!beadsStatus.installed) {
              logger.info('Tip: Install Beads CLI globally for full functionality: npm install -g beads');
            }
          } else {
            logger.info('Beads already initialized');
          }

          // Step 5: Setup git hooks
          logger.info('Setting up git hooks...');
          await beads.setupGitHooks();
          logger.success('✓ Git hooks configured');

          // Step 6: Initialize sessions folder
          const sessionManager = new SessionManager();
          await sessionManager.init();
          logger.success('✓ Sessions folder initialized');

          // Step 7: Initialize terminal session file
          const { tracker } = await sessionManager.initTerminalSession();
          logger.success(`✓ Session tracker initialized (${tracker.split('/').pop()})`);

          // Step 8: Install to enabled platforms
          const enabledAdapters = getEnabledAdapters(config);
          
          for (const adapter of enabledAdapters) {
            logger.info(`Installing AIKit for ${adapter.displayName}...`);
            await installToPlatform(adapter, config);
          }

          console.log(chalk.bold('\n✨ AIKit is ready!\n'));

          // Show usage based on primary platform
          if (platformConfig.primary === 'opencode') {
            showOpenCodeUsage();
          } else {
            showClaudeUsage();
          }

          // Show platform switch tip
          console.log(chalk.gray('━'.repeat(50)));
          console.log(chalk.gray('\nSwitch platforms anytime:'));
          console.log(chalk.gray('  aikit platform enable claude'));
          console.log(chalk.gray('  aikit platform disable opencode'));
          console.log(chalk.gray('  aikit platform status\n'));
        }
      } catch (error) {
        logger.error('Failed to initialize AIKit:', error);
        process.exit(1);
      }
    });
}

async function installToPlatform(
  adapter: any,
  config: any
): Promise<void> {
  const skillEngine = new SkillEngine(config);
  const commandRunner = new CommandRunner(config);
  const agentManager = new AgentManager(config);

  const skills = await skillEngine.listSkills();
  const commands = await commandRunner.listCommands();
  const agents = await agentManager.listAgents();

  // Install commands
  logger.info(`Installing ${commands.length} commands...`);
  for (const command of commands) {
    const { name, content } = await adapter.transformCommand(command);
    await adapter.installCommand(name, content);
    logger.info(`  ✓ Created ${name} command`);
  }

  // Install skills
  logger.info(`Installing ${skills.length} skills...`);
  for (const skill of skills) {
    const { name, directory, files } = await adapter.transformSkill(skill);
    await adapter.installSkill(name, directory, files);
    logger.info(`  ✓ Created ${name} skill`);
  }

  // Install agents
  logger.info(`Installing ${agents.length} agents...`);
  for (const agent of agents) {
    const { name, content } = await adapter.transformAgent(agent);
    await adapter.installAgent(name, content);
    logger.info(`  ✓ Created ${name} agent`);
  }

  // Generate commands manifest for Claude Code
  if (adapter.platform === CliPlatform.CLAUDE && adapter.generateCommandsManifest) {
    await adapter.generateCommandsManifest();
    logger.success('✓ Generated commands manifest');
  }
}

function showOpenCodeUsage(): void {
  console.log('Usage in OpenCode:');
  console.log(chalk.cyan('  /skills') + '  - List all available skills');
  console.log(chalk.cyan('  /plan') + '    - Create implementation plan');
  console.log(chalk.cyan('  /tdd') + '     - Test-driven development');
  console.log(chalk.cyan('  /debug') + '   - Systematic debugging');
  console.log(chalk.cyan('  /review') + '  - Code review checklist');
  console.log(chalk.cyan('  /git') + '     - Git workflow');
  console.log(chalk.cyan('  /frontend-aesthetics') + ' - UI/UX guidelines');
  console.log('\nPress ' + chalk.bold('Ctrl+K') + ' in OpenCode to see all commands.\n');
}

function showClaudeUsage(): void {
  console.log(chalk.yellow('Claude Code (Beta) Usage:'));
  console.log(chalk.cyan('  /help') + '    - List all available commands');
  console.log(chalk.cyan('  /plan') + '    - Create implementation plan');
  console.log(chalk.cyan('  /implement') + ' - Implement a task');
  console.log(chalk.cyan('  /test') + '    - Run tests');
  console.log('\nType ' + chalk.bold('"/help"') + ' in Claude to see all commands.\n');
}
