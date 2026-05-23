## State Update (Required)

After execution, update `.ai-agents/workspace/session.yaml` with the following fields.

### Mandatory (every skill must set)

- `session.last_command`: Set to the current skill command (e.g., `"/mvt-analyze"`)
- `skill_history`: Append entry:
  ```yaml
  - command: "/{skill-name}"
    completed_at: "{current timestamp ISO 8601}"
    summary: "{one-line summary of what was accomplished}"
  ```
  Keep max 10 entries. If exceeds, drop the oldest.
- `recent_actions`: Append one-line summary with format:
  `[{YYYY-MM-DD HH:MM}] /{command}: {one-line summary}`
  Keep max 5 entries. If exceeds, drop the oldest.

### Conditional (set only when applicable)

{{#update_active_change}}
- `active_change.id`: Set when this skill creates a new change
- `active_change.title`: Set when this skill creates a new change
- `active_change.created_at`: Set when this skill creates a new change
{{/update_active_change}}

{{#update_initialized_at}}
- `session.initialized_at`: Set to current timestamp when this skill initializes the project
{{/update_initialized_at}}

### Forbidden

- Do NOT update fields not listed above
- Do NOT overwrite `active_change` unless this skill creates a new change
- Do NOT modify `skill_history` entries other than appending a new one
