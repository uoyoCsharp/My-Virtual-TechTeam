## Execution Flow

### Step 1: Resolve Target

Required inputs:

- **task_id** -- which task to update
- **new_status** -- one of: `pending`, `in_progress`, `done`, `blocked`, `skipped`
- **artifacts** (optional, comma-separated paths) -- files produced or touched
- **notes** (optional) -- free-form note string

Resolution rules:

- If `task_id` is omitted AND exactly one task currently has status `in_progress` -> default to that task.
- If `task_id` is omitted AND zero or multiple tasks are in_progress -> ask the user to specify.
- If the user reply is the natural-language form `done` / `blocked: <reason>` (from a workflow skill's soft-prompt) -> map to:
  - `done` -> task = first value in plan.current_tasks, new_status = done
  - `blocked: <reason>` -> task = first value in plan.current_tasks, new_status = blocked, notes = `<reason>`

### Step 2: Load and Validate Existing Plan

1. Read `active_change.plan_path` (the file location is fixed by `/mvt-plan-dev`).
2. Parse YAML; if parse fails or schema is invalid -> stop and report. Do not attempt to repair silently.
3. Verify the target `task_id` exists in `tasks[]`. If not, list valid ids and stop.

### Step 3: Apply the Update, Recompute, Validate, and Write (via script)

The mechanical work — mutating the task, recomputing `current_tasks` via the per-project DAG
rules, validating the result, and writing back atomically — is performed by a
deterministic script. Do NOT hand-edit `plan.yaml` or reason through the
`current_tasks` selection yourself; call the script with the resolved arguments
from Step 1–2:

```bash
node .ai-agents/scripts/plan-update.cjs --plan "<active_change.plan_path>" --task <task_id> --status <new_status> --projects "<comma,separated,project,names>" [--artifacts "<comma,separated,paths>"] [--notes "<note text>"]
```

Include `--artifacts` only if artifacts were provided, and `--notes` only if a note was provided; omit each flag otherwise.

| Argument | Value source |
|----------|-------------|
| `--plan` | `active_change.plan_path` resolved from session.yaml |
| `--task` | the `task_id` resolved in Step 1 |
| `--status` | the `new_status` resolved in Step 1 (`pending`/`in_progress`/`done`/`blocked`/`skipped`) |
| `--projects` | comma-separated project names read from `project-context.yaml > projects[].name` |
| `--artifacts` | optional; comma-separated paths to append (the script de-duplicates) |
| `--notes` | optional; overwrites the task's `notes` |

The script performs, deterministically:

1. **Apply**: sets the task status; appends + de-duplicates `--artifacts` (handles `artifacts: null`); overwrites `--notes`; sets `completed_at` to now when status is `done`, else `null`; refreshes `plan.updated_at`.
2. **Recompute `current_tasks`** (per-project independent advancement): for each project, finds the `in_progress` task or advances the first `pending` task whose `depends_on` are all in `resolvedIds` (done + skipped; blocked does NOT satisfy). Detects `project_switch` when advancement crosses a project boundary. Plan done -> `current_tasks = {}`.
3. **Validate** the mutated plan (unique ids, valid `depends_on` references, DAG/no-cycle per project, one `in_progress` per project, every task has acceptance, `completed_at` consistency, `current_tasks` validity, project naming constraint, task project membership).
4. **Write atomically** (temp + rename) only if validation passes.

**Interpreting the result:**

- **Exit 0**: success. stdout is a single-line JSON object:
  ```json
  {"ok":true,"task":{"id":"t1","title":"...","old_status":"in_progress","new_status":"done"},"current_tasks":{"default":"t2"},"plan_status":"in_progress","progress":{"done":1,"total":4},"warning":null,"project_switch":null}
  ```
  Use these fields directly to render the Output Format block. The file is already written — do NOT read it back to verify. If `warning` is non-null, surface it. If `project_switch` is non-null, note the project boundary crossing.
- **Exit 1**: failure. stderr carries the error (invalid status, task not found, validation failure, parse/write error). The file was **not** modified. Report the error to the user and do not fabricate a success summary.

### Step 4: Output

Emit the Plan Update summary block defined in the Output Format section. Include:

- The task that changed (id, title, old -> new status).
- A compact table of all tasks with their current status.
- The new `current_tasks` map (or "(plan complete)" if `plan.status == done`).
- If `project_switch` was emitted in the script output, note: "Project switch: {from} -> {to}".
- A one-line "Next" hint:
  - If `current_tasks` has entries -> recommend the skill matching the relevant task's `skill_hint`.
  - If plan complete -> recommend `/mvt-cleanup` or starting a new change via `/mvt-analyze`.
  - If all remaining tasks are blocked -> recommend resolving the blocker (point at the `notes` of the blocked task).

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| `plan.yaml` not found at `active_change.plan_path` | Abort with error: "No plan found. Run `/mvt-plan-dev` to create one." |
| Task id provided does not exist in `plan.yaml` | Abort with error listing valid task ids |
| Transition to `done` but `depends_on` tasks are not all `done` | Warn but allow: "Task marked done despite unfinished dependencies — verify correctness" |
| All tasks are `done` but user marks another as `in_progress` | Reject: plan is already complete; suggest creating a new change |
| Circular dependency detected in `depends_on` | Report the cycle and refuse to auto-advance `current_tasks`; suggest manual fix |
| `plan.yaml` write fails (permission denied, invalid YAML state) | Abort; do not update session; report the write error |
