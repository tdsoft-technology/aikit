<div align="center">

<img src="assets/logo.png" alt="AIKit Logo" width="200"/>
<a href="https://www.producthunt.com/products/aikit?embed=true&amp;utm_source=badge-featured&amp;utm_medium=badge&amp;utm_campaign=badge-aikit" target="_blank" rel="noopener noreferrer"><img alt="AIKit - Transform Claude Code into a production dev environment. | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1058608&amp;theme=light&amp;t=1767742744161"></a>

# **AIKit**

### **Open-Source AI Coding Agent Toolkit**

**Works with Claude Code, OpenCode, and Cursor**

[![npm version](https://badge.fury.io/js/%40tdsoft-tech%2Faikit.svg)](https://www.npmjs.com/package/@tdsoft-tech/aikit)
[![License](https://img.shields.io/badge/License-Dual%20License-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%3E=18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

[![Stars](https://img.shields.io/github/stars/tdsoft-technology/aikit?style=social)](https://github.com/tdsoft-technology/aikit/stargazers)
[![Forks](https://img.shields.io/github/forks/tdsoft-technology/aikit?style=social)](https://github.com/tdsoft-technology/aikit/network/members)
[![Issues](https://img.shields.io/github/issues/tdsoft-technology/aikit)](https://github.com/tdsoft-technology/aikit/issues)

**Skills • Agents • Commands • Tools • Plugins**

[Documentation](https://aikit.tdsoft.tech/docs/intro) • [Quick Start](#-quick-start) • [Features](#-features) • [Contributing](#-contributing)

</div>

---

## ✨ What is AIKit?

**AIKit** is a powerful, open-source toolkit that extends your AI coding experience with reusable **skills**, intelligent **agents**, custom **commands**, and flexible **plugins**. It's designed to supercharge your development workflow with AI-driven automation.

**Works with Claude Code (recommended), OpenCode, and Cursor.**

Perfect for developers who want to:
- 🚀 **Automate repetitive tasks** with custom commands
- 🧠 **Leverage specialized AI skills** (testing, refactoring, security, etc.)
- 🤖 **Use intelligent agents** for complex workflows
- 🔌 **Extend functionality** with plugins
- 📦 **Share knowledge** across projects

---

### 🎬 Quick Demo

<div align="center">

<img src="assets/202601041506.gif" alt="AIKit Demo" width="800"/>

</div>

---

## 🎯 Key Features

### 🧠 Specialized Skills

23+ skills covering every aspect of development:

**Design & Architecture** • **Development** • **Testing** • **Workflow**

- 🎨 Frontend Aesthetics
- 🏗️ Component Design
- 🗄️ Database Design
- 📐 Design Measurement
- 🔌 API Design
- ⚡ Performance Optimization
- 🔨 Refactoring
- 🛡️ Security Audit
- 🐛 Systematic Debugging
- ✅ Unit Testing
- 🔄 Test-Driven Development
- 🔗 Integration Testing
- 🧪 Frontend Testing
- 📝 Documentation
- 🔀 CI/CD
- 🐳 Docker
- 🌳 Git Best Practices
- 💳 Payments Integration

---

### 🤖 Intelligent Agents

8 specialized agents for different workflows:

| Agent | Mode | Purpose |
|:-----:|:----:|:---------|
| `aikitplanner` | `<tab>` | Plan complex features |
| `aikitbuild` | `<tab>` | Implement features |
| `rush` | `<tab>` | Quick fixes |
| `review` | `<tab>` | Code review |
| `scout` | `<tab>` | Explore codebase |
| `explore` | `<tab>` | Deep analysis |
| `vision` | `<tab>` | Image analysis |
| `one-shot` | `<tab>` | End-to-end automation |

> 💡 **Tip:** Press `<tab>` in Claude Code or OpenCode to switch between agents!

---

### ⚡ Quick Commands

28+ commands at your fingertips:

**Claude Code (simpler):**
```bash
/plan      /implement    /fix
/test      /review       /branch
/session:start
```

**OpenCode:**
```bash
/plan    /implement  /fix
/test    /review     /branch
/session:start
```

[View all commands →](https://aikit.tdsoft.tech/docs/commands/intro)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **Claude Code** (recommended) or **OpenCode** with Claude integration

### Installation

```bash
# Install AIKit globally
npm install -g @tdsoft-tech/aikit

# Or install in your project
npm install -D @tdsoft-tech/aikit

# Initialize AIKit in your project
aikit install
```

That's it! 🎉 AIKit is now ready to use.

### First Steps

**For Claude Code:**
1. Open Claude Code in your project
2. Use commands: `/plan`, `/implement`, `/fix`, `/test`
3. Try a skill: `/test-driven-development` or `/code-review`
4. Read the [documentation](https://aikit.tdsoft.tech/docs/intro)

**For OpenCode:**
1. **Open OpenCode** and press `/` to see available commands
2. Try a skill: `/test-driven-development`
3. Switch agents: Press `<tab>` to cycle through agents
4. Read the [documentation](https://aikit.tdsoft.tech/docs/intro)

---

## 📚 Documentation

**[📖 Full Documentation](https://aikit.tdsoft.tech/docs/intro)**

### Quick Links

- [Installation Guide](https://aikit.tdsoft.tech/docs/installation)
- [Quick Reference](https://aikit.tdsoft.tech/docs/quick-reference)
- [All Skills](https://aikit.tdsoft.tech/docs/skills)
- [Commands](https://aikit.tdsoft.tech/docs/commands)
- [One-Shot Mode](https://aikit.tdsoft.tech/docs/one-shot-mode)
- [Figma Integration](https://aikit.tdsoft.tech/docs/using-analyze-figma)

---

## 🎬 Usage Examples

> 💡 **Note:** Command formats differ between Claude Code and OpenCode

### Session Management

**Claude Code:**
```bash
/session:start "Implement OAuth 2.0"
/session:update
/session:end
```

**OpenCode:**
```bash
/session:start "Implement OAuth 2.0"
/session:update
/session:end
```

### Planning Features

**Claude Code:**
```bash
/plan "Add user authentication with OAuth"
```

**OpenCode:**
```bash
/plan "Add user authentication with OAuth"
```

### Implementing Features

**Claude Code:**
```bash
/implement
# Or use skill directly
/test-driven-development
```

**OpenCode:**
```bash
/implement
/test-driven-development
```

### Fixing Bugs

**Claude Code:**
```bash
/fix "Login fails on Safari"
```

**OpenCode:**
```bash
/fix "Login fails on Safari"
```

### Code Review

**Claude Code:**
```bash
/code-review
```

**OpenCode:**
```bash
/code-review
```

### One-Shot Automation

**Claude Code:**
```bash
/one-shot "Add dark mode toggle to settings"
```

**OpenCode:**
```bash
/one-shot "Add dark mode toggle to settings"
```

### Creating Branches

**Claude Code:**
```bash
/branch "user-oauth"
```

**OpenCode:**
```bash
/branch "user-oauth"
```

---

## 🤝 Contributing

We love contributions! 💜

**[📖 Contributing Guide](CONTRIBUTING.md)**

### Ways to Contribute

- 🐛 [Report bugs](https://github.com/tdsoft-technology/aikit/issues)
- 💡 [Suggest features](https://github.com/tdsoft-technology/aikit/issues)
- 📝 [Improve docs](https://github.com/tdsoft-technology/aikit/pulls)
- 🔧 [Submit PRs](https://github.com/tdsoft-technology/aikit/pulls)
- 🌟 [Star the repo](https://github.com/tdsoft-technology/aikit) ⭐

---

## ❤️ Support AIKit

If you find AIKit useful, please consider supporting us! Your support helps us:
- 🛠️ Maintain and improve AIKit
- 🐛 Fix bugs faster
- ✨ Add new features
- 📚 Keep documentation up to date
- 🌍 Support the community

### Ways to Support

| Support Type | Link | Description |
|--------------|------|-------------|
| ⭐ **Star on GitHub** | [Star this repo](https://github.com/tdsoft-technology/aikit) | It's free and helps others discover AIKit! |
| 💬 **Join Discussions** | [GitHub Discussions](https://github.com/tdsoft-technology/aikit/discussions) | Ask questions, share ideas |
| 💰 **Sponsor me at GitHub** | [Sponsor me at GitHub](https://github.com/sponsors/dpnt23) | Support development |
<div style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; border: 1px solid rgb(224, 224, 224); border-radius: 12px; padding: 20px; max-width: 500px; background: rgb(255, 255, 255); box-shadow: rgba(0, 0, 0, 0.05) 0px 2px 8px;"><div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;"><img alt="AIKit" src="https://ph-files.imgix.net/e2eef671-13f0-4f5c-9dca-7450a9fb29ec.png?auto=format&amp;fit=crop&amp;w=80&amp;h=80" style="width: 64px; height: 64px; border-radius: 8px; object-fit: cover; flex-shrink: 0;"><div style="flex: 1 1 0%; min-width: 0px;"><h3 style="margin: 0px; font-size: 18px; font-weight: 600; color: rgb(26, 26, 26); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">AIKit</h3><p style="margin: 4px 0px 0px; font-size: 14px; color: rgb(102, 102, 102); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">Transform Claude Code into a production dev environment.</p></div></div><a href="https://www.producthunt.com/products/aikit?embed=true&amp;utm_source=embed&amp;utm_medium=post_embed" target="_blank" rel="noopener" style="display: inline-flex; align-items: center; gap: 4px; margin-top: 12px; padding: 8px 16px; background: rgb(255, 97, 84); color: rgb(255, 255, 255); text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">Check it out on Product Hunt →</a></div>

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.

### Recent Highlights
- **v0.1.20** - Latest stable release
- **v0.1.18** - Fixed agent tab switching
- **v0.1.15** - Command prefix separation
- **v0.1.11** - One-Shot mode (beta)

---

## Licensing

AIKit is available under a dual-license model:

### Non-Commercial License (Free)
- Free for personal, educational, and research use
- Open source learning and experimentation
- [View Non-Commercial License](LICENSE)

### Commercial License (Paid)
- Required for any commercial or revenue-generating use
- SaaS platforms, paid APIs, enterprise systems
- [View Commercial License](COMMERCIAL_LICENSE.md)

**For commercial licensing inquiries:**
📧 dev@tdsoft.tech or duypnt23@gmail.com
🌐 https://tdsoft.tech

---

## Acknowledgments

Built with ❤️ by the open-source community.
---

<div align="center">

Built for Developers • Open Source Forever


[Documentation](https://aikit.tdsoft.tech/docs/intro) •
[Issues](https://github.com/tdsoft-technology/aikit/issues) •
[Discussions](https://github.com/tdsoft-technology/aikit/discussions) •
[Releases](https://github.com/tdsoft-technology/aikit/releases)

Made with 💜 by [TDSoft Technology](https://github.com/tdsoft-technology)

</div>
