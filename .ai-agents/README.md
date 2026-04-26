# MVTT Framework

Skills-based AI agent framework for software development. Built on two foundations: **unified configuration management** and **context management**, with skills as functional modules on top.

## Quick Start

1. **Start**: Use `/mvt-init` to initialize, `/mvt-status` to check progress, `/mvt-help` for guidance
2. **Configure**: Use `/mvt-config` to set language, output preferences, and architecture pattern

## Standard Workflow

```
/mvt-analyze → /mvt-design → /mvt-implement → /mvt-review → /mvt-test
  Analyst       Architect      Developer       Reviewer       Tester
```

## Skills (19 total)

| Category | Skill | Purpose |
|----------|-------|---------|
| **Project** | `/mvt-init` | Initialize project |
| | `/mvt-status` | Show workflow status |
| | `/mvt-config` | Configure settings |
| | `/mvt-sync-context` | Sync context with code |
| | `/mvt-update` | Update framework |
| | `/mvt-cleanup` | Clean up workspace artifacts |
| **Workflow** | `/mvt-analyze` | Analyze requirements |
| | `/mvt-analyze-code` | Reverse-analyze code |
| | `/mvt-design` | Create architecture design |
| | `/mvt-implement` | Implement feature |
| | `/mvt-review` | Code review |
| | `/mvt-test` | Generate tests |
| **Shortcuts** | `/mvt-fix` | Fix bug (smart context) |
| | `/mvt-refactor` | Refactor code |
| **Utility** | `/mvt-help` | Show available skills |
| | `/mvt-create-skill` | Create custom skills |
| | `/mvt-add-context` | Add project context |
| | `/mvt-check-context` | Analyze context load |
| | `/mvt-template` | Manage output templates |

## Directory Structure

| Directory | Purpose |
|-----------|---------|
| `.claude/skills/mvt-*/SKILL.md` | Skill definitions (auto-discovered by Claude) |
| `registry.yaml` | Unified resource index |
| `config.yaml` | User preferences (language, output style) |
| `skills/_templates/` | Output templates for skills |
| `knowledge/` | Domain knowledge |
| `knowledge/core/` | Core principles (always loaded) |
| `knowledge/patterns/` | Architecture patterns (on-demand) |
| `knowledge/principle/` | Project coding standards (generated) |
| `knowledge/project/` | Project-specific knowledge |
| `workspace/` | Project workspace |
| `workspace/session.yaml` | Current session state |
| `workspace/project-context.yaml` | Unified project context |
| `workspace/artifacts/` | Work artifacts (grouped by change) |
| `workspace/requirements/` | Requirements input documents |

## Key Concepts

### Skill Activation Protocol

Each skill is a self-contained SKILL.md file in `.claude/skills/mvt-*/`:
- Auto-discovered by Claude's native skill system
- Contains a standardized 4-step Activation Protocol
- Invoked via `/mvt-{skill}` pattern

When a `/mvt-{skill}` is invoked, the skill executes its Activation Protocol:
1. **Step 1: Load Context** — Load session.yaml + project-context.yaml + skill-specific extended context
2. **Step 2: Load Config & Apply Preferences** — Read config.yaml and enforce language, output style throughout the session
3. **Step 3: Pre-flight Checks** — Validate prerequisites (session init, pattern, prior phases)
4. **Step 4: Execute** — Run the skill-specific execution flow

### Data Tiering

Workspace uses a simplified two-file structure:
- **session.yaml**: Current session state and workflow progress
- **project-context.yaml**: Unified project info, requirements, architecture, and decisions
- **artifacts/**: Work outputs grouped by change-id

### Index Convention

| File | Purpose | Used In |
|------|---------|--------|
| `registry.yaml` | Global resource index | Framework root |
| `manifest.yaml` | Knowledge pack metadata | knowledge/*/ |

## Architecture

```
┌─────────────────────────────────────────┐
│           Skills (Functional Modules)    │
│  mvt-analyze  mvt-design  mvt-implement │
│  mvt-review   mvt-test    mvt-fix  ...  │
├─────────────────────────────────────────┤
│     Standardized 4-Step Activation      │
│           Protocol (Glue Layer)         │
├──────────────────┬──────────────────────┤
│  Unified Config  │  Context Management  │
│  config.yaml     │  session.yaml        │
│  (preferences)   │  project-context.yaml│
│                  │  artifacts/          │
└──────────────────┴──────────────────────┘
```

Agent roles (Conductor, Analyst, Architect, Developer, Reviewer, Tester) are embedded directly in each SKILL.md file.

## Workflows

Workflows define phase transitions:

- **requirement-to-code**: Full development cycle
  - analyze → design → implement → review → test

## Extending

### Add Custom Agent

1. Create `.ai-agents/agents/{name}.md` with YAML frontmatter and behavior rules
2. Register in `registry.yaml` under `agents` and `commands`

### Add Architecture Pattern

1. Create `.ai-agents/knowledge/patterns/{pattern}/` directory
2. Add `manifest.yaml` with pattern metadata
3. Add pattern documentation (overview.md, review-checklist.md)
4. Update `.ai-agents/knowledge/patterns/manifest.yaml` under `available`
