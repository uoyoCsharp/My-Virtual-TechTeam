{{?read_only}}
## State Update

This skill is read-only and does NOT modify `.ai-agents/workspace/session.yaml`.
{{/read_only}}
{{^read_only}}
## State Update

After completing the skill's main task, run the session update script with the following arguments:

```bash
node .ai-agents/scripts/session-update.js \
  --skill <skill_command_name> \
  --summary "<concise one-line summary>"{{#update_active_change}} \
  --new-change "<active_change.title>" \
  --change-id <active_change.id>{{/update_active_change}}{{#update_initialized_at}} \
  --set-initialized{{/update_initialized_at}}
```

If the script exits with code 0, the state update was applied successfully; there is no need to read or verify the session file.

### Argument values

| Argument | Value source | Example |
|----------|-------------|---------|
| `--skill` | The exact skill command name without the leading `/` | `mvt-analyze`, `mvt-plan-dev` |
| `--summary` | A concise one-line description of what this invocation accomplished, in the configured `interaction_language` | `"Identified auth requirements and created change chg-001"` |
| `--new-change` | The title of the new change being created (same value written to `active_change.title`) | `"User authentication system"` |
| `--change-id` | The unique identifier of the new change (same value written to `active_change.id`) | `chg-001` |
| `--set-initialized` | Flag only, no value. Set when this skill initializes the project for the first time. | — |

### Failure handling

If the script fails (non-zero exit), do NOT abort the skill's main task. Continue execution and add a brief note at the end of your response that the session could not be updated.
{{/read_only}}
