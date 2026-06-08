# Development Guide

## Project Architecture

MVTT has two halves:
- **CLI** (`src/`): TypeScript, compiled to `dist/`. Commands: install, update, doctor, uninstall, build.
- **Skill Content** (`sources/`): Markdown + YAML, assembled into `SKILL.md` at install time.

## File Classification (Critical Invariant)

All files the CLI writes are classified in `install-manifest.yaml`:

| Category | Behavior | Examples |
|----------|----------|----------|
| `generated` | Overwritten on every `update` | Skill files, framework knowledge |
| `create_once` | Created on first install, never touched again | `config.yaml`, `session.yaml`, `registry.yaml` |
| `user_data` | Never written by CLI | `workspace/artifacts/`, user knowledge |

Breaking this classification can destroy user work. Always verify before adding new files.

## Skill Structure

Each skill lives under `sources/skills/mvt-*/`:
- `manifest.yaml` — Assembly blueprint (name, description, agent, sections, output_template)
- `business.md` — Skill instructions (prose for Claude, not code)

Skills are **declarative**. New behavior lives in `business.md`, not TypeScript. Only add code when genuinely needed for build-time logic.

## Skill Design Principles

MVTT skills follow a **single-entry-point, interactive-routing** design philosophy. Skills run inside AI coding agents (Claude Code, Qoder, etc.), not in a terminal shell — there is no argv parsing, no flag convention.

### Core Rule

Use a single invocation (`/mvt-skill-name`) to trigger a skill. When the operation target is ambiguous, resolve it through an interactive menu or user prompt — never through CLI-style flags or positional arguments.

### Design Rules

1. **One skill, one entry point.** `/mvt-skill-name` is the only invocation form. Do not define variants like `--all`, `--aspect`, or `{name}`.
2. **Single-project workspace: auto-select.** When only one project exists, proceed without prompting.
3. **Multi-project workspace: interactive menu.** When multiple projects are registered, present a selection menu listing project names. Include an "all projects" option where batch operation makes sense.
4. **Ambiguous target: ask, don't guess.** If the skill needs to know which project, file, or entity to operate on and the context doesn't disambiguate — ask the user. Never silently pick the first match.
5. **Subcommands are interactive menus, not flags.** Expose sub-operations as an interactive menu when invoked without arguments — not as positional CLI args.

### Good vs. Bad Patterns

| Pattern | Bad (CLI-style) | Good (Interactive) |
|---------|----------------|--------------------|
| Multi-project selection | `/mvt-analyze-code --all` | `/mvt-analyze-code` → prompt: "Which project? [project-a, project-b, All]" |
| Scoped review | `/mvt-review --aspect security` | `/mvt-review` → prompt: "Review scope? [full, architecture, security, ...]" |
| Context management | `/mvt-manage-context add shared` | `/mvt-manage-context` → interactive menu: "1. Add 2. Remove 3. Move ..." |
| Named target | `/mvt-analyze-code my-project` | `/mvt-analyze-code` → prompt with project list |

### Exceptions

Some skills accept a narrow set of **well-defined string arguments** as sub-mode selectors (e.g., `/mvt-config` accepting a config key). This is acceptable when:
- The set of valid values is small and enumerable
- The skill provides an interactive fallback for unrecognized input
- The argument is an accelerator for power users, not a parallel interface

When in doubt: **make it interactive.**

## Adding a New Skill

1. Create `sources/skills/mvt-{name}/` with `manifest.yaml` + `business.md`
2. Register in `registry.yaml` under `skills:`
3. (Optional) Add output template to `sources/templates/`
4. (Optional) Update `install-manifest.yaml` if writing outside standard paths
5. Build & verify: `npm run build && node dist/index.js build --out .test-output`
6. Add test if new templating logic or YAML validation is introduced

## Build Pipeline

```
validate(install-manifest.yaml) → for each skill: load manifest → expand sections (Mustache-like) → emit SKILL.md → materialize files → write .mvtt-manifest.json
```

### Section Loader Syntax

- `{{var}}` — interpolate
- `{{#var}} ... {{/var}}` — conditional block (truthy)
- `{{^var}} ... {{/var}}` — inverted block (falsy)
- `{{?var}} ... {{/var}}` — optional block (defined)
- `{{.}}` — current iteration value

## Coding Conventions

- **TypeScript strict mode** — no `any` unless unavoidable
- **ES Modules only** — `import`/`export`, never `require`
- **Named exports** — no default exports in business logic
- **Async/await** — prefer over raw promise chains
- **Commander for CLI parsing** — don't reinvent argv handling
- **No comments by default** — only comment "why", never "what"

## Error Handling

- Throw `Error` with descriptive messages; let `src/index.ts` translate to exit codes
- User cancellation throws `Error("Cancelled")` → exit 130
- Top-level `try/catch` in `index.ts` is the only place that calls `process.exit`

## Testing

- **Framework**: Vitest v2
- **Coverage thresholds**: Lines 75%, Statements 75%, Branches 70%, Functions 75%
- One test file per source file, mirroring path: `src/build/assembler.ts` → `test/assembler.test.ts`
- Prefer real filesystem operations into `os.tmpdir()` over mocks for `fs/` tests
- Mock `prompts` for command tests (otherwise tests hang on stdin)

## Key Files

- `registry.yaml` — Index of all skills with metadata (agent, category, depends_on, template)
- `install-manifest.yaml` — File classification (generated/create_once/user_data)
- `package.json` — npm metadata; `bin` → `dist/index.js`
- `tsconfig.json` — TypeScript config (strict, ES2022, NodeNext)

## Release Process

CI triggers on `v*` tags: `npm ci` → `npm run build` → `npm test` → `npm publish --tag <tag> --provenance`

Dist-tags: `*-alpha*` → alpha, `*-beta*` → beta, `*-rc*`/`*-next*` → next, otherwise → latest.

## Common Pitfalls

- Missing `.js` extension on relative imports (NodeNext requires `import x from './x.js'` even for `.ts` files)
- Tests pass but build fails (test config is more lenient than `tsconfig.build.json`)
- `update` overwrote user file (misclassified as `generated` instead of `create_once`/`user_data`)
- `mvtt build` produces stale output (TypeScript not recompiled — run `npm run build` first)
