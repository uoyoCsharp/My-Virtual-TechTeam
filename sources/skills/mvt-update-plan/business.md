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
  - `done` -> task = the entry in `plan.current_tasks` matching the current project (or the sole entry if single-project), new_status = done
  - `blocked: <reason>` -> task = the entry in `plan.current_tasks` matching the current project (or the sole entry if single-project), new_status = blocked, notes = `<reason>`

### Step 2: Load and Validate Existing Plan

1. Read `active_change.plan_path` (the file location is fixed by `/mvt-plan-dev`).
2. Parse YAML; if parse fails or schema is invalid -> stop and report. Do not attempt to repair silently.
3. Verify the target `task_id` exists in `tasks[]`. If not, list valid ids and stop.

### Step 3: Apply the Update, Recompute, Validate, and Write (via script)

The mechanical work — mutating the task, recomputing `current_tasks` via the per-project DAG
rules, validating the result, and writing back atomically — is performed by a
deterministic script. Do NOT hand-edit `plan.yaml` or reason through the
`current_tasks` selection yourself; call the script with the resolved arguments
from Step 1–2. See the **Script Usage Rule** section for the command template,
or read `.ai-agents/scripts/plan-update.md` for argument value sources,
parameter semantics, and output interpretation.

```bash
node .ai-agents/scripts/plan-update.cjs --plan "<active_change.plan_path>" --task <task_id> --status <new_status> --projects "<comma,separated,project,names>" [--artifacts "<comma,separated,paths>"] [--notes "<note text>"]
```

Include `--artifacts` only if artifacts were provided, and `--notes` only if a note was provided; omit each flag otherwise.

**Interpreting the result:** See `.ai-agents/scripts/plan-update.md` "Output interpretation" for the exit-0 / exit-1 protocol. On exit 0, use the JSON fields directly to render the Output Format block. On exit 1, report stderr and do not fabricate a success summary.

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

### Step 5: Epic Advancement Check

After the Step 3 script reports `plan_status: "done"`:

1. Read `session.active_change.epic_id` from session.yaml.
2. If empty -> skip this step (standard change, no epic context).
3. If non-empty -> prompt user:

   > This change belongs to epic: **{epic_title}** ({epic_id}).
   > All plan tasks are complete.
   >
   > - **(y)** Mark child done and advance to next sub-change
   > - **(n)** Keep change open (continue review/test/sync)
   > - **(defer)** Mark child done but don't advance yet

4. On **y**:
  - Call the Epic Update Script in `--complete-child` mode using the command below:
     ```bash
     node .ai-agents/scripts/epic-update.cjs --epic "<active_epic.epic_path>" --complete-child <active_change.id>
     ```
   - `session-update.cjs --skill mvt-update-plan --summary "..." --close-change`
   - Display: next child info from epic-update stdout. Suggest `/mvt-analyze` to start the next sub-change.

5. On **n**: No action. Display reminder: "Change remains open. Run other skills (e.g., `/mvt-review`, `/mvt-test`, `/mvt-fix`) as needed; run `/mvt-update-plan` again when ready to advance the epic."

6. On **defer**:
  - Call the Epic Update Script in `--set-child-status` mode using the command below:
     ```bash
     node .ai-agents/scripts/epic-update.cjs --epic "<active_epic.epic_path>" --set-child-status <active_change.id> --child-status done
     ```
   - `session-update.cjs --skill mvt-update-plan --summary "..." --close-change`
   - Display: "Child marked done, current_change unchanged."

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| `plan.yaml` not found at `active_change.plan_path` | Abort with error: "No plan found. Run `/mvt-plan-dev` to create one." |
| Task id provided does not exist in `plan.yaml` | Abort with error listing valid task ids |
| Transition to `done` but `depends_on` tasks are not all `done` | Warn but allow: "Task marked done despite unfinished dependencies — verify correctness" |
| All tasks are `done` but user marks another as `in_progress` | Reject: plan is already complete; suggest creating a new change |
| Circular dependency detected in `depends_on` | Report the cycle and refuse to auto-advance `current_tasks`; suggest manual fix |
| `plan.yaml` write fails (permission denied, invalid YAML state) | Abort; do not update session; report the write error |
