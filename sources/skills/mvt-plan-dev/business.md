## Execution Flow

### Step 1: Gather Source Material

Collect everything that should inform the plan:

1. The analysis artifact at `.ai-agents/workspace/artifacts/{active_change.id}/` (if any).
2. The design artifact (if `/mvt-design` was run for this change).
3. Any extra context the user supplies in the current message.

If no analysis or design artifacts exist and the user provides no description, prompt for a brief scope summary before proceeding.

### Step 2: Detect Regeneration

If `active_change.plan_path is non-empty` AND `.ai-agents/workspace/artifacts/{active_change.id}/plan.yaml` already exists:

- Read the existing plan.
- Show a summary (task count, status counts, current_tasks).
- Ask: "A plan already exists. Choose: (1) regenerate from scratch (existing tasks discarded), (2) cancel and use `/mvt-update-plan` to evolve it, (3) abort."
- Only continue with generation on choice (1).

### Step 3: Decompose Into Tasks

Decompose the change with the following constraints. These constraints are AI-friendly decomposition rules.

**Granularity guidance** — read from `preferences.planning.granularity` in `.ai-agents/config.yaml`. Default: `medium`.

| Level | Decomposition style |
|-------|---------------------|
| `coarse` | Prefer fewer, larger tasks — combine related work into broader task boundaries |
| `medium` | Balanced — each task maps to one focused skill invocation |
| `fine` | Prefer more, smaller tasks — split work into narrower, focused units |

This is **qualitative AI guidance**, not a hard task count constraint. A complex change may produce many tasks; a simple one may produce few — both are valid at any granularity level.

| Rule | Detail |
|------|--------|
| Single responsibility | Each task should map to one focused skill invocation (e.g., one `/mvt-implement` for one feature slice). |
| Independently verifiable | Each task must have at least one acceptance criterion that a human or test can check. |
| Explicit dependencies | If task B requires output from task A, list `A` in B's `depends_on`. Avoid hidden ordering. Tasks that can run in parallel should have no dependency between them. |
| No cycles | Dependency graph must be a DAG. Validation will reject cycles. |
| Skill hint | Set `skill_hint` to the skill best suited to execute the task (without `/` prefix): `mvt-implement`, `mvt-test`, `mvt-fix`, `mvt-design`, `mvt-review`, `mvt-refactor`, etc. |
| Project attribution | Each task must have a `project` array listing which projects it belongs to. In a single-project workspace (`projects.length == 1`), use the sole project name from `project-context.yaml > projects[].name`. In a multi-project workspace, auto-infer from the task's file paths matching `projects[].path` and `projects[].source_paths`; if ambiguous, prompt the user. Cross-project tasks list multiple project names. |
| Invalid value handling | If `granularity` contains a value other than `coarse`, `medium`, `fine`, warn the user and fall back to `medium`. |

### Step 4: Assemble plan.yaml

Build the plan object following the schema below. Here is a minimal reference sample showing the exact YAML shape to emit:

```yaml
version: 1
change_id: "20260531-feature-name"
title: "Feature Name"
created_at: "2026-05-31T11:30:00"
updated_at: "2026-05-31T11:30:00"
status: in_progress
current_tasks:
  "<project-name>": "t1-foundation-layer"

tasks:
  - id: "t1-foundation-layer"
    title: "Foundation types and interfaces"
    status: in_progress
    completed_at: null
    depends_on: []
    project:
      - "<project-name>"
    skill_hint: mvt-implement
    artifacts:
      files:
        - "src/core/types.ts"
        - "src/core/interfaces.ts"
    notes: >
      Define the data contract and shared interfaces.
      Referenced by ADR-2 in the design artifact.
    acceptance:
      - "All new types compile without errors"
      - "tsc clean; existing tests pass"

  - id: "t2-core-logic"
    title: "Core business logic implementation"
    status: pending
    completed_at: null
    depends_on: ["t1-foundation-layer"]
    project:
      - "<project-name>"
    skill_hint: mvt-implement
    artifacts: null
    notes: >
      Implement the main processing pipeline using types from t1.
      Must handle partial failures gracefully per design spec.
    acceptance:
      - "Pipeline processes valid input end-to-end"
      - "Partial failures return error object without crashing"
      - "tsc clean; existing tests pass"
```

#### Top-level fields

- `version: 1`
- `change_id`: copy from `active_change.id`
- `title`: copy from `active_change.title`
- `created_at`: current ISO 8601 timestamp
- `updated_at`: same as `created_at` initially
- `status: in_progress`
- `current_tasks`: a map of project name to task id. For single-project workspaces: `{ <sole-project-name>: "<first_task_id>" }`, where the key is copied from `project-context.yaml > projects[0].name`. For multi-project: one key per project, each pointing to that project's first executable task.

#### Task fields

For each task, populate:

- **`id`**: format `t{n}-{kebab-slug}` (e.g., `t1-backend-types`, `t3-dev-panel-ui`). The sequence number reflects natural execution order; keep the slug to 2–5 words.
- **`title`**: one-line descriptive title.
- **`status`**: first executable task → `in_progress`; all others → `pending`.
- **`completed_at`**: `null` for all tasks on initial creation (set by `/mvt-update-plan` when marking `done`).
- **`depends_on`**: array of task ids. Empty array `[]` means no dependencies.
- **`project`**: array of project names this task belongs to. In single-project workspaces, use the sole project name from `project-context.yaml > projects[].name`. Cross-project tasks list multiple names. Auto-infer from file paths matching `projects[].path` and `projects[].source_paths`; if ambiguous, prompt the user.
- **`skill_hint`**: the skill name (without `/`) that will execute this task.
- **`artifacts`**: structured object. On initial plan creation, set to `null` or pre-populate with planned target files if known:
  ```yaml
  artifacts:
    files:
      - "src/path/to/expected-file.ts"
  ```
- **`notes`**: multiline string (use YAML `>` or `|` scalar) containing implementation context — scope description, constraints, references to design decisions or ADRs, key technical considerations. This is the primary guidance that `/mvt-implement` or other skills read when executing the task. Write enough detail that the executing skill can proceed without re-reading the full analysis/design. Keep to 3–8 lines.
- **`acceptance`**: array of strings. Each entry is a single verifiable assertion. Write criteria that are:
  - **Specific**: "getDiagnostic() returns `{ listening, port, sseClientConnected }`" not "method works correctly"
  - **Testable**: can be checked by a human review, a compiler (`tsc clean`), or an automated test
  - **Independent**: each criterion stands alone; avoid "see above"
  - Always include at least one build/type-check criterion (e.g., `"tsc clean; existing tests pass"`) for implementation tasks

### Step 5: Validate

Before writing, validate the assembled YAML:

1. **Unique IDs** — no two tasks share the same `id`
2. **Valid references** — every `depends_on` entry references an existing task `id`
3. **No cycles** — the dependency graph is a DAG (per-project subgraph when multi-project)
4. **current_tasks validity** — each value references a task with status `pending` or `in_progress`
5. **Acceptance required** — every task has at least one acceptance criterion
6. **Per-project in_progress** — at most one `in_progress` task per project (not globally)
7. **completed_at consistency** — must be `null` for all non-done tasks
8. **Project attribution** — every task has a `project` array with at least one valid project name

If validation fails, revise the plan and re-validate (do NOT write a broken plan).

Before writing, write the draft to a temporary path and validate it with `node .ai-agents/scripts/plan-update.cjs --validate <draft-plan-path>`. Only write the final `plan.yaml` when the command exits 0; on failure, surface stderr, revise the draft, and re-run validation.

### Step 6: Write plan.yaml

Write to `.ai-agents/workspace/artifacts/{active_change.id}/plan.yaml`. If the artifacts directory does not exist, create it.

If a previous `plan.yaml` exists and the user chose regeneration in Step 2, overwrite it. Otherwise, this is a fresh write.

### Step 7: Update Session State

Apply the standard State Update rules (see State Update section below).

### Step 8: Output

Render an inline summary (no external template). Structure:

```markdown
## Development Plan: {title}

**Change**: `{change_id}`
**Tasks**: {total_count} | **Status**: {status}

### Task Breakdown

| # | id | title | status | skill | project | depends_on |
|---|----|----|--------|-------|---------|------------|
| 1 | {id} | {title} | {status} | {skill_hint} | {project_list} | {deps_or_"—"} |
| ... |

```
