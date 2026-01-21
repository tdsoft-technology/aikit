/**
 * CLI Helper Functions
 * 
 * Contains utility functions for CLI commands:
 * - initializeConfig: Create AIKit configuration
 * - configureMcpServer: Configure MCP server for OpenCode
 * - installCliTool: Install CLI tools
 * - installToOpenCode: Install AIKit to OpenCode
 */

import { existsSync } from 'fs';
import { mkdir, writeFile, readFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

import { VERSION } from '../index.js';
import { loadConfig } from '../core/config.js';
import { SkillEngine } from '../core/skills.js';
import { CommandRunner } from '../core/commands.js';
import { CliTool, CliToolInfo } from '../utils/cli-detector.js';
import { logger } from '../utils/logger.js';
import { paths } from '../utils/paths.js';
import chalk from 'chalk';

/**
 * Platform configuration for initialization
 */
export interface PlatformConfig {
  primary: 'opencode' | 'claude' | 'cursor';
  opencode: boolean;
  claude: boolean;
  cursor: boolean;
}

/**
 * Initialize AIKit configuration in a directory
 */
export async function initializeConfig(
  configDir: string, 
  _isGlobal?: boolean,
  platformConfig?: PlatformConfig
): Promise<void> {
  // Create directory structure
  const dirs = [
    '',
    'skills',
    'agents',
    'commands',
    'commands/build',
    'commands/git',
    'commands/plan',
    'commands/research',
    'tools',
    'plugins',
    'memory',
    'memory/_templates',
    'memory/handoffs',
    'memory/observations',
    'memory/research',
  ];
  
  for (const dir of dirs) {
    await mkdir(join(configDir, dir), { recursive: true });
  }
  
  // Use provided platform config or defaults
  const platform = platformConfig || {
    primary: 'opencode' as const,
    opencode: true,
    claude: false, // Archived - can be re-enabled later
  };

  // Create default config file
  const defaultConfig = {
    version: VERSION(),
    platform,
    skills: { enabled: true },
    agents: { enabled: true, default: 'build' },
    commands: { enabled: true },
    tools: { enabled: true },
    plugins: { enabled: true },
    memory: { enabled: true },
    beads: { enabled: true },
    antiHallucination: { enabled: true },
    database: { enabled: true, path: '.aikit/figma.db' },
  };
  
  await writeFile(
    join(configDir, 'aikit.json'),
    JSON.stringify(defaultConfig, null, 2)
  );
  
  // Create AGENTS.md template
  const agentsMd = `# AIKit Agent Rules

## Build Commands
- \`npm run build\` - Build the project
- \`npm run test\` - Run tests
- \`npm run lint\` - Run linting

## Code Style
- Use 2 spaces for indentation
- Use single quotes for strings
- Add trailing commas

## Naming Conventions
- Variables: camelCase
- Components: PascalCase
- Files: kebab-case

## Project-Specific Rules
Add your project-specific rules here.
`;
  
  await writeFile(join(configDir, 'AGENTS.md'), agentsMd);
}

/**
 * Configure MCP server for OpenCode
 */
export async function configureMcpServer(projectPath: string): Promise<void> {
  // Get absolute path to MCP server
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFile);
  const aikitPath = join(currentDir, '..', '..');
  const mcpServerPath = join(aikitPath, 'dist', 'mcp-server.js');
  
  // OpenCode config locations (try multiple)
  const configLocations = [
    // Global config (most common)
    join(homedir(), '.config', 'opencode', 'opencode.json'),
    // Project-level config
    join(projectPath, '.opencode', 'opencode.json'),
    // Alternative global location
    join(homedir(), '.opencode', 'opencode.json'),
  ];
  
  // OpenCode MCP server configuration
  const mcpServerConfig = {
    type: 'local',
    command: ['node', mcpServerPath],
    environment: {},
  };
  
  // Try to update OpenCode config
  for (const configPath of configLocations) {
    try {
      const configDir = join(configPath, '..');
      await mkdir(configDir, { recursive: true });
      
      // Read existing config or create new
      let config: any = {};
      if (existsSync(configPath)) {
        try {
          const existing = await readFile(configPath, 'utf-8');
          config = JSON.parse(existing);
        } catch {
          config = {};
        }
      }
      
      // OpenCode uses "mcp" key, not "mcpServers"
      if (!config.mcp) {
        config.mcp = {};
      }
      
      // Add or update aikit MCP server
      config.mcp.aikit = mcpServerConfig;
      
      await writeFile(configPath, JSON.stringify(config, null, 2));
      logger.success(`\n✅ MCP server configured: ${configPath}`);
      logger.info(`   Server: node ${mcpServerPath}`);
      return;
    } catch {
      // Try next location
      continue;
    }
  }
  
  // If all locations failed, create instructions file
  const instructionsPath = join(projectPath, '.opencode', 'MCP_SETUP.md');
  await mkdir(join(projectPath, '.opencode'), { recursive: true });
  await writeFile(instructionsPath, `# AIKit MCP Server Configuration

## Automatic Setup Failed

Please manually configure the MCP server in OpenCode.

## Configuration

Add this to your OpenCode configuration file (\`~/.config/opencode/opencode.json\`):

\`\`\`json
{
  "mcpServers": {
    "aikit": {
      "command": "node",
      "args": ["${mcpServerPath}"],
      "env": {}
    }
  }
}
\`\`\`

## After Configuration

1. Restart OpenCode completely
2. OpenCode will automatically start the MCP server
3. Tools will be available via MCP protocol
4. You can use tools like \`tool_read_figma_design\` directly

## Verify

After restarting OpenCode, check:
- MCP server is running (check OpenCode settings)
- Tools are discoverable (OpenCode should list them)
- You can call tools via MCP protocol
`);
  logger.warn(`\n⚠️  Could not auto-configure MCP server. See: ${instructionsPath}`);
}

/**
 * Install a CLI tool
 */
export async function installCliTool(tool: CliToolInfo): Promise<boolean> {
  try {
    logger.info(`Installing ${tool.displayName}...`);
    
    switch (tool.name) {
      case CliTool.OPENCODE:
        await installToOpenCode(paths.opencodeConfig());
        break;
        
      case CliTool.CLAUDE:
        // Use native install script (recommended by Claude)
        // Defer platform check to avoid cwd issues
        let platform: string;
        try {
          platform = process.platform;
        } catch {
          platform = 'darwin'; // Default to macOS if platform detection fails
        }

        if (platform === 'darwin') {
          // macOS
          execSync('curl -fsSL https://claude.ai/install.sh | bash', { stdio: 'inherit' });
        } else if (platform === 'win32') {
          // Windows
          execSync('powershell -Command "irm https://claude.ai/install.ps1 | iex"', { stdio: 'inherit' });
        } else {
          // Linux/WSL
          execSync('curl -fsSL https://claude.ai/install.sh | bash', { stdio: 'inherit' });
        }
        break;
        
      case CliTool.GITHUB:
        execSync('npm install -g gh', { stdio: 'inherit' });
        break;
    }
    
    return true;
  } catch (error) {
    logger.error(`Failed to install ${tool.displayName}:`, error);
    return false;
  }
}

/**
 * Agent files for OpenCode
 * NOTE: DO NOT create agents named 'build' or 'planner' - these conflict with
 * OpenCode's default modes (Plan, Planner, Build). Use @-mention for subagents instead.
 */
const AGENT_FILES: Record<string, string> = {
  rush: `---
description: Fast execution for small/urgent changes with minimal planning.
mode: subagent
tools:
  "*": true
---

Use for quick fixes, hotfixes, or tiny edits. Keep scope minimal and verify quickly.`,
  review: `---
description: Code review and quality/security auditing agent.
mode: subagent
tools:
  "*": true
---

Use to review correctness, security, performance, maintainability, and tests. Be specific
about issues and suggest concrete fixes.`,
  scout: `---
description: Research agent for external docs, patterns, and references.
mode: subagent
tools:
  "*": true
---

Use to look up docs, examples, best practices. Summarize findings concisely and cite sources.`,
  explore: `---
description: Codebase navigation agent (search, grep, structure understanding).
mode: subagent
tools:
  "*": true
---

Use to locate files, patterns, dependencies, and gather quick context in the repo.`,
  vision: `---
description: Visual analysis agent for mockups, screenshots, PDFs, diagrams.
mode: subagent
tools:
  "*": true
---

Use to interpret visual assets (components, layout, colors, typography) and translate to tasks.`,
  'one-shot': `---
description: End-to-end autonomous task execution (beta). Complete tasks from start to finish.
mode: subagent
tools:
  "*": true
---

⚠️ BETA: This mode is experimental. Use for straightforward tasks first.

## One-Shot Mode - Autonomous Task Execution

Execute tasks end-to-end with minimal intervention:

### Workflow Phases
1. **REQUIREMENTS** - Gather task type, scope, dependencies, success criteria
2. **PLANNING** - Create detailed plan, recommend skills/tools, create tracking bead
3. **COMPLEXITY** - Auto-split if: >30min, >10 files, >500 lines, >2 sub-systems
4. **EXECUTION** - Parallel tasks (max 3), dynamic agent delegation
5. **TESTING** - Run until pass: typecheck → test → lint → build (max 3 retries)
6. **VERIFICATION** - Quality gates ✓ → Manual verification → Deployment approval
7. **COMPLETION** - Generate proof, update tracking, collect feedback

### Quality Gates (ALL must pass)
- \`npm run typecheck\` - No type errors
- \`npm run test\` - All tests pass
- \`npm run lint\` - No lint errors
- \`npm run build\` - Build succeeds

### Error Recovery (3 Levels)
- **Level 1**: Auto-fix (type errors, lint --fix)
- **Level 2**: Alternative approach via @review
- **Level 3**: User intervention + follow-up task

### Delegates To
@planner for planning, @build for implementation, @review for code review,
@scout for research, @explore for navigation, @vision for visual analysis.

### Best Use Cases
- Straightforward features with clear scope
- Bug fixes with known reproduction steps
- Refactoring with defined boundaries

### Consider Alternatives For
- Complex multi-system features → Use /plan + /implement
- Exploratory research → Use /research first
- Critical production changes → Manual with /review`,
};

/**
 * Generate analyze-figma command content
 */
function generateAnalyzeFigmaCommand(): string {
  return `# Command: /analyze-figma

## Description
Analyze a Figma design and extract design tokens

## Usage
\`/analyze-figma <figma-url>\`

## Examples
- \`/analyze-figma https://www.figma.com/design/...\`

## Workflow

Analyze a Figma design and extract all design tokens automatically using Figma API.

**Step 1: Extract Figma URL**

The Figma URL is provided as: \`$ARGUMENTS\`

Extract the URL from \`$ARGUMENTS\`:
- The URL pattern: \`https://www.figma.com/design/...\` or \`http://www.figma.com/design/...\`
- Extract the ENTIRE URL including all query parameters
- If URL contains spaces or line breaks, clean and combine them

**Step 2: Check Tool Configuration**

Before calling the tool, verify that Figma tool is configured:
- If not configured, inform user to run: \`aikit skills figma-analysis config\`
- The tool requires a Figma Personal Access Token

**Step 3: Call MCP Tool**

Use the MCP Figma tool to analyze the design:
\`\`\`
Use MCP tool: mcp__figma__get_figma_data
Arguments: {
  "fileKey": "[extracted file key from URL]"
}
\`\`\`

**Step 4: Format and Save Results**

Format extracted tokens as structured markdown with:
- Colors (from fills and strokes)
- Typography (font families, sizes, weights, line heights)
- Spacing system
- Components
- Screens/Frames
- Layout information

**Category**: design`;
}

/**
 * Install AIKit to OpenCode
 */
export async function installToOpenCode(_opencodePath: string): Promise<void> {
  // Get current working directory for project-level installation
  const projectPath = process.cwd();
  const opencodeCommandDir = join(projectPath, '.opencode', 'command');
  const aikitDir = join(projectPath, '.aikit');
  const opencodeAgentDir = join(paths.opencodeConfig(), 'agent');
  
  // Ensure directories exist
  await mkdir(opencodeCommandDir, { recursive: true });
  await mkdir(join(aikitDir, 'skills'), { recursive: true });
  await mkdir(opencodeAgentDir, { recursive: true });

  // Install agent files
  for (const [name, content] of Object.entries(AGENT_FILES)) {
    const filePath = join(opencodeAgentDir, `${name}.md`);
    try {
      await access(filePath);
      // File exists - check if it has mode: subagent
      const existingContent = await readFile(filePath, 'utf8');
      if (!existingContent.includes('mode: subagent')) {
        // Missing mode: subagent - add it to preserve user edits but ensure critical config
        const matter = await import('gray-matter');
        const { data: frontmatter, content: body } = matter.default(existingContent);
        frontmatter.mode = 'subagent';
        const updatedContent = matter.default.stringify(body, frontmatter);
        await writeFile(filePath, updatedContent, 'utf8');
      }
      // File exists and has mode: subagent - keep user edits
    } catch {
      // File doesn't exist - create it
      await writeFile(filePath, content, 'utf8');
    }
  }
  
  // Load config to get skills and commands
  const config = await loadConfig();
  const skillEngine = new SkillEngine(config);
  const commandRunner = new CommandRunner(config);
  
  const skills = await skillEngine.listSkills();
  const commands = await commandRunner.listCommands();
  
  const opencodeCommands: Record<string, string> = {};
  
  // Create /skills command that lists all available skills
  const skillsList = skills.map(s => `| \`/${s.name.replace(/\s+/g, '-')}\` | ${s.description} |`).join('\n');
  opencodeCommands['skills'] = `List all available AIKit skills and how to use them.

READ .aikit/AGENTS.md

## Available Skills

| Command | Description |
|---------|-------------|
${skillsList}

Type any command to use that skill. For example: \`/test-driven-development\``;

  // Generate commands from skills
  for (const skill of skills) {
    const commandName = skill.name.replace(/\s+/g, '-').toLowerCase();
    const skillPath = skill.filePath;
    const relativePath = skillPath.startsWith(projectPath)
      ? skillPath.replace(projectPath, '').replace(/\\/g, '/').replace(/^\//, '')
      : `.aikit/skills/${skill.name.replace(/\s+/g, '-').toLowerCase()}.md`;

    const useWhen = skill.useWhen || `The user asks you to ${skill.name}`;

    opencodeCommands[commandName] = `Use the **${skill.name} skill** ${useWhen.toLowerCase()}.

READ ${relativePath}

## Description
${skill.description}

## When to Use
${useWhen}

## Workflow
${skill.content.split('\n').slice(0, 20).join('\n')}${skill.content.split('\n').length > 20 ? '\n\n... (see full skill file for complete workflow)' : ''}

**IMPORTANT**: Follow this skill's workflow step by step. Do not skip steps.
Complete the checklist at the end of the skill.`;
  }

  // Generate commands from slash commands
  for (const cmd of commands) {
    // Skip if already exists as a skill command
    if (opencodeCommands[cmd.name]) continue;

    const commandName = cmd.name.replace(/\//g, '').replace(/\s+/g, '-');
    const examples = cmd.examples.map(e => {
      return `- \`${e}\``;
    }).join('\n');

    // Special handling for analyze-figma command
    if (cmd.name === 'analyze-figma') {
      opencodeCommands[commandName] = generateAnalyzeFigmaCommand();
    } else {
      opencodeCommands[commandName] = `# Command: /${cmd.name}

## Description
${cmd.description}

## Usage
\`${cmd.usage}\`

## Examples
${examples}

## Workflow
${cmd.content}

**Category**: ${cmd.category}`;
    }
  }

  // Write all command files
  let count = 0;
  for (const [name, content] of Object.entries(opencodeCommands)) {
    const filePath = join(opencodeCommandDir, `${name}.md`);
    await writeFile(filePath, content.trim());
    logger.info(`  ✓ Created /${name} command`);
    count++;
  }

   logger.success(`\nCreated ${count} OpenCode commands in .opencode/command/`);

   // Configure MCP server
   await configureMcpServer(projectPath);

   logger.info('\nUsage in OpenCode:');
   logger.info('  Press Ctrl+K to open command picker');
   logger.info('  Or type /skills to see all available skills');
   logger.info(`  Available: ${skills.length} skills, ${commands.length} commands`);
   logger.info('  MCP server configured - tools available via MCP protocol');
}

/**
 * Group array by key function
 */
export function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

/**
 * Create a checkpoint
 */
export async function createCheckpoint(message?: string): Promise<void> {
  try {
    const { CheckpointManager } = await import('../core/checkpoints.js');
    const manager = new CheckpointManager();
    const checkpoint = await manager.create(message);

    logger.success('✓ Checkpoint created');
    console.log(`  ID: ${checkpoint.id}`);
    console.log(`  Message: ${checkpoint.message || 'No message'}`);
    console.log(`  Branch: ${checkpoint.branch}`);
    console.log(`  Files: ${checkpoint.files.length} modified`);
  } catch (error) {
    logger.error('Failed to create checkpoint:', error);
  }
}

/**
 * Restore a checkpoint
 */
export async function restoreCheckpoint(checkpointId?: string): Promise<void> {
  try {
    const { CheckpointManager } = await import('../core/checkpoints.js');
    const manager = new CheckpointManager();

    // If no ID provided, get latest
    const id = checkpointId || (await manager.getLatest())?.id;
    if (!id) {
      logger.error('No checkpoints found');
      return;
    }

    logger.info(`Restoring checkpoint: ${id}`);

    const success = await manager.restore(id);
    if (success) {
      logger.success('✓ Checkpoint restored successfully');
    } else {
      logger.error('Failed to restore checkpoint');
    }
  } catch (error) {
    logger.error('Failed to restore checkpoint:', error);
  }
}

/**
 * List checkpoints
 */
export async function listCheckpoints(): Promise<void> {
  try {
    const { CheckpointManager } = await import('../core/checkpoints.js');
    const manager = new CheckpointManager();
    const checkpoints = await manager.list();

    if (checkpoints.length === 0) {
      logger.info('No checkpoints found');
      return;
    }

    console.log('\nAvailable Checkpoints:');
    console.log('━'.repeat(60));

    for (const checkpoint of checkpoints) {
      const date = new Date(checkpoint.timestamp).toLocaleString();
      console.log(`\n${checkpoint.id}`);
      console.log(`  Date: ${date}`);
      console.log(`  Message: ${checkpoint.message || 'No message'}`);
      console.log(`  Branch: ${checkpoint.branch}`);
      console.log(`  Files: ${checkpoint.files.length} modified`);
    }

    console.log('\n' + '━'.repeat(60));
    console.log(`\nTotal: ${checkpoints.length} checkpoint${checkpoints.length > 1 ? 's' : ''}\n`);
    console.log('Restore with: /checkpoint:restore <id>');
    console.log('Latest: /checkpoint:restore latest\n');
  } catch (error) {
    logger.error('Failed to list checkpoints:', error);
  }
}

/**
 * Create a custom agent
 */
export async function createCustomAgent(name: string, description?: string): Promise<void> {
  try {
    const { AgentManager: CustomAgentManager } = await import('../core/agentManager.js');
    const manager = new CustomAgentManager();
    const agent = await manager.createAgent(name, description);

    logger.success(`✓ Agent "${name}" created successfully`);
    console.log(`\nFile: ${agent.filePath}`);
    console.log(`Description: ${agent.description}`);
    console.log(`\nYou can now use this agent with /agent ${name}\n`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      logger.error(`Agent "${name}" already exists`);
    } else {
      logger.error('Failed to create agent:', error);
    }
  }
}

/**
 * List all agents
 */
export async function listAgents(): Promise<void> {
  try {
    const { AgentManager: CustomAgentManager } = await import('../core/agentManager.js');
    const manager = new CustomAgentManager();
    const agents = await manager.listAgents();

    if (agents.length === 0) {
      logger.info('No agents found');
      return;
    }

    // Group by type/category
    const builtIn = agents.filter(a => !a.filePath.includes('.aikit/agents'));
    const custom = agents.filter(a => a.filePath.includes('.aikit/agents'));

    console.log('\nAvailable Agents:');
    console.log('━'.repeat(60));

    if (builtIn.length > 0) {
      console.log('\n### Built-in Agents');
      builtIn.forEach(agent => {
        console.log(`\n• ${agent.name} - ${agent.description}`);
        console.log(`  Use when: ${agent.useWhen}`);
      });
    }

    if (custom.length > 0) {
      console.log('\n### Custom Agents');
      custom.forEach(agent => {
        console.log(`\n• ${agent.name} - ${agent.description}`);
        console.log(`  Use when: ${agent.useWhen}`);
      });
    }

    console.log('\n' + '━'.repeat(60));
    console.log(`\nTotal: ${agents.length} agent${agents.length > 1 ? 's' : ''}\n`);
    console.log('Create a new agent: /create-agent <name> [description]\n');
  } catch (error) {
    logger.error('Failed to list agents:', error);
  }
}

/**
 * Initialize AI-safe git ignore patterns
 */
export async function initGitIgnore(): Promise<void> {
  try {
    const { initAISafeGitignore } = await import('../utils/git-ignore.js');
    const initialized = await initAISafeGitignore();

    if (initialized) {
      logger.success('✓ AI-safe .gitignore patterns added');
      console.log('\nProtected:');
      console.log('  • API keys and secrets (.env, *.key)');
      console.log('  • AI working directories (.aikit/memory/)');
      console.log('  • Configuration files (.claude/settings.json)');
      console.log('  • Logs and temporary files');
      console.log('\n✓ Safe to commit code\n');
    } else {
      logger.info('AI-safe patterns already exist in .gitignore');
    }
  } catch (error) {
    logger.error('Failed to initialize .gitignore:', error);
  }
}

/**
 * Start a new development session
 */
export async function startSession(name?: string, goals?: string[]): Promise<void> {
  try {
    const { SessionManager } = await import('../core/sessions.js');
    const manager = new SessionManager();
    const session = await manager.startSession(name, goals);

    logger.success('✓ Session started');
    console.log(`  ID: ${session.id}`);
    console.log(`  Name: ${session.name}`);
    console.log(`  Started: ${new Date(session.startTime).toLocaleString()}`);
    if (session.goals.length > 0) {
      console.log(`  Goals:`);
      session.goals.forEach(goal => console.log(`    - ${goal}`));
    }

    console.log('\nCommands:');
    console.log('  /session:update [notes] - Add progress notes');
    console.log('  /session:end - End session with summary');
    console.log('  /session:current - Show session status');
    console.log('  /session:use <id> - Switch to a different session\n');
  } catch (error) {
    if (error instanceof Error && error.message.includes('not initialized')) {
      logger.error(error.message);
      console.log('Run "aikit init" first to initialize AIKit in this directory.\n');
    } else {
      logger.error('Failed to start session:', error);
    }
  }
}

/**
 * Update current session with progress notes
 */
export async function updateSession(notes?: string): Promise<void> {
  try {
    const { SessionManager } = await import('../core/sessions.js');
    const manager = new SessionManager();
    const session = await manager.updateSession(notes);

    if (session) {
      logger.success('✓ Session updated');
      console.log(`  Session: ${session.id}`);
      console.log(`  Notes: ${notes || 'Auto-generated'}`);
      console.log(`  Time: ${new Date().toLocaleString()}`);
      if (session.updates[session.updates.length - 1]?.modifiedFiles) {
        const files = session.updates[session.updates.length - 1].modifiedFiles;
        console.log(`  Modified: ${files?.length} files`);
      }
      console.log();
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('not initialized')) {
      logger.error(error.message);
      console.log('Run "aikit init" first to initialize AIKit in this directory.\n');
    } else if (error instanceof Error && error.message.includes('No active session')) {
      logger.error('No active session. Use /session:start first');
    } else {
      logger.error('Failed to update session:', error);
    }
  }
}

/**
 * End current session with summary
 */
export async function endSession(): Promise<void> {
  try {
    const { SessionManager } = await import('../core/sessions.js');
    const manager = new SessionManager();
    const session = await manager.endSession();

    if (session) {
      const duration = session.endTime
        ? Math.floor((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000)
        : 0;

      logger.success('✓ Session ended');
      console.log(`\nSession: ${session.id}`);
      console.log(`Name: ${session.name}`);
      console.log(`Duration: ${Math.floor(duration / 60)}h ${duration % 60}m`);
      console.log(`Updates: ${session.updates.length}`);

      if (session.goals.length > 0) {
        console.log(`\nGoals:`);
        session.goals.forEach(goal => console.log(`  - ${goal}`));
      }

      const lastUpdate = session.updates[session.updates.length - 1];
      if (lastUpdate?.gitCommits) {
        console.log(`\nGit Activity:`);
        console.log(`  Commits: ${lastUpdate.gitCommits}`);
        if (lastUpdate.modifiedFiles && lastUpdate.modifiedFiles.length > 0) {
          console.log(`  Files Modified: ${lastUpdate.modifiedFiles.length}`);
        }
      }

      console.log(`\nUse /session:show ${session.id} for details\n`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('not initialized')) {
      logger.error(error.message);
      console.log('Run "aikit init" first to initialize AIKit in this directory.\n');
    } else if (error instanceof Error && error.message.includes('No active session')) {
      logger.error('No active session. Use /session:start first');
    } else {
      logger.error('Failed to end session:', error);
    }
  }
}

/**
 * Show current active session
 */
export async function showCurrentSession(): Promise<void> {
  try {
    const { SessionManager } = await import('../core/sessions.js');
    const manager = new SessionManager();
    const session = await manager.getCurrentSession();

    if (!session) {
      logger.info('No active session');
      console.log('Start a session: /session:start [name]\n');
      return;
    }

    const duration = Math.floor((Date.now() - new Date(session.startTime).getTime()) / 60000);
    const terminalInfo = await manager.getTerminalInfo();

    console.log('\n📍 Current Session');
    console.log('━'.repeat(60));
    console.log(`\nSession: ${session.name}`);
    console.log(`ID: ${session.id}`);
    console.log(`Started: ${Math.floor(duration / 60)}h ${duration % 60}m ago`);
    if (terminalInfo.tty) {
      console.log(`Terminal: ${terminalInfo.tty}`);
    }

    if (session.goals.length > 0) {
      console.log(`\nGoals:`);
      session.goals.forEach(goal => console.log(`  - ${goal}`));
    }

    if (session.updates.length > 0) {
      console.log(`\nRecent Updates (last 3):`);
      const recent = session.updates.slice(-3);
      recent.forEach(update => {
        const date = new Date(update.timestamp);
        console.log(`  ${date.toLocaleTimeString()} - ${update.notes || 'Update'}`);
      });
    }

    const lastUpdate = session.updates[session.updates.length - 1];
    if (lastUpdate?.gitBranch || lastUpdate?.gitCommits) {
      console.log(`\nGit:`);
      if (lastUpdate.gitBranch) console.log(`  Branch: ${lastUpdate.gitBranch}`);
      if (lastUpdate.gitCommits) console.log(`  Commits: ${lastUpdate.gitCommits}`);
      if (lastUpdate.modifiedFiles && lastUpdate.modifiedFiles.length > 0) {
        console.log(`  Modified: ${lastUpdate.modifiedFiles.length} files`);
      }
    }

    if (lastUpdate?.beadsTask) {
      console.log(`\nBeads Task:`);
      console.log(`  ${lastUpdate.beadsTask.id} (${lastUpdate.beadsTask.status})`);
    }

    console.log('\nCommands:');
    console.log('  /session:update [notes] - Add progress');
    console.log('  /session:use <id> - Switch to another session');
    console.log('  /session:end - Close session');
    console.log('━'.repeat(60) + '\n');
  } catch (error) {
    if (error instanceof Error && error.message.includes('not initialized')) {
      logger.error(error.message);
      console.log('Run "aikit init" first to initialize AIKit in this directory.\n');
    } else {
      logger.error('Failed to show current session:', error);
    }
  }
}

/**
 * List all sessions
 */
export async function listSessions(): Promise<void> {
  try {
    const { SessionManager } = await import('../core/sessions.js');
    const manager = new SessionManager();
    const sessions = await manager.listSessions();

    if (sessions.length === 0) {
      logger.info('No sessions found');
      console.log('Start a session: /session:start [name]\n');
      return;
    }

    console.log('\n📚 All Sessions');
    console.log('━'.repeat(60));

    sessions.forEach((session, index) => {
      const startDate = new Date(session.startTime);
      const endDate = session.endTime ? new Date(session.endTime) : null;
      const duration = endDate
        ? Math.floor((endDate.getTime() - startDate.getTime()) / 60000)
        : null;

      console.log(`\n${index + 1}. ${session.id}`);
      console.log(`   Status: ${session.status === 'active' ? '🟢 Active' : 'Ended'}`);
      console.log(`   Name: ${session.name}`);
      console.log(`   Started: ${startDate.toLocaleString()}`);

      if (endDate && duration) {
        console.log(`   Ended: ${endDate.toLocaleString()} (${Math.floor(duration / 60)}h ${duration % 60}m)`);
      }

      if (session.goals.length > 0) {
        console.log(`   Goals: ${session.goals.slice(0, 2).join(', ')}${session.goals.length > 2 ? '...' : ''}`);
      }

      console.log(`   Updates: ${session.updates.length}`);
    });

    console.log('\n' + '━'.repeat(60));
    console.log(`\nTotal: ${sessions.length} session${sessions.length > 1 ? 's' : ''}\n`);
    console.log('Commands:');
    console.log('  /session:show <id> - View session details');
    console.log('  /session:resume <id> - Resume session');
    console.log('  /session:search <query> - Search sessions\n');
  } catch (error) {
    if (error instanceof Error && error.message.includes('not initialized')) {
      logger.error(error.message);
      console.log('Run "aikit init" first to initialize AIKit in this directory.\n');
    } else {
      logger.error('Failed to list sessions:', error);
    }
  }
}

/**
 * Show specific session details
 */
export async function showSession(sessionId: string): Promise<void> {
  try {
    const { SessionManager } = await import('../core/sessions.js');
    const manager = new SessionManager();
    const sessions = await manager.listSessions();

    // Find matching session (supports partial ID)
    const session = sessions.find(s => s.id.startsWith(sessionId) || s.id === sessionId);

    if (!session) {
      logger.error(`Session not found: ${sessionId}`);
      console.log('Use /session:list to see all sessions\n');
      return;
    }

    const startDate = new Date(session.startTime);
    const endDate = session.endTime ? new Date(session.endTime) : null;
    const duration = endDate
      ? Math.floor((endDate.getTime() - startDate.getTime()) / 60000)
      : null;

    console.log('\n📄 Session: ' + session.id);
    console.log('━'.repeat(60));
    console.log(`\nStatus: ${session.status === 'active' ? '🟢 Active' : 'Ended'}`);
    console.log(`Name: ${session.name}`);
    console.log(`Started: ${startDate.toLocaleString()}`);
    if (endDate && duration) {
      console.log(`Ended: ${endDate.toLocaleString()}`);
      console.log(`Duration: ${Math.floor(duration / 60)}h ${duration % 60}m`);
    }

    if (session.goals.length > 0) {
      console.log(`\nGoals:`);
      session.goals.forEach(goal => console.log(`  ${session.status === 'ended' ? '✓' : '○'} ${goal}`));
    }

    console.log(`\n## Progress (${session.updates.length} updates)`);
    session.updates.forEach(update => {
      const date = new Date(update.timestamp);
      console.log(`\n### ${date.toLocaleString()}`);
      if (update.notes) console.log(`${update.notes}`);
      if (update.gitBranch) console.log(`**Git Branch:** ${update.gitBranch}`);
      if (update.modifiedFiles && update.modifiedFiles.length > 0) {
        console.log(`**Modified Files:** ${update.modifiedFiles.length} files`);
      }
      if (update.beadsTask) {
        console.log(`**Beads Task:** ${update.beadsTask.id} (${update.beadsTask.status})`);
      }
    });

    if (session.status === 'ended') {
      console.log(`\n## Summary`);
      console.log(`Duration: ${duration ? Math.floor(duration / 60) + 'h ' + (duration % 60) + 'm' : 'N/A'}`);
      console.log(`Updates: ${session.updates.length}`);
      if (session.updates[session.updates.length - 1]?.gitCommits) {
        console.log(`Git Commits: ${session.updates[session.updates.length - 1].gitCommits}`);
      }
    }

    console.log('\n' + '━'.repeat(60) + '\n');
  } catch (error) {
    if (error instanceof Error && error.message.includes('not initialized')) {
      logger.error(error.message);
      console.log('Run "aikit init" first to initialize AIKit in this directory.\n');
    } else {
      logger.error('Failed to show session:', error);
    }
  }
}

/**
 * Search sessions by keyword
 */
export async function searchSessions(query: string): Promise<void> {
  try {
    const { SessionManager } = await import('../core/sessions.js');
    const manager = new SessionManager();
    const sessions = await manager.searchSessions(query);

    if (sessions.length === 0) {
      logger.info(`No sessions found matching: ${query}`);
      console.log('Use /session:list to see all sessions\n');
      return;
    }

    console.log(`\n🔍 Search Results: "${query}"`);
    console.log('━'.repeat(60));
    console.log(`\nFound ${sessions.length} session${sessions.length > 1 ? 's' : ''}:\n`);

    sessions.forEach((session, index) => {
      const startDate = new Date(session.startTime);
      console.log(`${index + 1}. ${session.id}`);
      console.log(`   Name: ${session.name}`);
      console.log(`   Started: ${startDate.toLocaleString()}`);
      console.log(`   Status: ${session.status === 'active' ? '🟢 Active' : 'Ended'}`);

      if (session.goals.length > 0) {
        console.log(`   Goals: ${session.goals.slice(0, 2).join(', ')}${session.goals.length > 2 ? '...' : ''}`);
      }
      console.log();
    });

    console.log('━'.repeat(60));
    console.log(`\nTotal: ${sessions.length} matching session${sessions.length > 1 ? 's' : ''}\n`);
    console.log('Commands:');
    console.log('  /session:show <id> - View session details');
    console.log('  /session:resume <id> - Resume session\n');
  } catch (error) {
    if (error instanceof Error && error.message.includes('not initialized')) {
      logger.error(error.message);
      console.log('Run "aikit init" first to initialize AIKit in this directory.\n');
    } else {
      logger.error('Failed to search sessions:', error);
    }
  }
}

/**
 * Resume a past session
 */
export async function resumeSession(sessionId: string): Promise<void> {
  try {
    const { SessionManager } = await import('../core/sessions.js');
    const manager = new SessionManager();
    const session = await manager.resumeSession(sessionId);

    logger.success('✓ Session resumed');
    console.log(`  ID: ${session.id}`);
    console.log(`  Name: ${session.name}`);
    console.log(`  Status: ${session.status}`);
    console.log(`  Started: ${new Date(session.startTime).toLocaleString()}`);

    if (session.goals.length > 0) {
      console.log(`  Goals:`);
      session.goals.forEach(goal => console.log(`    - ${goal}`));
    }

    console.log('\nCommands:');
    console.log('  /session:update [notes] - Add progress notes');
    console.log('  /session:end - End session with summary');
    console.log('  /session:current - Show session status');
    console.log('  /session:use <id> - Switch to a different session\n');
  } catch (error) {
    if (error instanceof Error && error.message.includes('not initialized')) {
      logger.error(error.message);
      console.log('Run "aikit init" first to initialize AIKit in this directory.\n');
    } else if (error instanceof Error && error.message.includes('not found')) {
      logger.error(error.message);
      console.log('Use /session:list to see all sessions\n');
    } else {
      logger.error('Failed to resume session:', error);
    }
  }
}

/**
 * Switch to a different session in the current terminal
 */
export async function switchSession(sessionId: string): Promise<void> {
  try {
    const { SessionManager } = await import('../core/sessions.js');
    const manager = new SessionManager();

    // First verify session exists
    const session = await manager.getSession(sessionId);
    if (!session) {
      logger.error(`Session not found: ${sessionId}`);
      console.log('Use /session:list to see all sessions\n');
      return;
    }

    // Switch to this session for current terminal
    await manager.switchSession(sessionId);

    logger.success('✓ Switched to session');
    console.log(`  ID: ${session.id}`);
    console.log(`  Name: ${session.name}`);
    console.log(`  Status: ${session.status}`);
    console.log(`  Started: ${new Date(session.startTime).toLocaleString()}`);

    if (session.goals.length > 0) {
      console.log(`  Goals:`);
      session.goals.forEach(goal => console.log(`    - ${goal}`));
    }

    console.log('\nCommands:');
    console.log('  /session:update [notes] - Add progress notes');
    console.log('  /session:end - End session with summary');
    console.log('  /session:current - Show session status\n');
  } catch (error) {
    if (error instanceof Error && error.message.includes('not initialized')) {
      logger.error(error.message);
      console.log('Run "aikit init" first to initialize AIKit in this directory.\n');
    } else if (error instanceof Error && error.message.includes('not found')) {
      logger.error(error.message);
      console.log('Use /session:list to see all sessions\n');
    } else {
      logger.error('Failed to switch session:', error);
    }
  }
}
