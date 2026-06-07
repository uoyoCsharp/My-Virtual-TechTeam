## Execution Flow

### Step 1: Load Inputs
- **Recommended**:
  - `.ai-agents/knowledge/project/_generated/project-context.md` -- semantic context (only checked for existence here, not parsed).
- **Fallback / robustness**:
  - If a YAML file is missing, mark its section as `(unavailable)` in the report and continue. Do not abort the whole skill.
  - If a YAML file fails to parse, surface a one-line error with the file path and skip the affected section. Do not attempt automatic repair.
  - If `session.yaml` exists but is empty (zero keys), treat as `not initialized` -> recommend `/mvt-init`.

### Step 2: Build Activity Timeline
- **What**: produce the most-recent-first list of history entries with derived metadata.
- **How**:
  1. Read `.ai-agents/workspace/session.yaml`, extract `history`.
  2. For each entry, attach: relative time (e.g., "2h ago"), `change_id` (if present), and the originating skill name.
  3. Limit to the last 10 entries for the rendered table; keep full count separately for the summary line.

### Step 3: Discover All Plans (Multi-Change Dashboard)
- **What**: produce the canonical plan list across the workspace.
- **How**:
  1. From the session data loaded above, iterate `changes[]`. For each entry with a `plan_path`, attempt to read the plan file.
  2. Glob `.ai-agents/workspace/artifacts/*/plan.yaml` to find any plans not registered in `changes` (mark them `unindexed`). **Exclude paths under `artifacts/_archived/`** — those are completed changes archived by `/mvt-cleanup`.
  3. For each plan, extract: `change_id`, `title`, `status`, `current_tasks`, task progress (`done/total`), `updated_at`, `skill_hint` (from current task if present).
  4. If a plan file is present but malformed, include a row with `(corrupt)` in the status column and mark the file path; do not abort.
- **Branches**:

  | Condition | Action |
  |-----------|--------|
  | No plans found anywhere | Skip the Changes Overview section entirely; render "No active changes." |
  | One plan found | Render Changes Overview with one row |
  | Multiple plans found | Render Changes Overview sorted: `in_progress` desc by `updated_at` first, then `done` desc by `updated_at`, then `abandoned` last |
  | Any plan over the cap (more than ~12 rows) | Show top 10 rows; print a `+N older changes hidden -- see artifacts/` line |

### Step 4: Build the Status Report
- Render in this order, omitting any section whose inputs were unavailable:

  1. **Header** -- one-line summary: project name (from `project-context.yaml`), framework version, last synced timestamp.
  2. **Projects** -- table: name | type | tech stack (truncated). Cap at 10 rows; collapse the rest into `+N more`.
  3. **Semantic Context** -- one line: `project-context.md present` / `missing -- run /mvt-analyze-code`.
  4. **Active Change** -- if `active_change` exists: id, title, start time. Else: `none`.
  5. **Changes Overview** -- table from Step 3 (skip if no plans). Render with these columns:

     | change-id | title | status | progress | current_tasks | project | updated_at |
     |-----------|-------|--------|----------|---------------|---------|------------|

     For `current_tasks`, display as a compact representation: if single-project, show the task id only; if multi-project, show `web: t2, api: t1` format. The `project` column lists the distinct projects across all tasks in the plan.

     If any task has `deliverables.freshness == "stale"`, append a warning row: "Stale deliverables: {task_ids} -- run `/mvt-implement` to refresh"
  6. **Skill History** -- last 5 rows of the timeline from Step 2.

- Hard cap: total rendered output should not exceed ~120 lines. If it would, truncate Skill History first; never truncate the active change or Changes Overview header rows.

### Step 5: Suggest Next Step
- Resolution order (first match wins):
  1. `active_change` has a plan in `in_progress`, `current_tasks` has entries -> suggest the relevant task's `skill_hint` (or, if missing, recommend `/mvt-update-plan` to set `current_tasks`).
  2. `project-context.md` is missing -> suggest `/mvt-analyze-code`.
  3. No `active_change` or no active plan -> suggest `/mvt-analyze` to start a new feature OR `/mvt-help` to browse the catalog.
- The suggestion must be a single line: skill command + one-clause reason.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| `session.yaml` missing entirely | Render a minimal report (Projects section if available) and recommend `/mvt-init` |
| `session.yaml` corrupt (parse error) | Surface error with file path, render Projects only, recommend `/mvt-init` to reinitialize |
| `changes[]` references a `plan_path` that no longer exists | Include in Changes Overview with `(missing)` marker; do not delete the index entry from this skill |
| Plan file's `current_tasks` references a task id not in `tasks[]` | Render `current_tasks` entry as `(invalid: <id>)`; do not attempt to fix |
| Plan file's `status` is not one of the known values | Render the raw value verbatim; flag in skip-checks of the report |
| Both `changes[]` and the artifact glob find the same plan | Deduplicate by `change_id`; prefer the indexed entry's metadata |
| Multiple `in_progress` plans | All rendered in Changes Overview; Step 5's suggestion picks the most recently updated; mention the count in the suggestion line |
| Workspace contains zero projects | Render header only with a single suggestion: `/mvt-init` |
