import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Path utilities for AIKit configuration and data directories
 */
export const paths = {
  /**
   * Get the global AIKit configuration directory
   * ~/.config/aikit/ on Unix, %APPDATA%/aikit/ on Windows
   */
  globalConfig(): string {
    const base = process.platform === 'win32'
      ? process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
      : join(homedir(), '.config');
    return join(base, 'aikit');
  },

  /**
   * Get the project-level AIKit configuration directory
   */
  projectConfig(projectPath?: string): string {
    const base = projectPath || process.cwd();
    return join(base, '.aikit');
  },

  /**
   * Get the OpenCode configuration directory
   */
  opencodeConfig(): string {
    const base = process.platform === 'win32'
      ? process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
      : join(homedir(), '.config');
    return join(base, 'opencode');
  },

  /**
   * Get the Beads directory for the current project
   */
  beadsDir(projectPath?: string): string {
    const base = projectPath || process.cwd();
    return join(base, '.beads');
  },

  /**
   * Check if a project has AIKit initialized
   */
  hasProjectConfig(projectPath?: string): boolean {
    return existsSync(this.projectConfig(projectPath));
  },

  /**
   * Check if global AIKit is initialized
   */
  hasGlobalConfig(): boolean {
    return existsSync(this.globalConfig());
  },

  /**
   * Get effective config path (project takes precedence over global)
   */
  effectiveConfig(projectPath?: string): string | null {
    if (this.hasProjectConfig(projectPath)) {
      return this.projectConfig(projectPath);
    }
    if (this.hasGlobalConfig()) {
      return this.globalConfig();
    }
    return null;
  },

  /**
   * Get skills directory
   */
  skills(configPath: string): string {
    return join(configPath, 'skills');
  },

  /**
   * Get agents directory
   */
  agents(configPath: string): string {
    return join(configPath, 'agents');
  },

  /**
   * Get commands directory
   */
  commands(configPath: string): string {
    return join(configPath, 'commands');
  },

  /**
   * Get tools directory
   */
  tools(configPath: string): string {
    return join(configPath, 'tools');
  },

  /**
   * Get plugins directory
   */
  plugins(configPath: string): string {
    return join(configPath, 'plugins');
  },

  /**
   * Get memory directory
   */
  memory(configPath: string): string {
    return join(configPath, 'memory');
  },

  /**
   * Get the Claude Code CLI configuration directory
   */
  claudeConfig(scope?: 'user' | 'project'): string {
    if (scope === 'project') {
      return join(process.cwd(), '.claude');
    }
    const base = process.platform === 'win32'
      ? process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
      : join(homedir(), '.claude');
    return base;
  },

  /**
   * Get Claude Code CLI commands directory
   */
  claudeCommands(project?: boolean): string {
    return join(this.claudeConfig(project ? 'project' : 'user'), 'commands');
  },

  /**
   * Get Claude Code CLI skills directory
   */
  claudeSkills(project?: boolean): string {
    return join(this.claudeConfig(project ? 'project' : 'user'), 'skills');
  },

  /**
   * Get Claude Code CLI agents directory
   */
  claudeAgents(project?: boolean): string {
    return join(this.claudeConfig(project ? 'project' : 'user'), 'agents');
  },

  /**
   * Get Cursor configuration directory
   */
  cursorConfig(scope?: 'user' | 'project'): string {
    if (scope === 'project') {
      return join(process.cwd(), '.cursor');
    }
    const base = process.platform === 'win32'
      ? join(homedir(), 'AppData', 'Local', 'Cursor')
      : join(homedir(), '.cursor');
    return base;
  },

  /**
   * Get Cursor commands directory
   */
  cursorCommands(project?: boolean): string {
    return join(this.cursorConfig(project ? 'project' : 'user'), 'commands');
  },

  /**
   * Get Cursor skills directory
   */
  cursorSkills(project?: boolean): string {
    return join(this.cursorConfig(project ? 'project' : 'user'), 'skills');
  },

  /**
   * Get Cursor agents directory
   */
  cursorAgents(project?: boolean): string {
    return join(this.cursorConfig(project ? 'project' : 'user'), 'agents');
  },

  /**
   * Get the Google Antigravity configuration directory
   * Project: .agent/
   * Global: ~/.gemini/antigravity/
   */
  antigravityConfig(scope?: 'user' | 'project'): string {
    if (scope === 'project') {
      return join(process.cwd(), '.agent');
    }
    return join(homedir(), '.gemini', 'antigravity');
  },

  /**
   * Get Antigravity skills directory
   * Project: .agent/skills/
   * Global: ~/.gemini/antigravity/global_skills/
   */
  antigravitySkills(project?: boolean): string {
    if (project) {
      return join(process.cwd(), '.agent', 'skills');
    }
    return join(homedir(), '.gemini', 'antigravity', 'global_skills');
  },

  /**
   * Get Antigravity agents directory (skills are used for everything in Antigravity)
   */
  antigravityAgents(project?: boolean): string {
    // Antigravity uses skills for agents too
    return this.antigravitySkills(project);
  },
};
