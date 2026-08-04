## Execution Flow

### Step 1: Classify the Lifecycle Route

Classify before resolving a task or reading a plan. First inspect explicit lifecycle intent:

- If the user explicitly requests abandonment, skip Steps 2-4 and continue to Step 5 regardless of plan status.
- Otherwise, use the first matching state row:

| Active change state | Route |
|---------------------|-------|
| `plan_path` is empty | Intentional plan-less lifecycle; skip Steps 2-4 and continue to Step 5. |
| `plan_path` is non-empty but the file is missing or invalid | Recovery lifecycle; skip Steps 2-4 and continue to Step 5. |
| Plan is valid and `status: done` | Already-done lifecycle; skip Steps 2-4 and continue to Step 5. |
| Plan is valid and `status: in_progress` | Task update; continue to Step 2. |

Do not treat an empty `plan_path` as an error and do not request `/mvt-plan-dev` unless the user selects the recovery route for a missing or invalid non-empty plan path.

### Step 2: Resolve Task Update

Required inputs:

- **task_id** -- which task to update
- **new_status** -- one of: `pending`, `in_progress`, `done`, `blocked`, `skipped`
- **artifacts** (optional, comma-separated paths) -- files produced or touched
- **notes** (optional) -- free-form note string

Resolution rules:

- If `task_id` is omitted AND exactly one task currently has status `in_progress` -> default to that task.
- If `task_id` is omitted AND zero or multiple tasks are in_progress -> ask the user to specify.
- If the user reply is the natural-language form `done` / `blocked: <reason>` (from a workflow skill's soft-prompt) -> map to:
  - `done` -> task = the entry in `plan.current_tasks` matching the current project (or the sole entry if single-project), new_status = done
  - `blocked: <reason>` -> task = the entry in `plan.current_tasks` matching the current project (or the sole entry if single-project), new_status = blocked, notes = `<reason>`

### Step 3: Validate the Task Target

Verify the target `task_id` exists in the valid in-progress plan loaded in Step 1. If not, list valid ids and stop.

### Step 4: Apply the Task Update, Recompute, Validate, and Write

The mechanical work — mutating the task, recomputing `current_tasks` via the per-project DAG
rules, validating the result, and writing back atomically — is performed by a
deterministic script. Do NOT hand-edit `plan.yaml` or reason through the
`current_tasks` selection yourself; call the script with the resolved arguments
from Steps 2-3. See the **Script Usage Rule** section for the command template,
or read `.ai-agents/scripts/plan-update.md` for argument value sources,
parameter semantics, and output interpretation.

```bash
node .ai-agents/scripts/plan-update.cjs --plan "<active_change.plan_path>" --task <task_id> --status <new_status> --projects "<comma,separated,project,names>" [--artifacts "<comma,separated,paths>"] [--notes "<note text>"]
```

Include `--artifacts` only if artifacts were provided, and `--notes` only if a note was provided; omit each flag otherwise.

**Interpreting the result:** See `.ai-agents/scripts/plan-update.md` "Output interpretation" for the exit-0 / exit-1 protocol. On exit 0, use the JSON fields directly to render the Output Format block. On exit 1, report stderr and do not fabricate a success summary.

After an exit-0 result, continue to Step 5. Do not invoke `session-update.cjs` yet.

### Step 5: Lifecycle Routing

Resolve exactly one route, then render the task summary when Step 4 ran and the lifecycle summary below.

#### In-progress plan remains open

When Step 4 reports `plan_status: "in_progress"`, select `--update-change` and continue to State Update without an extra prompt.

When Step 1 detected an explicit abandonment request for an in-progress change, require confirmation with a recommended default that preserves work:

- Non-epic change: offer `Keep open` / `Abandon change`.
- Epic child: offer `Keep open` / `Abandon and advance`.

`Keep open` selects `--update-change`. `Abandon change` selects `--abandon-change`. `Abandon and advance` first calls `epic-update.cjs --abandon-child <active_change.id>`, then selects `--abandon-change`, adding `--abandon-epic` when the epic result is `abandoned`. On epic failure, do not run session-update; on session failure after epic success, report divergence without retry.

#### Missing or invalid non-empty plan path

Offer `Repair plan` / `Force finalize` / `Cancel`.

- `Repair plan`: stop without a session update and route to `/mvt-plan-dev`.
- `Force finalize`: warn that task history cannot be verified, require explicit confirmation, then enter the finalization choices below.
- `Cancel`: stop without mutation.

#### Finalization choices

For a plan that just became done, an already-done plan, an intentional plan-less change, or a confirmed force-finalize recovery:

- Non-epic change: offer `Keep open` / `Finalize now` / `Abandon`.
- Epic child: offer `Complete and advance` / `Complete and defer next` / `Abandon and advance` / `Keep open`.

`Keep open` selects `--update-change`. Non-epic finalization selects `--close-change`; non-epic abandonment selects `--abandon-change`.

For an epic child, call exactly one matching epic command first:

```bash
node .ai-agents/scripts/epic-update.cjs --epic "<active_epic.epic_path>" --complete-child <active_change.id>
node .ai-agents/scripts/epic-update.cjs --epic "<active_epic.epic_path>" --complete-child <active_change.id> --defer-next
node .ai-agents/scripts/epic-update.cjs --epic "<active_epic.epic_path>" --abandon-child <active_change.id>
```

On epic success, select one session lifecycle flag set: close or abandon the change, adding `--close-epic` when `epic_status` is `done` or `--abandon-epic` when it is `abandoned`. If epic-update fails, do not invoke session-update. If session-update fails after epic success, report the exact divergence and stop without retrying either mutation.

Never use `--set-child-status` for completion or deferral.

### Step 6: Output

Emit exactly one summary block defined in the Output Format section.

If Step 4 ran, emit **Plan Update** and include:

- The task that changed (id, title, old -> new status).
- A compact table of all tasks with their current status.
- The new `current_tasks` map (or "(plan complete)" if `plan.status == done`).
- If `project_switch` was emitted in the script output, note: "Project switch: {from} -> {to}".
- A one-line "Next" hint:
  - If `current_tasks` has entries -> recommend the skill matching the relevant task's `skill_hint`.
  - If the change remains open after plan completion -> recommend `/mvt-review` or `/mvt-test`.
  - If the change was finalized or abandoned -> recommend `/mvt-sync-context`, `/mvt-cleanup`, or `/mvt-analyze` as applicable.
  - If all remaining tasks are blocked -> recommend resolving the blocker (point at the `notes` of the blocked task).

If Steps 2-4 were skipped, emit **Lifecycle Update** instead. Never fabricate a task id, task status transition, task table, or `current_tasks` value for plan-less, already-done, recovery, explicit abandonment, or cancellation routes. Include the actual lifecycle action, epic result when applicable, selected session flags and result, and the route-specific next step.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| `plan_path` is empty | Treat as intentional plan-less lifecycle; do not read or mutate a plan. |
| Non-empty `plan_path` is missing or invalid | Offer the explicit recovery choices in Step 5; never silently treat it as plan-less. |
| Task id provided does not exist in `plan.yaml` | Abort with error listing valid task ids |
| Transition to `done` but `depends_on` tasks are not all `done` | Warn but allow: "Task marked done despite unfinished dependencies — verify correctness" |
| Plan is already done | Skip task mutation and enter Step 5 finalization choices. |
| Circular dependency detected in `depends_on` | Report the cycle and refuse to auto-advance `current_tasks`; suggest manual fix |
| `plan.yaml` write fails (permission denied, invalid YAML state) | Abort; do not update session; report the write error |
