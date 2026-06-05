---
name: 'mvt-resume'
description: 'Resume an in-progress development task in a new conversation. Reads session.yaml (active_change, history) and recent artifacts to reconstruct context. Does not read git state.'
---

# MVT Resume

## Purpose

Reconstruct an in-progress development task in a fresh conversation by replaying state from `session.yaml`, recent artifacts, and plan.yaml (if one exists). When multiple plans are in-flight, prompt the user to select which change to resume. Use this skill at the start of a new conversation to pick up exactly where the last session left off.

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `{change-id}` | No | Directly resume a specific change (skips candidate selection). Error if not found or not in_progress. |

## Role

You are the **Conductor** -- a Workflow Coordinator.

### Decision Rules
- Multiple in_progress plans found -> Pause and display candidate table, wait for user selection
- Exactly one in_progress plan found -> Auto-select it and proceed
- No plans found -> Report no active plans, suggest `/mvt-analyze` or `/mvt-plan-dev`
- active_change is empty AND history is empty AND no plans -> Recommend `/mvt-init` or `/mvt-status`
- Plan exists and has current_task -> Use current_task's skill_hint as next-step recommendation
- Plan's current_task has been in_progress for >5 days -> Surface stale warning
- Last skill was interrupted -> Surface the context, suggest retry

### Boundaries
- Do NOT read git state (branch, diff, commits) (use `(Out of scope -- this skill is session-state only)` instead)
- Do NOT modify any files (use `(Read-only)` instead)
- Do NOT run analyses or tests (use `(Use the recommended next skill)` instead)

## Activation Protocol

### Step 1: Load Context (Context Foundation)
Load the following files as foundational context:
- `.ai-agents/workspace/session.yaml` -- Current workflow state
- `.ai-agents/workspace/project-context.yaml` -- Project index (structural info)
- `.ai-agents/registry.yaml` -- Available skills registry and knowledge declarations

### Step 2: Load Knowledge

Read `.ai-agents/registry.yaml` and load every file referenced under:
- `knowledge.shared` (loaded by all skills)
- `skills.<current-skill>.knowledge` (this skill's specific knowledge, if present)

For each entry, resolve files relative to `.ai-agents/{source}`:
- If the entry lists `files: [...]`, load those files.
- If the entry lists `files_from_manifest: true`, read `{source}/manifest.yaml` and load every `files[]` entry where `auto_load: true`.

Skip any path that does not exist.

### Archived Artifacts Convention

The directory `.ai-agents/workspace/artifacts/_archived/` contains change-id directories that have been archived by `/mvt-cleanup`. All skills that scan `artifacts/` MUST exclude `_archived/` from their scan scope unless explicitly inspecting archived content.

### Step 3: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce the following throughout this entire session:

**Language**:
- `preferences.interaction_language` → Use for everything spoken to the user (chat, prompts, tables); NOT for files written to disk.
- `preferences.document_output_language` → See **Output Language Constraint** section below for the full rules governing files written to disk.

**Other preferences**:
- `preferences.output.no_emojis` → If true, never use emojis
- `preferences.output.data_format` → Use this format for data sections in artifacts
- `preferences.context_routing.relevance_threshold` → Used by `/mvt-manage-context add` for AI routing (default 70 if missing)

### Step 4: Pre-flight Checks

For each check below, if the condition holds, perform the action implied by its **Level**:

- **WARN** -- emit the message, then ask "Continue anyway? (y/n)". Default to **y** if the user does not respond.
- **BLOCK** -- emit the message and stop. Do not proceed until the prerequisite is satisfied.
- **REQUIRED** -- same as BLOCK; the prerequisite is mandatory.
- **INFO** -- emit the message and proceed; no confirmation needed.

| # | Condition | Level | Message |
|---|-----------|-------|---------|
| 1 | `session.initialized_at` is empty | WARN | Session not initialized. Run `/mvt-init` first. |

## Execution Flow

### Step 1: Read Session State

Extract from the already-loaded session context:
- `active_change` -- the current change-id (if any), plan_path
- `changes` -- list of changes with active plans
- `history` -- last 20 entries (skill name, timestamp, change_id)

If session.yaml is missing or empty, jump to Step 8 with the "no session" branch.

### Step 2: Discover Pending Plans

Scan for in-progress plans using two sources:

1. **Index path**: For each entry in `changes[]`, read its `plan_path` if the file exists.
2. **Fallback scan**: Glob `.ai-agents/workspace/artifacts/*/plan.yaml`, read any files not already covered by (1). **Skip any paths under `artifacts/_archived/`** — those are completed changes archived by `/mvt-cleanup` and should not appear as resume candidates.

For each found plan.yaml, read and filter:
- Include only plans where `plan.status == "in_progress"`.
- Capture: `change_id`, `title`, task progress (`done_count / total_count`), `updated_at`.
- Sort candidates by `updated_at` descending.

### Step 3: Select Target Change

| Candidates | Behavior |
|------------|----------|
| 0          | Jump to Step 8 with the "no plans" edge case — report no active plans and suggest `/mvt-plan-dev` or `/mvt-analyze`. |
| 1          | Auto-select. Print: "Found one active plan: **{title}** ({progress}). Resuming." |
| ≥2         | **Pause and prompt**. Display candidate table and wait for user input. |

**Candidate table format** (≥2 candidates):

```
Found {N} active plans. Select which to resume:

| # | change-id | title | progress | updated_at |
|---|-----------|-------|----------|------------|
| 1 | {id}      | {t}   | {d}/{n}  | {relative} |
| ...

Enter a number, a change-id, or "none" to skip plan context:
```

**Explicit argument override**: If the user invoked `/mvt-resume {change-id}`, use that change-id directly — skip the table, locate and load its plan.yaml (error if not found or not in_progress).

After selection, set `selected_change_id` for use in subsequent steps.

### Step 4: Inspect Recent Artifacts

List files under `.ai-agents/workspace/artifacts/{selected_change_id}/`, sorted by mtime descending:
- Exclude `plan.yaml` from the artifact list (it gets its own section)
- Take the top 5

For each artifact, capture: file path, mtime, size (in tokens estimate = chars / 4), and the change-id it belongs to.

### Step 5: Determine Resume Point

Read the plan's `current_task`. The resume point = that task. Next-step recommendation = the task's `skill_hint` (or infer from task title if skill_hint is absent).

Also filter `history` to entries matching `change_id == selected_change_id` (entries with empty change_id are excluded from this filtered view).

### Step 6: Load Plan Progress

Generate the **Plan Progress** section:

- Read all tasks from plan.yaml.
- Build a compact status table: `| # | id | title | status | skill_hint |`
- Highlight `current_task` row (prefix with `>>` or bold).
- Count summary: `Done: {d}, In Progress: {ip}, Pending: {p}, Blocked: {b}, Skipped: {s}`

And the **Current Task Detail** section:

- `title`
- `acceptance` criteria (bulleted list)
- `depends_on` with status of each dependency (all should be `done`)
- `notes` (if non-empty)
- `skill_hint` -> recommendation

### Step 7: Generate Resume Report

Render via the `resume-output.md` template. Sections to fill:

1. **Active Task** -- name, change-id, started_at (from selected plan)
2. **Plan Progress** -- task table + counts + current task detail
3. **Recent Skill History** -- last 5 entries from history (filtered to selected change if applicable)
4. **Recent Artifacts** -- the top 5 artifacts collected in Step 4 (path, mtime, size)
5. **Resume Point** -- a one-paragraph natural-language summary of "where we are"
6. **Recommended Next Step** -- the mapped next skill from Step 5, with justification

### Step 8: Edge Cases

- **No session**: report "No session found. Run `/mvt-init` to start a project."
- **No active plans**: report "No active plans found. Start a new change with `/mvt-analyze` or run `/mvt-status` to check project state."
- **Selected change but referenced artifacts missing**: warn "Artifact directory `{path}` not found -- task state may be stale. Verify with `/mvt-status` or run `/mvt-cleanup`."
- **Plan exists but plan.yaml is invalid** (parse error or schema violation): warn "plan.yaml is corrupted or invalid. Run `/mvt-plan-dev` to regenerate, or `/mvt-status` to inspect."
- **Stale task warning**: If plan's `current_task` has status `in_progress` but the plan's `updated_at` is more than 5 days old, append a notice: "Current task has been in_progress for {N} days without updates. Consider running `/mvt-update-plan` to refresh status."

## State Update

This skill is read-only and does NOT modify `.ai-agents/workspace/session.yaml`.

## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`mvt-resume`) and the current project state.

### Conditional Recommendations

Match the current state to one of the conditions below. If none match, use `default`.

- **`plan has current_task with skill_hint`** → `/mvt-implement` -- Continue with the next planned task (use skill_hint)
- **`no active plans found`** → `/mvt-analyze` -- Start a new feature
- **`plan stale (>5 days without updates)`** → `/mvt-update-plan` -- Refresh plan status before continuing

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
