import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Supported CLI tools
 */
export enum CliTool {
  OPENCODE = 'opencode',
  CLAUDE = 'claude',
  GITHUB = 'github',
  CURSOR = 'cursor',
  ANTIGRAVITY = 'antigravity',
}

/**
 * Supported CLI platforms
 */
export enum CliPlatform {
  OPENCODE = 'opencode',
  CLAUDE = 'claude',
  CODEX = 'codex',
  CURSOR = 'cursor',
  ANTIGRAVITY = 'antigravity',
}

/**
 * CLI tool info
 */
export interface CliToolInfo {
  name: CliTool;
  displayName: string;
  detected: boolean;
  installed: boolean;
  version?: string;
  configPath?: string;
}

/**
 * Platform info
 */
export interface PlatformInfo {
  platform: CliPlatform;
  displayName: string;
  installed: boolean;
  configPath: string;
}

/**
 * Detect and check CLI tools
 */
export class CliDetector {
  /**
   * Check if OpenCode is installed
   */
  static async checkOpenCode(): Promise<CliToolInfo> {
    try {
      const opencodePath = process.platform === 'win32'
        ? process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
        : join(homedir(), '.config');
      const opencodeConfig = join(opencodePath, 'opencode', 'opencode.json');
      let installed = existsSync(opencodeConfig);
      
      // Verify opencode is actually runnable by checking command
      let version: string | undefined;
      if (installed) {
        try {
          execSync('opencode --version', { stdio: 'ignore' });
          version = 'installed';
        } catch (error) {
          // Command check failed - check if config file still exists
          if (existsSync(opencodeConfig)) {
            version = 'installed (config exists)';
          } else {
            // Config file doesn't exist anymore
            installed = false;
          }
        }
      }
      
      return {
        name: CliTool.OPENCODE,
        displayName: 'OpenCode',
        detected: true,
        installed,
        version,
        configPath: opencodeConfig,
      };
    } catch {
      return {
        name: CliTool.OPENCODE,
        displayName: 'OpenCode',
        detected: false,
        installed: false,
      };
    }
  }

  /**
   * Check if Claude CLI is installed
   */
  static async checkClaude(): Promise<CliToolInfo> {
    try {
      execSync('claude --version', { stdio: 'ignore' });
      
      return {
        name: CliTool.CLAUDE,
        displayName: 'Claude CLI',
        detected: true,
        installed: true,
        version: 'installed',
      };
    } catch {
      return {
        name: CliTool.CLAUDE,
        displayName: 'Claude CLI',
        detected: true,
        installed: false,
      };
    }
  }

  /**
   * Check if GitHub CLI is installed
   */
  static async checkGitHub(): Promise<CliToolInfo> {
    try {
      const output = execSync('gh --version', { stdio: 'pipe', encoding: 'utf-8' });
      const match = output.match(/gh version ([\d.]+)/);
      const version = match?.[1];
      
      return {
        name: CliTool.GITHUB,
        displayName: 'GitHub CLI',
        detected: true,
        installed: true,
        version,
      };
    } catch {
      return {
        name: CliTool.GITHUB,
        displayName: 'GitHub CLI',
        detected: true,
        installed: false,
      };
    }
  }

  /**
   * Check if Cursor is installed
   */
  static async checkCursor(): Promise<CliToolInfo> {
    try {
      const cursorPath = process.platform === 'win32'
        ? join(homedir(), 'AppData', 'Local', 'Cursor')
        : join(homedir(), '.cursor');
      let installed = existsSync(cursorPath);

      // Verify cursor is actually runnable by checking command
      let version: string | undefined;
      if (installed) {
        try {
          execSync('cursor --version', { stdio: 'ignore' });
          version = 'installed';
        } catch (error) {
          // Command check failed - check if config file still exists
          if (existsSync(cursorPath)) {
            version = 'installed (config exists)';
          } else {
            // Config file doesn't exist anymore
            installed = false;
          }
        }
      }

      return {
        name: CliTool.CURSOR,
        displayName: 'Cursor',
        detected: true,
        installed,
        version,
        configPath: cursorPath,
      };
    } catch {
      return {
        name: CliTool.CURSOR,
        displayName: 'Cursor',
        detected: false,
        installed: false,
      };
    }
  }

  /**
   * Check if Antigravity is installed
   * Antigravity uses .agent/ directory for workspace skills
   * and ~/.gemini/antigravity/ for global configuration
   */
  static async checkAntigravity(): Promise<CliToolInfo> {
    try {
      // Check for global Gemini/Antigravity directory
      const globalPath = join(homedir(), '.gemini', 'antigravity');
      // Check for project-level .agent directory
      const projectPath = join(process.cwd(), '.agent');
      
      const hasGlobal = existsSync(globalPath);
      const hasProject = existsSync(projectPath);
      const installed = hasGlobal || hasProject;

      return {
        name: CliTool.ANTIGRAVITY,
        displayName: 'Google Antigravity',
        detected: true,
        installed,
        version: installed ? 'installed' : undefined,
        configPath: hasGlobal ? globalPath : projectPath,
      };
    } catch {
      return {
        name: CliTool.ANTIGRAVITY,
        displayName: 'Google Antigravity',
        detected: false,
        installed: false,
      };
    }
  }

  /**
   * Check all supported CLIs
   */
  static async checkAll(): Promise<CliToolInfo[]> {
    const results: CliToolInfo[] = [];

    results.push(await this.checkOpenCode());
    results.push(await this.checkClaude());
    results.push(await this.checkGitHub());
    results.push(await this.checkCursor());
    results.push(await this.checkAntigravity());

    return results;
  }

  /**
   * Filter tools by installation status
   */
  static filterInstalled(tools: CliToolInfo[]): CliToolInfo[] {
    return tools.filter(t => !t.installed && t.detected);
  }

  /**
   * Filter tools that can be installed
   */
  static filterInstallable(tools: CliToolInfo[]): CliToolInfo[] {
    return tools.filter(t => t.detected && !t.installed);
  }

  /**
   * Detect available platforms
   */
  static async detectPlatforms(): Promise<PlatformInfo[]> {
    const platforms: PlatformInfo[] = [];

    // Check OpenCode
    const opencodePath = process.platform === 'win32'
      ? process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
      : join(homedir(), '.config');
    platforms.push({
      platform: CliPlatform.OPENCODE,
      displayName: 'OpenCode',
      installed: existsSync(join(opencodePath, 'opencode', 'opencode.json')),
      configPath: opencodePath,
    });

    // Check Claude Code CLI
    const claudePath = process.platform === 'win32'
      ? process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
      : join(homedir(), '.claude');
    platforms.push({
      platform: CliPlatform.CLAUDE,
      displayName: 'Claude Code CLI',
      installed: existsSync(claudePath),
      configPath: claudePath,
    });

    // Check Cursor
    const cursorPath = process.platform === 'win32'
      ? join(homedir(), 'AppData', 'Local', 'Cursor')
      : join(homedir(), '.cursor');
    platforms.push({
      platform: CliPlatform.CURSOR,
      displayName: 'Cursor',
      installed: existsSync(cursorPath),
      configPath: cursorPath,
    });

    // Check Antigravity
    const antigravityGlobalPath = join(homedir(), '.gemini', 'antigravity');
    const antigravityProjectPath = join(process.cwd(), '.agent');
    const antigravityInstalled = existsSync(antigravityGlobalPath) || existsSync(antigravityProjectPath);
    platforms.push({
      platform: CliPlatform.ANTIGRAVITY,
      displayName: 'Google Antigravity',
      installed: antigravityInstalled,
      configPath: antigravityInstalled ? (existsSync(antigravityGlobalPath) ? antigravityGlobalPath : antigravityProjectPath) : antigravityProjectPath,
    });

    return platforms;
  }

  /**
   * Filter installed platforms
   */
  static filterInstalledPlatforms(platforms: PlatformInfo[]): PlatformInfo[] {
    return platforms.filter(p => p.installed);
  }

  /**
   * Match platform name to CliPlatform enum
   */
  static matchPlatform(name: string): CliPlatform {
    const normalized = name.toLowerCase();
    if (normalized === 'opencode' || normalized === 'open-code') {
      return CliPlatform.OPENCODE;
    } else if (normalized === 'claude' || normalized === 'claude-code' || normalized === 'claude-code-cli') {
      return CliPlatform.CLAUDE;
    } else if (normalized === 'cursor') {
      return CliPlatform.CURSOR;
    } else if (normalized === 'codex') {
      return CliPlatform.CODEX;
    } else if (normalized === 'antigravity' || normalized === 'gemini' || normalized === 'google-antigravity') {
      return CliPlatform.ANTIGRAVITY;
    }
    throw new Error(`Unknown platform: ${name}`);
  }
}

