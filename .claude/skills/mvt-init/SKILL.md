---
name: 'mvt-init'
description: 'Initialize or refresh a project by scanning its structure, detecting tech stack, and inferring project type. This skill should be used when starting a new project, re-initializing after structural changes, or setting up the MVTT workspace.'
---

# MVT Init

## Purpose

Initialize a project by scanning its structure, detecting tech stack, inferring project type, and writing the lean project index. This is the entry point for the MVTT framework.

## Role

You are the **Conductor** -- a Workflow Coordinator.

### Decision Rules
- If user intent is unclear -> Ask a clarifying question before proceeding
- If `session.yaml` shows `initialized_at: ""` -> This is a fresh init
- If `session.yaml` shows existing data -> This is a refresh (preserve existing state)
- If no project files found -> Warn user this may be an empty project
- If multiple languages detected -> Flag as monorepo candidate, identify primary language
- If project type is ambiguous -> Prompt for confirmation between top candidates
- If existing workspace files found on refresh -> Show diff and confirm before overwrite

### Boundaries
- Do NOT analyze requirements (use `/mvt-analyze` instead)
- Do NOT analyze existing code (use `/mvt-analyze-code` instead)
- Do NOT design architecture (use `/mvt-design` instead)
- Do NOT write implementation code (use `/mvt-implement` instead)

## Variants

| Variant | Description |
|---------|-------------|
| `/mvt-init` | Standard initialization or interactive refresh (scan + detect + write index; re-scan on existing project with user confirmation) |

## Activation Protocol

### Step 1: Load Context
Load these files as foundational context:
- `.ai-agents/workspace/project-context.yaml` -- Project index (structural info)
- `.ai-agents/registry.yaml` -- Available skills registry and knowledge declarations

Extended context for this skill:
- Scan project root for config files (package.json, requirements.txt, pom.xml, etc.)
- Scan project root for directory structure (src/, lib/, app/, tests/, etc.)

### Step 2: Resolve Project Scope (PS)

Read `project-context.yaml > projects[]`.

**Single project** (`projects.length == 1`): Set PS = [sole project name]. Skip remaining PS steps.

**Multi-project** (`projects.length > 1`):

**Mode A -- Plan-driven** (active plan exists and skill operates on plan tasks):

1. **Plan signal**: PS = current task's `project` array from plan's `current_tasks`. Drop stale project names (not in `projects[]`), fall through.
2. **Path match**: Match current working paths against `projects[].path` and `source_paths`.
3. **Prompt**: If still unresolved, list candidates and ask user. Never silently load all projects.

**Mode B -- Non-plan** (no active plan or ad-hoc changes):

Defer PS to execution: identify change target, match against `projects[].path` and `source_paths`, load project-specific knowledge on demand (Step 3).

### Step 3: Load Knowledge

Registry uses project-keyed maps; `_all` is a reserved key (all projects). Applies to both top-level `knowledge` and `skills.<name>.knowledge`.

**Entry resolution** (relative to `.ai-agents/{source}`):
- `files: [...]` -- load listed files.
- `files_from_manifest: true` -- read `{source}/manifest.yaml`, load entries with `auto_load: true`.
- Skip non-existent paths.

**At activation** (both modes): load `knowledge._all` + `skills.<current-skill>.knowledge._all`.

**Mode A** (additionally): for each P in PS, load `knowledge[P]` + `skills.<current-skill>.knowledge[P]`.

**Mode B** (during execution): on demand, load `knowledge[P]` + `skills.<current-skill>.knowledge[P]` for identified project(s).

### Step 4: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce the following throughout this entire session:

**Language**:
- `preferences.interaction_language` → Use for everything spoken to the user (chat, prompts, tables); NOT for files written to disk.
- `preferences.document_output_language` → See **Output Language Constraint** section below for the full rules governing files written to disk.

**Other preferences**:
- `preferences.output.no_emojis` → If true, never use emojis
- `preferences.output.data_format` → Use this format for data sections in artifacts
- `preferences.context_routing.relevance_threshold` → Used by `/mvt-manage-context add` for AI routing (default 70 if missing)

## Output Language Constraint (Mandatory)

All persisted document output (files written to disk) MUST be written in the language specified by `preferences.document_output_language` from config.yaml.

**Scope**: artifact files, generated reports, plans, and any markdown written to disk.

**Rules**:
- Section headings defined in templates may remain in their original language, but all generated **content** MUST use the configured language
- If `document_output_language` is not set, fall back to `interaction_language`
- Do NOT infer output language from template headings, user prompt language, or source code comments
- This constraint is NON-NEGOTIABLE and overrides any other language signals

## Output Format Constraint (Mandatory)

All persisted document output (markdown written to disk) MUST follow the formatting rules below. These rules govern *how* content is rendered, independent of the language it is written in.
**Scope**: artifact files, generated reports, plans, design documents, and any markdown written to disk. These rules do NOT apply to conversational output in the chat.

**Rules**:
- **Diagrams**: Express flowcharts, architecture, sequence, and structure diagrams as fenced `mermaid` code blocks. Do NOT draw diagrams with ASCII art (boxes made of `+`, `-`, `|`, arrows like `-->` outside mermaid, etc.).
- **Tables**: Render tabular data as Markdown tables (`| col | col |`). Do NOT simulate tables with space- or tab-aligned text.
- **Code**: Place code, commands, and config snippets in fenced code blocks with a language tag (e.g. ```` ```ts ````, ```` ```bash ````, ```` ```yaml ````). Do NOT leave code in bare or untagged fences.
- **Headings**: Use the Markdown heading hierarchy (`#` -> `##` -> `###`) without skipping levels. Do NOT use bold text as a substitute for a heading.

**Notes**:
- If a diagram genuinely cannot be expressed in mermaid (e.g. a precise spatial/pixel layout), state that explicitly and prefer a Markdown table or prose description over ASCII art.
- This constraint is NON-NEGOTIABLE and overrides formatting habits inferred from templates or source material.

### Step 5: Pre-flight Checks

For each check below, if the condition holds, perform the action implied by its **Level**:

- **WARN** -- emit the message, then ask "Continue anyway? (y/n)". Default to **y** if the user does not respond.
- **BLOCK** -- emit the message and stop. Do not proceed until the prerequisite is satisfied.
- **REQUIRED** -- same as BLOCK; the prerequisite is mandatory.
- **INFO** -- emit the message and proceed; no confirmation needed.

| # | Condition | Level | Message |
|---|-----------|-------|---------|
| 1 | `session and project-context both empty` is empty | INFO | This is a first-time init, proceed normally. |

## Execution Flow

### Step 1: Project Discovery

Scan the project root systematically to identify all projects and their structure.

#### 1.1 Root-level file scan (priority order)

Check for these files in order of detection priority:

| Priority | File | Indicates |
|----------|------|-----------|
| 1 | `package.json` | Node.js / JavaScript / TypeScript |
| 2 | `requirements.txt` / `pyproject.toml` / `setup.py` | Python |
| 3 | `go.mod` | Go |
| 4 | `Cargo.toml` | Rust |
| 5 | `pom.xml` / `build.gradle` | Java / JVM |
| 6 | `*.sln` / `*.csproj` | .NET |
| 7 | `Gemfile` | Ruby |
| 8 | `mix.exs` | Elixir |

If **multiple** package managers are detected at root level → flag as **monorepo candidate** and identify primary vs secondary languages.

If **no** package manager is detected → check for:
- Source directories (`src/`, `lib/`, `app/`) → infer language from file extensions
- Any code files at all → minimal detection
- Empty directory → warn user: "This appears to be an empty project. Initialize with minimal config?"

#### 1.2 Multi-project detection

After root-level scan, check for sub-projects:

| Indicator | Pattern | Example |
|-----------|---------|---------|
| Monorepo tools | `packages/`, `apps/`, `libs/`, `services/` | Turborepo, Nx, Lerna |
| Workspace config | `workspaces` in `package.json` | Yarn/pnpm workspaces |
| Multi-language | Different package managers in sub-directories | `apps/api/requirements.txt` + `apps/web/package.json` |
| Service-oriented | `services/` or `cmd/` with independent configs | Microservices |
| Independent sub-dirs | Multiple directories each with own package file | Multi-project repo |

For each detected sub-project:
1. Identify its root path (relative to repo root)
2. Repeat Step 1.1 scan within that path
3. Assign a unique `name` based on directory name or package name

If no sub-projects detected → single project with `name="default"`, `path="."`

#### 1.3 Directory structure scan

- Source directories: `src/`, `lib/`, `app/`, `cmd/`, `internal/`, `pkg/`
- Test directories: `tests/`, `__tests__/`, `spec/`, `test/`, `*_test/`
- Config directories: `config/`, `configs/`, `.config/`
- Framework-specific: `.eslintrc*`, `tsconfig.json`, `vite.config.*`, `next.config.*`, `Dockerfile`, `docker-compose.*`

### Step 2: Tech Stack Detection

For each detected project, determine:

- **Primary language**: The language with the most files / deepest structure
- **Secondary languages**: Other detected languages (if any)
- **Framework**: Extract from package.json dependencies, requirements.txt, go.mod, etc.
- **Build tool**: webpack, vite, rollup, cargo, maven, gradle, etc.
- **Test framework**: jest, pytest, go test, JUnit, etc.

### Step 3: Project Type Inference

Based on detected files and structure, infer the project type for each project:

| Signal | Inferred Type |
|--------|---------------|
| React / Vue / Angular / Next.js / Nuxt detected | `web-frontend` |
| Express / FastAPI / Spring Boot / Django REST detected | `api-service` |
| Dockerfile + exposed port, no frontend framework | `api-service` |
| CLI entry point (argparse, commander, clap) | `cli-tool` |
| `setup.py` / `pyproject.toml` with no web framework | `library` or `cli-tool` |
| Turborepo / Nx workspace config | `monorepo` |
| `packages/` or `apps/` with multiple package.json | `monorepo` |
| Airflow / Prefect / dbt detected | `data-pipeline` |
| Mobile framework (React Native, Flutter) | `mobile-app` |
| No clear signals | `generic` |

If uncertain between two types → prompt for user confirmation.

### Step 4: User Confirmation

Present the full detection summary:

For each project:
- Name, path, type
- Tech stack (language, framework, build tool, test framework)

**Project naming constraint**: each project name must match `[a-zA-Z0-9][a-zA-Z0-9_-]*` (no leading underscore). Validate all detected names against this constraint; if a name violates it (e.g., auto-detected as `_internal`), prompt the user to provide a valid alternative before proceeding.

Wait for user to confirm or adjust:
- `yes` -- Accept all
- Provide corrections -- User specifies which fields to change
- `add` -- Add a project that was not auto-detected
- `remove` -- Remove a project from the list

### Step 5: Write Artifacts

#### 5.1 Pre-write checks

For each target file, check if it already exists:
- If exists → compare proposed content with existing content
- If differences found → show diff and confirm overwrite with user
- If user declines → preserve existing file, skip that artifact

#### 5.2 Write files

1. Write `.ai-agents/workspace/project-context.yaml` with lean index schema:
   ```yaml
   projects:
     - name: "{project_name}"
       path: "{relative_path}"
       type: "{project_type}"
       source_paths: []
       tech_stack:
         primary_language: "{language}"
         secondary_languages: [{...}]
         framework: "{framework}"
         build_tool: "{build_tool}"
         test_framework: "{test_framework}"
   ```
   `source_paths` is populated by `/mvt-analyze-code` based on analyzed code structure. On initial `/mvt-init`, leave as empty array.
   For multi-project repos, include one entry per detected project.

#### 5.3 Post-write validation

After writing all files, validate:
- `project-context.yaml` is valid YAML with `projects[]` containing at least one entry
- Each project entry has required fields: `name`, `path`, `type`, `tech_stack.primary_language`
- `session.yaml` is structurally intact and contains: `session` (with `initialized_at`, `last_synced_at`), `active_change` (with `plan_path`), `changes` (array), `history`

If any validation fails → report the specific error and offer to retry or skip.

### Step 6: Refresh Mode Handling (Interactive)

When `mvt-init` is executed and existing MVTT artifacts are detected:

1. **Prompt user**: "Existing MVTT configuration found. Refresh to re-scan project structure? (y/n)"
   - If `n` -> stop, no changes made.
   - If `y` -> proceed with refresh.

2. **Re-scan** project structure using Steps 1-3 above.

3. **Compare** new vs existing `projects[]`. If project changes detected (added/removed/renamed sub-projects):
   - Show diff: "+N added / -N removed / ~N renamed"
   - Confirm before writing.

4. **Preserve** the following from existing files:
   - `session.yaml` > `history`
   - `project-context.yaml` > any user-added custom fields (fields not in the standard schema)
   - `config.yaml` > `preferences` section

5. **Update** only auto-detectable fields:
   - `tech_stack` (re-scan and update)
   - `type` (re-infer)
   - `source_paths` (re-scan)

6. **Old format migration**: If existing `project-context.yaml` uses old format (has top-level `project`, `requirements`, `architecture`, `environment` keys):
   - Wrap `project.*` as `projects[0]` with `name="default"`, `path="."`
   - Discard `requirements`, `architecture` sections -- suggest running `/mvt-analyze-code` to regenerate
   - Discard `environment` section
   - Discard any `pattern` related fields

7. **After writing** -> prompt: "Project structure updated. Recommend running `/mvt-analyze-code` to sync semantic context."

8. **Orphan knowledge entries**: After refresh, if any knowledge entries in `registry.yaml` reference a project name not in the updated `projects[]`, prompt: "N orphan knowledge entries found for project(s) not in projects list: {names}. Consider `/mvt-manage-context remove` to clean up."

### Step 7: Determine Project State (drives next-step recommendation)

After Step 5 writes are committed, classify the project state to select the appropriate next_suggestions branch from registry.yaml:

| Condition | Detection logic |
|-----------|-----------------|
| `has_existing_code` | Step 1 detected at least one source file (any language) under recognized source directories (`src/`, `lib/`, `app/`, `cmd/`, `internal/`, `pkg/`) OR a package manager file at root |
| `empty_project` | Step 1 found no source files AND no package manager file (truly empty or docs-only repo) -- the recommended next step is `/mvt-manage-context` to manually capture context |
| `default` | Neither condition matched (rare -- fallback path) |

Pass the resolved condition to the output template so the suggested next steps section renders the matching branch from `registry.yaml > skills.mvt-init.next_suggestions.conditional[]`.

## State Update

After completing the skill's main task, run the session update script **exactly once** with the following arguments:

```bash
node .ai-agents/scripts/session-update.cjs --skill <skill_command_name> --summary "<concise one-line summary>" --set-initialized

```

If the script exits with code 0, the state update was applied successfully; there is no need to read or verify the session file.

### Argument values

| Argument | Value source | Example |
|----------|-------------|---------|
| `--skill` | The exact skill command name without the leading `/` | `mvt-init` |
| `--summary` | A concise one-line description of what this invocation accomplished, in the configured `interaction_language` | `"Identified auth requirements and created change chg-001"` |
| `--set-initialized` | Flag only, no value. Set when this skill initializes the project for the first time. | — |

### Parameter semantics

| Argument | When to use | Effect on `session.yaml` |
|----------|-------------|--------------------------|
| `--set-initialized` | Skill initializes the project for the first time | Sets `session.initialized_at` (idempotent — only writes if empty). |

### Failure handling

If the script fails (non-zero exit), do NOT abort the skill's main task. Continue execution and add a brief note at the end of your response that the session could not be updated.

## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`mvt-init`) and the current project state.

### Conditional Recommendations

Match the current state to one of the conditions below. If none match, use `default`.

- **`has_existing_code`** → `/mvt-analyze-code` -- Reverse-analyze existing codebase to generate project-context.md
- **`empty_project`** → `/mvt-manage-context` -- Manually add project context, requirements, or team conventions
- **`default`** → `/mvt-analyze` -- Start analyzing requirements
- `/mvt-manage-context` -- Manually add team conventions or domain knowledge
- `/mvt-analyze` -- Start from a requirements document
- `/mvt-status` -- Inspect current project status

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
