# AI Agent Framework 

Multi-agent collaboration framework for software development.

## Quick Start

1. **Framework Entry**: Read `FRAMEWORK.md` for core instructions
2. **Resource Registry**: Read `registry.yaml` for agent/command mappings
3. **Start**: Use `#init` to initialize, `#status` to check progress

## Standard Workflow

```
#analyze --> #design --> #implement --> #review --> #test
 Analyst     Architect    Developer     Reviewer    Tester
```

## Core Commands (14 total)

| Category | Command | Purpose |
|----------|---------|--------|
| **Project** | `#init` | Initialize project |
| | `#status` | Show workflow status |
| | `#config` | Configure settings |
| | `#sync-context` | Sync context with code |
| | `#update-framework` | Update framework |
| | `#cleanup` | Clean up workspace artifacts |
| **Analysis** | `#analyze` | Analyze requirements |
| | `#analyze-code` | Reverse-analyze code |
| **Design** | `#design` | Create architecture design |
| **Development** | `#implement` | Implement feature |
| | `#fix` | Fix bug (smart context) |
| | `#refactor` | Refactor code |
| **Review** | `#review` | Code review |
| **Test** | `#test` | Generate tests |

## Directory Structure

| Directory | Purpose |
|-----------|---------|
| `FRAMEWORK.md` | Framework entry (core instructions for LLM) |
| `registry.yaml` | Unified resource index |
| `config.yaml` | User configuration |
| `.ai-agents/agents/_shared.md` | Shared behavior rules for all agents |
| `.ai-agents/agents/{agent}.md` | Agent core file (role + behavioral rules) |
| `.ai-agents/agents/_commands/{command}.md` | Command-specific execution file |
| `.ai-agents/skills/` | Modular capabilities (on-demand) |
| `.ai-agents/skills/_system/` | System skills (context-loader) |
| `.ai-agents/workflows/` | Workflow state machine definitions |
| `.ai-agents/knowledge/` | Domain knowledge |
| `.ai-agents/knowledge/core/` | Core principles (always loaded) |
| `.ai-agents/knowledge/patterns/` | Architecture patterns (on-demand) |
| `.ai-agents/knowledge/principle/` | Project coding standards (generated) |
| `.ai-agents/knowledge/project/` | Project-specific knowledge |
| `.ai-agents/workspace/` | Project workspace |
| `.ai-agents/workspace/session.yaml` | Current session state |
| `.ai-agents/workspace/project-context.yaml` | Unified project context (requirements + architecture + decisions) |
| `.ai-agents/workspace/artifacts/` | Work artifacts (grouped by change) |
| `.ai-agents/workspace/requirements/` | Requirements input documents |
| `.ai-agents/workspace/history/` | Historical archive |

## Key Concepts

### Agent Activation

Each agent defines its context in its `.md` file's YAML frontmatter:
```yaml
context:
  required:      # Must load
  optional:      # Load when relevant
```

When a `#command` is detected, the framework:
1. Looks up the agent in `registry.yaml`
2. Loads `.ai-agents/agents/{agent}.md` (agent core)
3. Loads `.ai-agents/agents/_commands/{command}.md` (command details)

### Data Tiering

Workspace uses a simplified two-file structure:
- **session.yaml**: Current session state and workflow progress
- **project-context.yaml**: Unified project info, requirements, architecture, and decisions
- **artifacts/**: Work outputs grouped by change-id
- **history/**: Historical archive

### Index Convention

| File | Purpose | Used In |
|------|---------|--------|
| `registry.yaml` | Global resource index | Framework root |
| `manifest.yaml` | Knowledge pack metadata | .ai-agents/knowledge/*/ |

## Agents

Each agent has a single `.md` file with:

1. **YAML frontmatter**: id, name, commands, context requirements
2. **Markdown body**: Core role, behavioral rules, decision framework

Common rules are defined in `.ai-agents/agents/_shared.md`.

## Skills

Skills are modular capabilities loaded on-demand:
- `project-initialization.md` - Initialize project and analyze structure
- `config-manager.md` - Interactive configuration management
- `review-execution.md` - Execute review checklists
- `test-generation.md` - Generate test cases
- `framework-update.md` - Update framework from GitHub

## Workflows

Workflows define phase transitions:

- **requirement-to-code**: Full development cycle
  - analyze --> design --> implement --> review --> test

- **code-review**: Internal execution flow of the `#review` command
  - analyze --> review --> report

## Extending

### Add Custom Agent

1. Create `.ai-agents/agents/{name}.md` with YAML frontmatter and behavior rules
2. Register in `registry.yaml` under `agents` and `commands`

### Add Architecture Pattern

1. Create `.ai-agents/knowledge/patterns/{pattern}/` directory
2. Add `manifest.yaml` with pattern metadata
3. Add pattern documentation (overview.md, review-checklist.md)
4. Update `.ai-agents/knowledge/patterns/manifest.yaml` under `available`
