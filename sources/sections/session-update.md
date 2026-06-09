{{?read_only}}
## State Update

This skill is read-only and does NOT modify `.ai-agents/workspace/session.yaml`.
{{/read_only}}
{{^read_only}}
## State Update

After completing the skill's main task, run the session update script **exactly once** with the following arguments:

```bash
node .ai-agents/scripts/session-update.cjs --skill <skill_command_name> --summary "<concise one-line summary>"{{#update_active_change}} --new-change "<active_change.title>" --change-id <active_change.id>{{#link_subchange_to_epic}} --epic-id <active_epic.id>{{/link_subchange_to_epic}}{{/update_active_change}}{{#set_plan_path}} --set-plan-path ".ai-agents/workspace/artifacts/{active_change.id}/plan.yaml"{{/set_plan_path}}{{#update_change}} --update-change{{/update_change}}{{#close_change}} --close-change{{/close_change}}{{#set_change_status}} --set-change-status <status>{{/set_change_status}}{{#new_epic}} --new-epic "<epic_title>" --epic-id <epic_id>{{/new_epic}}{{#set_epic_path}} --set-epic-path <epic_path>{{/set_epic_path}}{{#set_epic_status}} --set-epic-status <status>{{/set_epic_status}}{{#close_epic}} --close-epic{{/close_epic}}{{#no_change}} --no-change{{/no_change}}{{#set_synced}} --set-synced{{/set_synced}}{{#truncate_history}} --truncate-history <count>{{/truncate_history}}{{#update_initialized_at}} --set-initialized{{/update_initialized_at}}

```

If the script exits with code 0, the state update was applied successfully; there is no need to read or verify the session file.

### Argument values

| Argument | Value source | Example |
|----------|-------------|---------|
| `--skill` | The exact skill command name without the leading `/` | `{{current_skill}}` |
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
| `--truncate-history` | Number of most recent history entries to keep (read from `config.yaml > preferences.history_limits.history`, default 20); older entries are discarded. | `20` |
{{/truncate_history}}
{{#update_initialized_at}}
| `--set-initialized` | Flag only, no value. Set when this skill initializes the project for the first time. | — |
{{/update_initialized_at}}
{{#new_epic}}
| `--new-epic` | The title of the new epic being created (same value written to `active_epic.title`) | `"ecommerce platform"` |
| `--epic-id` | The unique identifier of the new epic. Required when using `--new-epic`. Format: `epic-{YYYYMMDD}-{slug}`. | `"epic-20260608-ecommerce-platform"` |
{{/new_epic}}
{{#set_epic_path}}
| `--set-epic-path` | The path to the written `epic.yaml` file. Sets `active_epic.epic_path`. | `".ai-agents/workspace/artifacts/epic-20260608-ecommerce-platform/epic.yaml"` |
{{/set_epic_path}}
{{#set_epic_status}}
| `--set-epic-status` | The status to set on the `epics[]` entry matching `active_epic.id`. Values: `in_progress`, `done`, `abandoned`. | `done` |
{{/set_epic_status}}
{{#close_epic}}
| `--close-epic` | Flag only, no value. Snapshots `active_epic` into `epics[]` with `status: done`, then clears all `active_epic` fields. | — |
{{/close_epic}}
{{#link_subchange_to_epic}}
| `--epic-id` (with `--new-change`) | The parent epic id that this new sub-change belongs to. Only valid when used together with `--new-change`. | `"epic-20260608-ecommerce-platform"` |
{{/link_subchange_to_epic}}

{{#update_active_change}}
### Parameter semantics

| Argument | When to use | Effect on `session.yaml` |
|----------|-------------|--------------------------|
| `--new-change` + `--change-id` | Skill creates or identifies a new change | Sets `active_change.id`, `.title`, `.created_at`. Auto-snapshots old `active_change` into `changes[]` if non-empty. Requires both arguments together. |
{{#link_subchange_to_epic}}
| `--epic-id` (with `--new-change`) | Skill creates a new sub-change inside an existing epic (epic-child mode) | Writes `active_change.epic_id` so the new sub-change is linked to the parent epic. Only valid when used together with `--new-change`. |
{{/link_subchange_to_epic}}
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
{{#set_epic_path}}
| `--set-epic-path` | Skill writes or moves the `epic.yaml` file (e.g., after `/mvt-decompose` writes the artifacts) | Sets `active_epic.epic_path`. |
{{/set_epic_path}}
{{#set_epic_status}}
| `--set-epic-status` | Skill marks the active epic as `done` or `abandoned` (rarely used directly — `epic-update.cjs` usually drives this) | Sets `status` on the `epics[]` entry whose `id` matches `active_epic.id`. |
{{/set_epic_status}}
{{#close_epic}}
| `--close-epic` | Skill closes the active epic (e.g., after archiving a completed epic) | Snapshots `active_epic` into `epics[]` with `status: done`, then clears all `active_epic` fields. |
{{/close_epic}}
{{#no_change}}
| `--no-change` | Skill should not be associated with any change | Forces `history[].change_id` to empty string, skipping the `active_change.id` fallback. |
{{/no_change}}
{{#set_synced}}
| `--set-synced` | Skill synchronizes context files | Sets `session.last_synced_at` to the current time. |
{{/set_synced}}
{{#truncate_history}}
| `--truncate-history` | Maintenance: trim old history entries | Keeps the most recent N entries in `history[]`, discards older ones. |
{{/truncate_history}}
{{#update_initialized_at}}
| `--set-initialized` | Skill initializes the project for the first time | Sets `session.initialized_at` (idempotent — only writes if empty). |
{{/update_initialized_at}}
{{/update_active_change}}
{{^update_active_change}}
### Parameter semantics

| Argument | When to use | Effect on `session.yaml` |
|----------|-------------|--------------------------|
{{#new_epic}}
| `--new-epic` + `--epic-id` | Skill creates a new epic (e.g., `/mvt-decompose`) | Sets `active_epic.{id,title,created_at}`. Auto-snapshots old `active_epic` into `epics[]` if non-empty. Requires both arguments together. |
{{/new_epic}}
{{#update_change}}
| `--update-change` | Skill modifies a plan (i.e., after `plan.yaml` is updated) | Upserts current `active_change` into `changes[]` (with `status: active`), sets `updated_at`, sorts ascending, truncates to configured limit. |
{{/update_change}}
{{#close_change}}
| `--close-change` | All plan tasks are completed | Snapshots `active_change` into `changes[]` with `status: done`, then clears all `active_change` fields. |
{{/close_change}}
{{#set_change_status}}
| `--set-change-status` | Explicitly mark a change as `done` or `abandoned` | Sets `status` on the `changes[]` entry whose `id` matches `active_change.id`. |
{{/set_change_status}}
{{#set_epic_path}}
| `--set-epic-path` | Skill writes or moves the `epic.yaml` file (e.g., after `/mvt-decompose` writes the artifacts) | Sets `active_epic.epic_path`. |
{{/set_epic_path}}
{{#set_epic_status}}
| `--set-epic-status` | Skill marks the active epic as `done` or `abandoned` (rarely used directly — `epic-update.cjs` usually drives this) | Sets `status` on the `epics[]` entry whose `id` matches `active_epic.id`. |
{{/set_epic_status}}
{{#close_epic}}
| `--close-epic` | Skill closes the active epic (e.g., after archiving a completed epic) | Snapshots `active_epic` into `epics[]` with `status: done`, then clears all `active_epic` fields. |
{{/close_epic}}
{{#no_change}}
| `--no-change` | Skill should not be associated with any change | Forces `history[].change_id` to empty string, skipping the `active_change.id` fallback. |
{{/no_change}}
{{#set_synced}}
| `--set-synced` | Skill synchronizes context files | Sets `session.last_synced_at` to the current time. |
{{/set_synced}}
{{#truncate_history}}
| `--truncate-history` | Maintenance: trim old history entries | Keeps the most recent N entries in `history[]`, discards older ones. |
{{/truncate_history}}
{{#update_initialized_at}}
| `--set-initialized` | Skill initializes the project for the first time | Sets `session.initialized_at` (idempotent — only writes if empty). |
{{/update_initialized_at}}
{{/update_active_change}}

### Failure handling

If the script fails (non-zero exit), do NOT abort the skill's main task. Continue execution and add a brief note at the end of your response that the session could not be updated.
{{/read_only}}
