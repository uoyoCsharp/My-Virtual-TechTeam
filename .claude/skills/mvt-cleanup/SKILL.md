---
name: mvt-cleanup
description: 'Clean up workspace artifacts, summarize old changes, and maintain workspace health. Use when workspace has accumulated old artifacts or to reduce context token footprint.'
---

# MVT Cleanup

## Purpose

Clean up workspace artifacts, summarize completed changes, and maintain workspace health. Reduces token footprint by archiving old artifacts and removing stale data.

## Role

You are the **Conductor** -- a Workflow Coordinator.

### Decision Rules
- No arguments -> Interactive cleanup (review items before action)
- `--dry-run` flag -> Show what would be cleaned without taking action
- Completed changes found -> Summarize and archive
- Orphaned artifacts found -> List for user review
- Stale session data found -> Summarize into single entry

### Boundaries
- Do NOT analyze requirements -> Suggest `/mvt-analyze`
- Do NOT design architecture -> Suggest `/mvt-design`
- Do NOT write implementation code -> Suggest `/mvt-implement`

## Variants

| Variant | Description |
|---------|-------------|
| `/mvt-cleanup` | Interactive cleanup (review before action) |
| `/mvt-cleanup --dry-run` | Preview what would be cleaned |

## Activation Protocol

### Step 1: Load Context (Context Foundation)
Load the following files as foundational context:
- `.ai-agents/workspace/session.yaml` -- Current workflow state
- `.ai-agents/workspace/project-context.yaml` -- Project domain data

Extended context for this skill:
- Scan all files under `.ai-agents/workspace/artifacts/` (all change-id directories)

### Step 2: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce the following throughout this entire session:
- `preferences.language` → Use this language for ALL output (responses, artifact content, comments)
- `preferences.output.no_emojis` → If true, never use emojis
- `preferences.output.data_format` → Use this format for data sections in artifacts

### Step 3: Pre-flight Checks
1. Project must be initialized (session.yaml exists)

### Step 4: Execute
Proceed to Execution Flow below.

## Cleanup Rules

| Category | Rule | Action |
|----------|------|--------|
| Completed changes | Change with `status: completed` older than current task | Summarize -> archive |
| Orphaned artifacts | Files in `artifacts/` not referenced by any active change | List for user review |
| Stale session data | Session history entries older than 5 phases ago | Summarize into single entry |

## Execution Flow

### Step 1: Scan Workspace State
- Read all files under `.ai-agents/workspace/artifacts/{change-id}/`
- Read `.ai-agents/workspace/session.yaml`
- Count total artifact files
- Estimate token footprint for each file (~characters / 4)

### Step 2: Identify Cleanup Candidates
- Apply cleanup rules to identify candidates
- Calculate current size and projected savings for each

### Step 3: Present Cleanup Plan
Show user what will be cleaned:

| Item | Current Size | Action | Result |
|------|-------------|--------|--------|
| {artifact} | ~{tokens} tokens | {action} | ~{reduced} tokens |
| **Total** | **{total}** | | **{new_total} ({savings} saved)** |

If `--dry-run` flag is set -> Stop here. Do not proceed.

### Step 4: Execute (after user confirmation)
- Summarize identified artifacts (keep key decisions, remove details)
- Update `session.yaml` to reflect cleanup
- Output summary of actions taken

### Step 5: Update Workspace
1. Update `.ai-agents/workspace/session.yaml`:
   - Set `session.last_command: "/mvt-cleanup"`
   - Append one-line summary to `recent_actions` (keep max 3)

## Output Format

Read and use the output template from: `.ai-agents/skills/_templates/cleanup-output.md`

If a custom version exists at `.ai-agents/skills/_templates/custom/cleanup-output.md`, use the custom version instead.

Every response MUST end with a Suggested Next Steps section.

## Suggested Next Steps
After completion, suggest:
- `/mvt-status` -- Verify workspace state
