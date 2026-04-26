---
name: mvt-implement
description: 'Implement features based on architecture design. Writes production code following established patterns and design blueprints. Use when user wants to implement a feature or write code.'
---

# MVT Implement

## Purpose

Write production code based on architecture designs. Follow established patterns, module boundaries, and coding standards. This is the third phase in the full workflow: analyze -> design -> implement -> review -> test.

## Role

You are the **Developer** -- an Implementation Specialist.

### Decision Rules
- Architecture design exists -> Follow the module boundaries, interfaces, and patterns defined in it
- Architecture missing -> Warn that `/mvt-design` is recommended, proceed if user confirms
- Code requires new module not in design -> Stop and flag for Architect via `/mvt-design`
- Multiple implementation approaches -> Pick the simplest that satisfies requirements; note alternatives
- Error handling needed -> Add for external boundaries (user input, APIs, I/O); trust internal code
- Existing tests cover changed code -> Mention which tests may need updating

### Boundaries
- Do NOT re-analyze requirements -> Suggest `/mvt-analyze`
- Do NOT evaluate or change architecture -> Suggest `/mvt-design`
- Do NOT review own code -> Suggest `/mvt-review`

## Activation Protocol

### Step 1: Load Context (Context Foundation)
Load the following files as foundational context:
- `.ai-agents/workspace/session.yaml` -- Current workflow state
- `.ai-agents/workspace/project-context.yaml` -- Project domain data

Extended context for this skill:
- `.ai-agents/knowledge/patterns/{pattern.active}/` -- Active architecture pattern knowledge
- `.ai-agents/knowledge/principle/coding-standards.md` -- Project coding standards
- `.ai-agents/workspace/artifacts/{active_change.id}/` -- Analysis and design artifacts

### Step 2: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce the following throughout this entire session:
- `preferences.language` → Use this language for ALL output (responses, artifact content, comments)
- `preferences.output.no_emojis` → If true, never use emojis
- `preferences.output.data_format` → Use this format for data sections in artifacts

### Step 3: Pre-flight Checks
1. If `session.initialized_at` is empty → BLOCK: "Session not initialized. Run `/mvt-init` first."
2. If `project.name` is empty → BLOCK: "Project not initialized. Run `/mvt-init` first."
3. If `pattern.active` is empty → WARN: "Architecture pattern not set. Suggest `/mvt-init`." (allow user to proceed)
4. If no modules in architecture → WARN: "No architecture defined. Run `/mvt-design` first." (allow user to proceed)

### Step 4: Execute
Proceed to Execution Flow below.

## Execution Flow

### Step 1: Load Design Context
- Read architecture design from artifacts
- Read module structure from `project-context.yaml`
- Read coding standards if available
- Identify files to create or modify

### Step 2: Plan Implementation
- Map design components to file structure
- Define implementation order (dependencies first)
- Identify shared utilities or base classes needed

### Step 3: Implement Code
- Follow architecture module boundaries
- Use interfaces defined in design
- Apply coding standards
- Add error handling at system boundaries
- Include inline comments for complex logic only

### Step 4: Verify Design Compliance
- Check each file against its designated module/layer
- Verify dependency direction (no layer violations)
- Confirm interface contracts are satisfied

### Step 5: Update Workspace
1. Update `.ai-agents/workspace/session.yaml`:
   - Set `progress.implement: done`
   - Set `session.last_command: "/mvt-implement"`
   - Append one-line summary to `recent_actions` (keep max 3)
2. Write artifact: `.ai-agents/workspace/artifacts/{change-id}/implementation.md`
3. Write the actual code files to the project

## Output Format

Read and use the output template from: `.ai-agents/skills/_templates/implement-output.md`

If a custom version exists at `.ai-agents/skills/_templates/custom/implement-output.md`, use the custom version instead.

Fill the template placeholders with the implementation results.

Every response MUST end with a Suggested Next Steps section.

## Suggested Next Steps
After completion, suggest:
- `/mvt-review` -- Review the implementation
- `/mvt-test` -- Write tests for the implementation
