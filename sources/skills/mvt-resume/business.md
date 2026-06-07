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
- **Stale task warning**: If plan's `current_tasks` entries reference tasks with status `in_progress` but the plan's `updated_at` is more than 5 days old, append a notice: "Current task has been in_progress for {N} days without updates. Consider running `/mvt-update-plan` to refresh status."
- **Stale deliverables warning**: If any task has `deliverables.freshness == "stale"`, warn: "Task(s) {ids} have stale deliverables. Downstream tasks may reference outdated contracts. Run `/mvt-implement` to refresh."
