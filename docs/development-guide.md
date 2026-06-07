# Development Guide

Welcome to **My Virtual Tech Team (MVTT)** — an AI-guided prompt orchestration framework for Claude Code, distributed as the npm CLI `@uoyo/mvtt`. This guide will get you from zero to your first contribution.

---

## Table of Contents

1. [What You're Working On](#1-what-youre-working-on)
2. [Mental Model: How MVTT Works](#2-mental-model-how-mvtt-works)
3. [Prerequisites & Setup](#3-prerequisites--setup)
4. [Repository Layout](#4-repository-layout)
5. [Common Workflows](#5-common-workflows)
6. [Adding a New Skill (Most Common Task)](#6-adding-a-new-skill-most-common-task)
7. [Skill Design Principles](#7-skill-design-principles)
8. [Adding a New CLI Command](#8-adding-a-new-cli-command)
9. [The Build Pipeline Explained](#9-the-build-pipeline-explained)
10. [Testing](#10-testing)
11. [Coding Conventions](#11-coding-conventions)
12. [Release & CI/CD](#12-release--cicd)
13. [Troubleshooting](#13-troubleshooting)
14. [Glossary](#14-glossary)

---

## 1. What You're Working On

MVTT is a CLI tool that installs a curated **virtual tech team** (18 specialized AI skills) into any Claude Code project. Each skill represents a role — Analyst, Architect, Developer, Reviewer, Tester — and guides the user through a standard software workflow.

**Two halves of the project:**

| Half | What it is | Where it lives |
|------|------------|----------------|
| **The CLI** (TypeScript) | `mvtt install`, `mvtt update`, `mvtt doctor`, `mvtt uninstall`, `mvtt build` | `src/` → compiled to `dist/` |
| **The Skill Content** (Markdown + YAML) | The 18 skills that get materialized into the user's project at install time | `sources/` |

The CLI's job is to **read the source content, assemble it, and write it into the user's project** (typically into `.claude/skills/` and `.ai-agents/`). The skills themselves are not code — they are structured Markdown documents that Claude Code interprets.

---

## 2. Mental Model: How MVTT Works

```
   sources/                              User's project
   ├── skills/mvt-*/                     ├── .claude/skills/mvt-*/SKILL.md
   │   ├── manifest.yaml      ───┐      ├── .ai-agents/
   │   └── business.md           │      │   ├── config.yaml
   ├── sections/  (shared)       │      │   ├── knowledge/
   ├── templates/                ├──►   │   ├── workspace/artifacts/
   ├── knowledge/                │      │   └── templates/
   └── defaults/             ────┘      └── .mvtt-manifest.json   (integrity index)
                          │
                ┌─────────▼─────────┐
                │  src/build/       │
                │  - assembler      │ ← composes manifest + sections → SKILL.md
                │  - section-loader │ ← Mustache-style template expansion
                │  - validators     │
                └───────────────────┘
                          │
                ┌─────────▼─────────┐
                │  src/fs/          │
                │  - materialize    │ ← writes files into user project
                │  - hashing        │ ← integrity check via SHA hashes
                │  - manifest       │ ← tracks what we own vs user data
                └───────────────────┘
```

**Three classes of files** the CLI manages (defined in `install-manifest.yaml`):

- **`generated`** — fully owned by MVTT, overwritten on `update` (e.g., skill files, framework knowledge)
- **`create_once`** — created on first install, never touched again (e.g., `config.yaml`)
- **`user_data`** — directories MVTT never touches (e.g., user knowledge, artifacts)

This separation is **the most important invariant in the codebase**. Breaking it can destroy user work. Always classify new files correctly before adding them.

---

## 3. Prerequisites & Setup

### Requirements
- **Node.js ≥ 18** (enforced at runtime in `src/index.ts`)
- **npm** (comes with Node)
- A Claude Code installation (for end-to-end manual testing)

### Get Started

```bash
git clone https://github.com/uoyoCsharp/My-Virtual-TechTeam.git
cd My-Virtual-TechTeam
npm install
npm run build           # Compile TypeScript to dist/
npm test                # Run all 66 tests
```

### Run the CLI Locally

After `npm run build`, you can invoke the CLI directly:

```bash
node dist/index.js --help
node dist/index.js install --help
```

To test the full install flow into a scratch directory:

```bash
mkdir /tmp/mvtt-sandbox
cd /tmp/mvtt-sandbox
node /path/to/My-Virtual-TechTeam/dist/index.js install
```

For rapid iteration on skill content, use the dev `build` command, which materializes `sources/` into any directory without going through the interactive installer:

```bash
node dist/index.js build --out .test-output
```

### Recommended Editor Setup
- **VS Code** with the official TypeScript and ESLint extensions
- Enable "Format on Save" — declaration maps are configured for cross-file navigation

---

## 4. Repository Layout

```
.
├── src/                       TypeScript source (compiled to dist/)
│   ├── index.ts               Entry point: shebang, Node-version check
│   ├── cli.ts                 Commander setup; registers all commands
│   ├── commands/              One file per CLI command (install, update, ...)
│   ├── build/                 Assembler, section loader, validators
│   ├── fs/                    Materialization, hashing, manifest I/O
│   ├── types/                 Shared TypeScript interfaces
│   └── util/                  Color output, package metadata helpers
│
├── sources/                   The "content" that gets installed into user projects
│   ├── skills/mvt-*/          18 skill packages (manifest.yaml + business.md)
│   ├── sections/              Shared markdown fragments reused across skills
│   ├── templates/             Output artifact templates (e.g. analyze-output.md)
│   ├── knowledge/             Framework knowledge & architecture patterns
│   │   ├── core/              Framework principles
│   │   └── patterns/          ddd/, clean-architecture/, frontend-react/
│   └── defaults/              Seed files for first install (config.yaml, etc.)
│
├── test/                      Vitest test suite (66 tests)
│   ├── *.test.ts              Unit tests mirroring src/ structure
│   └── commands/              Command-level integration tests
│
├── docs/                      Documentation (you are here)
├── dist/                      Compiled JavaScript output (gitignored)
│
├── registry.yaml              Single source of truth: skill metadata
├── install-manifest.yaml      File classification (generated/create_once/user_data)
├── package.json               npm metadata; bin → dist/index.js
├── tsconfig.json              TS config (strict, ES2022, NodeNext)
├── tsconfig.build.json        Build-only TS config (excludes tests)
├── vitest.config.ts           Test config (75% line coverage threshold)
└── .github/workflows/         CI: build → test → npm publish
```

### Two Files Worth Reading First

- **`registry.yaml`** — declares every skill, its category, dependencies, and template. It's the index Claude Code uses at runtime.
- **`install-manifest.yaml`** — declares which files MVTT owns vs which belong to the user. The `update` command consults this to know what's safe to overwrite.

---

## 5. Common Workflows

### Daily Loop

```bash
npm run test:watch              # Keep this running in one terminal
# Edit src/...
# Tests re-run automatically on save
```

### Before Committing

```bash
npm run build                   # Catches type errors not seen in test mode
npm test                        # Full suite, ~few seconds
npm run test:coverage           # If you added new code paths (must hit 75%)
```

### Manual Smoke Test

```bash
npm run build
node dist/index.js install      # In a scratch directory
node dist/index.js doctor       # Verify integrity
node dist/index.js update --check
node dist/index.js uninstall
```

---

## 6. Adding a New Skill (Most Common Task)

Skills are the unit of new functionality. **You typically don't write any TypeScript to add one** — only Markdown and YAML.

### Step-by-step

**1. Create the skill folder under `sources/skills/`:**

```
sources/skills/mvt-my-new-skill/
├── manifest.yaml         # Assembly blueprint
└── business.md           # The skill's prose / logic
```

**2. Write `manifest.yaml`** — this tells the assembler how to compose the final `SKILL.md`. Look at an existing skill (e.g., `sources/skills/mvt-analyze/manifest.yaml`) for the schema. Typical fields:

```yaml
name: mvt-my-new-skill
description: One-line summary shown in /mvt-help
agent: developer            # analyst | architect | developer | reviewer | tester
sections:                   # Pulled from sources/sections/*
  - role-header
  - activation-protocol
output_template: my-new-skill-output.md   # Optional: from sources/templates/
```

**3. Write `business.md`** — this is the skill's actual instructions. It's prose for Claude, not code for humans. Keep it focused on **one role doing one job**.

**4. Register in `registry.yaml`:** add an entry under the `skills:` list. Match the structure of existing entries — set `path`, `category`, and `depends_on` (if it requires another skill to run first).

**5. (Optional) Add an output template** to `sources/templates/` if the skill produces an artifact. Reference it from `manifest.yaml`.

**6. (Optional) Update `install-manifest.yaml`** if your skill writes files outside the standard generated paths.

**7. Build & verify locally:**

```bash
npm run build
node dist/index.js build --out .test-output
ls .test-output/.claude/skills/mvt-my-new-skill/   # SKILL.md should exist
cat .test-output/.claude/skills/mvt-my-new-skill/SKILL.md
```

**8. Add a test** if the skill introduces new templating logic or validates new YAML. Otherwise the assembler tests already cover it.

**9. Update `README.md`** — add the new skill to the relevant category section.

### Key Pattern

Skills are **declarative**. New behavior lives in `business.md` prose, not TypeScript. Resist the urge to add code unless you genuinely need new build-time logic.

---

## 7. Skill Design Principles

MVTT skills follow a **single-entry-point, interactive-routing** design philosophy. Understanding these principles is essential before creating or modifying any skill.

### Core Principle: Interactive Routing Over CLI Flags

> **Use a single invocation to trigger a skill. When the operation target is ambiguous, resolve it through an interactive menu or user prompt — never through CLI-style flags or positional arguments.**

**Why?** Skills run inside AI coding agents (Claude Code, Qoder, etc.), not in a terminal shell. There is no argv parsing, no flag convention, and no reason to teach users a flag syntax when the AI can simply ask.

### Rules

1. **One skill, one entry point.** `/mvt-skill-name` is the only invocation form. Do not define variants like `--all`, `--aspect`, or `{name}`.

2. **Single-project workspace: auto-select.** When only one project exists, proceed without prompting.

3. **Multi-project workspace: interactive menu.** When multiple projects are registered, present a selection menu listing project names. Include an "all projects" option where batch operation makes sense.

4. **Ambiguous target: ask, don't guess.** If the skill needs to know which project, file, or entity to operate on and the context doesn't disambiguate — ask the user. Never silently pick the first match.

5. **Subcommands are interactive menus, not flags.** Skills like `/mvt-manage-context` expose sub-operations (add, remove, move, rename, list) as an interactive menu when invoked without arguments — not as positional CLI args.

### Good vs. Bad Examples

| Pattern | Bad (CLI-style) | Good (Interactive) |
|---------|----------------|--------------------|
| Multi-project selection | `/mvt-analyze-code --all` | `/mvt-analyze-code` → prompt: "Which project? [project-a, project-b, All]" |
| Scoped review | `/mvt-review --aspect security` | `/mvt-review` → prompt: "Review scope? [full, architecture, security, ...]" |
| Context management | `/mvt-manage-context add shared` | `/mvt-manage-context` → interactive menu: "1. Add 2. Remove 3. Move ..." |
| Named target | `/mvt-analyze-code my-project` | `/mvt-analyze-code` → prompt with project list |

### Exceptions

Some skills accept a narrow set of **well-defined string arguments** that act as sub-mode selectors (e.g., `/mvt-config` accepting a config key). This is acceptable when:
- The set of valid values is small and enumerable
- The skill provides an interactive fallback for unrecognized input
- The argument is an accelerator for power users, not a parallel interface

When in doubt: **make it interactive.**

---

## 8. Adding a New CLI Command

If you need a new top-level command (e.g., `mvtt diagnose`):

**1. Create `src/commands/diagnose.ts`** following the shape of an existing command (e.g., `src/commands/doctor.ts`). Export a single async function:

```ts
export async function runDiagnose(options: DiagnoseOptions): Promise<void> {
  // ...
}
```

**2. Register it in `src/cli.ts`** with Commander:

```ts
program
  .command('diagnose')
  .description('Run extended diagnostics')
  .option('--verbose', 'Print detailed output')
  .action(async (opts) => {
    await runDiagnose(opts);
  });
```

**3. Add a test in `test/commands/diagnose.test.ts`.** Use `vi.spyOn` for `console` and mock `fs` calls; see `test/cli.test.ts` for patterns.

**4. Update `README.md`** if the command is user-facing.

---

## 9. The Build Pipeline Explained

When the CLI runs `install` or `build`, it walks this pipeline:

```
1. validate(install-manifest.yaml)        src/build/validator.ts
2. for each skill in registry.yaml:
   a. load manifest.yaml                  src/build/assembler.ts
   b. expand sections (Mustache-like)     src/build/section-loader.ts
   c. emit SKILL.md (frontmatter + body)  src/build/assembler.ts
3. materialize files into target          src/fs/materialize.ts
   - hash each generated file             src/fs/hash.ts
   - skip create_once if already present
   - never touch user_data dirs
4. write .mvtt-manifest.json              src/fs/install-manifest.ts
   (so update/doctor know what we own)
```

### Section Loader

`section-loader.ts` supports a small Mustache-inspired syntax for templating shared sections:

- `{{var}}` — interpolate
- `{{#var}} ... {{/var}}` — conditional block (truthy)
- `{{^var}} ... {{/var}}` — inverted block (falsy)
- `{{?var}} ... {{/var}}` — optional block (defined)
- `{{.}}` — current iteration value

If you add a new directive, add tests in `test/section-loader.test.ts`.

### Manifest Validation

Every change to `manifest.yaml` schemas (skill manifests or `install-manifest.yaml`) should be matched by a validator update in `src/build/validator.ts` and a test case.

---

## 10. Testing

**Framework:** [Vitest](https://vitest.dev/) v2

**Coverage thresholds** (enforced in `vitest.config.ts`):
- Lines: 75% · Statements: 75% · Branches: 70% · Functions: 75%

### Conventions

- One test file per source file, mirroring path: `src/build/assembler.ts` → `test/assembler.test.ts`
- Use `describe` blocks per public function
- Prefer real filesystem operations into `os.tmpdir()` over mocks for `fs/` tests
- Mock `prompts` for command tests (otherwise tests hang on stdin)

### Useful Commands

```bash
npm test                          # One-shot
npm run test:watch                # Continuous, on save
npm run test:coverage             # Report to ./coverage/
npx vitest run test/cli.test.ts   # Single file
npx vitest run -t "should install" # Filter by name
```

---

## 11. Coding Conventions

### Style

- **TypeScript strict mode** — no `any` unless unavoidable
- **ES Modules only** — `import`/`export`, never `require`
- **Named exports** — no default exports in business logic
- **Async/await** — prefer over raw promise chains
- **Commander for CLI parsing** — don't reinvent argv handling

### Error Handling

- Throw `Error` with descriptive messages; let `src/index.ts` translate to exit codes
- User cancellation (e.g., Ctrl+C in prompts) throws `Error("Cancelled")` → exit 130
- Top-level `try/catch` in `index.ts` is the only place that calls `process.exit`

### Logging

- `console.log()` for info, `console.warn()` for warnings, `console.error()` for errors
- Color via `src/util/color.ts` ANSI helpers — no external logging library
- Keep output terse; this is a CLI, not a daemon

### File I/O

- All YAML reads use the `yaml` package (`parse` / `stringify`)
- Hash generated files with `src/fs/hash.ts` so `doctor` can detect tampering
- Never write to a `user_data` path — verify against `install-manifest.yaml`

### Comments

- Default to no comments. Only comment **why**, never **what**.
- Don't write multi-paragraph docstrings. One short line is enough when needed.

---

## 12. Release & CI/CD

CI is defined in `.github/workflows/publish.yml`.

**Trigger:** pushing a tag matching `v*` (e.g., `v2.0.1`) or manual dispatch.

**Pipeline:**
1. `npm ci`
2. `npm run build`
3. `npm test`
4. Auto-detect dist-tag from version:
   - `*-alpha*` → `alpha`
   - `*-beta*` → `beta`
   - `*-rc*` / `*-next*` → `next`
   - Otherwise → `latest`
5. Verify `package.json` version matches the tag
6. `npm publish --tag <tag> --provenance` (OIDC-signed)

### Cutting a Release

```bash
# Bump version in package.json (e.g., 2.0.0-beta.1)
git commit -am "Release 2.0.0-beta.1"
git tag v2.0.0-beta.1
git push origin main --tags
# CI publishes automatically
```

The `prepublishOnly` script also runs `build` + `test` locally if you ever publish manually — but **prefer tag-driven CI publishing** so releases are reproducible and signed.

---

## 13. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `Cannot find module 'commander'` | Forgot `npm install` | `npm install` |
| Tests pass but build fails | Test config is more lenient than `tsconfig.build.json` | Run `npm run build` before pushing |
| Skill missing after `mvtt install` | Not registered in `registry.yaml` | Add an entry under `skills:` |
| `update` overwrote a user's file | File misclassified as `generated` instead of `create_once` or `user_data` | Fix `install-manifest.yaml` and bump a minor version |
| Coverage threshold failing | New code path not exercised | Add a test in the matching `test/*.test.ts` |
| `mvtt build` produces stale output | TypeScript not recompiled | `npm run build` first |
| ES module import errors | Missing `.js` extension on relative imports | NodeNext requires `import x from './x.js'` even for `.ts` files |

---

## 14. Glossary

- **Skill** — A specialized AI capability (e.g., `mvt-analyze`) packaged as a manifest + Markdown. Lives under `sources/skills/`.
- **Section** — A reusable Markdown fragment composed into multiple skills (e.g., shared role headers). Lives under `sources/sections/`.
- **Template** — An output artifact scaffold (e.g., the analysis report format). Lives under `sources/templates/`.
- **Registry** (`registry.yaml`) — The index of all skills with metadata, used at both build time and runtime.
- **Install Manifest** (`install-manifest.yaml`) — Schema declaring file ownership classes (`generated`, `create_once`, `user_data`).
- **`.mvtt-manifest.json`** — Written into the user's project after install; records hashes of generated files so `doctor` and `update` can detect changes.
- **Materialization** — The process of writing assembled files from `sources/` into the target project.
- **Assembler** — The build component that composes a skill from its manifest + sections into a final `SKILL.md`.
- **Pattern** — A pre-built architecture template (DDD, Clean Architecture, Frontend-React) the user can choose at install time.

---

## Where to Go Next

- Read `README.md` for the user-facing perspective on what MVTT does
- Skim `registry.yaml` to see all 18 skills at a glance
- Open an existing skill (e.g., `sources/skills/mvt-analyze/`) and trace how its `manifest.yaml` becomes a `SKILL.md` via `src/build/assembler.ts`
- Pair a small change (e.g., tweaking a skill's description) with running `node dist/index.js build --out .test-output` to see end-to-end output
- Check open issues on GitHub for "good first issue" labels

Welcome aboard. When in doubt: **read an existing skill, copy its shape, and run `npm test` early and often.**
