# Plan: Google Antigravity Support for AIKit

## Overview
Add complete Google Antigravity platform support to AIKit, enabling skills, commands, and agents to work seamlessly with Antigravity's AI coding agent. Antigravity uses a unique directory structure with `.agent/skills/` for workspace skills and `~/.gemini/antigravity/global_skills/` for global skills.

**Key Differences from Other Platforms:**
- Skills use folder-based structure with `SKILL.md` file (not flat markdown files)
- YAML frontmatter format with `name` and `description` fields
- Progressive disclosure pattern - agent discovers skills by description
- Global skills stored in `~/.gemini/antigravity/global_skills/`
- Workspace skills stored in `.agent/skills/`

## Tasks

### 1. Platform Detection & Configuration (~15 min) ✅ COMPLETED
- [x] `src/utils/cli-detector.ts` - Add `ANTIGRAVITY` to `CliTool` enum
- [x] `src/utils/cli-detector.ts` - Add `ANTIGRAVITY` to `CliPlatform` enum
- [x] `src/utils/cli-detector.ts` - Add `checkAntigravity()` method to detect installation
- [x] `src/utils/cli-detector.ts` - Update `detectPlatforms()` to include Antigravity
- [x] `src/utils/cli-detector.ts` - Update `matchPlatform()` to handle 'antigravity'
- [x] `src/core/config.ts` - Add `'antigravity'` to `PlatformType` union
- [x] `src/core/config.ts` - Add `antigravity` field to `PlatformConfigSchema` (default: false)
- [x] `src/core/config.ts` - Update `getEnabledPlatforms()` to include antigravity

### 2. Path Utilities (~10 min) ✅ COMPLETED
- [x] `src/utils/paths.ts` - Add `antigravityConfig(scope?: 'user' | 'project')` method
- [x] `src/utils/paths.ts` - Add `antigravitySkills(project?: boolean)` method
  - Project: `.agent/skills/`
  - Global: `~/.gemini/antigravity/global_skills/`
- [x] `src/utils/paths.ts` - Add `antigravityAgents(project?: boolean)` method (if supported)

### 3. Antigravity Platform Adapter (~2-3 hours) ✅ COMPLETED
- [x] `src/platform/antigravity-adapter.ts` - Create new `AntigravityAdapter` class
- [x] Implement directory getters:
  - Skills: `.agent/skills/` (workspace) or `~/.gemini/antigravity/global_skills/` (global)
  - Commands: May not be directly supported - investigate
  - Agents: Research if Antigravity has agent concept
- [x] Implement `transformSkill()`:
  - Create folder structure: `<skill-name>/SKILL.md`
  - Generate YAML frontmatter with `name` and `description`
  - Convert AIKit skill content to Antigravity format
- [x] Implement `transformCommand()`:
  - Convert commands to skills (Antigravity uses skills for everything)
  - Add 'aikit-' prefix to avoid conflicts
- [x] Implement `transformAgent()`:
  - Convert agents to skills if Antigravity doesn't have native agent support
- [x] Implement `installSkill()`:
  - Create folder: `.agent/skills/<skill-name>/`
  - Write `SKILL.md` file with proper frontmatter
- [x] Implement `installCommand()` - wraps as skill
- [x] Implement `installAgent()` - wraps as skill

### 4. Adapter Integration (~15 min) ✅ COMPLETED
- [x] `src/platform/adapters.ts` - Import `AntigravityAdapter`
- [x] `src/platform/adapters.ts` - Add Antigravity case to `createAdapter()` switch
- [x] `src/platform/adapters.ts` - Add 'antigravity' to `platformTypeToCliPlatform()`
- [x] `src/platform/adapters.ts` - Add Antigravity entry to `SUPPORTED_PLATFORMS`

### 5. CLI Integration (~20 min) ✅ COMPLETED
- [x] `src/cli/commands/install.ts` - Add antigravity to `cliPlatformToType()`
- [x] `src/cli/commands/install.ts` - Add antigravity to platform status display
- [x] `src/cli/commands/init.ts` - Add `--antigravity` flag
- [x] `src/cli/commands/init.ts` - Add antigravity to interactive prompt choices
- [x] `src/cli/commands/init.ts` - Add antigravity to platform config display
- [x] `src/cli/helpers.ts` - Update `PlatformConfig` interface

### 6. Documentation Updates (~1 hour) - Previously completed
- [x] `document/aikit/docs-config.json` - Add antigravity platform configuration
- [x] `document/aikit/docs/installation.md` - Add Antigravity installation tab
- [x] `document/aikit/docs/intro.md` - Update to mention Antigravity
- [x] `document/aikit/docs/PLATFORM_TOGGLE.md` - Add antigravity toggle instructions
- [x] `document/aikit/package.json` - Add toggle scripts for antigravity
- [x] `README.md` - Update to mention Antigravity

### 7. Testing (~1-2 hours)
- [ ] Manual testing - `aikit init antigravity`
- [ ] Manual testing - `aikit install antigravity`
- [ ] Verify `.agent/skills/` directory created with proper structure
- [ ] Verify `SKILL.md` files have correct YAML frontmatter
- [ ] Verify skills are discoverable by Antigravity

## Dependencies
- Existing adapters (OpenCode, Claude, Cursor) as reference
- Gray-matter library for YAML frontmatter (already installed)
- Standard Node.js fs/promises and path modules

## Antigravity-Specific Format

### Skill Structure
```
.agent/skills/
└─── aikit-plan/
    └─── SKILL.md
```

### SKILL.md Format
```markdown
---
name: aikit-plan
description: Creates detailed implementation plans for features. Use when planning new features, refactoring, or complex tasks.
---

# Plan Skill

Detailed instructions for the agent go here.

## When to use this skill

- Use when planning new features
- Use when refactoring existing code
- Use when breaking down complex tasks

## How to use it

1. UNDERSTAND: Clarify requirements
2. RESEARCH: Check existing patterns
3. BREAK DOWN: Create sub-tasks
4. DOCUMENT: Write plan to memory/plans/
```

## Risks

### Technical Risks
- **Folder-based structure**: Different from flat file approach used by other platforms
  - Mitigation: Create folders per skill with SKILL.md inside
  
- **No direct command support**: Antigravity uses skills for everything
  - Mitigation: Convert commands to skills with clear naming

- **Global vs Workspace**: Two different locations for skills
  - Mitigation: Use workspace location by default, add `--global` flag option

### Implementation Risks
- **Detection**: No known CLI command for Antigravity
  - Mitigation: Check for `.agent/` directory or `~/.gemini/` directory

- **Format evolution**: Antigravity skill format may change
  - Mitigation: Keep transformation logic isolated in adapter

## Verification

### Unit Tests
- [ ] Skill transformation produces valid folder + SKILL.md structure
- [ ] YAML frontmatter is valid and has required fields
- [ ] Commands converted to skills correctly
- [ ] Platform detection works

### Integration Tests
- [ ] `aikit install antigravity` creates `.agent/skills/` directory
- [ ] Skills have proper folder structure
- [ ] SKILL.md files are readable by Antigravity

### Manual Testing Checklist
- [ ] Run `aikit init antigravity`
- [ ] Verify `.aikit/aikit.json` has `"antigravity": true`
- [ ] Run `aikit install antigravity`
- [ ] Verify `.agent/skills/` directory exists
- [ ] Check `aikit-plan/SKILL.md` has correct format
- [ ] Open project in Antigravity
- [ ] Verify skills are discovered and usable

### Documentation Verification
- [ ] docs-config.json has antigravity entry
- [ ] installation.md has Antigravity tab
- [ ] README mentions Antigravity support

## Output Format

This plan will result in:
1. New `AntigravityAdapter` class in `src/platform/antigravity-adapter.ts`
2. Updated platform detection and configuration
3. Modified path utilities for Antigravity directories
4. Skills installed as folder + SKILL.md structure
5. Updated documentation

## Time Estimate
- Platform detection & config: 15 min
- Path utilities: 10 min
- Antigravity adapter: 2-3 hours
- Adapter integration: 15 min
- CLI integration: 20 min
- Documentation: 1 hour
- Testing: 1-2 hours
- **Total: 5-7 hours**
