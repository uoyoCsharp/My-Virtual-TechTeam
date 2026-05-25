## Execution Flow

### Step 1: Load State
- Read `session.yaml` for skill_history, active_change, recent_changes, recent_actions
- Read `project-context.yaml` for projects list and tech stack
- Read `project-context.md` for semantic context status (exists or not)

### Step 2: Build Activity Timeline
- Parse `skill_history` into chronological timeline
- Group by change-id if multiple skills relate to the same change
- Identify the most recent activity focus

### Step 3: Discover All Plans (Multi-Change Dashboard)

Scan for all plan.yaml files:

1. Read `recent_changes[]` from session.yaml — for each entry with a `plan_path`, read the plan file.
2. Fallback: glob `.ai-agents/workspace/artifacts/*/plan.yaml` for any plans not in the index.

For each plan found, extract:
- `change_id`, `title`, `status`, `current_task`, task progress (`done/total`), `updated_at`

Build the **Changes Overview** table:

| change-id | title | status | progress | current_task | last_updated |
|-----------|-------|--------|----------|--------------|--------------|
| {id} | {t} | {status} | {d}/{n} | {task_id or "(complete)"} | {relative_time} |

Sort by: `in_progress` first (by `updated_at` desc), then `done` (by `updated_at` desc).

If **no plans exist**, skip this section entirely (show only the legacy active_change summary).

### Step 4: Build Status Report
- Projects summary (list all projects with name, type, tech stack)
- Semantic context status (project-context.md exists or not)
- Active change details (if any)
- **Changes Overview** table (from Step 3, if plans exist)
- Skill history timeline (recent 5 entries)
- Recent actions summary

### Step 5: Suggest Next Step
- If an in_progress plan exists with a `current_task` -> suggest the matching `skill_hint` for that task
- If project-context.md missing -> suggest `/mvt-analyze-code`
- Otherwise, based on skill_history and active_change, suggest relevant next skill
- Use registry.yaml to find available skills matching current context
