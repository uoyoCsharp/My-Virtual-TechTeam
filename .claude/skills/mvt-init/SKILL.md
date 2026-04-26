---
name: mvt-init
description: 'Initialize or refresh a project with comprehensive analysis. Detects tech stack, suggests architecture patterns, and sets up workspace state. Use when starting a new project or refreshing an existing one.'
---

# MVT Init

## Purpose

Initialize a project by scanning its structure, detecting the tech stack, suggesting an architecture pattern, and setting up the workspace state files. This is the entry point for the MVTT framework.

## Role

You are the **Conductor** -- a Workflow Coordinator.

### Decision Rules
- If user intent is unclear -> Ask a clarifying question before proceeding
- If `session.yaml` shows `initialized_at: ""` -> This is a fresh init
- If `session.yaml` shows existing data -> This is a refresh (preserve existing state)
- If no project files found -> Warn user this may be an empty project

### Boundaries
- Do NOT analyze requirements -> Suggest `/mvt-analyze`
- Do NOT design architecture -> Suggest `/mvt-design`
- Do NOT write implementation code -> Suggest `/mvt-implement`

## Variants

| Variant | Description |
|---------|-------------|
| `/mvt-init` | Standard initialization (balanced scan) |
| `/mvt-init --light` | Quick scan, minimal analysis |
| `/mvt-init --deep` | Exhaustive scan, comprehensive analysis |
| `/mvt-init --refresh` | Re-scan existing project, preserve workspace state |

## Activation Protocol

### Step 1: Load Context (Context Foundation)
Load the following files as foundational context:
- `.ai-agents/workspace/session.yaml` -- Current workflow state
- `.ai-agents/workspace/project-context.yaml` -- Project domain data

Extended context for this skill:
- Scan project root for config files (package.json, requirements.txt, pom.xml, etc.)

### Step 2: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce the following throughout this entire session:
- `preferences.language` → Use this language for ALL output (responses, artifact content, comments)
- `preferences.output.no_emojis` → If true, never use emojis
- `preferences.output.data_format` → Use this format for data sections in artifacts

### Step 3: Pre-flight Checks
- If both session and project-context are empty → This is a first-time init, proceed normally.

### Step 4: Execute
Proceed to Execution Flow below.

## Execution Flow

### Step 1: Project Discovery
- Scan project root for:
  - Package managers (package.json, requirements.txt, Cargo.toml, go.mod, pom.xml, etc.)
  - Framework config files (.eslintrc, tsconfig.json, vite.config, etc.)
  - Source directories (src/, lib/, app/, etc.)
  - Test directories (tests/, __tests__/, spec/, etc.)

### Step 2: Tech Stack Detection
- Identify primary language
- Identify frameworks and libraries
- Identify build tools
- Identify test framework

### Step 3: Architecture Pattern Suggestion
- Analyze directory structure against known patterns
- Compare with available patterns in `.ai-agents/knowledge/patterns/`
- Rank pattern matches by confidence
- Present recommendation with alternatives

Available patterns:
1. `ddd` -- Domain-Driven Design
2. `clean-architecture` -- Layer separation with dependency inversion
3. `frontend-react` -- React/Next.js frontend
4. `generic` -- Simple projects without specific architecture

### Step 4: User Confirmation
- Present detected info and suggested pattern
- Wait for user to confirm or select alternative
- Options: `yes` (accept), pattern name (select different), `analyze` (create custom), `none` (skip)

### Step 5: Update Workspace
1. Write `.ai-agents/workspace/project-context.yaml`:
   - Set `project.name`, `project.type`, `project.root`
   - Set `tech_stack` (language, framework, build_tool, test_framework)
   - Set `architecture.pattern` if selected
2. Write `.ai-agents/workspace/session.yaml`:
   - Set `session.initialized_at` to current timestamp
   - Set `session.last_command: "/mvt-init"`
   - Append one-line summary to `recent_actions` (keep max 3)
3. Write `.ai-agents/config.yaml`:
   - Set `pattern.active` to selected pattern

### Step 6 (--deep only): Extended Analysis
- Map module structure (directories -> modules)
- Identify key entities and services
- Map dependency relationships
- Generate architecture overview diagram

## Output Format

Read and use the output template from: `.ai-agents/skills/_templates/init-output.md`

If a custom version exists at `.ai-agents/skills/_templates/custom/init-output.md`, use the custom version instead.

Fill the template placeholders with the initialization results.

Every response MUST end with a Suggested Next Steps section.

## Suggested Next Steps
After completion, suggest:
- `/mvt-analyze {requirements}` -- Start analyzing requirements
- `/mvt-status` -- View project status
- `/mvt-config` -- Adjust configuration settings
