/**
 * Install Command
 *
 * Install AIKit to specific CLI tool configuration
 * Respects platform toggle flags in aikit.json
 */

import { Command } from 'commander';
import inquirer from 'inquirer';

import { logger } from '../../utils/logger.js';
import { CliDetector, CliPlatform } from '../../utils/cli-detector.js';
import { createAdapter, getEnabledAdapters, SUPPORTED_PLATFORMS } from '../../platform/adapters.js';
import { loadConfig, PlatformType } from '../../core/config.js';
import { AgentManager } from '../../core/agents.js';
import { CommandRunner } from '../../core/commands.js';
import { SessionManager } from '../../core/sessions.js';
import { SkillEngine } from '../../core/skills.js';

/**
 * Map CliPlatform to PlatformType
 */
function cliPlatformToType(platform: CliPlatform): PlatformType {
  switch (platform) {
    case CliPlatform.OPENCODE:
      return 'opencode';
    case CliPlatform.CLAUDE:
      return 'claude';
    case CliPlatform.CURSOR:
      return 'cursor';
    case CliPlatform.ANTIGRAVITY:
      return 'antigravity';
    default:
      return 'opencode';
  }
}

export function registerInstallCommand(program: Command): void {
  program
    .command('install [platform]')
    .description('Install AIKit to specific CLI tool configuration')
    .option('--all', 'Install to all enabled platforms')
    .option('--force', 'Force install even if platform is disabled in config')
    .action(async (platformArg, options) => {
      try {
        const config = await loadConfig();
        const enabledPlatforms = config.getEnabledPlatforms();

        // Show current platform status
        logger.info('Platform Configuration:');
        logger.info(`  Primary: ${config.getPrimaryPlatform()}`);
        logger.info(`  OpenCode: ${config.isPlatformEnabled('opencode') ? 'enabled' : 'disabled'}`);
        logger.info(`  Antigravity: ${config.isPlatformEnabled('antigravity') ? 'enabled' : 'disabled'}`);
        logger.info(`  Claude Code: ${config.isPlatformEnabled('claude') ? 'enabled (archived)' : 'disabled (archived)'}`);
        logger.info(`  Cursor: ${config.isPlatformEnabled('cursor') ? 'enabled' : 'disabled'}`);
        logger.info('');

        // Check if any platform is enabled
        if (enabledPlatforms.length === 0) {
          logger.error('No platforms enabled in config!');
          logger.info('Enable at least one platform in .aikit/aikit.json:');
          logger.info('  { "platform": { "opencode": true } }');
          process.exit(1);
        }

        // Install to all enabled platforms
        if (options.all) {
          logger.info(`Installing to all enabled platforms: ${enabledPlatforms.join(', ')}`);
          const adapters = getEnabledAdapters(config);
          
          for (const adapter of adapters) {
            await installToAdapter(adapter, config);
          }
          
          logger.success(`\n✓ AIKit installed to ${enabledPlatforms.length} platform(s)!`);
          return;
        }

        let selectedPlatform: CliPlatform;

        if (platformArg) {
          selectedPlatform = CliDetector.matchPlatform(platformArg);
          if (!selectedPlatform) {
            logger.error(`Unknown platform: ${platformArg}`);
            logger.info(`Supported platforms: ${Object.values(CliPlatform).join(', ')}`);
            process.exit(1);
          }

          // Check if platform is enabled (unless --force)
          const platformType = cliPlatformToType(selectedPlatform);
          if (!config.isPlatformEnabled(platformType) && !options.force) {
            logger.warn(`Platform '${platformType}' is disabled in config.`);
            logger.info('To enable it, update .aikit/aikit.json:');
            logger.info(`  { "platform": { "${platformType}": true } }`);
            logger.info('Or use --force to install anyway.');
            process.exit(1);
          }
        } else {
          // Filter platforms based on config
          const platforms = await CliDetector.detectPlatforms();
          const availablePlatforms = platforms.filter(p => {
            const platformInfo = SUPPORTED_PLATFORMS.find(sp => sp.platform === p.platform);
            return platformInfo && config.isPlatformEnabled(platformInfo.configKey);
          });

          if (availablePlatforms.length === 0) {
            logger.error('No enabled platforms detected!');
            logger.info('Enable platforms in .aikit/aikit.json');
            process.exit(1);
          }

          // If only one enabled platform, use it directly
          if (availablePlatforms.length === 1) {
            selectedPlatform = availablePlatforms[0].platform;
            logger.info(`Using only enabled platform: ${availablePlatforms[0].displayName}`);
          } else {
            // Smart default: prefer primary platform
            const primaryPlatform = config.getPrimaryPlatform();
            const defaultChoice = availablePlatforms.find(p => {
              const platformInfo = SUPPORTED_PLATFORMS.find(sp => sp.platform === p.platform);
              return platformInfo?.configKey === primaryPlatform;
            })?.platform || availablePlatforms[0].platform;

            const { platform } = await inquirer.prompt([
              {
                type: 'list',
                name: 'platform',
                message: 'Which CLI tool do you want to install AIKit for?',
                choices: availablePlatforms.map(p => ({
                  name: `${p.displayName}${p.installed ? ' (installed)' : ''}`,
                  value: p.platform,
                })),
                default: defaultChoice,
              },
            ]);

            selectedPlatform = platform;
          }
        }

        logger.info(`Installing AIKit for ${selectedPlatform}...`);

        // Initialize sessions folder
        const sessionManager = new SessionManager();
        await sessionManager.init();
        logger.success('✓ Sessions folder initialized');

        // Initialize terminal session file
        const { tracker } = await sessionManager.initTerminalSession();
        logger.success(`✓ Session tracker initialized (${tracker.split('/').pop()})`);

        const adapter = createAdapter(selectedPlatform);
        await installToAdapter(adapter, config);

        logger.success(`\n✓ AIKit installed to ${adapter.displayName}!`);
        
        // Show hint for disabled platforms
        const disabledPlatforms = SUPPORTED_PLATFORMS.filter(p => !config.isPlatformEnabled(p.configKey));
        if (disabledPlatforms.length > 0) {
          logger.info('');
          logger.info('Note: Some platforms are disabled:');
          disabledPlatforms.forEach(p => {
            logger.info(`  - ${p.name}: Enable with { "platform": { "${p.configKey}": true } }`);
          });
        }
      } catch (error) {
        logger.error('Failed to install:', error);
        process.exit(1);
      }
    });
}

/**
 * Install AIKit components to a specific adapter
 */
async function installToAdapter(adapter: any, config: any): Promise<void> {
  const skillEngine = config.skills.enabled ? new SkillEngine(config) : null;
  const commandRunner = config.commands.enabled ? new CommandRunner(config) : null;
  const agentManager = config.agents.enabled ? new AgentManager(config) : null;

  logger.info(`\n📦 Installing to ${adapter.displayName}...`);

  // Install commands
  if (commandRunner) {
    const commands = await commandRunner.listCommands();
    logger.info(`Installing ${commands.length} commands...`);
    for (const command of commands) {
      const { name, content } = await adapter.transformCommand(command);
      await adapter.installCommand(name, content);
      logger.info(`  ✓ Created ${name} command`);
    }
  }

  // Install skills
  if (skillEngine) {
    const skills = await skillEngine.listSkills();
    logger.info(`Installing ${skills.length} skills...`);
    for (const skill of skills) {
      const { name, directory, files } = await adapter.transformSkill(skill);
      await adapter.installSkill(name, directory, files);
      logger.info(`  ✓ Created ${name} skill`);
    }
  }

  // Install agents
  if (agentManager) {
    const agents = await agentManager.listAgents();
    logger.info(`Installing ${agents.length} agents...`);
    for (const agent of agents) {
      const { name, content } = await adapter.transformAgent(agent);
      await adapter.installAgent(name, content);
      logger.info(`  ✓ Created ${name} agent`);
    }
  }

  // Generate commands.json manifest for Claude Code
  // This ensures local commands are discovered and take precedence over parent directories
  if (adapter.platform === 'claude' && adapter.generateCommandsManifest) {
    await adapter.generateCommandsManifest();
    logger.success('✓ Generated commands manifest');
  }
}
