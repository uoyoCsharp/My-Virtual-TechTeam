{{?read_only}}
## State Update

This skill is read-only and does NOT modify `.ai-agents/workspace/session.yaml`.
{{/read_only}}
{{^read_only}}
## State Update

After completing the skill's main task, run the session update script **exactly once** with the following arguments:

```bash
node .ai-agents/scripts/session-update.cjs --skill <skill_command_name> --summary "<concise one-line summary>"{{#update_active_change}} --new-change "<active_change.title>" --change-id <active_change.id>{{/update_active_change}}{{#set_plan_path}} --set-plan-path ".ai-agents/workspace/artifacts/{active_change.id}/plan.yaml"{{/set_plan_path}}{{#update_change}} --update-change{{/update_change}}{{#close_change}} --close-change{{/close_change}}{{#set_change_status}} --set-change-status <status>{{/set_change_status}}{{#no_change}} --no-change{{/no_change}}{{#set_synced}} --set-synced{{/set_synced}}{{#truncate_history}} --truncate-history <count>{{/truncate_history}}{{#update_initialized_at}} --set-initialized{{/update_initialized_at}}

```

If the script exits with code 0, the state update was applied successfully; there is no need to read or verify the session file.

### Argument values

| Argument | Value source | Example |
|----------|-------------|---------|
| `--skill` | The exact skill command name without the leading `/` | `mvt-analyze`, `mvt-plan-dev` |
| `--summary` | A concise one-line description of what this invocation accomplished, in the configured `interaction_language` | `"Identified auth requirements and created change chg-001"` |
{{#update_active_change}}
| `--new-change` | The title of the new change being created (same value written to `active_change.title`) | `"User authentication system"` |
| `--change-id` | The unique identifier of the new change (same value written to `active_change.id`) | `chg-001` |
{{/update_active_change}}
{{#set_plan_path}}
| `--set-plan-path` | The path to the newly created plan.yaml | `".ai-agents/workspace/artifacts/chg-001/plan.yaml"` |
{{/set_plan_path}}
{{#update_change}}
| `--update-change` | Flag only, no value. Upserts the current `active_change` into `changes[]`. | — |
{{/update_change}}
{{#close_change}}
| `--close-change` | Flag only, no value. Snapshots `active_change` into `changes[]` with `status: done`, then clears `active_change`. | — |
{{/close_change}}
{{#set_change_status}}
| `--set-change-status` | The status to set on the `changes[]` entry matching `active_change.id`. Values: `active`, `done`, `abandoned`. | `done` |
{{/set_change_status}}
{{#no_change}}
| `--no-change` | Flag only, no value. Forces `history[].change_id` to empty string (skips `active_change.id` fallback). | — |
{{/no_change}}
{{#set_synced}}
| `--set-synced` | Flag only, no value. Sets `session.last_synced_at` to current time. | — |
{{/set_synced}}
{{#truncate_history}}
| `--truncate-history` | Number of most recent history entries to keep; older entries are discarded. | `10` |
{{/truncate_history}}
{{#update_initialized_at}}
| `--set-initialized` | Flag only, no value. Set when this skill initializes the project for the first time. | — |
{{/update_initialized_at}}

{{#update_active_change}}
### Parameter semantics

| Argument | When to use | Effect on `session.yaml` |
|----------|-------------|--------------------------|
| `--new-change` + `--change-id` | Skill creates or identifies a new change | Sets `active_change.id`, `.title`, `.created_at`. Auto-snapshots old `active_change` into `changes[]` if non-empty. Requires both arguments together. |
{{#set_plan_path}}
| `--set-plan-path` | Skill creates a new `plan.yaml` for the active change | Sets `active_change.plan_path`. Must be used together with `--update-change`. |
{{/set_plan_path}}
{{#update_change}}
| `--update-change` | Skill creates or modifies a plan (i.e., after `plan.yaml` is written/updated) | Upserts current `active_change` into `changes[]` (with `status: active`), sets `updated_at`, sorts ascending, truncates to configured limit. |
{{/update_change}}
{{#close_change}}
| `--close-change` | All plan tasks are completed | Snapshots `active_change` into `changes[]` with `status: done`, then clears all `active_change` fields. |
{{/close_change}}
{{#set_change_status}}
| `--set-change-status` | Explicitly mark a change as `done` or `abandoned` | Sets `status` on the `changes[]` entry whose `id` matches `active_change.id`. |
{{/set_change_status}}
{{#no_change}}
| `--no-change` | Skill should not be associated with any change | Forces `history[].change_id` to empty string, skipping the `active_change.id` fallback. |
{{/no_change}}
{{#set_synced}}
| `--set-synced` | Skill synchronizes context files | Sets `session.last_synced_at` to the current time. |
{{/set_synced}}
{{#truncate_history}}
| `--truncate-history` | Maintenance: trim old history entries | Keeps the most recent N entries in `history[]`, discards older ones. |
{{/truncate_history}}
{{/update_active_change}}
{{^update_active_change}}
{{#update_change}}
### Parameter semantics

| Argument | When to use | Effect on `session.yaml` |
|----------|-------------|--------------------------|
| `--update-change` | Skill modifies a plan (i.e., after `plan.yaml` is updated) | Upserts current `active_change` into `changes[]` (with `status: active`), sets `updated_at`, sorts ascending, truncates to configured limit. |
{{/update_change}}
{{#close_change}}
### Parameter semantics

| Argument | When to use | Effect on `session.yaml` |
|----------|-------------|--------------------------|
| `--close-change` | All plan tasks are completed | Snapshots `active_change` into `changes[]` with `status: done`, then clears all `active_change` fields. |
{{/close_change}}
{{#set_change_status}}
### Parameter semantics

| Argument | When to use | Effect on `session.yaml` |
|----------|-------------|--------------------------|
| `--set-change-status` | Explicitly mark a change as `done` or `abandoned` | Sets `status` on the `changes[]` entry whose `id` matches `active_change.id`. |
{{/set_change_status}}
{{#no_change}}
### Parameter semantics

| Argument | When to use | Effect on `session.yaml` |
|----------|-------------|--------------------------|
| `--no-change` | Skill should not be associated with any change | Forces `history[].change_id` to empty string, skipping the `active_change.id` fallback. |
{{/no_change}}
{{#set_synced}}
### Parameter semantics

| Argument | When to use | Effect on `session.yaml` |
|----------|-------------|--------------------------|
| `--set-synced` | Skill synchronizes context files | Sets `session.last_synced_at` to the current time. |
{{/set_synced}}
{{#truncate_history}}
### Parameter semantics

| Argument | When to use | Effect on `session.yaml` |
|----------|-------------|--------------------------|
| `--truncate-history` | Maintenance: trim old history entries | Keeps the most recent N entries in `history[]`, discards older ones. |
{{/truncate_history}}
{{/update_active_change}}
{{#update_initialized_at}}
### Parameter semantics

| Argument | When to use | Effect on `session.yaml` |
|----------|-------------|--------------------------|
| `--set-initialized` | Skill initializes the project for the first time | Sets `session.initialized_at` (idempotent — only writes if empty). |
{{/update_initialized_at}}

### Failure handling

If the script fails (non-zero exit), do NOT abort the skill's main task. Continue execution and add a brief note at the end of your response that the session could not be updated.
{{/read_only}}
