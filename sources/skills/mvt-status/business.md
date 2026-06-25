## Execution Flow

### Step 1: Load Inputs
- **Recommended**:
  - `.ai-agents/knowledge/project/_generated/project-context.md` -- semantic context. Check **presence only** (e.g. `test -f`); do NOT read its contents. This skill reports whether the file exists, never what is in it.
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
  1. **Glob first — the glob is the source of truth for live plans.** Glob `.ai-agents/workspace/artifacts/*/plan.yaml`. **Exclude paths under `artifacts/_archived/`** — those are completed changes archived by `/mvt-cleanup`. This set is the authoritative list of plan files that actually exist on disk.
  2. From the session data loaded above, iterate `changes[]` only to **enrich metadata** for the globbed plans (title, indexed status). A `changes[]` entry whose `plan_path` is NOT in the glob set is a dangling pointer: render it with the `(missing)` marker (per Edge Cases) — do NOT attempt to read it. Only read a `changes[].plan_path` that the glob confirmed exists.
  3. A globbed plan with no matching `changes[]` entry is `unindexed`.
  4. For each plan, extract: `change_id`, `title`, `status`, `current_tasks`, task progress (`done/total`), `updated_at`, `skill_hint` (from current task if present).
  5. If a plan file is present but malformed, include a row with `(corrupt)` in the status column and mark the file path; do not abort.
- **Branches**:

  | Condition | Action |
  |-----------|--------|
  | No plans found anywhere | Skip the Changes Overview section entirely; render "No active plans." |
  | One plan found | Render Changes Overview with one row |
  | Multiple plans found | Render Changes Overview sorted: `in_progress` desc by `updated_at` first, then `done` desc by `updated_at`, then `abandoned` last |
  | Any plan over the cap (more than ~12 rows) | Show top 10 rows; print a `+N older changes hidden -- see artifacts/` line |

### Step 4: Build the Status Report
- Render in this order, omitting any section whose inputs were unavailable:

  1. **Header** -- one-line summary: project name (from `project-context.yaml`), last synced timestamp.
  2. **Projects** -- table: name | type | tech stack (truncated). Cap at 10 rows; collapse the rest into `+N more`.
  3. **Semantic Context** -- one line: `project-context.md present` / `missing -- run /mvt-analyze-code`.
  4. **Active Change** -- if `active_change` exists: id, title, start time. Else: `none`.
  4a. **Epic Progress** -- if `active_epic.id` is non-empty:
     - Read `epic.yaml` via `active_epic.epic_path`. If the file is missing or unreadable, render `(epic.yaml not found at {path})` and skip this section.
     - Compute progress: count children with `status` in `["done", "abandoned"]` as completed; total = `children.length`.
     - Render:

       ```markdown
       ## Epic: {epic_title} ({epic_id})
       Progress: {done}/{total} done -- Status: {status}

       | Sub-change | Status | depends_on | Internal Progress |
       |------------|--------|------------|-------------------|
       | {title} | {status} | {deps or --} | {plan progress or --} |
       ```

     - For each child in `epic.yaml.children[]`:
       - `depends_on`: comma-separated list of change_ids, or `--` if empty.
       - `Internal Progress`: for a child with `status: active`, attempt to read its plan.yaml from `.ai-agents/workspace/artifacts/{change_id}/plan.yaml`. If found, show `{done_count}/{total_count} tasks`. If not found, show `--`. For non-active children, show `--`.
     - Below the table, render a context line:
       - If `active_change.id` is non-empty (within-epic active change): "Current: **{active_child_title}**. Run `/mvt-resume` to continue."
       - If `active_change.id` is empty (epic-pending state): "Next sub-change: **{current_change_title}**. Run `/mvt-analyze` to start."
  5. **Changes Overview** -- table from Step 3 (skip if no plans). Render with these columns:

     | change-id | title | status | progress | current_tasks | project | updated_at |
     |-----------|-------|--------|----------|---------------|---------|------------|

     For `current_tasks`, display as a compact representation: if single-project, show the task id only; if multi-project, show `web: t2, api: t1` format. The `project` column lists the distinct projects across all tasks in the plan.
  6. **Skill History** -- last 5 rows of the timeline from Step 2.

- Hard cap: total rendered output should not exceed ~120 lines. If it would, truncate Skill History first; never truncate the active change or Changes Overview header rows.

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
| `active_epic.epic_path` points to missing `epic.yaml` | Render `(epic.yaml not found at {path})` in Epic Progress section; skip the section |
| `epic.yaml` parse error | Surface one-line error with file path, skip Epic Progress section; do not attempt repair |
| `epic.yaml.current_change` points to non-existent child | Show `(invalid: {id})` in the child table context line |
