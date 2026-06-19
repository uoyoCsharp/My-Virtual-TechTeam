## Script Usage Rule

{{#uses_plan_update}}When this skill must mutate `plan.yaml`, call the deterministic plan update script. Do NOT hand-edit `plan.yaml` or reason through `current_tasks` selection yourself.

**Minimal command** (always required flags):
```bash
node .ai-agents/scripts/plan-update.cjs --plan "<active_change.plan_path>" --task <task_id> --status <new_status> --projects "<project_list>"
```
For the full flag reference (including `--artifacts`, `--notes`, `--deliverables-pointer`, `--mark-deliverable-stale`), read `.ai-agents/scripts/plan-update.md`. **Do NOT read the `.cjs` or `.js` source file.**

{{/uses_plan_update}}{{#uses_epic_update}}When this skill must mutate `epic.yaml` (complete a child, set child status, switch active, add children, or validate), call the deterministic epic update script. Do NOT hand-edit `epic.yaml` or reason through `current_change` advancement yourself.

**Minimal command** (most common mode — complete child):
```bash
node .ai-agents/scripts/epic-update.cjs --epic "<active_epic.epic_path>" --complete-child <active_change.id>
```
For the full flag reference (all 5 modes: `--complete-child`, `--set-child-status`, `--switch-active`, `--add-child`, `--validate`), read `.ai-agents/scripts/epic-update.md`. **Do NOT read the `.cjs` or `.js` source file.**

{{/uses_epic_update}}{{#uses_session_update}}When this skill must update session state, call the deterministic session update script (see the State Update section for the exact command with this skill's flags). **Do NOT read the `.cjs` or `.js` source file** — the State Update section already contains the full command template with all applicable flags pre-filled.

{{/uses_session_update}}
**General rule**: script usage documentation is deployed alongside each script as `.ai-agents/scripts/{name}.md`. If you are unsure about a script's flags or behavior, read the corresponding `.md` file. **Never read `.js` or `.cjs` source files to learn how to call a script.**
