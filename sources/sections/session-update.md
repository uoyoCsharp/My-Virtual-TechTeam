{{?read_only}}
## State Update

This skill is read-only and does NOT modify `.ai-agents/workspace/session.yaml`. No state mutation, no `skill_history` append, no `recent_actions` append.
{{/read_only}}
{{^read_only}}
## State Update (Required)

After execution, update `.ai-agents/workspace/session.yaml` with the following fields.

### Mandatory (every skill must set)

- `session.last_command`: Set to the current skill command (e.g., `"/mvt-analyze"`)
- `skill_history`: Append entry:
  ```yaml
  - command: "/{skill-name}"
    completed_at: "{current timestamp ISO 8601}"
    summary: "{one-line summary of what was accomplished}"
    change_id: "{active_change.id if set, otherwise empty string}"
  ```
  Keep max 10 entries. If exceeds, drop the oldest. The `change_id` field enables `/mvt-resume` to filter history per change when multiple changes are in flight.
- `recent_actions`: Append one-line summary with format:
  `[{YYYY-MM-DD HH:MM}] /{command}: {one-line summary}`
  Keep max 5 entries. If exceeds, drop the oldest.
{{#update_active_change}}

### Conditional (set only when applicable)

- `active_change.id`: Set when this skill creates a new change
- `active_change.title`: Set when this skill creates a new change
- `active_change.created_at`: Set when this skill creates a new change
{{/update_active_change}}
{{#update_initialized_at}}

### Conditional (set only when applicable)

- `session.initialized_at`: Set to current timestamp when this skill initializes the project
{{/update_initialized_at}}

### Forbidden

- Do NOT update fields not listed above
- Do NOT overwrite `active_change` unless this skill creates a new change
- Do NOT modify `skill_history` entries other than appending a new one
- Do NOT modify `recent_changes` -- it is owned by `/mvt-plan-dev` and `/mvt-update-plan`
- Do NOT modify `active_change.plan_path` or `active_change.has_plan` -- these are owned by `/mvt-plan-dev`
{{/read_only}}
