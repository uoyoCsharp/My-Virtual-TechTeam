## Execution Flow

### Step 1: Read Session State

Read `.ai-agents/workspace/session.yaml`. If the file is missing or empty, jump to Step 8 with the "no session" branch.

Extract:
- `active_change` -- the current change-id (if any), plan_path, epic_id
- `active_epic` -- the current epic (if any): id, title, epic_path
- `changes` -- list of changes with active plans
- `history` -- last 20 entries (skill name, timestamp, change_id)

### Step 1a: Check Epic State

After extracting session data in Step 1, check for epic state:

| Condition | Action |
|-----------|--------|
| `active_change.id` non-empty AND `active_change.epic_id` non-empty | Set `within_epic = true`. Continue to Step 2 (normal plan-based resume). In Step 7, include an Epic Context section. |
| `active_change.id` empty AND `active_epic.id` non-empty (epic-pending) | Read `epic.yaml` via `active_epic.epic_path`. If unreadable, warn and jump to Step 8 with the "epic-pending but epic.yaml missing" edge case. Otherwise, identify the child referenced by `epic.yaml.current_change` as the resume target. Skip Steps 2-6 and go directly to Step 7 with a simplified report containing: (1) **Epic State** -- epic title, id, status, progress (done/total); (2) **Current Sub-change** -- title, scope, depends_on status of each dependency; (3) **Resume Point** -- "Resuming epic: {title}. Next sub-change: {current_change_title}. Run `/mvt-analyze` to start."; (4) **Recommended Next Step** -- `/mvt-analyze` -- Start the next sub-change in the epic. |
| Neither | Continue to Step 2 (normal flow). |

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
| 1 | {id}      | {t}   | {d}/{n}  | {updated_at ISO timestamp} |
| ...

Enter a number, a change-id, or "none" to skip plan context:
```

**Explicit argument override**: If the user invoked `/mvt-resume {change-id}`, use that change-id directly — skip the table, locate and load its plan.yaml (error if not found or not in_progress).

After selection, set `selected_change_id` for use in subsequent steps.

### Step 4: Inspect Recent Artifacts

List files under `.ai-agents/workspace/artifacts/{selected_change_id}/`, sorted by mtime descending:
- Exclude `plan.yaml` from the artifact list (it gets its own section)
- Take the top 5

For each artifact, capture: file path, mtime, size in characters and estimated tokens using a deterministic character count divided by 4, rounded up, and the change-id it belongs to.

### Step 5: Determine Resume Point

Read the plan's `current_tasks` map. The resume point = the task(s) referenced by `current_tasks`. Next-step recommendation = the relevant task's `skill_hint` (or infer from task title if skill_hint is absent).

For multi-project workspaces, if `current_tasks` has entries for multiple projects, display each project's current task separately.

Also filter `history` to entries matching `change_id == selected_change_id` (entries with empty change_id are excluded from this filtered view).

If the plan-update script output from a previous session included a `project_switch` notification, surface it: "Last session crossed from {from} to {to} project."

### Step 6: Load Plan Progress

Generate the **Plan Progress** section:

- Read all tasks from plan.yaml.
- Build a compact status table: `| # | id | title | status | project | skill_hint |`
- Highlight `current_tasks` rows (prefix with `>>` or bold).
- Count summary: `Done: {d}, In Progress: {ip}, Pending: {p}, Blocked: {b}, Skipped: {s}`
- If any task has `deliverables.freshness == "stale"`, append a warning: "Stale deliverables: {task_ids} -- downstream tasks may be out of date. Run `/mvt-implement` to refresh."

And the **Current Task Detail** section:

- `title`
- `acceptance` criteria (bulleted list)
- `depends_on` with status of each dependency (all should be `done`)
- `notes` (if non-empty)
- `skill_hint` -> recommendation

### Step 7: Generate Resume Report

Render inline using the seven sections below. No external template is required.

1. **Active Task** -- name, change-id, started_at (from selected plan)
2. **Epic Context** (if `within_epic` is true) -- epic title, id, progress (done/total children), current position within the epic. Resolve the parent epic path: compare `active_change.epic_id` to `active_epic.id`. If they match, use `active_epic.epic_path`. If they do not match, search `session.epics[]` for an entry with `id == active_change.epic_id` and use its `epic_path`. If neither path exists, render the plan resume and add a bounded warning: "Epic context could not be loaded (epic_id: {active_change.epic_id})." Read `epic.yaml` via the resolved path and render: "This change is part of epic: **{epic_title}** ({done}/{total} sub-changes done). Current: {active_child_title}."
3. **Plan Progress** -- task table + counts + current task detail
4. **Recent Skill History** -- last 5 entries from history (filtered to selected change if applicable)
5. **Recent Artifacts** -- the top 5 artifacts collected in Step 4 (path, mtime, size)
6. **Resume Point** -- a one-paragraph natural-language summary of "where we are"
7. **Recommended Next Step** -- the mapped next skill from Step 5, with justification

### Step 8: Edge Cases

- **No session**: report "No session found. Run `/mvt-init` to start a project."
- **No active plans**: report "No active plans found. Start a new change with `/mvt-analyze` or run `/mvt-status` to check project state."
- **Selected change but referenced artifacts missing**: warn "Artifact directory `{path}` not found -- task state may be stale. Verify with `/mvt-status` or run `/mvt-cleanup`."
- **Plan exists but plan.yaml is invalid** (parse error or schema violation): warn "plan.yaml is corrupted or invalid. Run `/mvt-plan-dev` to regenerate, or `/mvt-status` to inspect."
- **Stale task warning**: If plan's `current_tasks` entries reference tasks with status `in_progress` but the plan's `updated_at` is more than 5 days old, append a notice: "Current task has been in_progress for {N} days without updates. Consider running `/mvt-update-plan` to refresh status."
- **Stale deliverables warning**: If any task has `deliverables.freshness == "stale"`, warn: "Task(s) {ids} have stale deliverables. Downstream tasks may reference outdated contracts. Run `/mvt-implement` to refresh."
- **Epic-pending but epic.yaml missing**: warn "Epic state references `epic_path` but file not found at `{path}`. Run `/mvt-status` to inspect or `/mvt-cleanup` to archive stale entries."
- **Epic-pending but current_change empty or invalid**: warn "Epic `current_change` is empty or points to a non-existent child. Run `/mvt-status` to inspect the epic state."
