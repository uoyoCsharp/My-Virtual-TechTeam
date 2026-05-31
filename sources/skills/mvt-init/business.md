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
       tech_stack:
         primary_language: "{language}"
         secondary_languages: [{...}]
         framework: "{framework}"
         build_tool: "{build_tool}"
         test_framework: "{test_framework}"
   ```
   For multi-project repos, include one entry per detected project.

#### 5.3 Post-write validation

After writing all files, validate:
- `project-context.yaml` is valid YAML with `projects[]` containing at least one entry
- Each project entry has required fields: `name`, `path`, `type`, `tech_stack.primary_language`
- `session.yaml` is structurally intact and contains: `session` (with `initialized_at`, `last_synced_at`), `active_change` (with `plan_path`), `changes` (array), `history`

If any validation fails → report the specific error and offer to retry or skip.

### Step 6: Refresh Mode Handling (--refresh only)

When `--refresh` is specified:

1. **Preserve** the following from existing files:
   - `session.yaml` > `history`
   - `project-context.yaml` > any user-added custom fields (fields not in the standard schema)
   - `config.yaml` > `preferences` section

2. **Update** only auto-detectable fields:
   - `tech_stack` (re-scan and update)
   - `type` (re-infer)

3. **Diff and confirm**: Show a summary of what will change vs what will be preserved. Ask for confirmation before writing.

4. **Old format migration**: If existing `project-context.yaml` uses old format (has top-level `project`, `requirements`, `architecture`, `environment` keys):
   - Wrap `project.*` as `projects[0]` with `name="default"`, `path="."`
   - Discard `requirements`, `architecture` sections -- suggest running `/mvt-analyze-code` to regenerate
   - Discard `environment` section
   - Discard any `pattern` related fields

### Step 7: Determine Project State (drives next-step recommendation)

After Step 5 writes are committed, classify the project state to select the appropriate next_suggestions branch from registry.yaml:

| Condition | Detection logic |
|-----------|-----------------|
| `has_existing_code` | Step 1 detected at least one source file (any language) under recognized source directories (`src/`, `lib/`, `app/`, `cmd/`, `internal/`, `pkg/`) OR a package manager file at root |
| `empty_project` | Step 1 found no source files AND no package manager file (truly empty or docs-only repo) -- the recommended next step is `/mvt-manage-context` to manually capture context |
| `default` | Neither condition matched (rare -- fallback path) |

Pass the resolved condition to the output template so the suggested next steps section renders the matching branch from `registry.yaml > skills.mvt-init.next_suggestions.conditional[]`.
