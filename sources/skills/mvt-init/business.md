## Execution Flow

### Step 1: Project Discovery

Scan the project root systematically to identify the project's nature and structure.

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

If **multiple** package managers are detected → flag as **monorepo candidate** and identify primary vs secondary languages (primary = most files / deepest directory structure).

If **no** package manager is detected → check for:
- Source directories (`src/`, `lib/`, `app/`) → infer language from file extensions
- Any code files at all → minimal detection
- Empty directory → warn user: "This appears to be an empty project. Initialize with minimal config?"

#### 1.2 Directory structure scan

- Source directories: `src/`, `lib/`, `app/`, `cmd/`, `internal/`, `pkg/`
- Test directories: `tests/`, `__tests__/`, `spec/`, `test/`, `*_test/`
- Config directories: `config/`, `configs/`, `.config/`
- Monorepo indicators: `packages/`, `apps/`, `libs/`, `services/`, `workspaces/` (in package.json), `turborepo`/`nx` config

#### 1.3 Framework config scan

- Frontend: `.eslintrc*`, `tsconfig.json`, `vite.config.*`, `next.config.*`, `nuxt.config.*`, `angular.json`, `vue.config.*`
- Backend: `Dockerfile`, `docker-compose.*`, `.env*`, `prisma/`, `drizzle/`
- CI/CD: `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`

### Step 2: Tech Stack Detection

From the discovery results, determine:

- **Primary language**: The language with the most files / deepest structure
- **Secondary languages**: Other detected languages (if any)
- **Frameworks and libraries**: Extract from package.json dependencies, requirements.txt, go.mod, etc.
- **Build tools**: webpack, vite, rollup, cargo, maven, gradle, etc.
- **Test framework**: jest, pytest, go test, JUnit, etc.

### Step 3: Project Type Inference

Based on detected files and structure, infer the project type:

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

If uncertain between two types, prompt for user confirmation.

Write the inferred type to `project-context.yaml` > `project.type`.

### Step 4: Architecture Pattern Suggestion

#### 4.1 Dynamic pattern discovery

Read available patterns from `.ai-agents/knowledge/patterns/` directory:
- List all subdirectories as candidate patterns
- For each pattern, read `manifest.yaml` (if exists) to get `name`, `description`, `suitable_for`

If the patterns directory is not populated, fall back to built-in pattern list:

| Pattern | Description | Suitable for |
|---------|-------------|--------------|
| `ddd` | Domain-Driven Design | Complex business logic, bounded contexts |
| `clean-architecture` | Layer separation with dependency inversion | API services, backend applications |
| `frontend-react` | React/Next.js frontend | web-frontend with React |
| `generic` | Simple projects without specific architecture | Small projects, scripts, libraries |

#### 4.2 Auto-matching based on tech stack + project type

Map detection results to candidate patterns:

| Detection Result | Recommended Pattern |
|-----------------|---------------------|
| Project type = `web-frontend` + React detected | `frontend-react` |
| Project type = `api-service` + complex domain | `ddd` or `clean-architecture` |
| Project type = `api-service` + simple CRUD | `clean-architecture` |
| Project type = `monorepo` | `clean-architecture` (services) |
| Project type = `library` / `cli-tool` / `generic` | `generic` |
| No match | `generic` |

#### 4.3 Present recommendation

Rank pattern matches by confidence (primary match > secondary > fallback). Present the top recommendation with alternatives.

### Step 5: User Confirmation

Present the full detection summary:
- Tech stack (language, framework, build tool, test framework)
- Project type
- Suggested architecture pattern

Wait for user to confirm or select alternative:
- `yes` -- Accept recommendation
- Pattern name -- Select a different pattern
- `analyze` -- Skip pattern, will be determined later via `/mvt-analyze`
- `none` -- No pattern, proceed without

### Step 6: Write Artifacts

#### 6.1 Pre-write checks

For each target file, check if it already exists:
- If exists → compare proposed content with existing content
- If differences found → show diff and confirm overwrite with user
- If user declines → preserve existing file, skip that artifact

#### 6.2 Write files

1. Write `.ai-agents/workspace/project-context.yaml`:
   ```yaml
   project:
     name: {project_name}
     type: {project_type}
     root: {project_root}
   tech_stack:
     primary_language: {language}
     secondary_languages: [{...}]
     framework: {framework}
     build_tool: {build_tool}
     test_framework: {test_framework}
   architecture:
     pattern: {selected_pattern_or_empty}
   environment:
     detected_at: "{current timestamp ISO 8601}"
     last_synced_at: "{current timestamp ISO 8601}"
   ```

2. Write `.ai-agents/config.yaml`:
   - Set `pattern.active` to selected pattern
   - Preserve existing user preferences if file already exists

3. Write `.ai-agents/registry.yaml`:
   - Ensure `knowledge.shared` contains `pattern-active` entry:
     ```yaml
     - id: "pattern-active"
       type: "dynamic"
       source: "knowledge/patterns/{pattern.active}/"
       files_from_manifest: true
     ```
     If already present, do not duplicate. If user selected `none`, do not add this entry.

#### 6.3 Post-write validation

After writing all files, validate:
- Each file is valid YAML (parse and check)
- `project-context.yaml` contains required fields: `project.name`, `project.type`, `tech_stack.primary_language`
- `config.yaml` contains `pattern.active` (if pattern was selected)
- `registry.yaml` is structurally intact (version, knowledge, skills sections present)

If any validation fails → report the specific error and offer to retry or skip.

### Step 7: Refresh Mode Handling (--refresh only)

When `--refresh` is specified:

1. **Preserve** the following from existing files:
   - `session.yaml` > `skill_history` and `recent_actions`
   - `project-context.yaml` > any user-added custom fields (fields not in the standard schema)
   - `config.yaml` > `preferences` section

2. **Update** only auto-detectable fields:
   - `tech_stack` (re-scan and update)
   - `project.type` (re-infer)
   - `architecture.pattern` (only if user confirms change)
   - `environment.detected_at` (update timestamp)

3. **Diff and confirm**: Show a summary of what will change vs what will be preserved. Ask for confirmation before writing.

4. **Backup**: Before writing, copy existing files to `.ai-agents/workspace/.backup/` with timestamp suffix (e.g., `project-context.yaml.2026-05-23T14-30-00`).

### Step 8: Extended Analysis (--deep only)

Perform deeper project analysis. Expected additional time: 30-60 seconds.

#### 8.1 Module mapping
- Identify top-level modules (one level below source root)
- For each module, list: entry file, public exports, dependencies on other modules

#### 8.2 Entity and service identification
- Scan for domain entities (models, schemas, types, interfaces)
- Scan for services (files with business logic, API handlers)
- Classify as: entity, service, utility, config

#### 8.3 Dependency graph
- Analyze import/require statements across modules
- Build a dependency adjacency list
- Identify circular dependencies (if any)

#### 8.4 Architecture diagram
- Generate a Mermaid diagram showing module structure and dependencies
- Format:
  ```mermaid
  graph TD
    ModuleA --> ModuleB
    ModuleA --> ModuleC
    ModuleB --> ModuleC
  ```

Write results to `.ai-agents/workspace/project-context.yaml` under `analysis` key.

### Step 9: Light Mode Handling (--light only)

When `--light` is specified:

- Skip Step 3 (Project Type Inference) -- set `project.type: generic`
- Skip Step 4 (Architecture Pattern) -- set `pattern.active: ""`
- Skip Step 8 (Extended Analysis) even if `--deep` is also specified
- Only detect: primary language, framework (if obvious), build tool
- Write minimal `project-context.yaml` with basic fields only
- No user confirmation step -- proceed with auto-detected values

### Step 10: Environment Information Collection

Detect runtime environment information (optional, non-blocking -- skip if detection fails):

| Check | Command / Method | Field |
|-------|-----------------|-------|
| Node.js version | `node --version` | `environment.node_version` |
| Python version | `python --version` | `environment.python_version` |
| Go version | `go version` | `environment.go_version` |
| Rust version | `rustc --version` | `environment.rust_version` |
| Java version | `java --version` | `environment.java_version` |
| Docker available | `docker --version` | `environment.docker_available` |
| Git info | `git remote -v`, `git branch --show-current` | `environment.git_remote`, `environment.git_branch` |

Only collect versions for languages actually detected in the tech stack. Write to `project-context.yaml` > `environment`.

If any detection command fails, skip silently (do not block init).

### Step 11: Sync Context Reminder

After successful initialization, remind the user about context synchronization:

- "When the project structure changes significantly (new modules, renamed directories, tech stack changes), run `/mvt-sync-context` to update the workspace context."
- The `environment.last_synced_at` field in `project-context.yaml` tracks the last sync timestamp. Other skills can use this to detect staleness.
