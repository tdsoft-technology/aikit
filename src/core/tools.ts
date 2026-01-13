import { readdir, writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { z } from 'zod';
import { Config } from './config.js';
import { paths } from '../utils/paths.js';
import { logger } from '../utils/logger.js';

/**
 * Tool argument schema
 */
export const ToolArgSchema = z.object({
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
  description: z.string(),
  required: z.boolean().optional().default(true),
  default: z.any().optional(),
});

export type ToolArg = z.infer<typeof ToolArgSchema>;

/**
 * Tool definition
 */
export interface Tool {
  name: string;
  description: string;
  args: Record<string, ToolArg>;
  execute: (args: Record<string, unknown>, context?: { config?: Config; toolConfigManager?: any }) => Promise<string>;
  filePath?: string;
}

/**
 * Tool definition helper for type safety
 */
export function defineTool(config: {
  name: string;
  description: string;
  args: Record<string, ToolArg>;
  execute: (args: Record<string, unknown>) => Promise<string>;
}): Tool {
  return config;
}

/**
 * Built-in tools
 */
const BUILT_IN_TOOLS: Tool[] = [
  {
    name: 'websearch',
    description: 'Search the web for documentation, articles, and current information',
    args: {
      query: {
        type: 'string',
        description: 'The search query',
        required: true,
      },
      numResults: {
        type: 'number',
        description: 'Number of results to return (default: 5)',
        required: false,
        default: 5,
      },
    },
    async execute({ query }) {
      // This would integrate with a search API (Exa, Tavily, etc.)
      // For now, return placeholder
      return `Web search results for: "${query}"\n\nNote: Configure a search provider in AIKit settings for actual results.`;
    },
  },
  {
    name: 'codesearch',
    description: 'Search GitHub for code patterns and examples across millions of repositories',
    args: {
      query: {
        type: 'string',
        description: 'The code pattern or search query',
        required: true,
      },
      language: {
        type: 'string',
        description: 'Programming language to filter by',
        required: false,
      },
    },
    async execute({ query, language }) {
      // This would integrate with GitHub code search
      const langFilter = language ? ` in ${language}` : '';
      return `GitHub code search for: "${query}"${langFilter}\n\nNote: Configure GitHub integration in AIKit settings for actual results.`;
    },
  },
  {
    name: 'memory-read',
    description: 'Read from persistent memory (project or global)',
    args: {
      key: {
        type: 'string',
        description: 'The memory key to read',
        required: true,
      },
    },
    async execute({ key }, context?: { config?: Config }) {
      const config = context?.config;
      if (!config) {
        return 'Error: Configuration not available';
      }

      try {
        const { MemoryManager } = await import('./memory.js');
        const memory = new MemoryManager(config);
        const content = await memory.read(key as string);

        if (!content) {
          return `Memory entry not found: ${key as string}\n\nAvailable keys (use \`list_session\` or \`aikit memory list\`):\n- handoffs/\n- observations/\n- research/\n- _templates/`;
        }

        return content;
      } catch (error) {
        return `Error reading memory: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  },
  {
    name: 'memory-update',
    description: 'Update persistent memory with new information',
    args: {
      key: {
        type: 'string',
        description: 'The memory key to update',
        required: true,
      },
      content: {
        type: 'string',
        description: 'The content to write',
        required: true,
      },
      append: {
        type: 'boolean',
        description: 'Whether to append to existing content (default: true)',
        required: false,
        default: true,
      },
    },
    async execute({ key, content, append = true }, context?: { config?: Config }) {
      const config = context?.config;
      if (!config) {
        return 'Error: Configuration not available';
      }

      if (typeof content !== 'string') {
        return 'Error: content must be a string';
      }

      try {
        const { MemoryManager } = await import('./memory.js');
        const memory = new MemoryManager(config);
        await memory.update(key as string, content as string, { append: append as boolean | undefined });
        return `✓ Saved to memory: ${key as string}${append ? ' (appended)' : ' (overwrote)'}`;
      } catch (error) {
        return `Error updating memory: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  },
  {
    name: 'find_skills',
    description: 'Find available workflow skills',
    args: {
      query: {
        type: 'string',
        description: 'Optional search query to filter skills',
        required: false,
      },
    },
    async execute({ query }) {
      // Implemented by SkillEngine integration
      return `Skills matching: ${query || 'all'}`;
    },
  },
  {
    name: 'use_skill',
    description: 'Load and use a specific skill workflow',
    args: {
      name: {
        type: 'string',
        description: 'Name of the skill to use',
        required: true,
      },
    },
    async execute({ name }) {
      // Implemented by SkillEngine integration
      return `Loading skill: ${name}`;
    },
  },
  {
    name: 'read_figma_design',
    description: 'Read and analyze a Figma design using Figma API. Extracts design tokens including colors, typography, spacing, components, and layout.',
    args: {
      url: {
        type: 'string',
        description: 'Figma design URL to analyze (must start with https://www.figma.com/design/)',
        required: true,
      },
    },
    async execute({ url }, context?: { toolConfigManager?: import('./tool-config.js').ToolConfigManager; config?: Config }) {
      // Validate Figma URL
      if (!url || typeof url !== 'string') {
        return 'Error: Invalid URL provided';
      }
      
      if (!url.startsWith('https://www.figma.com/design/') && !url.startsWith('http://www.figma.com/design/')) {
        return `Error: Invalid Figma URL format. URL must start with https://www.figma.com/design/\n\nProvided URL: ${url}`;
      }

      // Check if Figma tool is configured
      const configManager = context?.toolConfigManager;
      if (!configManager) {
        return `Error: Tool configuration manager not available. This usually means the MCP server isn't properly initialized. Please restart OpenCode.\n\nIf the issue persists, configure Figma tool manually: aikit skills figma-analysis config`;
      }

      const isReady = await configManager.isToolReady('figma-analysis');
      if (!isReady) {
        // Provide more helpful error message
        const toolConfig = await configManager.getToolConfig('figma-analysis');
        if (toolConfig?.status === 'error') {
          return `Error: Figma tool configuration error: ${toolConfig.errorMessage || 'Unknown error'}\n\nPlease reconfigure: aikit skills figma-analysis config`;
        }
        return `Error: Figma tool is not configured. Please run: aikit skills figma-analysis config\n\nThis will guide you through setting up your Figma Personal Access Token.`;
      }

      const apiKey = await configManager.getApiKey('figma-analysis');
      if (!apiKey) {
        return `Error: Figma API key not found. Please run: aikit skills figma-analysis config`;
      }

      try {
        // Use Figma MCP client to extract design tokens with database persistence
        const { FigmaMcpClient } = await import('./tools/figma-mcp.js');
        
        // Get database if available
        let database;
        try {
          if (context?.config) {
            database = context.config.getDatabase();
          }
        } catch (error) {
          // Database disabled or error - continue without persistence
          logger.info('Database not available for Figma persistence');
        }
        
        const client = new FigmaMcpClient(apiKey, configManager, database);
        
        // Determine assets directory (use project root or current working directory)
        const assetsDir = './assets/images';
        
        // Extract design tokens (without downloading assets yet - will do after screen selection)
        const tokens = await client.extractDesignTokens(url, false, assetsDir);

        // Format results
        let result = `# Figma Design Analysis\n\n`;
        result += `**URL**: ${url}\n\n`;
        
        result += `## Design Structure & Content\n\n`;
        
        // Structure hierarchy
        if (tokens.structure) {
          result += `### Node Hierarchy (${tokens.structure.nodes.length} nodes)\n\n`;
          result += `\`\`\`\n${tokens.structure.hierarchy}\n\`\`\`\n\n`;
          
          // Key elements with content
          const textNodes = tokens.structure.nodes.filter(n => n.type === 'TEXT' && n.content);
          if (textNodes.length > 0) {
            result += `### Text Content (${textNodes.length} text elements)\n\n`;
            textNodes.slice(0, 20).forEach(node => {
              const preview = node.content && node.content.length > 100 
                ? node.content.substring(0, 100) + '...' 
                : node.content;
              result += `- **${node.name}**: "${preview}"\n`;
              if (node.styles) {
                result += `  - Style: ${node.styles.fontFamily || 'N/A'} ${node.styles.fontSize || 'N/A'}px, weight ${node.styles.fontWeight || 'N/A'}\n`;
              }
            });
            if (textNodes.length > 20) {
              result += `\n... and ${textNodes.length - 20} more text elements\n`;
            }
            result += `\n`;
          }

          // Layout structure
          const frameNodes = tokens.structure.nodes.filter(n => n.type === 'FRAME' || n.type === 'COMPONENT');
          if (frameNodes.length > 0) {
            result += `### Layout Structure (${frameNodes.length} frames/components)\n\n`;
            frameNodes.slice(0, 15).forEach(node => {
              result += `- **${node.name}** (${node.type})\n`;
              if (node.position) {
                result += `  - Position: x=${Math.round(node.position.x)}, y=${Math.round(node.position.y)}\n`;
                result += `  - Size: ${Math.round(node.position.width)}×${Math.round(node.position.height)}px\n`;
              }
              if (node.styles?.layout) {
                result += `  - Layout: ${node.styles.layout}${node.styles.gap ? `, gap: ${node.styles.gap}px` : ''}\n`;
              }
              if (node.children && node.children.length > 0) {
                result += `  - Children: ${node.children.length}\n`;
              }
            });
            if (frameNodes.length > 15) {
              result += `\n... and ${frameNodes.length - 15} more frames/components\n`;
            }
            result += `\n`;
          }
        }
        
        result += `## Design Tokens\n\n`;
        
        // Colors
        if (tokens.colors.length > 0) {
          result += `### Colors (${tokens.colors.length} found)\n\n`;
          tokens.colors.slice(0, 30).forEach(color => {
            result += `- \`${color.hex}\`\n`;
          });
          if (tokens.colors.length > 30) {
            result += `\n... and ${tokens.colors.length - 30} more colors\n`;
          }
          result += `\n`;
        }

        // Typography
        if (tokens.typography.length > 0) {
          result += `### Typography (${tokens.typography.length} styles)\n\n`;
          tokens.typography.forEach(typography => {
            result += `- **${typography.name}**: ${typography.fontFamily}, ${typography.fontSize}px, weight ${typography.fontWeight}, line-height ${typography.lineHeight}px\n`;
          });
          result += `\n`;
        }

        // Spacing
        result += `### Spacing System\n\n`;
        result += `- Base unit: ${tokens.spacing.unit}px\n`;
        result += `- Scale: ${tokens.spacing.scale.length > 0 ? tokens.spacing.scale.join(', ') : 'Not detected'}\n\n`;

        // Components
        if (tokens.components.length > 0) {
          result += `### Components (${tokens.components.length} found)\n\n`;
          tokens.components.forEach(component => {
            result += `- **${component.name}**: ${component.type}${component.description ? ` - ${component.description}` : ''}\n`;
          });
          result += `\n`;
        }

        // Screens - Show with selection prompt
        if (tokens.screens.length > 0) {
          result += `## Available Screens/Frames (${tokens.screens.length} found)\n\n`;
          result += `**Please confirm which screen(s) you want to develop:**\n\n`;
          tokens.screens.forEach((screen, index) => {
            result += `${index + 1}. **${screen.name}**\n`;
            result += `   - Size: ${screen.width}×${screen.height}px\n`;
            result += `   - Type: ${screen.type}\n`;
            if (screen.childrenCount) {
              result += `   - Components: ${screen.childrenCount}\n`;
            }
            result += `   - ID: \`${screen.id}\`\n\n`;
          });
          result += `\n**To proceed, simply reply with the screen number(s) or name(s) you want to develop.**\n`;
          result += `Example: "1" or "Main Page" or "1, 2, 3"\n\n`;
        }

        // Breakpoints
        result += `### Responsive Breakpoints\n\n`;
        result += `- ${tokens.breakpoints.join('px, ')}px\n\n`;

        // Assets
        if (tokens.assets && tokens.assets.length > 0) {
          result += `## Downloaded Assets (${tokens.assets.length} files)\n\n`;
          result += `All assets have been downloaded to: \`${tokens.assets[0].path.split('/').slice(0, -1).join('/')}\`\n\n`;
          result += `### Image Files\n\n`;
          tokens.assets.forEach(asset => {
            const relativePath = asset.path.replace(process.cwd() + '/', '');
            result += `- **${asset.nodeName}** (${asset.nodeType})\n`;
            result += `  - File: \`${relativePath}\`\n`;
            if (asset.width && asset.height) {
              result += `  - Size: ${Math.round(asset.width)}×${Math.round(asset.height)}px\n`;
            }
            result += `  - Format: ${asset.format.toUpperCase()}\n`;
            result += `  - Usage: \`<img src="${relativePath}" alt="${asset.nodeName}" />\`\n\n`;
          });
        }

        result += `## Implementation Guide\n\n`;
        result += `### Structure Analysis\n`;
        result += `The design contains ${tokens.structure?.nodes.length || 0} nodes organized in a hierarchical structure.\n`;
        result += `Use the node hierarchy above to understand:\n`;
        result += `1. **Component structure** - How elements are organized\n`;
        result += `2. **Text content** - All text content from TEXT nodes\n`;
        result += `3. **Layout properties** - Flex direction, gaps, padding\n`;
        result += `4. **Positioning** - Exact x, y, width, height values\n\n`;
        result += `### Next Steps\n\n`;
        result += `1. Review the structure hierarchy to understand component organization\n`;
        result += `2. Extract text content from TEXT nodes for HTML content\n`;
        result += `3. Use position and size data for pixel-perfect CSS\n`;
        result += `4. Use layout properties (HORIZONTAL/VERTICAL) for flexbox/grid\n`;
        result += `5. Use extracted design tokens (colors, typography) for styling\n`;
        result += `6. Save this analysis: \`memory-update("research/figma-analysis", "[this analysis]")\`\n`;

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error analyzing Figma design: ${errorMessage}\n\nPlease check:\n1. The Figma URL is correct and accessible\n2. Your Figma API token has proper permissions\n3. The design file is shared with your account`;
      }
    },
  },
  {
    name: 'develop_figma_screen',
    description: 'Smart workflow to develop a specific Figma screen: check current code, pull needed assets, plan, and develop. User just needs to confirm the screen number/name.',
    args: {
      figmaUrl: {
        type: 'string',
        description: 'Figma design URL',
        required: true,
      },
      screenId: {
        type: 'string',
        description: 'Screen ID or name to develop (from read_figma_design output)',
        required: true,
      },
    },
    async execute({ figmaUrl, screenId }, context?: { toolConfigManager?: import('./tool-config.js').ToolConfigManager; config?: Config }) {
      const configManager = context?.toolConfigManager;
      if (!configManager) {
        return 'Error: Tool configuration manager not available.';
      }

      const isReady = await configManager.isToolReady('figma-analysis');
      if (!isReady) {
        return 'Error: Figma tool is not configured. Please run: aikit skills figma-analysis config';
      }

      const apiKey = await configManager.getApiKey('figma-analysis');
      if (!apiKey) {
        return 'Error: Figma API key not found.';
      }

      try {
        const { FigmaMcpClient } = await import('./tools/figma-mcp.js');
        const { checkCurrentCodeStatus, compareCodeWithFigma } = await import('./tools/figma-screen-developer.js');
        
        // Get database if available
        let database;
        try {
          if (context?.config) {
            database = context.config.getDatabase();
          }
        } catch (error) {
          // Database disabled or error - continue without persistence
          logger.info('Database not available for Figma persistence');
        }
        
        const client = new FigmaMcpClient(apiKey, configManager, database);
        
        // Step 1: Extract design tokens
        const tokens = await client.extractDesignTokens(figmaUrl as string, false, './assets/images');
        
        // Step 2: Find selected screen
        const screenIdStr = String(screenId);
        const selectedScreen = tokens.screens?.find((s: any) => 
          s.id === screenIdStr || s.name.toLowerCase() === screenIdStr.toLowerCase()
        );
        
        if (!selectedScreen) {
          return `Error: Screen "${screenId}" not found. Available screens:\n${tokens.screens?.map((s: any, i: number) => `${i + 1}. ${s.name} (ID: ${s.id})`).join('\n') || 'None'}`;
        }

        // Step 3: Check current code status
        const codeStatus = await checkCurrentCodeStatus();
        
        // Step 4: Compare with Figma
        const comparison = await compareCodeWithFigma(tokens, selectedScreen.id);
        
        // Step 5: Download assets for this screen only
        let downloadedAssets: any[] = [];
        const fileKey = (client as any).extractFileKey(figmaUrl as string);
        if (fileKey) {
          try {
            const fileData = await (client as any).getFileData(figmaUrl as string);
            // Use absolute path for assets directory
            const projectPath = process.cwd();
            const assetsDir = join(projectPath, 'assets', 'images');
            const assets = await (client as any).downloadAssets(fileKey, fileData.document, assetsDir, selectedScreen.id);
            downloadedAssets = assets || [];
            logger.info(`Downloaded ${downloadedAssets.length} assets for screen ${selectedScreen.name}`);
          } catch (error) {
            logger.warn(`Failed to download assets: ${error instanceof Error ? error.message : String(error)}`);
            downloadedAssets = [];
          }
        }

        // Step 6: Generate detailed plan
        let result = `# Development Plan for Screen: ${selectedScreen.name}\n\n`;
        result += `## Current Code Status\n\n`;
        result += `- HTML: ${codeStatus.hasHTML ? `✅ ${codeStatus.htmlFile}` : '❌ Not found'}\n`;
        result += `- CSS: ${codeStatus.hasCSS ? `✅ ${codeStatus.cssFiles.length} files` : '❌ Not found'}\n`;
        result += `- Assets: ${codeStatus.hasAssets ? `✅ ${codeStatus.assetCount} files` : '❌ Not found'}\n`;
        result += `- Existing Sections: ${codeStatus.sections.length > 0 ? codeStatus.sections.join(', ') : 'None'}\n\n`;
        
        result += `## Comparison with Figma Design\n\n`;
        result += `- Missing Sections: ${comparison.missingSections.length > 0 ? comparison.missingSections.join(', ') : 'None'}\n`;
        result += `- Missing Assets: ${comparison.missingAssets.length > 0 ? comparison.missingAssets.join(', ') : 'None'}\n`;
        result += `- Needs Update: ${comparison.needsUpdate ? 'Yes' : 'No'}\n\n`;
        
        result += `## Recommendations\n\n`;
        comparison.recommendations.forEach((rec, i) => {
          result += `${i + 1}. ${rec}\n`;
        });
        result += `\n`;
        
        result += `## Downloaded Assets (${downloadedAssets.length})\n\n`;
        if (downloadedAssets.length > 0) {
          downloadedAssets.forEach((asset: any) => {
            const relativePath = asset.path.replace(process.cwd() + '/', '');
            result += `- **${asset.nodeName}** (${asset.nodeType})\n`;
            result += `  - File: \`${relativePath}\`\n`;
            if (asset.width && asset.height) {
              result += `  - Size: ${Math.round(asset.width)}×${Math.round(asset.height)}px\n`;
            }
            result += `  - Usage: \`<img src="${relativePath}" alt="${asset.nodeName}" />\`\n\n`;
          });
          
          // Add critical instruction to use downloaded assets
          result += `\n**⚠️ IMPORTANT: Use downloaded assets above instead of placeholder images!**\n`;
          result += `Replace all Unsplash/placeholder image URLs with the downloaded asset paths.\n\n`;
        } else {
          result += `**No assets downloaded.** This may indicate:\n`;
          result += `1. The screen doesn't contain exportable image nodes\n`;
          result += `2. Assets download failed (check logs)\n`;
          result += `3. Figma API permissions issue\n\n`;
        }
        
        result += `\n## Next Steps\n\n`;
        result += `1. Review the plan above\n`;
        result += `2. Use @build agent to implement missing sections\n`;
        result += `3. Use extracted design tokens for CSS variables\n`;
        result += `4. Use downloaded assets in HTML\n`;
        result += `5. Verify pixel-perfect match with Figma design\n`;

        return result;
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  },
  {
    name: 'list_session',
    description: 'List previous sessions to discover what happened and when. Use this before read_session to find the right context.',
    args: {
      limit: {
        type: 'number',
        description: 'Maximum number of sessions to return (default: 10)',
        required: false,
        default: 10,
      },
    },
    async execute({ limit = 10 }, context?: { config?: Config }) {
      const config = context?.config;
      if (!config) {
        return 'Error: Configuration not available';
      }
      
      // Ensure limit is a number
      const limitNum = typeof limit === 'number' ? limit : 10;
      
      try {
        const { MemoryManager } = await import('./memory.js');
        const memory = new MemoryManager(config);
        const memories = await memory.list();
        
        // Filter handoffs (sessions)
        const handoffs = memories
          .filter(m => m.type === 'handoff')
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
          .slice(0, limitNum);
        
        if (handoffs.length === 0) {
          return 'No previous sessions found. Use /handoff to create a session handoff.';
        }
        
        let result = `# Previous Sessions (${handoffs.length})\n\n`;
        handoffs.forEach((handoff, index) => {
          const sessionId = handoff.key.replace('handoffs/', '');
          result += `${index + 1}. **${sessionId}**\n`;
          result += `   - Updated: ${handoff.updatedAt.toLocaleString()}\n`;
          result += `   - Summary: ${handoff.summary}\n\n`;
        });
        
        result += `\nUse \`read_session\` with a session ID to load full context.`;
        return result;
      } catch (error) {
        return `Error listing sessions: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  },
  {
    name: 'read_session',
    description: 'Load context from a previous session. Returns session summary, user tasks, and file changes.',
    args: {
      sessionId: {
        type: 'string',
        description: 'Session ID from list_session (e.g., "2024-01-15T10-30-00")',
        required: true,
      },
    },
    async execute({ sessionId }, context?: { config?: Config }) {
      const config = context?.config;
      if (!config) {
        return 'Error: Configuration not available';
      }
      
      try {
        const { MemoryManager } = await import('./memory.js');
        const memory = new MemoryManager(config);
        const content = await memory.read(`handoffs/${sessionId}`);
        
        if (!content) {
          return `Session not found: ${sessionId}\n\nUse \`list_session\` to see available sessions.`;
        }
        
        return `# Session Context: ${sessionId}\n\n${content}\n\n---\n\nThis context has been loaded. Use /resume to continue from this point.`;
      } catch (error) {
        return `Error reading session: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  },
  {
    name: 'bead-create',
    description: 'Create a new bead/task for tracking work',
    args: {
      title: {
        type: 'string',
        description: 'Title of bead/task',
        required: true,
      },
      description: {
        type: 'string',
        description: 'Description of what needs to be done',
        required: true,
      },
    },
    async execute({ title, description }, context?: { config?: Config }) {
      const config = context?.config;
      if (!config) {
        return 'Error: Configuration not available';
      }

      if (typeof title !== 'string' || typeof description !== 'string') {
        return 'Error: title and description must be strings';
      }

      try {
        const { BeadsIntegration } = await import('./beads.js');
        const beads = new BeadsIntegration(config.projectPath);
        const bead = await beads.createBead(title, description);
        return `✓ Created bead: ${bead.id}\n\nTitle: ${bead.title}\nDescription: ${description}\n\nUse \`bead-update-status\` to change status or \`bead-complete\` to finish with quality gates.`;
      } catch (error) {
        return `Error creating bead: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  },
  {
    name: 'bead-update-status',
    description: 'Update bead status (todo, in-progress, completed, blocked)',
    args: {
      id: {
        type: 'string',
        description: 'Bead ID (e.g., "bead-001")',
        required: true,
      },
      status: {
        type: 'string',
        description: 'New status: todo, in-progress, completed, blocked',
        required: true,
      },
    },
    async execute({ id, status }, context?: { config?: Config }) {
      const config = context?.config;
      if (!config) {
        return 'Error: Configuration not available';
      }

      if (typeof id !== 'string' || typeof status !== 'string') {
        return 'Error: id and status must be strings';
      }

      const validStatuses = ['todo', 'in-progress', 'completed', 'blocked'];
      if (!validStatuses.includes(status)) {
        return `Error: Invalid status "${status}". Valid statuses: ${validStatuses.join(', ')}`;
      }

      try {
        const { BeadsIntegration } = await import('./beads.js');
        const beads = new BeadsIntegration(config.projectPath);
        const success = await beads.updateBeadStatus(id, status as any);
        if (success) {
          return `✓ Updated bead ${id} to status: ${status}`;
        } else {
          return `Error: Bead ${id} not found`;
        }
      } catch (error) {
        return `Error updating bead status: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  },
  {
    name: 'bead-complete',
    description: 'Complete a bead with quality gates (typecheck, test, lint, build)',
    args: {
      id: {
        type: 'string',
        description: 'Bead ID (e.g., "bead-001")',
        required: true,
      },
    },
    async execute({ id }, context?: { config?: Config }) {
      const config = context?.config;
      if (!config) {
        return 'Error: Configuration not available';
      }

      if (typeof id !== 'string') {
        return 'Error: id must be a string';
      }

      try {
        const { BeadsIntegration } = await import('./beads.js');
        const beads = new BeadsIntegration(config.projectPath);
        const result = await beads.completeBead(id);

        if (!result.success) {
          let errorReport = `❌ Quality gates failed for bead ${id}:\n\n`;
          result.gates.forEach(gate => {
            const status = gate.passed ? '✓' : '✗';
            errorReport += `${status} ${gate.name}`;
            if (gate.error) {
              errorReport += `\n  Error: ${gate.error}`;
            }
            errorReport += '\n';
          });
          return errorReport;
        }

        return `✓ Bead ${id} completed successfully!\n\nAll quality gates passed:\n${result.gates.map(g => `  ✓ ${g.name}`).join('\n')}`;
      } catch (error) {
        return `Error completing bead: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  },
  {
    name: 'bead-list',
    description: 'List all beads in the project',
    args: {
      filter: {
        type: 'string',
        description: 'Filter by status: todo, in-progress, completed, blocked (optional)',
        required: false,
      },
    },
    async execute({ filter }, context?: { config?: Config }) {
      const config = context?.config;
      if (!config) {
        return 'Error: Configuration not available';
      }

      if (filter !== undefined && typeof filter !== 'string') {
        return 'Error: filter must be a string';
      }

      try {
        const { BeadsIntegration } = await import('./beads.js');
        const beads = new BeadsIntegration(config.projectPath);
        const allBeads = await beads.listBeads();

        let filtered = allBeads;
        if (filter && ['todo', 'in-progress', 'completed', 'blocked'].includes(filter)) {
          filtered = allBeads.filter(b => b.status === filter);
        }

        if (filtered.length === 0) {
          return `No beads found${filter ? ` with status "${filter}"` : ''}`;
        }

        let result = `# Beads (${filtered.length})\n\n`;
        filtered.forEach(bead => {
          const statusEmoji = {
            'todo': '⏸️',
            'in-progress': '🔄',
            'completed': '✅',
            'blocked': '🚫'
          }[bead.status] || '❓';

          result += `${statusEmoji} **${bead.id}**: ${bead.title}\n`;
          result += `   Status: ${bead.status}\n`;
          result += `   Updated: ${bead.updatedAt.toLocaleString()}\n`;
          if (bead.description) {
            const desc = bead.description.length > 100 ? bead.description.slice(0, 100) + '...' : bead.description;
            result += `   Description: ${desc}\n`;
          }
          result += '\n';
        });

        return result.trim();
      } catch (error) {
        return `Error listing beads: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  },
  {
    name: 'bead-update-type',
    description: 'Update the type of an existing bead (feature, pattern, decision, knowledge)',
    args: {
      id: {
        type: 'string',
        description: 'Bead ID (e.g., "bead-001")',
        required: true,
      },
      type: {
        type: 'string',
        description: 'New type: feature, pattern, decision, or knowledge',
        required: true,
      },
    },
    async execute({ id, type }, context?: { config?: Config }) {
      const config = context?.config;
      if (!config) {
        return 'Error: Configuration not available';
      }

      if (typeof id !== 'string') {
        return 'Error: id must be a string';
      }
      if (typeof type !== 'string') {
        return 'Error: type must be a string';
      }

      const validTypes = ['feature', 'pattern', 'decision', 'knowledge'];
      if (!validTypes.includes(type)) {
        return `Error: Invalid type "${type}". Valid types: ${validTypes.join(', ')}`;
      }

      try {
        const { BeadsIntegration } = await import('./beads.js');
        const beads = new BeadsIntegration(config.projectPath);
        const success = await beads.updateBeadType(id, type as any);
        if (success) {
          return `✓ Updated bead ${id} type to: ${type}`;
        } else {
          return `Error: Bead ${id} not found`;
        }
      } catch (error) {
        return `Error updating bead type: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  },
];

/**
 * Tool Registry - Manages custom tools for AI agents
 */
export class ToolRegistry {
  private config: Config;
  private tools: Map<string, Tool> = new Map();
  private toolConfigManager?: import('./tool-config.js').ToolConfigManager;

  constructor(config: Config) {
    this.config = config;
    
    // Register built-in tools
    for (const tool of BUILT_IN_TOOLS) {
      this.tools.set(tool.name, tool);
    }
  }

  /**
   * Set tool config manager (for tools that need configuration)
   */
  setToolConfigManager(manager: import('./tool-config.js').ToolConfigManager): void {
    this.toolConfigManager = manager;
  }

  /**
   * List all available tools
   */
  async listTools(): Promise<Tool[]> {
    // Load custom tools
    await this.loadCustomTools();
    return Array.from(this.tools.values());
  }

  /**
   * Get a specific tool
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Register a new tool
   */
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Execute a tool
   */
  async executeTool(name: string, args: Record<string, unknown>, context?: { toolConfigManager?: import('./tool-config.js').ToolConfigManager }): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    // Validate required arguments
    for (const [argName, argDef] of Object.entries(tool.args)) {
      if (argDef.required && args[argName] === undefined) {
        throw new Error(`Missing required argument: ${argName}`);
      }
    }

    // Merge context with config and toolConfigManager from registry
    const mergedContext = {
      ...context,
      config: this.config,
      toolConfigManager: context?.toolConfigManager || this.toolConfigManager,
    };

    // Check if tool.execute accepts context parameter
    if (tool.execute.length === 2) {
      return await (tool.execute as (args: Record<string, unknown>, context?: any) => Promise<string>)(args, mergedContext);
    }

    return await tool.execute(args);
  }

  /**
   * Create a custom tool
   */
  async createTool(name: string, options: {
    description: string;
    args: Record<string, ToolArg>;
    code: string;
    global?: boolean;
  }): Promise<void> {
    const configPath = options.global ? paths.globalConfig() : this.config.configPath;
    const toolsDir = paths.tools(configPath);
    
    await mkdir(toolsDir, { recursive: true });
    
    const fileName = `${name}.ts`;
    const filePath = join(toolsDir, fileName);
    
    const argsSchema = Object.entries(options.args)
      .map(([argName, arg]) => `    ${argName}: {
      type: '${arg.type}',
      description: '${arg.description}',
      required: ${arg.required ?? true},
    }`)
      .join(',\n');
    
    const content = `import { defineTool } from 'aikit';

export default defineTool({
  name: '${name}',
  description: '${options.description}',
  args: {
${argsSchema}
  },
  async execute(args) {
${options.code}
  }
});
`;
    
    await writeFile(filePath, content);
  }

  /**
   * Format tool for agent consumption
   */
  formatForAgent(tool: Tool): string {
    const argsDesc = Object.entries(tool.args)
      .map(([name, arg]) => `  - ${name} (${arg.type}${arg.required ? ', required' : ''}): ${arg.description}`)
      .join('\n');
    
    return `## Tool: ${tool.name}

${tool.description}

### Arguments
${argsDesc}
`;
  }

  /**
   * Load custom tools from disk
   */
  private async loadCustomTools(): Promise<void> {
    // Load from global config
    const globalToolsPath = paths.tools(paths.globalConfig());
    await this.loadToolsFromDir(globalToolsPath);
    
    // Load from project config (override global)
    const projectToolsPath = paths.tools(this.config.configPath);
    if (projectToolsPath !== globalToolsPath) {
      await this.loadToolsFromDir(projectToolsPath);
    }
  }

  private async loadToolsFromDir(dir: string): Promise<void> {
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      return; // Directory doesn't exist
    }
    
    for (const file of files) {
      if (extname(file) !== '.ts' && extname(file) !== '.js') continue;
      
      const filePath = join(dir, file);
      
      try {
        // Dynamic import of custom tool
        const toolModule = await import(`file://${filePath}`);
        const tool = toolModule.default as Tool;
        
        if (tool?.name && typeof tool.execute === 'function') {
          tool.filePath = filePath;
          this.tools.set(tool.name, tool);
        }
      } catch (error) {
        // Failed to load tool, skip
        logger.warn(`Failed to load tool from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}
