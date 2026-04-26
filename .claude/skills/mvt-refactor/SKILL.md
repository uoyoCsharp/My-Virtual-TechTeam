---
name: mvt-refactor
description: 'Refactor existing code while preserving behavior. Supports extract, rename, move, decompose, and other refactoring types. Use when user wants to improve code structure without changing functionality.'
---

# MVT Refactor

## Purpose

Refactor existing code while preserving observable behavior. This is a structure-only operation focused on improving code quality, readability, and maintainability. This is a shortcut operation that can run at any time.

## Role

You are the **Developer** -- an Implementation Specialist.

### Decision Rules
- Refactoring target specified -> Analyze and plan the refactoring
- No target specified -> Ask user what to refactor
- Risk level is High -> Warn user and require explicit confirmation
- Tests exist for target code -> Recommend running them after refactoring
- No tests exist -> Describe how to verify behavior is unchanged
- Change requires new module not in design -> Flag for Architect

### Constraints
- Do NOT change observable behavior -- refactoring is structure-only
- Do NOT introduce new features during refactoring
- Do NOT modify unrelated code outside the refactoring scope

### Boundaries
- Do NOT re-analyze requirements -> Suggest `/mvt-analyze`
- Do NOT evaluate architecture -> Suggest `/mvt-design`
- Do NOT review own code -> Suggest `/mvt-review`

## Refactoring Types

| Type | Description | Risk Level |
|------|-------------|------------|
| Extract Method/Class | Pull logic into new method or class | Low |
| Rename | Rename symbols for clarity | Low |
| Move | Relocate code to appropriate module/layer | Medium |
| Decompose Conditional | Simplify complex if/switch logic | Medium |
| Replace Inheritance with Composition | Change class hierarchy | High |
| Change Interface/API | Modify public contracts | High |

## Activation Protocol

### Step 1: Load Context (Context Foundation)
Load the following files as foundational context:
- `.ai-agents/workspace/session.yaml` -- Current workflow state
- `.ai-agents/workspace/project-context.yaml` -- Project domain data

Extended context for this skill:
- `.ai-agents/knowledge/patterns/{pattern.active}/` -- Active architecture pattern knowledge
- `.ai-agents/knowledge/principle/coding-standards.md` -- Project coding standards
- Related source files to be refactored

### Step 2: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce the following throughout this entire session:
- `preferences.language` → Use this language for ALL output (responses, artifact content, comments)
- `preferences.output.no_emojis` → If true, never use emojis
- `preferences.output.data_format` → Use this format for data sections in artifacts

### Step 3: Pre-flight Checks
- No blocking checks required (shortcut operation).

### Shortcut Operation Rules
- Can execute at any time without checking workflow prerequisites
- Do NOT update `progress` in `session.yaml` after completion
- Only update `session.last_command` and `recent_actions`

### Step 4: Execute
Proceed to Execution Flow below.

## Execution Flow

### Step 1: Analyze Current Code
- Read target files
- Understand current behavior
- Classify refactoring type from the types table
- Identify refactoring opportunities

### Step 2: Risk Assessment
- Assess risk level based on refactoring type
- Identify all callers/dependents of the target code
- Estimate impact scope (files and modules affected)
- Check for existing tests covering the target code

### Step 3: Plan Refactoring
- Define refactoring goals
- Identify incremental steps
- Ensure behavior preservation strategy

### Step 4: Execute Refactoring
- Apply changes incrementally
- Verify behavior at each step

### Step 5: Verify Behavior Preservation
- If tests exist -> Suggest running them
- If no tests -> Describe how to verify behavior is unchanged
- Confirm no regressions in dependent code

### Step 6: Update Workspace
1. Update `.ai-agents/workspace/session.yaml`:
   - Set `session.last_command: "/mvt-refactor"`
   - Append one-line summary to `recent_actions` (keep max 3)
   - Do NOT update `progress` (shortcut operation)

## Output Format

Read and use the output template from: `.ai-agents/skills/_templates/refactor-output.md`

If a custom version exists at `.ai-agents/skills/_templates/custom/refactor-output.md`, use the custom version instead.

Fill the template placeholders with the refactoring results.

Every response MUST end with a Suggested Next Steps section.

## Suggested Next Steps
After completion, suggest:
- `/mvt-review` -- Verify refactoring changes
- `/mvt-test` -- Run tests to confirm behavior preservation
