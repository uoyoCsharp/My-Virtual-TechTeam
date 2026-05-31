## Execution Flow

### Step 1: Gather Source Material

Collect everything that should inform the plan:

1. Any extra context the user supplies in the current message.

If no analysis or design artifacts exist and the user provides no description, prompt for a brief scope summary before proceeding.

### Step 2: Detect Regeneration

If `active_change.plan_path is non-empty` AND `.ai-agents/workspace/artifacts/{active_change.id}/plan.yaml` already exists:

- Read the existing plan.
- Show a summary (task count, status counts, current_task).
- Ask: "A plan already exists. Choose: (1) regenerate from scratch (existing tasks discarded), (2) cancel and use `/mvt-update-plan` to evolve it, (3) abort."
- Only continue with generation on choice (1).

### Step 3: Decompose Into Tasks

Decompose the change with the following constraints. These constraints are AI-friendly granularity rules — too coarse leaves a task uncompletable in a single skill invocation; too fine turns the plan into noise.

| Rule | Detail |
|------|--------|
| Count | Aim for 3–10 tasks at the top level. If the change clearly needs more, stop and propose phasing into multiple plans (one per phase). |
| Single responsibility | Each task should map to one focused skill invocation (e.g., one `/mvt-implement` for one feature slice). |
| Independently verifiable | Each task must have at least one acceptance criterion that a human or test can check. |
| Explicit dependencies | If task B requires output from task A, list `A` in B's `depends_on`. Avoid hidden ordering. |
| No cycles | Dependency graph must be a DAG. Validation will reject cycles. |
| Skill hint | Set `skill_hint` to the skill that will most likely execute the task (`mvt-implement`, `mvt-test`, `mvt-fix`, `mvt-review`, etc.). |

### Step 4: Assemble plan.yaml

Build the plan object following `docs/plan-yaml-schema.md`:

- `version: 1`
- `change_id`: copy from `active_change.id`
- `title`: copy from `active_change.title`
- `created_at`: current ISO 8601 timestamp
- `updated_at`: same as `created_at` initially
- `status: in_progress`
- `current_task`: the id of the first task that has `depends_on: []` and `status: pending` (or `in_progress` if you mark one as actively in progress)
- `tasks[]`: as decomposed above. Initial task statuses:
  - First task → `in_progress`
  - All other tasks → `pending`

### Step 5: Validate

Before writing, validate the assembled YAML against the schema:

- Unique task ids
- All `depends_on` references resolve
- No dependency cycles
- `current_task` references a task with status `pending` or `in_progress`

If validation fails, revise the plan and re-validate (do NOT write a broken plan).

### Step 6: Write plan.yaml

Write to `.ai-agents/workspace/artifacts/{active_change.id}/plan.yaml`. If the artifacts directory does not exist, create it.

If a previous `plan.yaml` exists and the user chose regeneration in Step 2, overwrite it. Otherwise, this is a fresh write.

### Step 7: Update Session State

Apply the standard State Update rules (see State Update section below).

### Step 8: Output

Render the result via the plan-dev output template, including a tabular summary of all tasks with their initial status and the `current_task` highlight. Surface the schema location so users know how to read or hand-edit it later.
