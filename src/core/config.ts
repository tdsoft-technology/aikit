import { readFile, access, constants } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';
import { paths } from '../utils/paths.js';
import { getVersion } from '../utils/version.js';
import { FigmaDatabase } from './database/figma-db.js';

/**
 * Platform types supported by AIKit
 */
export type PlatformType = 'opencode' | 'claude';

/**
 * Platform configuration schema
 */
const PlatformConfigSchema = z.object({
  /**
   * Primary platform to use (affects default behavior)
   */
  primary: z.enum(['opencode', 'claude']).default('opencode'),
  /**
   * Enable OpenCode platform support
   * Default: true (OpenCode is the primary focus)
   */
  opencode: z.boolean().default(true),
  /**
   * Enable Claude Code platform support
   * Default: false (archived, can be re-enabled later)
   */
  claude: z.boolean().default(false),
}).default({});

/**
 * AIKit Configuration Schema
 */
const ConfigSchema = z.object({
  version: z.string(),
  /**
   * Platform configuration - controls which platforms are active
   */
  platform: PlatformConfigSchema,
  skills: z.object({
    enabled: z.boolean().default(true),
    directory: z.string().optional(),
  }).default({}),
  agents: z.object({
    enabled: z.boolean().default(true),
    default: z.string().default('build'),
  }).default({}),
  commands: z.object({
    enabled: z.boolean().default(true),
  }).default({}),
  tools: z.object({
    enabled: z.boolean().default(true),
  }).default({}),
  plugins: z.object({
    enabled: z.boolean().default(true),
    autoload: z.array(z.string()).optional(),
  }).default({}),
  memory: z.object({
    enabled: z.boolean().default(true),
    maxSize: z.number().optional(),
  }).default({}),
  beads: z.object({
    enabled: z.boolean().default(true),
    autoInit: z.boolean().default(false),
  }).default({}),
  antiHallucination: z.object({
    enabled: z.boolean().default(true),
    specFile: z.string().default('spec.md'),
    reviewFile: z.string().default('review.md'),
  }).default({}),
  database: z.object({
    enabled: z.boolean().default(true),
    path: z.string().optional(), // If not provided, will use default path
  }).default({}),
  mcp: z.object({
    context7: z.boolean().default(false),
    githubGrep: z.boolean().default(false),
    gkg: z.boolean().default(false),
  }).optional(),
  mode: z.string().default('build').optional(),
});

export type AIKitConfig = z.infer<typeof ConfigSchema> & {
  configPath: string;
  projectPath: string;
};

/**
 * Configuration manager for AIKit
 */
export class Config {
  private config: AIKitConfig;

  constructor(config: AIKitConfig) {
    this.config = config;
  }

  get(): AIKitConfig {
    return this.config;
  }

  get skills() {
    return this.config.skills;
  }

  get agents() {
    return this.config.agents;
  }

  get commands() {
    return this.config.commands;
  }

  get tools() {
    return this.config.tools;
  }

  get plugins() {
    return this.config.plugins;
  }

  get memory() {
    return this.config.memory;
  }

  get beads() {
    return this.config.beads;
  }

  get antiHallucination() {
    return this.config.antiHallucination;
  }

  get database() {
    return this.config.database;
  }

  get mode() {
    return this.config.mode;
  }

  get platform() {
    return this.config.platform;
  }

  get configPath(): string {
    return this.config.configPath;
  }

  /**
   * Check if a specific platform is enabled
   */
  isPlatformEnabled(platform: PlatformType): boolean {
    return this.config.platform[platform] ?? false;
  }

  /**
   * Get the primary platform
   */
  getPrimaryPlatform(): PlatformType {
    return this.config.platform.primary;
  }

  /**
   * Get list of all enabled platforms
   */
  getEnabledPlatforms(): PlatformType[] {
    const platforms: PlatformType[] = [];
    if (this.config.platform.opencode) {
      platforms.push('opencode');
    }
    if (this.config.platform.claude) {
      platforms.push('claude');
    }
    return platforms;
  }

  get projectPath(): string {
    return this.config.projectPath;
  }

  /**
   * Get path to a specific resource
   */
  getPath(resource: 'skills' | 'agents' | 'commands' | 'tools' | 'plugins' | 'memory' | 'database'): string {
    if (resource === 'database') {
      return this.config.database.path || join(this.configPath, 'figma.db');
    }
    return paths[resource](this.configPath);
  }

  /**
   * Get database instance
   */
  getDatabase(): FigmaDatabase {
    // Database is enabled by default, check explicit disable
    if (this.config.database?.enabled === false) {
      throw new Error('Database is disabled in configuration');
    }
    
    const dbPath = this.getPath('database');
    return new FigmaDatabase(dbPath);
  }
}

/**
 * Load AIKit configuration
 * Merges project-level config with global config (project takes precedence)
 */
export async function loadConfig(projectPath?: string): Promise<Config> {
  const project = projectPath || process.cwd();
  
  // Try project config first, then global
  const projectConfigPath = paths.projectConfig(project);
  const globalConfigPath = paths.globalConfig();
  
  let configPath: string;
  let configData: Record<string, unknown> = {};
  
  // Load global config first (as base)
  try {
    await access(join(globalConfigPath, 'aikit.json'), constants.R_OK);
    const globalContent = await readFile(join(globalConfigPath, 'aikit.json'), 'utf-8');
    configData = JSON.parse(globalContent);
    configPath = globalConfigPath;
  } catch {
    // No global config
    configPath = projectConfigPath;
  }
  
  // Merge project config on top
  try {
    await access(join(projectConfigPath, 'aikit.json'), constants.R_OK);
    const projectContent = await readFile(join(projectConfigPath, 'aikit.json'), 'utf-8');
    const projectData = JSON.parse(projectContent);
    configData = deepMerge(configData, projectData);
    configPath = projectConfigPath;
  } catch {
    // No project config, use global or defaults
  }
  
  // Add default version if not present
  if (!configData.version) {
    configData.version = getVersion();
  }

  // Parse and validate config
  const parsed = ConfigSchema.parse(configData);

  return new Config({
    ...parsed,
    configPath,
    projectPath: project,
  });
}

/**
 * Deep merge two objects
 */
function deepMerge<T extends Record<string, unknown>>(base: T, override: Partial<T>): T {
  const result = { ...base };
  
  for (const key in override) {
    const baseValue = base[key];
    const overrideValue = override[key];
    
    if (
      typeof baseValue === 'object' &&
      baseValue !== null &&
      typeof overrideValue === 'object' &&
      overrideValue !== null &&
      !Array.isArray(baseValue) &&
      !Array.isArray(overrideValue)
    ) {
      result[key] = deepMerge(
        baseValue as Record<string, unknown>,
        overrideValue as Record<string, unknown>
      ) as T[Extract<keyof T, string>];
    } else if (overrideValue !== undefined) {
      result[key] = overrideValue as T[Extract<keyof T, string>];
    }
  }
  
  return result;
}
