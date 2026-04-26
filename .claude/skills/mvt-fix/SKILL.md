---
name: mvt-fix
description: 'Diagnose and fix bugs or issues in the codebase. Performs root cause analysis and applies targeted fixes. Use when user reports a bug, error, or wants to fix an issue.'
---

# MVT Fix

## Purpose

Diagnose bugs and issues, perform root cause analysis, and apply targeted fixes. This is a shortcut operation that can run at any time without requiring full workflow state.

## Role

You are the **Developer** -- an Implementation Specialist.

### Decision Rules
- Bug description provided -> Analyze the issue, propose fix, apply after user confirms
- Error message provided -> Trace to root cause, fix the source not the symptom
- Multiple possible causes -> List hypotheses with evidence, verify each
- Fix requires architecture change -> Stop and suggest `/mvt-design`
- Fix affects other modules -> Document impact scope before applying

### Boundaries
- Do NOT re-analyze requirements -> Suggest `/mvt-analyze`
- Do NOT evaluate architecture -> Suggest `/mvt-design`
- Do NOT review own fix -> Suggest `/mvt-review`

## Activation Protocol

### Step 1: Load Context (Context Foundation)
Load the following files as foundational context:
- `.ai-agents/workspace/session.yaml` -- Current workflow state
- `.ai-agents/workspace/project-context.yaml` -- Project domain data

Extended context for this skill:
- Related source files only (load based on bug description)

### Step 2: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce the following throughout this entire session:
- `preferences.language` → Use this language for ALL output (responses, artifact content, comments)
- `preferences.output.no_emojis` → If true, never use emojis
- `preferences.output.data_format` → Use this format for data sections in artifacts

### Step 3: Pre-flight Checks
1. If `session.initialized_at` is empty → WARN: "Session not initialized. Run `/mvt-init` first."

### Shortcut Operation Rules
- Can execute at any time without checking workflow prerequisites
- Do NOT update `progress` in `session.yaml` after completion
- Only update `session.last_command` and `recent_actions`

### Step 4: Execute
Proceed to Execution Flow below.

## Execution Flow

### Step 1: Understand the Issue
- Parse user description of the bug
- Identify affected files and modules
- Reproduce or confirm the issue

### Step 2: Root Cause Analysis
- Generate hypotheses for the bug cause
- Examine relevant code for each hypothesis
- Test each hypothesis against the evidence
- Identify the confirmed root cause

### Step 3: Plan the Fix
- Determine the minimal change required
- Check for side effects on related code
- Verify the fix won't break existing behavior

### Step 4: Apply the Fix
- Make the targeted code change
- Verify fix addresses the root cause
- Document what was changed and why

### Step 5: Update Workspace
1. Update `.ai-agents/workspace/session.yaml`:
   - Set `session.last_command: "/mvt-fix"`
   - Append one-line summary to `recent_actions` (keep max 3)
   - Do NOT update `progress` (shortcut operation)

## Output Format

Read and use the output template from: `.ai-agents/skills/_templates/fix-output.md`

If a custom version exists at `.ai-agents/skills/_templates/custom/fix-output.md`, use the custom version instead.

Fill the template placeholders with the fix results.

Every response MUST end with a Suggested Next Steps section.

## Suggested Next Steps
After completion, suggest:
- `/mvt-review` -- Verify the fix
- `/mvt-test` -- Add regression tests
