## Resume Report

### Active Task
- **Change ID**: `{change_id}`
- **Title**: {title}
- **Phase**: {phase}
- **Started**: {started_at}
- **Has Plan**: {yes/no}

> If no active task, replace this section with: "No active task. Suggested entry points: `/mvt-init`, `/mvt-analyze`, `/mvt-status`."

### Plan Progress
> Only render this section if the selected change has a plan.yaml. Otherwise skip entirely.

| # | id | title | status | skill_hint |
|---|----|----|--------|------------|
| 1 | {task_id} | {task_title} | {task_status} | {skill_hint} |
| >> 2 | {current_task_id} | {current_task_title} | **{status}** | {skill_hint} |
| 3 | ... | ... | ... | ... |

**Summary**: Done: {d} | In Progress: {ip} | Pending: {p} | Blocked: {b} | Skipped: {s}

### Current Task Detail
> Only render this section if a plan exists and current_task is not null.

- **Task**: `{current_task_id}` -- {current_task_title}
- **Status**: {current_task_status}
- **Depends on**: {deps_list_with_status (all should show "done")}
- **Acceptance criteria**:
  - {criterion_1}
  - {criterion_2}
- **Notes**: {notes_or_"(none)"}
- **Suggested skill**: `/{skill_hint}`

### Recent Skill History
> When a plan is selected, filter to entries matching that change_id only.

| When | Skill | Summary |
|------|-------|---------|
| {ts_1} | `/{skill_1}` | {summary_1} |
| {ts_2} | `/{skill_2}` | {summary_2} |
| {ts_3} | `/{skill_3}` | {summary_3} |
| {ts_4} | `/{skill_4}` | {summary_4} |
| {ts_5} | `/{skill_5}` | {summary_5} |

### Recent Artifacts
| File | Modified | Est. Tokens |
|------|----------|-------------|
| `{path_1}` | {mtime_1} | {tokens_1} |
| `{path_2}` | {mtime_2} | {tokens_2} |
| `{path_3}` | {mtime_3} | {tokens_3} |
| `{path_4}` | {mtime_4} | {tokens_4} |
| `{path_5}` | {mtime_5} | {tokens_5} |

### Resume Point
{one_paragraph_summary}

### Recommended Next Step
- **Run**: `/{next_skill}`
- **Why**: {justification}

---
**Suggested Next Steps**:
- `/{next_skill}` - {next_skill_desc}
- `/mvt-update-plan` - Mark task progress when work is done
- `/mvt-status` - Inspect full project status before resuming
