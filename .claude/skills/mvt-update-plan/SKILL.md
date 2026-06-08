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

### Step 1: Load Context
Load these files as foundational context:
- `.ai-agents/workspace/project-context.yaml` -- Project index (structural info)
- `.ai-agents/registry.yaml` -- Available skills registry and knowledge declarations

Extended context for this skill:
- {active_change.plan_path} -- The plan to update (resolved from session.yaml)

### Step 2: Resolve Project Scope (PS)

Read `project-context.yaml > projects[]`.

**Single project** (`projects.length == 1`): Set PS = [sole project name]. Skip remaining PS steps.

**Multi-project** (`projects.length > 1`):
**Mode A -- Plan-driven** (active plan exists and skill operates on plan tasks):
1. **Plan signal**: PS = current task's `project` array from plan's `current_tasks`. Drop stale project names (not in `projects[]`), fall through.
2. **Path match**: Match current working paths against `projects[].path` and `source_paths`.
3. **Prompt**: If still unresolved, list candidates and ask user. Never silently load all projects.

**Mode B -- Non-plan** (no active plan or ad-hoc changes):
Defer PS to execution: identify change target, match against `projects[].path` and `source_paths`, load project-specific knowledge on demand (Step 3).

### Step 3: Load Knowledge

Registry uses project-keyed maps; `_all` is a reserved key (all projects). Applies to both top-level `knowledge` and `skills.<name>.knowledge`.

**Knowledge Loading Protocol**:
For each knowledge entry in the registry, follow these steps:
1. **Read the `source` field** from the registry entry (e.g., `knowledge/project/_generated/`).
2. **Construct the base directory**: join `.ai-agents/` with the `source` value → `.ai-agents/{source_value}/`.
3. **Load files**:
   - `files: [a.md, b.md]` → load `.ai-agents/{source_value}/a.md`, `.ai-agents/{source_value}/b.md`.
   - `files_from_manifest: true` → read `.ai-agents/{source_value}/manifest.yaml`, load entries with `auto_load: true`.
4. **Skip non-existent paths** silently (do not error or warn).

**Worked example**:
Given this registry entry:
```yaml
- id: project-context
  source: knowledge/project/_generated/
  files:
    - project-context.md
```
Resolution: `.ai-agents/` + `knowledge/project/_generated/` + `project-context.md` = `.ai-agents/knowledge/project/_generated/project-context.md`

**Anti-pattern -- DO NOT**:
- Guess or hardcode base directories (e.g., `.ai-agents/workspace/`).
- Assume a default path structure. The `source` field value is the authoritative path component.

**At activation** (both modes): load `knowledge._all` + `skills.<current-skill>.knowledge._all`.
**Mode A** (additionally): for each P in PS, load `knowledge[P]` + `skills.<current-skill>.knowledge[P]`.
**Mode B** (during execution): on demand, load `knowledge[P]` + `skills.<current-skill>.knowledge[P]` for identified project(s).

### Step 4: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce the following throughout this entire session:

**Language**:
- `preferences.interaction_language` → Use for everything spoken to the user (chat, prompts, tables); NOT for files written to disk.
- `preferences.document_output_language` → See **Output Language Constraint** section below for the full rules governing files written to disk.

**Other preferences**:
- `preferences.output.no_emojis` → If true, never use emojis
- `preferences.output.data_format` → Use this format for data sections in artifacts
- `preferences.context_routing.relevance_threshold` → Used by `/mvt-manage-context add` for AI routing (default 70 if missing)

## Output Language Constraint (Mandatory)

All persisted document output (files written to disk) MUST be written in the language specified by `preferences.document_output_language` from config.yaml.

**Scope**: artifact files, generated reports, plans, and any markdown written to disk.

**Rules**:
- Section headings defined in templates may remain in their original language, but all generated **content** MUST use the configured language
- If `document_output_language` is not set, fall back to `interaction_language`
- Do NOT infer output language from template headings, user prompt language, or source code comments
- This constraint is NON-NEGOTIABLE and overrides any other language signals

## Output Format Constraint (Mandatory)

All persisted document output (markdown written to disk) MUST follow the formatting rules below. These rules govern *how* content is rendered, independent of the language it is written in.
**Scope**: artifact files, generated reports, plans, design documents, and any markdown written to disk. These rules do NOT apply to conversational output in the chat.

**Rules**:
- **Diagrams**: Express flowcharts, architecture, sequence, and structure diagrams as fenced `mermaid` code blocks. Do NOT draw diagrams with ASCII art (boxes made of `+`, `-`, `|`, arrows like `-->` outside mermaid, etc.).
- **Tables**: Render tabular data as Markdown tables (`| col | col |`). Do NOT simulate tables with space- or tab-aligned text.
- **Code**: Place code, commands, and config snippets in fenced code blocks with a language tag (e.g. ```` ```ts ````, ```` ```bash ````, ```` ```yaml ````). Do NOT leave code in bare or untagged fences.
- **Headings**: Use the Markdown heading hierarchy (`#` -> `##` -> `###`) without skipping levels. Do NOT use bold text as a substitute for a heading.

**Notes**:
- If a diagram genuinely cannot be expressed in mermaid (e.g. a precise spatial/pixel layout), state that explicitly and prefer a Markdown table or prose description over ASCII art.
- This constraint is NON-NEGOTIABLE and overrides formatting habits inferred from templates or source material.

### Step 5: Pre-flight Checks

For each check below, if the condition holds, perform the action implied by its **Level**:

- **WARN** -- emit the message, then ask "Continue anyway? (y/n)". Default to **y** if the user does not respond.
- **BLOCK** -- emit the message and stop. Do not proceed until the prerequisite is satisfied.
- **REQUIRED** -- same as BLOCK; the prerequisite is mandatory.
- **INFO** -- emit the message and proceed; no confirmation needed.

| # | Condition | Level | Message |
|---|-----------|-------|---------|
| 1 | `session.initialized_at` is empty | WARN | Session not initialized. Run `/mvt-init` first. |
| 2 | `active_change.plan_path` is empty | BLOCK | No active plan. Run `/mvt-plan-dev` to create one. |

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
from Step 1–2:

```bash
node .ai-agents/scripts/plan-update.cjs --plan "<active_change.plan_path>" --task <task_id> --status <new_status> --projects "<comma,separated,project,names>" [--artifacts "<comma,separated,paths>"] [--notes "<note text>"]
```

Include `--artifacts` only if artifacts were provided, and `--notes` only if a note was provided; omit each flag otherwise.

| Argument | Value source |
|----------|-------------|
| `--plan` | `active_change.plan_path` resolved from session.yaml |
| `--task` | the `task_id` resolved in Step 1 |
| `--status` | the `new_status` resolved in Step 1 (`pending`/`in_progress`/`done`/`blocked`/`skipped`) |
| `--projects` | comma-separated project names read from `project-context.yaml > projects[].name` |
| `--artifacts` | optional; comma-separated paths to append (the script de-duplicates) |
| `--notes` | optional; overwrites the task's `notes` |

The script performs, deterministically:

1. **Apply**: sets the task status; appends + de-duplicates `--artifacts` (handles `artifacts: null`); overwrites `--notes`; sets `completed_at` to now when status is `done`, else `null`; refreshes `plan.updated_at`.
2. **Recompute `current_tasks`** (per-project independent advancement): for each project, finds the `in_progress` task or advances the first `pending` task whose `depends_on` are all in `resolvedIds` (done + skipped; blocked does NOT satisfy). Detects `project_switch` when advancement crosses a project boundary. Plan done -> `current_tasks = {}`.
3. **Validate** the mutated plan (unique ids, valid `depends_on` references, DAG/no-cycle per project, one `in_progress` per project, every task has acceptance, `completed_at` consistency, `current_tasks` validity, project naming constraint, task project membership).
4. **Write atomically** (temp + rename) only if validation passes.

**Interpreting the result:**

- **Exit 0**: success. stdout is a single-line JSON object:
  ```json
  {"ok":true,"task":{"id":"t1","title":"...","old_status":"in_progress","new_status":"done"},"current_tasks":{"default":"t2"},"plan_status":"in_progress","progress":{"done":1,"total":4},"warning":null,"project_switch":null}
  ```
  Use these fields directly to render the Output Format block. The file is already written — do NOT read it back to verify. If `warning` is non-null, surface it. If `project_switch` is non-null, note the project boundary crossing.
- **Exit 1**: failure. stderr carries the error (invalid status, task not found, validation failure, parse/write error). The file was **not** modified. Report the error to the user and do not fabricate a success summary.

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

After completing the skill's main task, run the session update script **exactly once** with the following arguments:

```bash
node .ai-agents/scripts/session-update.cjs --skill <skill_command_name> --summary "<concise one-line summary>" --update-change
```

If the script exits with code 0, the state update was applied successfully; there is no need to read or verify the session file.

### Argument values

| Argument | Value source | Example |
|----------|-------------|---------|
| `--skill` | The exact skill command name without the leading `/` | `mvt-update-plan` |
| `--summary` | A concise one-line description of what this invocation accomplished, in the configured `interaction_language` | `"Identified auth requirements and created change chg-001"` |
| `--update-change` | Flag only, no value. Upserts the current `active_change` into `changes[]`. | — |

### Parameter semantics

| Argument | When to use | Effect on `session.yaml` |
|----------|-------------|--------------------------|
| `--update-change` | Skill modifies a plan (i.e., after `plan.yaml` is updated) | Upserts current `active_change` into `changes[]` (with `status: active`), sets `updated_at`, sorts ascending, truncates to configured limit. |

### Failure handling

If the script fails (non-zero exit), do NOT abort the skill's main task. Continue execution and add a brief note at the end of your response that the session could not be updated.

## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`mvt-update-plan`) and the current project state.

### Conditional Recommendations

Match the current state to one of the conditions below. If none match, use `default`.

- **`plan_done`** → `/mvt-cleanup` -- All tasks complete -- clean up artifacts and prepare to start the next change
- **`default`** → `/mvt-implement` -- Continue with the next task from current_tasks
- `/mvt-resume` -- Refresh context after task transitions
- `/mvt-status` -- Inspect overall progress across changes

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
