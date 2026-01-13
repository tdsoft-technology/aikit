/**
 * AIKit MCP Server for OpenCode
 * 
 * Exposes AIKit skills, agents, and commands as MCP tools
 * that OpenCode can discover and use via the Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import type { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './core/config.js';
import { SkillEngine } from './core/skills.js';
import { AgentManager } from './core/agents.js';
import { CommandRunner } from './core/commands.js';
import { ToolRegistry } from './core/tools.js';
import { ToolConfigManager } from './core/tool-config.js';
import { logger } from './utils/logger.js';

class AiKitMcpServer {
  private server: Server;
  private skillEngine!: SkillEngine;
  private agentManager!: AgentManager;
  private commandRunner!: CommandRunner;
  private toolRegistry!: ToolRegistry;
  private toolConfigManager!: ToolConfigManager;
  private config!: any; // Store config instance
  private currentMode: string = 'build'; // Default mode

  constructor() {
    // Define server capabilities - must declare tools support
    const capabilities: ServerCapabilities = {
      tools: {},
    };

    this.server = new Server(
      {
      name: 'aikit',
      version: '0.1.0',
      },
      {
        capabilities,
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: await this.getAvailableTools(),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return await this.handleToolCall(request);
    });
  }

  private async getAvailableTools(): Promise<Tool[]> {
    const tools: Tool[] = [];

    try {
      // Add skill tools
      const skills = await this.skillEngine.listSkills();
      for (const skill of skills) {
        tools.push({
          name: `skill_${skill.name.replace(/\s+/g, '_')}`,
          description: `Execute the "${skill.name}" skill: ${skill.description}`,
          inputSchema: {
            type: 'object',
            properties: {
              context: {
                type: 'string',
                description: 'Additional context for the skill',
              },
            },
            required: [],
          },
        });
      }

      // Add agent delegation tools
      const agents = this.agentManager.listAgents();
      for (const agent of agents) {
        tools.push({
          name: `agent_${agent.name}`,
          description: `Delegate to the ${agent.name} agent: ${agent.description}`,
          inputSchema: {
            type: 'object',
            properties: {
              task: {
                type: 'string',
                description: 'Task for the agent to handle',
              },
              context: {
                type: 'string',
                description: 'Optional context',
              },
            },
            required: ['task'],
          },
        });
      }

      // Add command tools
      const commands = await this.commandRunner.listCommands();
      for (const cmd of commands) {
        tools.push({
          name: `cmd_${cmd.name}`,
          description: `Run command: ${cmd.description}`,
          inputSchema: {
            type: 'object',
            properties: {
              args: {
                type: 'string',
                description: 'Arguments for the command',
              },
            },
            required: [],
          },
        });
      }

      // Add built-in tools from ToolRegistry
      const aikitTools = await this.toolRegistry.listTools();
      for (const tool of aikitTools) {
        // Convert Tool to MCP Tool format
        const properties: Record<string, { type: string; description: string }> = {};
        const required: string[] = [];
        
        for (const [argName, argDef] of Object.entries(tool.args)) {
          properties[argName] = {
            type: argDef.type,
            description: argDef.description,
          };
          if (argDef.required) {
            required.push(argName);
          }
        }

        tools.push({
          name: `tool_${tool.name.replace(/\s+/g, '_')}`,
          description: tool.description,
          inputSchema: {
            type: 'object',
            properties,
            required,
          },
        });
      }

      // Add mode management tools
      tools.push({
        name: 'get_current_mode',
        description: 'Get the current AIKit mode (plan, build, one-shot)',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      });

      tools.push({
        name: 'set_mode',
        description: 'Set the AIKit mode (plan, build, one-shot)',
        inputSchema: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              description: 'Mode to set (plan, build, one-shot)',
              required: true,
            },
          },
        },
      });

      tools.push({
        name: 'list_modes',
        description: 'List available AIKit modes',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      });
    } catch (error) {
      logger.error(`Failed to list tools: ${error}`);
    }

    return tools;
  }

  private async handleToolCall(request: {
    params: {
      name: string;
      arguments?: Record<string, unknown>;
    };
  }): Promise<{ content: Array<{ type: string; text: string }> }> {
    const { name, arguments: args } = request.params;

    try {
      let result = '';

      if (name.startsWith('skill_')) {
        const skillName = name.replace('skill_', '').replace(/_/g, '-');
        const skill = await this.skillEngine.getSkill(skillName);

        if (skill) {
          const formatted = this.skillEngine.formatForAgent(skill);
          result = formatted;
        } else {
          result = `Skill not found: ${skillName}`;
        }
      } else if (name.startsWith('agent_')) {
        const task = (args?.task as string) || 'Execute task';
        const context = (args?.context as string) || '';

        const decision = this.agentManager.decideAgent(task, context);
        result = `Delegated to agent: ${decision.agent}\n\nReasoning: ${decision.reason}`;
      } else if (name.startsWith('cmd_')) {
        const cmdName = name.replace('cmd_', '');
        const cmdArgs = (args?.args as string) || '';

        const command = await this.commandRunner.getCommand(cmdName);

        if (command) {
          result = this.commandRunner.formatForAgent(command, cmdArgs);
        } else {
          result = `Command not found: ${cmdName}`;
        }
      } else if (name.startsWith('tool_')) {
        // Remove 'tool_' prefix and keep underscores (tool names use underscores, not dashes)
        const toolName = name.replace('tool_', '');
        try {
          // Verify toolConfigManager is available
          if (!this.toolConfigManager) {
            result = `Error: Tool configuration manager not initialized. MCP server may not be properly started.`;
          } else {
          // Pass both toolConfigManager AND config for database support
          const context = { 
            toolConfigManager: this.toolConfigManager,
            config: this.config 
          };
          result = await this.toolRegistry.executeTool(toolName, args || {}, context);
          }
        } catch (error) {
          result = `Error executing tool ${toolName}: ${error instanceof Error ? error.message : String(error)}`;
        }
      } else if (name === 'get_current_mode') {
        // Get current mode
        const modeInfo = this.getModeInfo(this.currentMode);
        result = `Current mode: ${modeInfo}`;
      } else if (name === 'set_mode') {
        // Set mode
        const mode = args?.mode as string;
        const validModes = ['plan', 'build', 'one-shot'];
        
        if (!mode || !validModes.includes(mode)) {
          result = `Invalid mode. Available modes: ${validModes.join(', ')}`;
        } else {
          this.currentMode = mode;
          const modeInfo = this.getModeInfo(mode);
          result = `Mode set to: ${modeInfo}`;
          
          // Log mode change
          logger.info(`Mode changed to: ${mode}`);
        }
      } else if (name === 'list_modes') {
        // List all modes
        const modes = this.getAllModesInfo();
        result = modes;
      } else {
        result = `Unknown tool: ${name}`;
      }

      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool: ${errorMsg}`,
          },
        ],
      };
    }
  }

  /**
   * Get mode information for display
   */
  private getModeInfo(mode: string): string {
    const modeDescriptions: Record<string, { icon: string; description: string }> = {
      plan: { icon: '📋', description: 'Create detailed implementation plans' },
      build: { icon: '🔧', description: 'Direct execution mode' },
      'one-shot': { icon: '🚀', description: 'End-to-end autonomous execution' },
    };

    const info = modeDescriptions[mode] || modeDescriptions.build;
    return `${info.icon} ${mode.toUpperCase()} - ${info.description}`;
  }

  /**
   * Get all modes information
   */
  private getAllModesInfo(): string {
    const modes = ['plan', 'build', 'one-shot'];
    return modes.map(mode => this.getModeInfo(mode)).join('\n');
  }

  async initialize(): Promise<void> {
    try {
      const config = await loadConfig();
      this.config = config; // CRITICAL: Store config instance for tools to access database
      this.skillEngine = new SkillEngine(config);
      this.agentManager = new AgentManager(config);
      this.commandRunner = new CommandRunner(config);
      this.toolRegistry = new ToolRegistry(config);
      this.toolConfigManager = new ToolConfigManager(config);
      this.toolRegistry.setToolConfigManager(this.toolConfigManager);
      
      // Load mode from config
      this.currentMode = config.mode || 'build';
      logger.info(`AIKit mode set to: ${this.currentMode}`);
      
      // Verify tool config is loaded
      const figmaReady = await this.toolConfigManager.isToolReady('figma-analysis');
      if (figmaReady) {
        logger.info('Figma tool configured and ready');
      } else {
        logger.warn('Figma tool not configured - tools requiring config may not work');
      }
    } catch (error) {
      logger.error(`Failed to initialize: ${error}`);
      process.exit(1);
    }
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('AIKit MCP Server started');
  }
}

async function main(): Promise<void> {
  const server = new AiKitMcpServer();
  await server.initialize();
  await server.start();
}

main().catch((error) => {
  logger.error(`Fatal error: ${error}`);
  process.exit(1);
});
