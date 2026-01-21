import { CliPlatform } from '../utils/cli-detector.js';
import { OpenCodeAdapter } from './opencode-adapter.js';
import { ClaudeAdapter } from './claude-adapter.js';
import { CursorAdapter } from './cursor-adapter.js';
import { PlatformAdapter } from './types.js';
import { Config, PlatformType } from '../core/config.js';

/**
 * Create a platform adapter for a specific platform
 */
export function createAdapter(platform: CliPlatform): PlatformAdapter {
  switch (platform) {
    case CliPlatform.OPENCODE:
      return new OpenCodeAdapter();
    case CliPlatform.CLAUDE:
      return new ClaudeAdapter();
    case CliPlatform.CURSOR:
      return new CursorAdapter();
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Map PlatformType to CliPlatform
 */
function platformTypeToCliPlatform(type: PlatformType): CliPlatform {
  switch (type) {
    case 'opencode':
      return CliPlatform.OPENCODE;
    case 'claude':
      return CliPlatform.CLAUDE;
    case 'cursor':
      return CliPlatform.CURSOR;
  }
}

/**
 * Get adapters for all enabled platforms based on config
 * This respects the platform toggle flags in aikit.json
 */
export function getEnabledAdapters(config: Config): PlatformAdapter[] {
  const enabledPlatforms = config.getEnabledPlatforms();
  return enabledPlatforms.map(platform => 
    createAdapter(platformTypeToCliPlatform(platform))
  );
}

/**
 * Get adapter for a specific platform if it's enabled
 * Returns null if the platform is disabled in config
 */
export function getAdapterIfEnabled(config: Config, platform: PlatformType): PlatformAdapter | null {
  if (!config.isPlatformEnabled(platform)) {
    return null;
  }
  return createAdapter(platformTypeToCliPlatform(platform));
}

/**
 * Check if any platform is enabled
 */
export function hasEnabledPlatforms(config: Config): boolean {
  return config.getEnabledPlatforms().length > 0;
}

export const SUPPORTED_PLATFORMS = [
  { platform: CliPlatform.OPENCODE, name: 'OpenCode', configKey: 'opencode' as PlatformType },
  { platform: CliPlatform.CLAUDE, name: 'Claude Code CLI', configKey: 'claude' as PlatformType },
  { platform: CliPlatform.CURSOR, name: 'Cursor', configKey: 'cursor' as PlatformType },
] as const;
