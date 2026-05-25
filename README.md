# My-Virtual-TechTeam (MVTT)

A virtual IT team made up of AI agents. Built for [Claude Code](https://claude.ai/claude-code), MVTT turns your IDE into a coordinated squad of Analyst, Architect, Developer, Reviewer, and Tester — each with a clear role, a shared workspace, and enforceable team conventions.

## Why MVTT

- **One-command install** — `npx @uoyo/mvtt install` drops a full skill suite into any project
- **Claude Code native** — 18 skills auto-discovered from `.claude/skills/`
- **Bilingual output** — choose `en-US` or `zh-CN` at install time; every skill honors the setting
- **Shared workspace** — `.ai-agents/` centralizes session state, domain knowledge, config, and output templates
- **Safe lifecycle** — `install` / `update` / `uninstall` / `doctor` with manifest-based file ownership, so user data is never overwritten
- **Extensible** — `/mvt-create-skill` lets your team grow its own skills for project-specific workflows

## Installation

```bash
npx @uoyo/mvtt install
```

The installer is interactive:

```
? Select language / 选择语言
❯ English (en-US)
  中文 (zh-CN)
```

Optional flags:

```bash
npx @uoyo/mvtt install --pattern ddd    # Preset architecture pattern (ddd | clean-architecture | frontend-react)
```

## Quick Start

1. Run `npx @uoyo/mvtt install` in your project root
2. Open the project in Claude Code
3. Run `/mvt-init` to initialize the workspace
4. Run `/mvt-help` to see all available skills
5. Follow the guided workflow through your development phases

## CLI Commands

| Command | Purpose |
|---|---|
| `npx @uoyo/mvtt install` | First-time install; interactive language selection |
| `npx @uoyo/mvtt install --pattern <name>` | Install with a preset architecture pattern |
| `npx @uoyo/mvtt update` | Upgrade to the latest version (user data preserved) |
| `npx @uoyo/mvtt update --check` | Show version diff without modifying anything |
| `npx @uoyo/mvtt doctor` | Check installation health and detect manual edits |
| `npx @uoyo/mvtt uninstall` | Interactive confirmation, then remove generated files (user data preserved) |
| `npx @uoyo/mvtt --help` | Full CLI help |
| `npx @uoyo/mvtt --version` | Print version |

## Skills (18 total)

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
| `/mvt-cleanup` | Clean up workspace artifacts |

### Utility Skills

| Skill | Description |
|-------|-------------|
| `/mvt-help` | Show available skills and workflow guidance |
| `/mvt-create-skill` | Create custom MVTT skills |
| `/mvt-manage-context` | Add, remove, move, rename, or list knowledge entries (with AI routing) |
| `/mvt-check-context` | Analyze context token load and optimization |
| `/mvt-template` | View and customize output templates |

## Standard Workflow

```
/mvt-analyze → /mvt-design → /mvt-implement → /mvt-review → /mvt-test
   Analyst       Architect      Developer       Reviewer       Tester
```

The Conductor (the underlying orchestration logic) keeps session state in `.ai-agents/workspace/session.yaml` so any skill can pick up where the previous one left off.

## Configuration

All preferences live in `.ai-agents/config.yaml`:

```yaml
version: "2.0"

preferences:
  language: en-US          # en-US | zh-CN — chosen during install, changeable anytime
  output:
    no_emojis: true        # Disable emojis in skill output
    data_format: yaml      # yaml | json

pattern:
  active: ""               # Detected via /mvt-init or set via --pattern on install
  selection:
    auto_detect: true
    confirm_with_user: true
```

Every skill reads this file on activation and enforces the settings through the shared Activation Protocol.

## Architecture Patterns

MVTT ships with first-class knowledge for three patterns (`.ai-agents/knowledge/patterns/`):

- **`ddd`** — Domain-Driven Design (bounded contexts, aggregates, domain events)
- **`clean-architecture`** — Layered boundaries, dependency inversion
- **`frontend-react`** — React-specific structural conventions

Each pattern contributes its own review checklist and design guidance that `/mvt-design`, `/mvt-review`, and `/mvt-refactor` automatically consume.

## Runtime Layout

After `install`, your project has:

```
.claude/skills/mvt-*/SKILL.md       # GENERATED (18 skills, Claude Code entry points)

.ai-agents/
├── config.yaml                      # CREATE_ONCE (user-editable)
├── registry.yaml                    # GENERATED (skill metadata)
├── .mvtt-manifest.json              # GENERATED (install metadata, hashes)
├── workspace/
│   ├── session.yaml                 # CREATE_ONCE
│   ├── project-context.yaml         # CREATE_ONCE
│   └── artifacts/                   # USER DATA (skill outputs)
├── skills/_templates/
│   ├── *-output.md                  # GENERATED (14 templates)
│   └── custom/                      # USER DATA (your overrides)
└── knowledge/
    ├── core/                        # GENERATED (framework-wide principles)
    ├── patterns/                    # GENERATED (ddd, clean-architecture, frontend-react)
    ├── principle/                   # USER DATA (team conventions)
    └── project/                     # USER DATA (domain-specific knowledge)
```

File classification:

- **GENERATED** — owned by the CLI; overwritten on every `update`
- **CREATE_ONCE** — created only on first install; never overwritten
- **USER DATA** — CLI never touches these paths

`doctor` hashes every GENERATED file against the manifest, so manual edits are detected immediately.

## Activation Protocol (Runtime)

Every skill shares a 4-step activation sequence, inlined into each `SKILL.md` at build time:

1. **Load Context** — `session.yaml` + `project-context.yaml` + skill-specific extended context
2. **Load Config & Apply Preferences** — read `config.yaml`, enforce language and output style
3. **Pre-flight Checks** — validate prerequisites (workspace initialized, required artifacts exist, etc.)
4. **Execute** — run skill-specific logic

DRY at source (one shared section per step), flat at runtime (each `SKILL.md` is self-contained — no cross-file reads when Claude Code loads a skill).

## Extending MVTT

Beyond the 18 built-in skills, run `/mvt-create-skill` to scaffold a project-specific skill interactively. Custom skills live under `.ai-agents/skills/` and can override or complement any default behavior (e.g. a `/mvt-test-gherkin` variant that emits Gherkin feature files in your team's house style).

## Development (Contributing to MVTT Itself)

Requirements: Node.js ≥ 18.

```bash
npm install
npm run build                       # Compile TypeScript
npm test                            # Run test suite (66 tests)
npm test -- --coverage              # With coverage report

# Rebuild skills / templates from sources into any output directory
node dist/index.js build --out .test-output
```

Source layout:

- `src/` — CLI TypeScript source (commander-based; uses `prompts` for interactive selection)
- `sources/skills/<name>/manifest.yaml + business.md` — Skill source files
- `sources/templates/<name>/manifest.yaml + body.md` — Template source files
- `sources/sections/*.md` — Shared activation protocol sections (mustache-style blocks)
- `registry.yaml` — Single source of truth for skill metadata
- `install-manifest.yaml` — File classification (generated / create_once / user_data)

## License

MIT
