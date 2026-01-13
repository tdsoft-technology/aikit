/**
 * AIKit - Open-source AI coding agent toolkit for OpenCode
 *
 * Provides skills, agents, commands, tools, and plugins for enhanced AI-assisted development.
 */

// Core exports
export { Config, loadConfig, type AIKitConfig } from './core/config.js';
export { SkillEngine, type Skill } from './core/skills.js';
export { AgentManager, type Agent, type AgentType } from './core/agents.js';
export { CommandRunner, type Command } from './core/commands.js';
export { ToolRegistry, type Tool, defineTool } from './core/tools.js';
export { ToolConfigManager, type ToolConfig, type ToolStatus } from './core/tool-config.js';
export { PluginSystem, type Plugin, type PluginEvent } from './core/plugins.js';
export { MemoryManager, type Memory } from './core/memory.js';
export { BeadsIntegration } from './core/beads.js';
export { AntiHallucination } from './core/anti-hallucination.js';
export { checkForUpdatesAsync } from './core/update-manager.js';

// Utilities
export { logger } from './utils/logger.js';
export { paths } from './utils/paths.js';
export { getVersion as VERSION } from './utils/version.js';
