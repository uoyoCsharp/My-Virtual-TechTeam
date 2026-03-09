# My-Virtual-TechTeam

A virtual IT team made up of AI agents. Help unleash your potential by leveraging the power of AI.

## Overview

This is an AI Agent Framework built on prompt engineering principles. It defines multiple AI agent roles that work together to assist in software development workflows, similar to BMAD Method or Open Spec approaches.

## Quick Start

1. Open this project in VS Code with GitHub Copilot or Claude Code
2. Start a chat and type `#init` to initialize your project
3. Follow the guided prompts to move through the development phases

## Commands

| Command | Description |
|---------|-------------|
| `#init` | Initialize project |
| `#status` | Show workflow status |
| `#config` | Configure settings |
| `#sync-context` | Sync context with code |
| `#update-framework` | Update framework |
| `#cleanup` | Clean up workspace artifacts |
| `#analyze` | Analyze requirements |
| `#analyze-code` | Reverse-analyze code |
| `#design` | Create architecture design |
| `#implement` | Implement feature |
| `#fix` | Fix bug (smart context) |
| `#refactor` | Refactor code |
| `#review` | Code review |
| `#test` | Generate tests |

## Architecture 

```
.ai-agents/           # Core framework (platform-agnostic)
├── registry.yaml     # Unified resource index (LLM preferred entry)
├── config.yaml       # System configuration
├── agents/           # Agent definitions (.yaml + .prompt.md)
│   └── _shared.md    # Shared agent rules
├── skills/           # Modular skills
│   └── _system/      # System skills (auto-invoked)
├── workflows/        # Workflow definitions
├── knowledge/        # Domain knowledge (with semantic index)
└── workspace/        # Project workspace
    ├── state/        # Hot data (current session)
    ├── context/      # Warm data (project context)
    ├── history/      # Cold data (historical archive)
    └── artifacts/    # Work artifacts

.github/              # GitHub Copilot adapter
├── agents/           # Agent activation files
└── copilot-instructions.md  # Global Copilot instructions
```

## Agents

| Agent | Role |
|-------|------|
| **Conductor** | Workflow coordinator and task dispatcher |
| **Analyst** | Requirements analysis and concept extraction |
| **Architect** | System architecture and technical design |
| **Developer** | Code implementation |
| **Reviewer** | Code quality review |
| **Tester** | Test design and execution |

## Features

- **Role Separation**: Each agent has clear responsibilities and boundaries
- **Platform Agnostic**: Works with GitHub Copilot (Claude Code adapter planned)
- **Unified Resource Registry**: `registry.yaml` provides quick access to all resources
- **Context Contract**: Each agent declares required/conditional context
- **Data Tiering**: Hot/warm/cold storage strategy for efficient memory management
- **Semantic Knowledge Index**: Load only relevant knowledge sections
- **Semi-automatic Workflow**: Guided progression with user confirmation
- **Modular Skills**: Load capabilities on-demand to optimize context usage
- **Language Agnostic**: Supports any programming language

## License

MIT
