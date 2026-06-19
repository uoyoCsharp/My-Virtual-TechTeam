## Script Usage Rule

{{#uses_plan_update}}To mutate `plan.yaml`, call the deterministic plan update script. Do NOT hand-edit `plan.yaml` or choose `current_tasks` yourself.

**Minimal command** (always required flags):
```bash
node .ai-agents/scripts/plan-update.cjs --plan "<active_change.plan_path>" --task <task_id> --status <new_status> --projects "<project_list>"
```
For optional flags (`--artifacts`, `--notes`, `--deliverables-pointer`, `--mark-deliverable-stale`), read `.ai-agents/scripts/plan-update.md`. Do NOT read `.cjs` or `.js` source.

{{/uses_plan_update}}{{#uses_epic_update}}To mutate `epic.yaml` (complete a child, set child status, switch active, add children, or validate), call the deterministic epic update script. Do NOT hand-edit `epic.yaml` or advance `current_change` yourself.

**Minimal command** (most common mode — complete child):
```bash
node .ai-agents/scripts/epic-update.cjs --epic "<active_epic.epic_path>" --complete-child <active_change.id>
```
For all modes (`--complete-child`, `--set-child-status`, `--switch-active`, `--add-child`, `--validate`), read `.ai-agents/scripts/epic-update.md`. Do NOT read `.cjs` or `.js` source.

{{/uses_epic_update}}{{#uses_session_update}}To update session state, call the deterministic session update script using the exact command in State Update. Do NOT read `.cjs` or `.js` source; all applicable flags are already rendered there.

{{/uses_session_update}}
**General rule**: Never read `.js` or `.cjs` source to learn script usage. For non-session scripts, read `.ai-agents/scripts/{name}.md` when optional flags or modes are needed.
