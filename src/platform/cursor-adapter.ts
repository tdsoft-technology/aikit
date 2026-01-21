import { PlatformAdapter } from './types.js';
import { Command } from '../core/commands.js';
import { Skill } from '../core/skills.js';
import { Agent } from '../core/agents.js';
import { CliPlatform } from '../utils/cli-detector.js';
import { paths } from '../utils/paths.js';
import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join } from 'path';

interface TransformedSkill {
  name: string;
  directory: string;
  files: Record<string, string>;
}

/**
 * Cursor Platform Adapter
 * Transforms aikit commands/skills/agents to Cursor format
 */
export class CursorAdapter implements PlatformAdapter {
  readonly platform = CliPlatform.CURSOR;
  readonly displayName = 'Cursor';

  getCommandsDir(): string {
    return join(process.cwd(), '.cursor', 'commands');
  }

  getSkillsDir(): string {
    return join(process.cwd(), '.cursor', 'skills');
  }

  getAgentsDir(): string {
    return paths.cursorConfig('project');
  }

  async transformCommand(command: Command): Promise<{ name: string; content: string }> {
    // Add 'aikit-' prefix to all commands to avoid conflicts
    const name = `aikit-${command.name.replace(/:/g, '-')}`;
    const content = this.generateCommandContent(command);
    return { name, content };
  }

  async transformSkill(skill: Skill): Promise<TransformedSkill> {
    const skillContent = this.generateSkillContent(skill);
    const result: TransformedSkill = {
      name: skill.name,
      directory: '',
      files: { [`${skill.name}.md`]: skillContent },
    };
    return result;
  }

  async transformAgent(agent: Agent): Promise<{ name: string; content: string }> {
    const name = agent.name;
    const content = this.generateAgentContent(agent);
    return { name, content };
  }

  async installCommand(name: string, content: string): Promise<void> {
    const dir = this.getCommandsDir();
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${name}.md`), content);
  }

  async installSkill(_name: string, directory: string, files: Record<string, string>): Promise<void> {
    const baseDir = this.getSkillsDir();
    const targetDir = directory ? join(baseDir, directory) : baseDir;
    await mkdir(targetDir, { recursive: true });
    for (const [filename, content] of Object.entries(files)) {
      await writeFile(join(targetDir, filename), content);
    }
  }

  async installAgent(name: string, content: string): Promise<void> {
    const dir = this.getAgentsDir();
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, `${name}.md`);

    try {
      await access(filePath);
      // File exists - check if it needs updates
      const existingContent = await readFile(filePath, 'utf-8');
      if (!existingContent.includes('name:')) {
        // Missing proper format - update it
        const updatedContent = `---\n${content}\n---\n\n${existingContent}`;
        await writeFile(filePath, updatedContent, 'utf-8');
      }
    } catch {
      // File doesn't exist - create it
      await writeFile(filePath, content, 'utf-8');
    }
  }

  private generateCommandContent(command: Command): string {
    const examples = command.examples.map(e => {
      return `- \`${e}\``;
    }).join('\n');

    let workflow = command.content;

    workflow = workflow
      .replace(/\$ARGUMENTS/g, '$ARGUMENTS')
      .replace(/\$1/g, '$1')
      .replace(/\$2/g, '$2')
      .replace(/\$3/g, '$3')
      .replace(/\$4/g, '$4')
      .replace(/\$5/g, '$5');

    return `# Command: /${command.name}

## Description
${command.description}

## Usage
\`${command.usage}\`

## Examples
${examples}

## Workflow
${workflow}

**Category**: ${command.category}`;
  }

  private generateSkillContent(skill: Skill): string {
    const relativePath = skill.filePath.startsWith(process.cwd())
      ? skill.filePath.replace(process.cwd(), '').replace(/\\/g, '/').replace(/^\//, '')
      : `.aikit/skills/${skill.name}.md`;

    return `Use the **${skill.name} skill** ${skill.useWhen.toLowerCase()}.

READ ${relativePath}

## Description
${skill.description}

## When to Use
${skill.useWhen}

## Workflow
${skill.content.split('\n').slice(0, 20).join('\n')}${skill.content.split('\n').length > 20 ? '\n\n... (see full skill file for complete workflow)' : ''}

**IMPORTANT**: Follow this skill's workflow step by step. Do not skip steps.
Complete the checklist at the end of the skill.`;
  }

  private generateAgentContent(agent: Agent): string {
    return `---
name: ${agent.name}
mode: subagent
---

${agent.systemPrompt}`;
  }
}
