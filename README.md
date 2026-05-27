# My Virtual Tech Team (MVTT)

> A prompt orchestration framework for [Claude Code](https://claude.ai/claude-code) — 23 AI skills that share persistent context and cover the full development lifecycle from requirements to testing.

[![npm](https://img.shields.io/npm/v/@uoyo/mvtt)](https://www.npmjs.com/package/@uoyo/mvtt) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What is MVTT

MVTT turns Claude Code into a coordinated engineering team — Analyst, Architect, Developer, Reviewer, and Tester — each with a distinct role but sharing the same persistent workspace. Every skill reads from and writes to a file-based context layer that lives in your repository, so knowledge accumulates across conversations instead of being lost.

## Highlights

### Persistent Context That Grows With Your Project

```
.ai-agents/
├── workspace/
│   ├── session.yaml              # Who did what, what's in progress
│   ├── project-context.yaml      # Tech stack, domain model, conventions
│   └── artifacts/                # Analysis docs, design specs, review logs
└── knowledge/
    ├── core/                     # Framework principles & architecture patterns
    ├── principle/                # Your team's coding standards
    └── project/                  # Domain-specific knowledge
```

Context is **never lost between conversations**. Start a new Claude Code session tomorrow and it picks up exactly where you left off — your domain model, architecture decisions, in-progress tasks, and team conventions are all there.

### Save, Resume, and Sync

| Capability | How |
|---|---|
| **Save progress** | Every skill automatically updates `session.yaml` with what was done |
| **Resume anywhere** | `/mvt-resume` restores full context in a new conversation |
| **Sync after changes** | `/mvt-sync-context` updates context when code evolves outside the workflow |
| **Check context health** | `/mvt-check-context` analyzes token load and suggests optimizations |

You can close your IDE, switch machines, or come back days later — the context persists in version-controlled files that travel with your repo.

### One Shared Truth, Zero Drift

Every skill operates against the **same context source**:

```
┌─────────────────────────────────────────────────────┐
│              Shared Context Layer                    │
│  session.yaml + project-context.yaml + knowledge/   │
└───────────┬───────────┬───────────┬─────────────────┘
            │           │           │
      ┌─────┴──┐  ┌────┴────┐  ┌──┴──────┐
      │Analyst │  │Architect│  │Developer│  ...
      └────────┘  └─────────┘  └─────────┘
```

When the Analyst discovers a new domain concept, the Architect sees it. When the Architect makes a design decision, the Developer follows it. No skill can "go rogue" because they all read the same ground truth before acting.

### Complete Development Lifecycle

MVTT covers the full engineering workflow — not just code generation:

```
 Analyze        Design        Plan         Implement      Review        Test
┌────────┐   ┌────────┐   ┌────────┐   ┌──────────┐   ┌────────┐   ┌──────┐
│Extract │   │Define  │   │Break   │   │Write code│   │Check   │   │Write │
│domain  │──▶│arch &  │──▶│into    │──▶│following │──▶│quality │──▶│tests │
│concepts│   │patterns│   │tasks   │   │the design│   │& style │   │      │
└────────┘   └────────┘   └────────┘   └──────────┘   └────────┘   └──────┘
     │                                                                  │
     └──────────────── Context flows through every phase ───────────────┘
```

Each phase produces artifacts that become input for the next. The context accumulates — it doesn't reset.

## Quick Start

```bash
# Install into any project
npx @uoyo/mvtt install

# Open in Claude Code, then:
/mvt-init          # Detect tech stack, initialize context
/mvt-analyze       # Start with requirements analysis
```

## All Skills (23)

### Workflow — Full Development Lifecycle

| Skill | Role | What It Does |
|-------|------|--------------|
| `/mvt-analyze` | Analyst | Extract requirements, domain concepts, acceptance criteria |
| `/mvt-analyze-code` | Analyst | Reverse-analyze existing code into structured context |
| `/mvt-design` | Architect | Define architecture, component boundaries, data flow |
| `/mvt-plan-dev` | Architect | Break design into ordered implementation tasks |
| `/mvt-update-plan` | Architect | Update plan as tasks complete or scope changes |
| `/mvt-implement` | Developer | Write code following the design and plan |
| `/mvt-review` | Reviewer | Check quality, standards compliance, potential issues |
| `/mvt-test` | Tester | Generate tests that validate the implementation |

### Shortcuts — Skip the Ceremony

| Skill | Description |
|-------|-------------|
| `/mvt-bug-detect` | Analyze and detect bugs: investigate root cause, assess severity and impact without fixing |
| `/mvt-fix` | Diagnose and fix bugs (reads context to understand the system) |
| `/mvt-refactor` | Refactor with full awareness of architecture decisions |
| `/mvt-quick-dev` | Fast implementation for simple, well-scoped changes |

### Context Management

| Skill | Description |
|-------|-------------|
| `/mvt-init` | Initialize project context, detect tech stack |
| `/mvt-sync-context` | Update context after code changes made outside MVTT |
| `/mvt-resume` | Restore full context in a new conversation |
| `/mvt-status` | Show what's in progress, what context is loaded |
| `/mvt-manage-context` | Add, remove, or reorganize knowledge entries |
| `/mvt-check-context` | Analyze context token usage and optimize |
| `/mvt-cleanup` | Archive stale artifacts, maintain context health |

### Utility

| Skill | Description |
|-------|-------------|
| `/mvt-help` | Overview of skills and workflow guidance |
| `/mvt-config` | Change language, output format, and preferences |
| `/mvt-create-skill` | Create custom skills for your team's workflows |
| `/mvt-template` | View and customize output templates |

## How Context Stays in Sync

A common fear: "what if the context becomes outdated?" MVTT handles this at multiple levels:

1. **Auto-update on skill execution** — Every skill writes its results back to session and artifacts
2. **Explicit sync** — `/mvt-sync-context` reconciles context with actual code changes
3. **Context health checks** — `/mvt-check-context` identifies stale or bloated entries
4. **Artifact cleanup** — `/mvt-cleanup` archives old artifacts that no longer reflect reality

The context is designed to be a **living document**, not a snapshot.

## CLI Commands

```bash
mvtt install              # First-time install (interactive language selection)
mvtt update [--check]     # Upgrade to latest (user data preserved)
mvtt doctor               # Check installation health
mvtt uninstall            # Remove generated files (user data preserved)
```

## Architecture Patterns

MVTT ships knowledge for three patterns that workflow skills automatically consume:

- **`ddd`** — Domain-Driven Design (bounded contexts, aggregates, domain events)
- **`clean-architecture`** — Layered boundaries, dependency inversion
- **`frontend-react`** — React-specific structural conventions

Detected automatically by `/mvt-init` or configured via `/mvt-config`.

## Extending MVTT

- **Add team knowledge** — Drop markdown files into `.ai-agents/knowledge/principle/` for coding standards, or `project/` for domain knowledge. All skills load them automatically.
- **Create custom skills** — `/mvt-create-skill` scaffolds project-specific skills (e.g., `/mvt-test-e2e` for your E2E conventions).
- **Customize templates** — Override output formats in `.ai-agents/skills/_templates/custom/`.

## Configuration

Edit `.ai-agents/config.yaml` or use `/mvt-config`:

```yaml
version: "2.0"
preferences:
  interaction_language: en-US       # en-US | zh-CN
  document_output_language: en-US   # Language for generated artifacts
  output:
    no_emojis: true
    data_format: yaml               # yaml | json
  context_routing:
    relevance_threshold: 70
```

## Development

```bash
git clone https://github.com/uoyoCsharp/My-Virtual-TechTeam.git
cd My-Virtual-TechTeam
npm install
npm run build        # Compile TypeScript
npm test             # Run test suite
```

## License

MIT
