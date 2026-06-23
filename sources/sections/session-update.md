{{?read_only}}
## State Update

This skill is read-only and does NOT modify `.ai-agents/workspace/session.yaml`.
{{/read_only}}
{{^read_only}}
## State Update

After the skill's main task, run the session update script **exactly once**:

```bash
node .ai-agents/scripts/session-update.cjs --skill {{current_skill}} --summary "<concise one-line summary>"{{#update_active_change}} --new-change "<active_change.title>" --change-id <active_change.id>{{#link_subchange_to_epic}} --epic-id <active_epic.id>{{/link_subchange_to_epic}}{{/update_active_change}}{{#set_plan_path}} --set-plan-path ".ai-agents/workspace/artifacts/{active_change.id}/plan.yaml"{{/set_plan_path}}{{#update_change}} --update-change{{/update_change}}{{#close_change}} --close-change{{/close_change}}{{#set_change_status}} --set-change-status <status>{{/set_change_status}}{{#new_epic}} --new-epic "<epic_title>" --epic-id <epic_id>{{/new_epic}}{{#set_epic_path}} --set-epic-path <epic_path>{{/set_epic_path}}{{#set_epic_status}} --set-epic-status <status>{{/set_epic_status}}{{#close_epic}} --close-epic{{/close_epic}}{{#no_change}} --no-change{{/no_change}}{{#set_synced}} --set-synced{{/set_synced}}{{#truncate_history}} --truncate-history <count>{{/truncate_history}}{{#update_initialized_at}} --set-initialized{{/update_initialized_at}}{{#remove_change}} --remove-change <ids>{{/remove_change}}{{#remove_epic}} --remove-epic <ids>{{/remove_epic}}

```

Write `--summary` as one concise line in the configured `interaction_language`.

### Critical flag semantics

- Use only the flags rendered in the command above; do not invent extra session-update flags.
{{#update_active_change}}
- `--new-change` and `--change-id` are required together; they set `active_change.{id,title,created_at}` and snapshot any prior active change into `changes[]`.
{{/update_active_change}}
{{#set_plan_path}}{{#update_change}}
- `--set-plan-path` must be used with `--update-change`; together they persist the active change's `plan_path` into `changes[]`.
{{/update_change}}{{/set_plan_path}}
{{#update_change}}{{^set_plan_path}}
- `--update-change` upserts the current `active_change` into `changes[]`, refreshes `updated_at`, and preserves the configured change-history limit.
{{/set_plan_path}}{{/update_change}}
{{#close_change}}
- `--close-change` snapshots `active_change` into `changes[]` with `status: done`, then clears all active-change fields.
{{/close_change}}
{{#set_change_status}}
- `--set-change-status` sets the matching `changes[]` entry to `active`, `done`, or `abandoned`.
{{/set_change_status}}
{{#no_change}}
- `--no-change` forces `history[].change_id` to empty instead of falling back to `active_change.id`.
{{/no_change}}
{{#set_synced}}
- `--set-synced` refreshes `session.last_synced_at`.
{{/set_synced}}
{{#truncate_history}}
- `--truncate-history` keeps the most recent N `history[]` entries; use the configured history limit.
{{/truncate_history}}
{{#update_initialized_at}}
- `--set-initialized` sets `session.initialized_at` only when it is empty.
{{/update_initialized_at}}
{{#new_epic}}
- `--new-epic` requires `--epic-id`; together they set `active_epic.{id,title,created_at}` and snapshot any prior active epic into `epics[]`.
{{/new_epic}}
{{#set_epic_path}}
- `--set-epic-path` records the written `epic.yaml` path on `active_epic.epic_path`.
{{/set_epic_path}}
{{#set_epic_status}}
- `--set-epic-status` sets the matching `epics[]` entry to `in_progress`, `done`, or `abandoned`.
{{/set_epic_status}}
{{#close_epic}}
- `--close-epic` snapshots `active_epic` into `epics[]` with `status: done`, then clears all active-epic fields.
{{/close_epic}}
{{#remove_change}}
- `--remove-change <ids>` removes entries with matching `id` from `session.changes[]` (comma-separated for multiple ids); does NOT touch `active_change`. Unknown ids are silently skipped; if all ids are unknown, a warning is written to stderr (exit code remains 0).
{{/remove_change}}
{{#remove_epic}}
- `--remove-epic <ids>` removes entries with matching `id` from `session.epics[]` (comma-separated for multiple ids); does NOT touch `active_epic`. Unknown ids are silently skipped; if all ids are unknown, a warning is written to stderr (exit code remains 0).
{{/remove_epic}}
{{#link_subchange_to_epic}}
- `--epic-id` with `--new-change` links the new active change to its parent epic; do not use it outside `--new-epic` or `--new-change`.
{{/link_subchange_to_epic}}

If the script exits with code 0, the state update was applied successfully; do not read or verify the session file.

### Failure handling

If the script fails (non-zero exit), do NOT abort the skill's main task. Continue execution and add a brief note at the end of your response that the session could not be updated.
{{/read_only}}
