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

## Core Commands (13 total)

| Category | Command | Purpose |
|----------|---------|---------|
| **Project** | `#init` | Initialize project |
| | `#status` | Show workflow status |
| | `#config` | Configure settings |
| | `#sync-context` | Sync context with code |
| | `#update-framework` | Update framework |
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
| `agents/_shared.md` | Shared behavior rules for all agents |
| `agents/{agent}.md` | Agent core file (role + behavioral rules) |
| `agents/_commands/{command}.md` | Command-specific execution file |
| `skills/` | Modular capabilities (on-demand) |
| `skills/_system/` | System skills (context-loader, semantic-indexer) |
| `workflows/` | Workflow state machine definitions |
| `knowledge/` | Domain knowledge |
| `knowledge/core/` | Core principles (always loaded) |
| `knowledge/patterns/` | Architecture patterns (on-demand) |
| `knowledge/principle/` | Project coding standards (generated) |
| `knowledge/project/` | Project-specific knowledge |
| `workspace/` | Project workspace |
| `workspace/state/` | Hot data: current session |
| `workspace/context/` | Warm data: project context |
| `workspace/history/` | Cold data: historical archive |
| `workspace/artifacts/` | Work artifacts (grouped by change) |

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
2. Loads `agents/{agent}.md` (agent core)
3. Loads `agents/_commands/{command}.md` (command details)

### Data Tiering

Workspace uses tiered storage strategy:
- **Hot (state/)**: Current session, <50KB
- **Warm (context/)**: Project context, <100KB  
- **Cold (history/)**: Historical archive, read index only

### Index Files Convention

| File | Purpose | Used In |
|------|---------|---------|
| `_index.yaml` | Directory contents listing | workspace/, skills/, workflows/ |
| `manifest.yaml` | Knowledge pack metadata with loading strategies | knowledge/*/ |

## Agents

Each agent has a single `.md` file with:

1. **YAML frontmatter**: id, name, commands, context requirements
2. **Markdown body**: Core role, behavioral rules, decision framework

Common rules are defined in `agents/_shared.md`.

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

1. Create `agents/{name}.md` with YAML frontmatter and behavior rules
2. Register in `registry.yaml` under `agents` and `commands`

### Add Architecture Pattern

1. Create `knowledge/patterns/{pattern}/` directory
2. Add `manifest.yaml` with pattern metadata
3. Add pattern documentation (overview.md, review-checklist.md)
4. Update `knowledge/patterns/manifest.yaml` under `available`
