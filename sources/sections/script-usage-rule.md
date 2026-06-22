## Script Usage Rule

{{#uses_plan_update}}To mutate `plan.yaml`, call `plan-update.cjs`. Do NOT hand-edit `plan.yaml` or choose `current_tasks`.

**Minimal command** (always required flags):
```bash
node .ai-agents/scripts/plan-update.cjs --plan "<active_change.plan_path>" --task <task_id> --status <new_status> --projects "<project_list>"
```
For flags, argument sources, or output not rendered here, read `.ai-agents/scripts/plan-update.md`. Do NOT read `.cjs`/`.js` source.

{{/uses_plan_update}}
{{#plan_update_inline_command_only}}To mutate `plan.yaml`, use the exact `plan-update.cjs` command rendered in this skill's workflow. Do NOT hand-edit `plan.yaml`, choose `current_tasks`, or read `.cjs`/`.js` source.

{{/plan_update_inline_command_only}}
{{#plan_update_project_reminder}}When calling `plan-update.cjs` for a project-attributed plan, pass `--projects` with the relevant project list. Do NOT hand-edit `plan.yaml` or read `.cjs`/`.js` source. For flags or value sources not rendered here, read `.ai-agents/scripts/plan-update.md`.

{{/plan_update_project_reminder}}
{{#uses_epic_update}}To mutate `epic.yaml` (complete a child, set child status, switch active, add children, or validate), call `epic-update.cjs`. Do NOT hand-edit `epic.yaml` or advance `current_change`.

**Minimal command** (most common mode — complete child):
```bash
node .ai-agents/scripts/epic-update.cjs --epic "<active_epic.epic_path>" --complete-child <active_change.id>
```
For modes not rendered here, read `.ai-agents/scripts/epic-update.md`. Do NOT read `.cjs`/`.js` source.

{{/uses_epic_update}}
{{#epic_update_inline_modes_only}}To mutate `epic.yaml`, use the exact `epic-update.cjs` mode commands rendered in this skill's workflow. Do NOT hand-edit `epic.yaml`, advance `current_change`, or read `.cjs`/`.js` source.

{{/epic_update_inline_modes_only}}
{{#epic_update_fallback_for_unrendered_modes}}To mutate `epic.yaml`, use the `epic-update.cjs` mode commands rendered in this skill's workflow. Do NOT hand-edit `epic.yaml`, advance `current_change`, or read `.cjs`/`.js` source. For modes or flags not rendered here, read `.ai-agents/scripts/epic-update.md`.

{{/epic_update_fallback_for_unrendered_modes}}
