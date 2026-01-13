import { readFile, writeFile, mkdir, access, constants } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { z } from 'zod';
import { Config } from './config.js';
import { logger } from '../utils/logger.js';

/**
 * Tool configuration status
 */
export type ToolStatus = 'ready' | 'needs_config' | 'error';

/**
 * Configuration method
 */
export type ConfigMethod = 'oauth' | 'manual' | 'none';

/**
 * Tool configuration schema
 */
const ToolConfigSchema = z.object({
  name: z.string(),
  status: z.enum(['ready', 'needs_config', 'error']),
  description: z.string(),
  configMethod: z.enum(['oauth', 'manual', 'none']),
  config: z.record(z.unknown()).optional(),
  errorMessage: z.string().optional(),
});

export type ToolConfig = z.infer<typeof ToolConfigSchema>;

/**
 * Tools registry with configuration
 */
const REGISTERED_TOOLS: Omit<ToolConfig, 'status' | 'config' | 'errorMessage'>[] = [
  {
    name: 'figma-analysis',
    description: 'Analyze Figma designs and extract design tokens using Figma API',
    configMethod: 'oauth',
  },
  // Add more tools here as needed
];

/**
 * Tool Configuration Manager
 */
export class ToolConfigManager {
  private config: Config;
  private toolsConfigPath: string;

  constructor(config: Config) {
    this.config = config;
    this.toolsConfigPath = join(this.config.configPath, 'config', 'tools.json');
  }

  /**
   * Get all registered tools with their current status
   */
  async listTools(): Promise<ToolConfig[]> {
    const savedConfigs = await this.loadConfigs();
    const tools: ToolConfig[] = [];

    for (const tool of REGISTERED_TOOLS) {
      const saved = savedConfigs[tool.name];
      const toolConfig: ToolConfig = {
        ...tool,
        status: this.determineStatus(tool, saved),
        config: saved?.config,
        errorMessage: saved?.errorMessage,
      };
      tools.push(toolConfig);
    }

    return tools;
  }

  /**
   * Get configuration for a specific tool
   */
  async getToolConfig(toolName: string): Promise<ToolConfig | null> {
    const tools = await this.listTools();
    return tools.find(t => t.name === toolName) || null;
  }

  /**
   * Update tool configuration
   */
  async updateToolConfig(toolName: string, updates: {
    config?: Record<string, unknown>;
    status?: ToolStatus;
    errorMessage?: string;
  }): Promise<void> {
    const savedConfigs = await this.loadConfigs();
    const tool = REGISTERED_TOOLS.find(t => t.name === toolName);

    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    const existing = savedConfigs[toolName] || {};
    savedConfigs[toolName] = {
      ...existing,
      ...updates,
    };

    await this.saveConfigs(savedConfigs);
  }

  /**
   * Check if a tool is ready to use
   */
  async isToolReady(toolName: string): Promise<boolean> {
    const toolConfig = await this.getToolConfig(toolName);
    const isReady = toolConfig?.status === 'ready';
    logger.info(`🔍 Tool ready check for ${toolName}:`, {
      hasConfig: !!toolConfig,
      status: toolConfig?.status,
      isReady
    });
    return isReady;
  }

  /**
   * Get API key for a tool (if configured)
   */
  async getApiKey(toolName: string): Promise<string | null> {
    const toolConfig = await this.getToolConfig(toolName);
    logger.info(`🔍 Getting API key for ${toolName}:`, {
      hasConfig: !!toolConfig,
      hasApiKey: !!toolConfig?.config?.apiKey,
      status: toolConfig?.status,
      apiKeyLength: typeof toolConfig?.config?.apiKey === 'string' ? toolConfig.config.apiKey.length : 0
    });
    if (toolConfig?.config?.apiKey && typeof toolConfig.config.apiKey === 'string') {
      return toolConfig.config.apiKey;
    }
    return null;
  }

  /**
   * Determine tool status based on configuration
   */
  private determineStatus(
    tool: Omit<ToolConfig, 'status' | 'config' | 'errorMessage'>,
    saved?: { config?: Record<string, unknown>; errorMessage?: string }
  ): ToolStatus {
    if (tool.configMethod === 'none') {
      logger.info(`🔍 Tool ${tool.name} uses 'none' config method - marking as ready`);
      return 'ready';
    }

    if (saved?.errorMessage) {
      logger.warn(`🔍 Tool ${tool.name} has error: ${saved.errorMessage}`);
      return 'error';
    }

    if (tool.configMethod === 'oauth' || tool.configMethod === 'manual') {
      // Check if API key is configured
      const hasApiKey = saved?.config?.apiKey && typeof saved.config.apiKey === 'string' && saved.config.apiKey.length > 0;
      logger.info(`🔍 Tool ${tool.name} status check:`, {
        configMethod: tool.configMethod,
        hasSaved: !!saved,
        hasConfig: !!saved?.config,
        hasApiKey,
        apiKeyLength: typeof saved?.config?.apiKey === 'string' ? saved.config.apiKey.length : 0
      });
      if (hasApiKey) {
        return 'ready';
      }
      return 'needs_config';
    }

    logger.warn(`🔍 Tool ${tool.name} fell through to default 'needs_config'`);
    return 'needs_config';
  }

  /**
   * Load saved configurations
   * Checks both global and project configs, project takes precedence
   */
  private async loadConfigs(): Promise<Record<string, { config?: Record<string, unknown>; errorMessage?: string }>> {
    // Load global config first (as base)
    const globalConfigPath = join(homedir(), '.config', 'aikit', 'config', 'tools.json');
    let configs: Record<string, any> = {};
    
    try {
      await access(globalConfigPath, constants.R_OK);
      const content = await readFile(globalConfigPath, 'utf-8');
      configs = JSON.parse(content);
      logger.info('Loaded global tool configs');
    } catch {
      // No global config, that's okay
    }
    
    // Load project config and merge (project overrides global)
    try {
      await access(this.toolsConfigPath, constants.R_OK);
      const content = await readFile(this.toolsConfigPath, 'utf-8');
      const projectConfigs = JSON.parse(content);
      configs = { ...configs, ...projectConfigs }; // Project overrides global
      logger.info('Loaded project tool configs');
    } catch {
      // No project config, use global only
    }
    
    return configs;
  }

  /**
   * Save configurations
   */
  private async saveConfigs(configs: Record<string, unknown>): Promise<void> {
    const configDir = join(this.config.configPath, 'config');
    await mkdir(configDir, { recursive: true });
    await writeFile(this.toolsConfigPath, JSON.stringify(configs, null, 2));
  }

  /**
   * Configure Claude Desktop MCP server for a tool
   * This adds the MCP server configuration to Claude Desktop's config file
   */
  async configureMcpServer(toolName: string, apiKey: string): Promise<void> {
    if (toolName !== 'figma-analysis') {
      logger.info(`MCP server configuration not implemented for tool: ${toolName}`);
      return;
    }

    // Determine Claude Desktop config path based on platform
    const isWindows = process.platform === 'win32';
    const claudeConfigBase = isWindows
      ? process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
      : join(homedir(), '.config');
    const claudeConfigPath = join(claudeConfigBase, 'claude', 'claude_desktop_config.json');

    try {
      // Read existing config or create new one
      let claudeConfig: { mcpServers?: Record<string, unknown> } = {};

      try {
        const content = await readFile(claudeConfigPath, 'utf-8');
        claudeConfig = JSON.parse(content);
      } catch {
        // File doesn't exist, start with empty config
        claudeConfig = {};
      }

      // Initialize mcpServers if not present
      if (!claudeConfig.mcpServers) {
        claudeConfig.mcpServers = {};
      }

      // Add Figma MCP server configuration
      // NOTE: Must use --stdio flag for Claude Desktop compatibility
      claudeConfig.mcpServers.figma = {
        command: 'npx',
        args: ['-y', 'figma-developer-mcp', `--figma-oauth-token=${apiKey}`, '--stdio'],
      };

      // Ensure directory exists
      const claudeConfigDir = join(claudeConfigBase, 'claude');
      await mkdir(claudeConfigDir, { recursive: true });

      // Write updated config
      await writeFile(claudeConfigPath, JSON.stringify(claudeConfig, null, 2));

      logger.success('✅ Claude Desktop MCP server configured');
      logger.info(`   Config file: ${claudeConfigPath}`);
      logger.info('');
      logger.info('⚠️  IMPORTANT: Restart Claude Desktop for changes to take effect');
    } catch (error) {
      logger.warn(`Could not configure MCP server automatically: ${error instanceof Error ? error.message : String(error)}`);
      logger.info('');
      logger.info('Please configure manually:');
      logger.info(`1. Edit: ${claudeConfigPath}`);
      logger.info('2. Add the following to "mcpServers":');
      logger.info(JSON.stringify({
        figma: {
          command: 'npx',
          args: ['-y', 'figma-developer-mcp'],
          env: {
            FIGMA_OAUTH_TOKEN: apiKey,
          },
        },
      }, null, 2));
    }
  }
}

