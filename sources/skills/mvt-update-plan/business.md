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
  - `done` -> task = plan.current_task, new_status = done
  - `blocked: <reason>` -> task = plan.current_task, new_status = blocked, notes = `<reason>`

### Step 2: Load and Validate Existing Plan

1. Read `active_change.plan_path` (the file location is fixed by `/mvt-plan-dev`).
2. Parse YAML; if parse fails or schema is invalid -> stop and report. Do not attempt to repair silently.
3. Verify the target `task_id` exists in `tasks[]`. If not, list valid ids and stop.

### Step 3: Apply the Update

Mutate the in-memory plan:

1. Find the target task; capture `old_status` for the report.
2. Set `tasks[i].status = new_status`.
3. If `artifacts` provided -> append to `tasks[i].artifacts` (de-duplicate).
4. If `notes` provided -> overwrite `tasks[i].notes`.
5. Update `plan.updated_at` to current ISO 8601 timestamp.

### Step 4: Recompute current_task

Selection logic, in order:

1. If any task has status `in_progress` AND it is **not** the task we just changed to a terminal status (done/blocked/skipped) -> `current_task` = that task's id.
2. Otherwise pick the first task (by array order) where:
   - `status == pending`
   - All ids in `depends_on` reference tasks with status `done`
3. If no such task exists AND every task is `done` -> set `plan.status = done`, `current_task = null`.
4. If no such task exists but some tasks are still `pending` (because their dependencies are not done -- e.g., everything reachable is blocked) -> set `current_task = null`, leave `plan.status = in_progress`. Surface a warning in the output ("All remaining tasks are blocked by dependencies; resolve a blocker before continuing").

If the selected next task is currently `pending` -> promote it to `in_progress` (so the plan accurately reflects the active focus). Skip this promotion if `plan.status` just transitioned to `done`.

### Step 5: Validate and Write

1. Run the plan validator on the mutated structure.
2. If validation fails -> abort the write, report the validation errors, leave the original file untouched.
3. Otherwise, write back to `active_change.plan_path`.

### Step 6: Update Session State

Apply the standard State Update rules (see shared section above) AND the update-plan-specific updates:

- Refresh the matching entry in `recent_changes[]`: `last_updated` -> current ISO 8601 timestamp.
- Do NOT touch `active_change.has_plan` / `active_change.plan_path`.

### Step 7: Output

Emit the Plan Update summary block defined in the Output Format section. Include:

- The task that changed (id, title, old -> new status).
- A compact table of all tasks with their current status.
- The new `current_task` (or "(plan complete)" if `plan.status == done`).
- A one-line "Next" hint:
  - If a new `current_task` is set -> recommend the skill matching its `skill_hint`.
  - If plan complete -> recommend `/mvt-cleanup` or starting a new change via `/mvt-analyze`.
  - If all remaining tasks are blocked -> recommend resolving the blocker (point at the `notes` of the blocked task).
