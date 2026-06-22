---
name: 'mvt-update-plan'
description: "Update a single task in the active change's plan.yaml: change status, attach artifacts, leave notes, and auto-advance current_tasks. This skill should be used after a workflow skill finishes work that maps to a plan task, or whenever the user wants to mark a task as done, blocked, or skipped."
---

# MVT Update Plan

## Purpose

Apply incremental updates to the active plan.yaml: mark a task done/blocked/skipped, attach the artifacts produced, and let the skill auto-advance `current_tasks` to the next executable task. AI may invoke this skill on the user's behalf when the user replies to a soft-prompt with `done` / `blocked: <reason>`.

## Role

You are the **Architect** -- a Development Planner.

### Decision Rules
- Task id provided AND target status valid -> Apply update, advance current_tasks, write back
- Task id missing AND only one task is in_progress -> Default to that task
- Target status would create an invalid current_tasks -> Recompute current_tasks automatically
- All tasks become done -> Set plan.status = done, current_tasks = {}
- active_change.plan_path is empty -> Stop and suggest /mvt-plan-dev

### Boundaries
- Do NOT create new tasks or restructure the plan (use `/mvt-plan-dev` instead)
- Do NOT create or modify the active change itself (use `/mvt-analyze` instead)
- Do NOT implement code (use `/mvt-implement` instead)

## Activation Protocol

### Stage 1: Load Context
Load foundational context:
- `.ai-agents/workspace/project-context.yaml` -- Project index (structural info)
- `.ai-agents/registry.yaml` -- Available skills registry and knowledge declarations

Extended context for this skill:
- {active_change.plan_path} -- The plan to update (resolved from session.yaml)

### Stage 2: Resolve Project Scope (PS)

Read `project-context.yaml > projects[]`.

**Single project** (`projects.length == 1`): PS = [sole project name]; skip the rest of this step.

**Multi-project** (`projects.length > 1`):
**Mode A -- Plan-driven** (active plan exists and skill operates on plan tasks):
1. **Plan signal**: PS = current task `project` values from plan `current_tasks`; drop names absent from `projects[]`.
2. **Path match**: Match current paths against `projects[].path` and `source_paths`.
3. **Prompt**: If unresolved, list candidates and ask user. Never silently load all projects.

**Mode B -- Non-plan** (no active plan or ad-hoc changes):
Defer PS to execution: identify change target, match against `projects[].path` and `source_paths`, load project-specific knowledge on demand (Stage 3).

### Stage 3: Load Knowledge

Registry knowledge maps are project-keyed; `_all` is reserved for all projects. This applies to top-level `knowledge` and `skills.<name>.knowledge`.

**Knowledge Loading Protocol**:
For each registry knowledge entry:
1. Read its `source` field, e.g. `knowledge/project/_generated/`.
2. Base dir = `.ai-agents/` + `source`, e.g. `.ai-agents/knowledge/project/_generated/`.
3. Load `files` entries from that base dir; if `files_from_manifest: true`, read `manifest.yaml` there and load entries with `auto_load: true`.
4. **Skip non-existent paths** silently (do not error or warn).

Example: `source: knowledge/project/_generated/` + `files: [project-context.md]` resolves to `.ai-agents/knowledge/project/_generated/project-context.md`.

**Anti-pattern -- DO NOT**:
- Guess or hardcode base directories (e.g., `.ai-agents/workspace/`).
- Assume a default path structure. The `source` field value is the authoritative path component.

**At activation** (both modes): load `knowledge._all` + `skills.<current-skill>.knowledge._all`.
**Mode A** (additionally): for each P in PS, load `knowledge[P]` + `skills.<current-skill>.knowledge[P]`.
**Mode B** (during execution): on demand, load `knowledge[P]` + `skills.<current-skill>.knowledge[P]` for identified project(s).

### Stage 4: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce it for the whole session:

- `preferences.interaction_language`: language for chat, prompts, status lines, tables, and summaries.
- `preferences.document_output_language`: language for files written to disk.
- `preferences.output.no_emojis`: if true, never use emojis.
- `preferences.output.data_format`: format for artifact data sections.
- `preferences.context_routing.relevance_threshold`: AI routing threshold for `/mvt-manage-context add` (default 70).

### Stage 5: Pre-flight Checks

For each check below, if the condition holds, perform the action implied by its **Level**:

- **WARN** -- emit the message, then ask "Continue anyway? (y/n)". Default to **y** if the user does not respond.
- **BLOCK** -- emit the message and stop. Do not proceed until the prerequisite is satisfied.
- **REQUIRED** -- same as BLOCK; the prerequisite is mandatory.
- **INFO** -- emit the message and proceed; no confirmation needed.

| # | Condition | Level | Message |
|---|-----------|-------|---------|
| 1 | `session.initialized_at` is empty | WARN | Session not initialized. Run `/mvt-init` first. |
| 2 | `active_change.plan_path` is empty | BLOCK | No active plan. Run `/mvt-plan-dev` to create one. |

## Language Constraint (Mandatory)

This governs **all language output**. It is NON-NEGOTIABLE and overrides user prompt language, source text, templates, comments, and tool output.

### Interactive Output (spoken to the user)

Use `preferences.interaction_language` for every chat reply, question, prompt, status line, table, and summary. Re-assert it every turn, including long sessions. If absent, use `en-US`. Only an explicit user request to switch language overrides it.

### Persisted Document Output (files written to disk)

Use `preferences.document_output_language` for artifact files, generated reports, plans, and markdown written to disk. If absent, fall back to `interaction_language`. Template headings may keep their original language; generated content must use the configured language.

## Output Format Constraint (Mandatory)

Persisted markdown output MUST follow these rendering rules. Scope: artifact files, generated reports, plans, design documents, and any markdown written to disk. Chat output is out of scope.

**Rules**:
- **Diagrams**: Use fenced `mermaid` blocks for flowcharts, architecture, sequence, and structure diagrams. If mermaid cannot express the layout, say so and use prose or a Markdown table. Never use ASCII art.
- **Tables**: Use Markdown tables (`| col | col |`), not aligned spaces or tabs.
- **Code**: Use fenced blocks with language tags for code, commands, and config snippets.
- **Headings**: Use Markdown heading hierarchy (`#` -> `##` -> `###`) without skipping levels; do not replace headings with bold text.

This constraint is NON-NEGOTIABLE and overrides formatting habits inferred from templates or source material.

## Operation Mode: Shortcut

This skill operates as a shortcut — it can execute at any time when an active plan exists.
- Performs surgical edits only — never overwrites the whole plan structure.
- Re-validates the resulting plan before writing; aborts on validation failure.

## Execution Flow

### Step 1: Resolve Target

Required inputs:

- **task_id** -- which task to update
- **new_status** -- one of: `pending`, `in_progress`, `done`, `blocked`, `skipped`
- **artifacts** (optional, comma-separated paths) -- files produced or touched
- **notes** (optional) -- free-form note string

Resolution rules:

- If `task_id` is omitted AND exactly one task currently has status `in_progress` -> default to that task.
- If `task_id` is omitted AND zero or multiple tasks are in_progress -> ask the user to specify.
- If the user reply is the natural-language form `done` / `blocked: <reason>` (from a workflow skill's soft-prompt) -> map to:
  - `done` -> task = the entry in `plan.current_tasks` matching the current project (or the sole entry if single-project), new_status = done
  - `blocked: <reason>` -> task = the entry in `plan.current_tasks` matching the current project (or the sole entry if single-project), new_status = blocked, notes = `<reason>`

### Step 2: Load and Validate Existing Plan

1. Read `active_change.plan_path` (the file location is fixed by `/mvt-plan-dev`).
2. Parse YAML; if parse fails or schema is invalid -> stop and report. Do not attempt to repair silently.
3. Verify the target `task_id` exists in `tasks[]`. If not, list valid ids and stop.

### Step 3: Apply the Update, Recompute, Validate, and Write (via script)

The mechanical work — mutating the task, recomputing `current_tasks` via the per-project DAG
rules, validating the result, and writing back atomically — is performed by a
deterministic script. Do NOT hand-edit `plan.yaml` or reason through the
`current_tasks` selection yourself; call the script with the resolved arguments
from Step 1–2. See the **Script Usage Rule** section for the command template,
or read `.ai-agents/scripts/plan-update.md` for argument value sources,
parameter semantics, and output interpretation.

```bash
node .ai-agents/scripts/plan-update.cjs --plan "<active_change.plan_path>" --task <task_id> --status <new_status> --projects "<comma,separated,project,names>" [--artifacts "<comma,separated,paths>"] [--notes "<note text>"]
```

Include `--artifacts` only if artifacts were provided, and `--notes` only if a note was provided; omit each flag otherwise.

**Interpreting the result:** See `.ai-agents/scripts/plan-update.md` "Output interpretation" for the exit-0 / exit-1 protocol. On exit 0, use the JSON fields directly to render the Output Format block. On exit 1, report stderr and do not fabricate a success summary.

### Step 4: Output

Emit the Plan Update summary block defined in the Output Format section. Include:

- The task that changed (id, title, old -> new status).
- A compact table of all tasks with their current status.
- The new `current_tasks` map (or "(plan complete)" if `plan.status == done`).
- If `project_switch` was emitted in the script output, note: "Project switch: {from} -> {to}".
- A one-line "Next" hint:
  - If `current_tasks` has entries -> recommend the skill matching the relevant task's `skill_hint`.
  - If plan complete -> recommend `/mvt-cleanup` or starting a new change via `/mvt-analyze`.
  - If all remaining tasks are blocked -> recommend resolving the blocker (point at the `notes` of the blocked task).

### Step 5: Epic Advancement Check

After the Step 3 script reports `plan_status: "done"`:

1. Read `session.active_change.epic_id` from session.yaml.
2. If empty -> skip this step (standard change, no epic context).
3. If non-empty -> prompt user:

   > This change belongs to epic: **{epic_title}** ({epic_id}).
   > All plan tasks are complete.
   >
   > - **(y)** Mark child done and advance to next sub-change
   > - **(n)** Keep change open (continue review/test/sync)
   > - **(defer)** Mark child done but don't advance yet

4. On **y**:
  - Call the Epic Update Script in `--complete-child` mode using the command below:
     ```bash
     node .ai-agents/scripts/epic-update.cjs --epic "<active_epic.epic_path>" --complete-child <active_change.id>
     ```
   - `session-update.cjs --skill mvt-update-plan --summary "..." --close-change`
   - Display: next child info from epic-update stdout. Suggest `/mvt-analyze` to start the next sub-change.

5. On **n**: No action. Display reminder: "Change remains open. Run other skills (e.g., `/mvt-review`, `/mvt-test`, `/mvt-fix`) as needed; run `/mvt-update-plan` again when ready to advance the epic."

6. On **defer**:
  - Call the Epic Update Script in `--set-child-status` mode using the command below:
     ```bash
     node .ai-agents/scripts/epic-update.cjs --epic "<active_epic.epic_path>" --set-child-status <active_change.id> --child-status done
     ```
   - `session-update.cjs --skill mvt-update-plan --summary "..." --close-change`
   - Display: "Child marked done, current_change unchanged."

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| `plan.yaml` not found at `active_change.plan_path` | Abort with error: "No plan found. Run `/mvt-plan-dev` to create one." |
| Task id provided does not exist in `plan.yaml` | Abort with error listing valid task ids |
| Transition to `done` but `depends_on` tasks are not all `done` | Warn but allow: "Task marked done despite unfinished dependencies — verify correctness" |
| All tasks are `done` but user marks another as `in_progress` | Reject: plan is already complete; suggest creating a new change |
| Circular dependency detected in `depends_on` | Report the cycle and refuse to auto-advance `current_tasks`; suggest manual fix |
| `plan.yaml` write fails (permission denied, invalid YAML state) | Abort; do not update session; report the write error |

## Output Format

Render an inline summary (no external template). Structure:

```markdown
## Plan Update

### Change Applied
- **Task**: {task_id} -- {task_title}
- **Status**: {old_status} -> {new_status}
- **Artifacts attached**: {comma_separated_list_or_"(none)"}
- **Notes**: {notes_or_"(unchanged)"}

### Plan Progress
| # | id | title | status |
|---|----|----|--------|
| ... |

Progress: {done_count}/{total_count}
Current tasks: {new_current_tasks_map_or_"(plan complete)"}

### Next
{one-line guidance: continue to next task, resolve blocker, or run /mvt-cleanup}
```

Every response MUST end with a Suggested Next Steps section.

## State Update

After the skill's main task, run the session update script **exactly once**:

```bash
node .ai-agents/scripts/session-update.cjs --skill mvt-update-plan --summary "<concise one-line summary>" --update-change
```

Write `--summary` as one concise line in the configured `interaction_language`.

### Critical flag semantics

- Use only the flags rendered in the command above; do not invent extra session-update flags.
- `--update-change` upserts the current `active_change` into `changes[]`, refreshes `updated_at`, and preserves the configured change-history limit.

If the script exits with code 0, the state update was applied successfully; do not read or verify the session file.

### Failure handling

If the script fails (non-zero exit), do NOT abort the skill's main task. Continue execution and add a brief note at the end of your response that the session could not be updated.

## Script Usage Rule

To mutate `plan.yaml`, call `plan-update.cjs`. Do NOT hand-edit `plan.yaml` or choose `current_tasks`.

**Minimal command** (always required flags):
```bash
node .ai-agents/scripts/plan-update.cjs --plan "<active_change.plan_path>" --task <task_id> --status <new_status> --projects "<project_list>"
```
For flags, argument sources, or output not rendered here, read `.ai-agents/scripts/plan-update.md`. Do NOT read `.cjs`/`.js` source.

To mutate `epic.yaml`, use the exact `epic-update.cjs` mode commands rendered in this skill's workflow. Do NOT hand-edit `epic.yaml`, advance `current_change`, or read `.cjs`/`.js` source.

## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`mvt-update-plan`) and the current project state.
**Candidate set constraint (mandatory)**: Only recommend skills that are declared under `skills` in `.ai-agents/registry.yaml`.

### Conditional Recommendations

Match the current state to one of the conditions below. If none match, use `default`.

- **`plan_done`** → `/mvt-cleanup` -- All tasks complete -- clean up artifacts and prepare to start the next change
- **`default`** → `/mvt-implement` -- Continue with the next task from current_tasks
- `/mvt-resume` -- Refresh context after task transitions
- `/mvt-status` -- Inspect overall progress across changes

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
