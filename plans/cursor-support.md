# Plan: Cursor Support for AIKit

## Overview
Add complete Cursor platform support to AIKit, enabling commands, skills, and agents to work seamlessly with Cursor's AI coding assistant. Cursor stores commands in `.cursor/commands` directory and supports team commands via dashboard.

## Tasks

### 1. Platform Detection & Configuration
- [ ] `src/utils/cli-detector.ts` - Add `CURSOR` to `CliPlatform` enum and `CliTool` enum
- [ ] `src/utils/cli-detector.ts` - Add `checkCursor()` method to detect Cursor installation
- [ ] `src/utils/cli-detector.ts` - Update `detectPlatforms()` to include Cursor detection
- [ ] `src/core/config.ts` - Add `'cursor'` to `PlatformType` union
- [ ] `src/core/config.ts` - Add `cursor` field to `PlatformConfigSchema` with `default(false)` (opt-in)
- [ ] `src/core/config.ts` - Update `getEnabledPlatforms()` to include cursor when enabled

### 2. Path Utilities
- [ ] `src/utils/paths.ts` - Add `cursorConfig(scope?: 'user' | 'project')` method
- [ ] `src/utils/paths.ts` - Add `cursorCommands(project?: boolean)` method
- [ ] `src/utils/paths.ts` - Add `cursorSkills(project?: boolean)` method
- [ ] `src/utils/paths.ts` - Add `cursorAgents(project?: boolean)` method

### 3. Cursor Platform Adapter
- [ ] `src/platform/cursor-adapter.ts` - Create new `CursorAdapter` class implementing `PlatformAdapter`
- [ ] `src/platform/cursor-adapter.ts` - Implement directory getters (`.cursor/commands`, `.cursor/skills`, `.cursor/agents`)
- [ ] `src/platform/cursor-adapter.ts` - Implement `transformCommand()` with 'aikit-' prefix for all commands
- [ ] `src/platform/cursor-adapter.ts` - Implement `transformSkill()` converting to Cursor markdown format
- [ ] `src/platform/cursor-adapter.ts` - Implement `transformAgent()` with proper frontmatter for Cursor
- [ ] `src/platform/cursor-adapter.ts` - Implement `installCommand()`, `installSkill()`, `installAgent()` methods

### 4. Adapter Integration
- [ ] `src/platform/adapters.ts` - Import `CursorAdapter`
- [ ] `src/platform/adapters.ts` - Add Cursor case to `createAdapter()` switch
- [ ] `src/platform/adapters.ts` - Add 'cursor' to `platformTypeToCliPlatform()` mapping
- [ ] `src/platform/adapters.ts` - Add Cursor entry to `SUPPORTED_PLATFORMS` array

### 5. Documentation & Templates
- [ ] `.aikit/aikit.json.example` - Add cursor platform configuration example
- [ ] `README.md` - Update to mention Cursor support alongside OpenCode/Claude
- [ ] `CONTRIBUTING.md` - Add Cursor platform to contributing guidelines

### 6. Testing
- [ ] `test/cursor-adapter.test.ts` - Create tests for command transformation with prefix
- [ ] `test/cursor-adapter.test.ts` - Test skill transformation to Cursor format
- [ ] `test/cursor-adapter.test.ts` - Test agent transformation
- [ ] `test/cursor-adapter.test.ts` - Test installation to `.cursor/` directories
- [ ] Manual testing - Install AIKit in a test project with cursor enabled
- [ ] Manual testing - Verify commands appear with `aikit-` prefix in Cursor
- [ ] Manual testing - Verify skills and agents load in Cursor

### 7. CLI Integration (Optional Enhancement)
- [ ] `src/cli/commands/install.ts` - Update to include cursor platform option
- [ ] `src/cli/commands/sync.ts` - Update to support cursor sync

### 8. Documentation Updates
- [ ] `document/aikit/docs-config.json` - Add cursor platform configuration entry
- [ ] `document/aikit/docs-config.json` - Add cursor to `platforms` section with `enabled: false` (opt-in)
- [ ] `document/aikit/docs-config.json` - Add cursor to `ui.platformTabs` with icon and color
- [ ] `document/aikit/docs-config.json` - Add cursor badge styles to `ui.badgeStyles`
- [ ] `document/aikit/docs/PLATFORM_TOGGLE.md` - Add cursor toggle instructions and npm scripts
- [ ] `document/aikit/docs/installation.md` - Add Cursor installation tab with `aikit install cursor` command
- [ ] `document/aikit/docs/installation.md` - Add prerequisite: Cursor installation link
- [ ] `document/aikit/docs/installation.md` - Add Cursor-specific troubleshooting section
- [ ] `document/aikit/docs/intro.md` - Update "Works with" section to include Cursor
- [ ] `document/aikit/docs/intro.md` - Add Cursor to platform tabs
- [ ] `document/aikit/docs/quick-start.md` - Add Cursor quick start section
- [ ] `document/aikit/docs/features.md` - Update platform comparison table
- [ ] `document/aikit/sidebars.ts` - Update navigation to include Cursor platform

## Dependencies
- Existing OpenCode and Claude adapters (as reference)
- Gray-matter library (already installed)
- Standard Node.js fs/promises and path modules

## Risks

### Technical Risks
- **Cursor API changes**: Cursor's command format may evolve (currently in beta). Risk: Medium
  - Mitigation: Follow Cursor docs closely, monitor for format changes

- **Command conflicts**: Even with prefixes, some conflicts might occur with other tools
  - Mitigation: Clear documentation of prefixed command names

- **Agent compatibility**: Cursor may not support tab-switching agents like OpenCode
  - Mitigation: Test agent functionality thoroughly, may need to adapt format

### Implementation Risks
- **Platform detection**: Cursor may not have a standard CLI version command
  - Mitigation: Check for cursor config directory and executable

- **Path differences**: Cursor may use different directory structures on different OS
  - Mitigation: Follow Cursor docs, test on multiple platforms if possible

### User Experience Risks
- **Opt-in friction**: Users may not know to enable cursor in config
  - Mitigation: Add clear documentation and helpful error messages

- **Prefix confusion**: Users might type `/plan` instead of `/aikit-plan`
  - Mitigation: Clear documentation, consider adding alias support

## Verification

### Unit Tests
- All adapter transformations produce valid Cursor markdown format
- Commands are correctly prefixed with 'aikit-'
- Installation methods create correct directory structure
- Platform detection correctly identifies Cursor installation

### Integration Tests
- Running `aikit install` with cursor enabled creates `.cursor/` directories
- Commands appear in Cursor when pressing `/`
- Skills and agents are accessible in Cursor
- Configuration opt-in works correctly

### Manual Testing Checklist
- [ ] Install Cursor on test machine
- [ ] Create test project: `mkdir test-cursor && cd test-cursor`
- [ ] Enable cursor in `.aikit/aikit.json`: `{"platform": {"cursor": true}}`
- [ ] Run `aikit install`
- [ ] Verify `.cursor/commands/` directory exists with prefixed commands
- [ ] Open Cursor in test project
- [ ] Press `/` and verify `aikit-plan`, `aikit-fix`, etc. appear
- [ ] Try running a command: `/aikit-plan "test feature"`
- [ ] Verify skills and agents are loaded (if Cursor supports them)
- [ ] Disable cursor in config and verify `.cursor/` not updated on sync

### Documentation Verification
- [ ] README mentions Cursor support
- [ ] Example aikit.json shows cursor configuration
- [ ] Contributing guide includes Cursor platform notes
- [ ] `document/aikit/docs-config.json` includes cursor platform entry with proper settings
- [ ] `document/aikit/docs/installation.md` has Cursor tab with complete instructions
- [ ] `document/aikit/docs/intro.md` mentions Cursor in supported platforms list
- [ ] `document/aikit/docs/quick-start.md` includes Cursor getting started guide
- [ ] `document/aikit/docs/PLATFORM_TOGGLE.md` has cursor toggle instructions
- [ ] Platform toggle script in `document/aikit/package.json` supports cursor: `npm run docs:show-cursor` / `npm run docs:hide-cursor`
- [ ] Documentation in `document/aikit/` builds successfully with Cursor enabled
- [ ] Platform tabs appear correctly for Cursor (if enabled in docs-config)
- [ ] Navigation sidebar includes Cursor sections properly

## Output Format

This plan will result in:
1. New `CursorAdapter` class in `src/platform/cursor-adapter.ts`
2. Updated platform detection and configuration
3. Modified path utilities for Cursor directories
4. Tests validating all transformations
5. Updated documentation

## Time Estimate
- Platform detection & config: 30 min
- Path utilities: 15 min
- Cursor adapter: 2-3 hours
- Adapter integration: 30 min
- Documentation (docs-config, install, intro, quick-start, features): 2-3 hours
- Testing (unit + integration + manual): 2-3 hours
- Total: **9-10 hours**
