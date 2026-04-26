# My-Virtual-TechTeam

A virtual IT team made up of AI agents. Help unleash your potential by leveraging the power of AI.

## Overview

This is an AI Agent Framework built on prompt engineering principles. It defines multiple AI agent roles that work together to assist in software development workflows, similar to BMAD Method or Open Spec approaches.

## Quick Start

1. Open this project in VS Code with GitHub Copilot or Claude Code
2. Start a chat and use `/mvt-init` to initialize your project
3. Use `/mvt-help` to see all available skills
4. Follow the guided workflow to move through development phases

## Skills

### Workflow Skills (Sequential Phases)

| Skill | Description |
|-------|-------------|
| `/mvt-analyze` | Analyze requirements and extract domain concepts |
| `/mvt-analyze-code` | Reverse-analyze existing code to generate context |
| `/mvt-design` | Create architecture design based on requirements |
| `/mvt-implement` | Implement features based on architecture design |
| `/mvt-review` | Code review for quality and standards compliance |
| `/mvt-test` | Generate tests to validate implementations |

### Shortcut Skills (Anytime)

| Skill | Description |
|-------|-------------|
| `/mvt-fix` | Diagnose and fix bugs or issues |
| `/mvt-refactor` | Refactor code while preserving behavior |

### Project Management Skills

| Skill | Description |
|-------|-------------|
| `/mvt-init` | Initialize or refresh project setup |
| `/mvt-status` | Show current project and workflow status |
| `/mvt-config` | Manage framework configuration |
| `/mvt-sync-context` | Synchronize context with code changes |
| `/mvt-update` | Check for and install framework updates |
| `/mvt-cleanup` | Clean up workspace artifacts |

### Utility Skills

| Skill | Description |
|-------|-------------|
| `/mvt-help` | Show available skills and workflow guidance |
| `/mvt-create-skill` | Create custom MVTT skills |
| `/mvt-add-context` | Add or update project context interactively |
| `/mvt-check-context` | Analyze context token load and optimization |
| `/mvt-template` | View and customize output templates |

## Standard Workflow

```
/mvt-analyze → /mvt-design → /mvt-implement → /mvt-review → /mvt-test
  Analyst       Architect      Developer       Reviewer       Tester
```

## Architecture 

```
.claude/                # Claude Skill definitions (auto-discovered)
└── skills/             # One directory per skill
    └── mvt-*/SKILL.md  # Self-contained skill instructions

.ai-agents/             # Core framework (platform-agnostic)
├── registry.yaml       # Unified resource index (includes skills registry)
├── config.yaml         # User preferences (language, output style)
├── skills/             # Output templates
│   └── _templates/     # Output templates for skills
├── knowledge/          # Domain knowledge
│   ├── core/           # Universal principles
│   ├── patterns/       # Architecture patterns
│   ├── principle/      # Project coding standards
│   └── project/        # Custom project knowledge
├── workspace/          # Project workspace
│   ├── session.yaml    # Current session state
│   ├── project-context.yaml  # Project context
│   └── artifacts/      # Work artifacts
└── scripts/            # Update and utility scripts
```

## Architecture

Agent roles (Conductor, Analyst, Architect, Developer, Reviewer, Tester) are embedded directly in each SKILL.md file.

All skills share a standardized 4-step Activation Protocol:
1. **Load Context** — session.yaml + project-context.yaml + skill-specific context
2. **Load Config & Apply Preferences** — Read config.yaml, enforce language and output style
3. **Pre-flight Checks** — Validate prerequisites
4. **Execute** — Run skill-specific logic

## Features

- **Role Separation**: Each agent has clear responsibilities and boundaries
- **Native Skill System**: Skills auto-discovered by Claude from `.claude/skills/`
- **Standardized Activation Protocol**: Every skill follows the same 4-step activation
- **Unified Config Center**: `config.yaml` preferences enforced across all skills
- **Context Management**: session.yaml + project-context.yaml as shared foundation
- **Output Templates**: Customizable output templates for consistent formatting
- **Semantic Knowledge Index**: Load only relevant knowledge sections
- **Semi-automatic Workflow**: Guided progression with user confirmation
- **Custom Skills**: Create project-specific skills via `/mvt-create-skill`
- **Context Management**: Track and optimize context token usage
- **Language Agnostic**: Supports any programming language

## License

MIT
