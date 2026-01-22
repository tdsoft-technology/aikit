import { PlatformAdapter } from './types.js';
import { Command } from '../core/commands.js';
import { Skill } from '../core/skills.js';
import { Agent } from '../core/agents.js';
import { CliPlatform } from '../utils/cli-detector.js';
import { paths } from '../utils/paths.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

/**
 * Google Antigravity Platform Adapter
 * 
 * Antigravity uses a folder-based skill structure:
 * .agent/skills/<skill-name>/SKILL.md
 * 
 * Skills have YAML frontmatter with name and description fields.
 * Commands are converted to skills (Antigravity uses skills for everything).
 */
export class AntigravityAdapter implements PlatformAdapter {
  readonly platform = CliPlatform.ANTIGRAVITY;
  readonly displayName = 'Google Antigravity';

  getCommandsDir(): string {
    // Antigravity uses skills for commands
    return this.getSkillsDir();
  }

  getSkillsDir(): string {
    return paths.antigravitySkills(true);
  }

  getAgentsDir(): string {
    // Antigravity uses skills for agents too
    return paths.antigravitySkills(true);
  }

  async transformCommand(command: Command): Promise<{ name: string; content: string }> {
    // Convert command to skill format with aikit- prefix
    const name = `aikit-${command.name.replace(/:/g, '-')}`;
    const content = this.generateSkillFromCommand(command, name);
    return { name, content };
  }

  async transformSkill(skill: Skill): Promise<{ name: string; directory: string; files: Record<string, string> }> {
    const name = skill.name;
    const skillContent = this.generateSkillContent(skill);
    
    // Antigravity uses folder structure: <skill-name>/SKILL.md
    return {
      name,
      directory: name,
      files: { 'SKILL.md': skillContent },
    };
  }

  async transformAgent(agent: Agent): Promise<{ name: string; content: string }> {
    // Convert agent to skill format
    const name = `agent-${agent.name}`;
    const content = this.generateAgentAsSkill(agent, name);
    return { name, content };
  }

  async installCommand(name: string, content: string): Promise<void> {
    // Commands are installed as skills in folder structure
    const skillDir = join(this.getSkillsDir(), name);
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, 'SKILL.md'), content);
  }

  async installSkill(name: string, directory: string, files: Record<string, string>): Promise<void> {
    const baseDir = this.getSkillsDir();
    const targetDir = directory ? join(baseDir, directory) : join(baseDir, name);
    await mkdir(targetDir, { recursive: true });
    
    for (const [filename, content] of Object.entries(files)) {
      await writeFile(join(targetDir, filename), content);
    }
  }

  async installAgent(name: string, content: string): Promise<void> {
    // Agents are installed as skills in folder structure
    const skillDir = join(this.getSkillsDir(), name);
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, 'SKILL.md'), content);
  }

  /**
   * Generate YAML frontmatter for Antigravity skills
   */
  private generateFrontmatter(name: string, description: string): string {
    return `---
name: ${name}
description: ${description}
---`;
  }

  /**
   * Convert AIKit command to Antigravity skill format
   */
  private generateSkillFromCommand(command: Command, skillName: string): string {
    const frontmatter = this.generateFrontmatter(
      skillName,
      command.description
    );

    const examples = command.examples.map(e => `- \`${e}\``).join('\n');

    let workflow = command.content;
    // Preserve argument placeholders
    workflow = workflow
      .replace(/\$ARGUMENTS/g, '$ARGUMENTS')
      .replace(/\$1/g, '$1')
      .replace(/\$2/g, '$2')
      .replace(/\$3/g, '$3');

    return `${frontmatter}

# ${command.name} Command

${command.description}

## Usage
\`${command.usage}\`

## Examples
${examples}

## Workflow
${workflow}

**Category**: ${command.category}`;
  }

  /**
   * Convert AIKit skill to Antigravity skill format
   */
  private generateSkillContent(skill: Skill): string {
    const frontmatter = this.generateFrontmatter(
      skill.name,
      `${skill.description} ${skill.useWhen}`
    );

    return `${frontmatter}

# ${skill.name}

${skill.description}

## When to Use
${skill.useWhen}

## Workflow
${skill.content}

**IMPORTANT**: Follow this skill's workflow step by step. Do not skip steps.`;
  }

  /**
   * Convert AIKit agent to Antigravity skill format
   */
  private generateAgentAsSkill(agent: Agent, skillName: string): string {
    const frontmatter = this.generateFrontmatter(
      skillName,
      `Agent: ${agent.name}. ${agent.systemPrompt.slice(0, 100)}...`
    );

    return `${frontmatter}

# ${agent.name} Agent

This skill embodies the ${agent.name} agent persona.

## System Prompt
${agent.systemPrompt}

## How to Use
When you need to act as the ${agent.name} agent, follow the system prompt above as your guiding instructions.`;
  }
}
