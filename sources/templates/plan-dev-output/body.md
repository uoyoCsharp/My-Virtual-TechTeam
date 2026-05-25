## Development Plan: {Change Title}

### Plan Metadata
- **Change ID**: {change_id}
- **Plan File**: `.ai-agents/workspace/artifacts/{change_id}/plan.yaml`
- **Status**: {plan_status}
- **Current Task**: {current_task_id} -- {current_task_title}
- **Created**: {created_at}

### Tasks
| # | id | title | status | depends_on | skill_hint |
|---|----|----|--------|------------|------------|
| 1 | T1 | {title} | {status} | {deps_or_"(none)"} | {skill_hint} |
| 2 | ... | ... | ... | ... | ... |

### Acceptance Criteria (per task)

**T1 -- {title}**
- {criterion}
- {criterion}

**T2 -- {title}**
- {criterion}

(...repeat per task)

### How To Use This Plan
- Run the next task with the suggested skill (see `skill_hint` in the table).
- When a task finishes, reply `done` to the workflow skill's prompt OR run `/mvt-update-plan {task_id} done` to advance.
- If you hit a blocker, run `/mvt-update-plan {task_id} blocked --notes "<reason>"`.
- Schema reference: `docs/plan-yaml-schema.md`.

---
**Suggested Next Steps**:
- `/mvt-{current_task.skill_hint}` to start work on `{current_task_id}`
- `/mvt-resume` from a future session to pick this plan up where you left off
