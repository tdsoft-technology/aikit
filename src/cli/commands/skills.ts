/**
 * Skills Command Group
 * 
 * Manage skills and tool configurations
 */

import { Command } from 'commander';
import chalk from 'chalk';

import { loadConfig } from '../../core/config.js';
import { SkillEngine } from '../../core/skills.js';
import { logger } from '../../utils/logger.js';

export function registerSkillsCommand(program: Command): Command {
  const skillsCmd = program
    .command('skills')
    .description('Manage skills');

  skillsCmd
    .command('list')
    .description('List available skills and tools with their configuration status')
    .action(async () => {
      const config = await loadConfig();
      const engine = new SkillEngine(config);
      const skills = await engine.listSkills();
      
      // Import tool config manager
      const { ToolConfigManager } = await import('../../core/tool-config.js');
      const toolConfigManager = new ToolConfigManager(config);
      const tools = await toolConfigManager.listTools();
      
      console.log(chalk.bold('\n📚 Available Skills:\n'));
      
      for (const skill of skills) {
        console.log(`  ${chalk.cyan(skill.name)} - ${skill.description}`);
      }
      
      console.log(chalk.bold('\n🔧 Available Tools:\n'));
      
      for (const tool of tools) {
        let statusIcon = '  ';
        let statusText = '';
        
        if (tool.status === 'ready') {
          statusIcon = chalk.green('✓');
          statusText = chalk.gray('(ready)');
        } else if (tool.status === 'needs_config') {
          statusIcon = chalk.yellow('⚠');
          statusText = chalk.yellow('(needs config)');
        } else if (tool.status === 'error') {
          statusIcon = chalk.red('✗');
          statusText = chalk.red('(error)');
        }
        
        console.log(`  ${statusIcon} ${chalk.cyan(tool.name)} - ${tool.description} ${statusText}`);
        
        if (tool.errorMessage) {
          console.log(`    ${chalk.red('Error:')} ${tool.errorMessage}`);
        }
      }
      
      console.log();
      console.log(chalk.gray('Tip: Use "aikit skills <tool-name> config" to configure a tool\n'));
    });

  skillsCmd
    .command('show <name>')
    .description('Show skill details')
    .action(async (name: string) => {
      const config = await loadConfig();
      const engine = new SkillEngine(config);
      const skill = await engine.getSkill(name);
      
      if (!skill) {
        logger.error(`Skill not found: ${name}`);
        process.exit(1);
      }
      
      console.log(chalk.bold(`\n📖 Skill: ${skill.name}\n`));
      console.log(chalk.gray(skill.description));
      console.log(chalk.bold('\nWorkflow:'));
      console.log(skill.content);
    });

  skillsCmd
    .command('create <name>')
    .description('Create a new skill')
    .action(async (name: string) => {
      const config = await loadConfig();
      const engine = new SkillEngine(config);
      await engine.createSkill(name);
      logger.success(`Skill created: ${name}`);
    });

  skillsCmd
    .command('sync')
    .description('Sync global skills to project')
    .action(async () => {
      const config = await loadConfig();
      const engine = new SkillEngine(config);
      const result = await engine.syncSkillsToProject();
      
      if (result.count === 0) {
        logger.info('Skills already in sync or no global skills to sync');
      } else {
        console.log(chalk.bold(`\n✓ Synced ${result.count} skills to project:\n`));
        for (const skill of result.synced) {
          console.log(`  ${chalk.cyan('•')} ${skill}`);
        }
        console.log();
      }
    });

  // Tool configuration command - supports "config <tool-name>"
  skillsCmd
    .command('config <tool-name>')
    .description('Configure a tool (e.g., config figma-analysis)')
    .action(async (toolName: string) => {
      await configureToolAction(toolName);
    });

  // Tool configuration command - supports "<tool-name> config" pattern
  skillsCmd
    .command('*')
    .description('Configure a tool (e.g., figma-analysis config)')
    .allowUnknownOption()
    .action(async () => {
      // Parse arguments manually from process.argv
      const args = process.argv.slice(process.argv.indexOf('skills') + 1);
      const toolName = args[0];
      const action = args[1];
      
      // Only handle if action is 'config', otherwise show error
      if (action === 'config' && toolName) {
        await configureToolAction(toolName);
      } else {
        // Not a tool config command, show help
        logger.error(`Unknown command: ${toolName || 'unknown'} ${action || ''}`);
        console.log(chalk.gray('\nAvailable commands:'));
        console.log('  aikit skills list                    - List all skills and tools');
        console.log('  aikit skills show <name>              - Show skill details');
        console.log('  aikit skills config <tool-name>       - Configure a tool');
        console.log('  aikit skills <tool-name> config       - Configure a tool (alternative syntax)');
        console.log();
        process.exit(1);
      }
    });

  return skillsCmd;
}

/**
 * Configure a tool action
 */
async function configureToolAction(toolName: string): Promise<void> {
  const config = await loadConfig();
  const { ToolConfigManager } = await import('../../core/tool-config.js');
  const toolConfigManager = new ToolConfigManager(config);
  
  const tool = await toolConfigManager.getToolConfig(toolName);
  
  if (!tool) {
    logger.error(`Tool not found: ${toolName}`);
    console.log(chalk.gray('\nAvailable tools:'));
    const tools = await toolConfigManager.listTools();
    for (const t of tools) {
      console.log(`  - ${chalk.cyan(t.name)}`);
    }
    console.log();
    console.log(chalk.gray('Tip: If you meant to show a skill, use: aikit skills show <name>'));
    console.log();
    process.exit(1);
  }
  
  console.log(chalk.bold(`\n🔧 Configuring: ${tool.name}\n`));
  console.log(chalk.gray(tool.description));
  console.log();
  
  if (tool.configMethod === 'oauth') {
    // Use OAuth flow
    if (toolName === 'figma-analysis') {
      const { FigmaOAuth } = await import('../../core/auth/figma-oauth.js');
      const oauth = new FigmaOAuth(toolConfigManager);

      try {
        const token = await oauth.authenticate();

        // Validate token
        console.log(chalk.gray('\nValidating token...'));
        const isValid = await oauth.validateToken(token);

        if (isValid) {
          logger.success(`\n✅ ${tool.name} configured successfully!`);

          // Configure Claude Desktop MCP server
          console.log(chalk.gray('\nConfiguring Claude Desktop MCP server...'));
          await toolConfigManager.configureMcpServer(toolName, token);

          console.log(chalk.gray('\nYou can now use the /analyze-figma command in OpenCode.\n'));
        } else {
          await toolConfigManager.updateToolConfig(toolName, {
            status: 'error',
            errorMessage: 'Token validation failed',
          });
          logger.error('Token validation failed. Please try again.');
          process.exit(1);
        }
      } catch (error) {
        await toolConfigManager.updateToolConfig(toolName, {
          status: 'error',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        logger.error(`Configuration failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    } else {
      logger.error(`OAuth flow not implemented for tool: ${toolName}`);
      process.exit(1);
    }
  } else if (tool.configMethod === 'manual') {
    // Manual configuration
    logger.info('Manual configuration not yet implemented');
    process.exit(1);
  } else {
    logger.info(`Tool ${tool.name} does not require configuration`);
  }
}




