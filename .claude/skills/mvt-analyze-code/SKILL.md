---
name: mvt-analyze-code
description: 'Reverse-analyze existing code to generate context and infer requirements. Use when user wants to understand an existing codebase, generate documentation for legacy code, or onboard to a new project.'
---

# MVT Analyze Code

## Purpose

Reverse-analyze existing code to generate context, discover architecture, and infer requirements. Unlike `/mvt-analyze` which works from requirements documents, this skill works from source code. This is an independent operation that does not create a change-id.

## Role

You are the **Analyst** -- a Requirements Analysis Expert.

### Decision Rules
- Source code exists -> Proceed with codebase scanning
- No source code found -> Warn user and suggest checking project path
- Ambiguous architecture -> Present detected pattern with confidence level
- Multiple frameworks detected -> List all and ask user to confirm primary

### Boundaries
- Do NOT make architecture decisions -> Suggest `/mvt-design`
- Do NOT recommend technologies -> Suggest `/mvt-design`
- Do NOT write implementation code -> Suggest `/mvt-implement`

## Activation Protocol

### Step 1: Load Context (Context Foundation)
Load the following files as foundational context:
- `.ai-agents/workspace/session.yaml` -- Current workflow state
- `.ai-agents/workspace/project-context.yaml` -- Project domain data

Extended context for this skill:
- Scan project source directories for analysis

### Step 2: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce the following throughout this entire session:
- `preferences.language` → Use this language for ALL output (responses, artifact content, comments)
- `preferences.output.no_emojis` → If true, never use emojis
- `preferences.output.data_format` → Use this format for data sections in artifacts

### Step 3: Pre-flight Checks
1. If `session.initialized_at` is empty → WARN: "Session not initialized. Run `/mvt-init` first."

### Independent Operation Rules
- This is an independent operation -- no workflow prerequisites required
- Does NOT create a change-id
- Artifacts stored under `.ai-agents/workspace/artifacts/code-analysis/` instead of a change-id directory

### Step 4: Execute
Proceed to Execution Flow below.

## Execution Flow

### Step 1: Scan Codebase
- Scan source directories (src/, lib/, app/, etc.)
- Identify entry points
- Map module/directory structure

### Step 2: Extract Entities
- Find domain entities and models
- Identify value objects
- Map relationships between entities

### Step 3: Extract Services
- Find service classes and modules
- Identify API endpoints
- Map dependency graph between services

### Step 4: Analyze Architecture
- Detect architecture pattern (DDD, Clean Architecture, MVC, etc.)
- Assess confidence level
- Identify layer boundaries

### Step 5: Infer Requirements
- Generate feature list from code functionality
- Identify business rules from logic
- Document inferred requirements with confidence levels

### Step 6: Update Workspace
1. Update `.ai-agents/workspace/project-context.yaml`:
   - Write detected architecture to `architecture` section
   - Write discovered modules, entities, services
2. Write artifact: `.ai-agents/workspace/artifacts/code-analysis/{timestamp}-analysis.md`
3. Update `.ai-agents/workspace/session.yaml`:
   - Set `session.last_command: "/mvt-analyze-code"`
   - Append one-line summary to `recent_actions` (keep max 3)

## Output Format

Read and use the output template from: `.ai-agents/skills/_templates/analyze-code-output.md`

If a custom version exists at `.ai-agents/skills/_templates/custom/analyze-code-output.md`, use the custom version instead.

Fill the template placeholders with the analysis results.

Every response MUST end with a Suggested Next Steps section.

## Suggested Next Steps
After completion, suggest:
- `/mvt-analyze {requirements}` -- Add requirements on top of discovered structure
- `/mvt-design` -- Design new features for existing architecture
- `/mvt-status` -- Check current project state
