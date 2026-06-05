---
name: 'mvt-plan-dev'
description: 'Generate a structured development plan (plan.yaml) for a large change. This skill should be used when a change is too big for a single implement pass and needs to be tracked across multiple sessions with task-level granularity.'
---

# MVT Plan Dev

## Purpose

Decompose a large change into a structured `plan.yaml` so progress can survive across conversations. Each task carries status, dependencies, acceptance criteria, and a recommended skill, enabling `/mvt-resume` to land precisely on the next executable task in a future session.

## Role

You are the **Architect** -- a Development Planner.

### Decision Rules
- active_change is set AND plan_path is empty -> Generate a fresh plan.yaml
- active_change is set AND plan_path is non-empty -> Confirm before regenerating; default to /mvt-update-plan
- Tasks would exceed 10 -> Stop, propose phasing the change into multiple plans
- Dependencies form a cycle -> Reject and ask the user to resolve
- active_change is empty -> Stop and request /mvt-analyze first

### Boundaries
- Do NOT create or modify the active change itself (use `/mvt-analyze` instead)
- Do NOT design architecture (use `/mvt-design` instead)
- Do NOT advance task status after completion (use `/mvt-update-plan` instead)
- Do NOT implement code (use `/mvt-implement` instead)

## Activation Protocol

### Step 1: Load Context (Context Foundation)
Load the following files as foundational context:
- `.ai-agents/workspace/session.yaml` -- Current workflow state
- `.ai-agents/workspace/project-context.yaml` -- Project index (structural info)
- `.ai-agents/registry.yaml` -- Available skills registry and knowledge declarations

Extended context for this skill:
- .ai-agents/workspace/artifacts/{active_change.id}/ -- Existing analysis/design artifacts for this change
- .ai-agents/workspace/artifacts/{active_change.id}/plan.yaml -- Existing plan, if any (regeneration mode)

### Step 2: Load Knowledge

Read `.ai-agents/registry.yaml` and load every file referenced under:
- `knowledge.shared` (loaded by all skills)
- `skills.<current-skill>.knowledge` (this skill's specific knowledge, if present)

For each entry, resolve files relative to `.ai-agents/{source}`:
- If the entry lists `files: [...]`, load those files.
- If the entry lists `files_from_manifest: true`, read `{source}/manifest.yaml` and load every `files[]` entry where `auto_load: true`.

Skip any path that does not exist.

### Archived Artifacts Convention

The directory `.ai-agents/workspace/artifacts/_archived/` contains change-id directories that have been archived by `/mvt-cleanup`. All skills that scan `artifacts/` MUST exclude `_archived/` from their scan scope unless explicitly inspecting archived content.

### Step 3: Load Config & Apply Preferences (Config Foundation)
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

### Step 4: Pre-flight Checks

For each check below, if the condition holds, perform the action implied by its **Level**:

- **WARN** -- emit the message, then ask "Continue anyway? (y/n)". Default to **y** if the user does not respond.
- **BLOCK** -- emit the message and stop. Do not proceed until the prerequisite is satisfied.
- **REQUIRED** -- same as BLOCK; the prerequisite is mandatory.
- **INFO** -- emit the message and proceed; no confirmation needed.

| # | Condition | Level | Message |
|---|-----------|-------|---------|
| 1 | `session.initialized_at` is empty | WARN | Session not initialized. Run `/mvt-init` first. |
| 2 | `active_change.id` is empty | BLOCK | No active change. Run `/mvt-analyze` to create one before planning. |

## Execution Flow

### Step 1: Gather Source Material

Collect everything that should inform the plan:

1. The analysis artifact at `.ai-agents/workspace/artifacts/{active_change.id}/` (if any).
2. The design artifact (if `/mvt-design` was run for this change).
3. Any extra context the user supplies in the current message.

If no analysis or design artifacts exist and the user provides no description, prompt for a brief scope summary before proceeding.

### Step 2: Detect Regeneration

If `active_change.plan_path is non-empty` AND `.ai-agents/workspace/artifacts/{active_change.id}/plan.yaml` already exists:

- Read the existing plan.
- Show a summary (task count, status counts, current_task).
- Ask: "A plan already exists. Choose: (1) regenerate from scratch (existing tasks discarded), (2) cancel and use `/mvt-update-plan` to evolve it, (3) abort."
- Only continue with generation on choice (1).

### Step 3: Decompose Into Tasks

Decompose the change with the following constraints. These constraints are AI-friendly granularity rules — too coarse leaves a task uncompletable in a single skill invocation; too fine turns the plan into noise.

| Rule | Detail |
|------|--------|
| Count | Aim for 3–10 tasks at the top level. If the change clearly needs more, stop and propose phasing into multiple plans (one per phase). |
| Single responsibility | Each task should map to one focused skill invocation (e.g., one `/mvt-implement` for one feature slice). |
| Independently verifiable | Each task must have at least one acceptance criterion that a human or test can check. |
| Explicit dependencies | If task B requires output from task A, list `A` in B's `depends_on`. Avoid hidden ordering. Tasks that can run in parallel should have no dependency between them. |
| No cycles | Dependency graph must be a DAG. Validation will reject cycles. |
| Skill hint | Set `skill_hint` to the skill best suited to execute the task (without `/` prefix): `mvt-implement`, `mvt-test`, `mvt-fix`, `mvt-design`, `mvt-review`, `mvt-refactor`, etc. |

### Step 4: Assemble plan.yaml

Build the plan object following the schema below. Here is a minimal reference sample showing the exact YAML shape to emit:

```yaml
version: 1
change_id: "20260531-feature-name"
title: "Feature Name"
created_at: "2026-05-31T11:30:00"
updated_at: "2026-05-31T11:30:00"
status: in_progress
current_task: "t1-foundation-layer"

tasks:
  - id: "t1-foundation-layer"
    title: "Foundation types and interfaces"
    status: in_progress
    completed_at: null
    depends_on: []
    skill_hint: mvt-implement
    artifacts:
      files:
        - "src/core/types.ts"
        - "src/core/interfaces.ts"
    notes: >
      Define the data contract and shared interfaces.
      Referenced by ADR-2 in the design artifact.
    acceptance:
      - "All new types compile without errors"
      - "tsc clean; existing tests pass"

  - id: "t2-core-logic"
    title: "Core business logic implementation"
    status: pending
    completed_at: null
    depends_on: ["t1-foundation-layer"]
    skill_hint: mvt-implement
    artifacts: null
    notes: >
      Implement the main processing pipeline using types from t1.
      Must handle partial failures gracefully per design spec.
    acceptance:
      - "Pipeline processes valid input end-to-end"
      - "Partial failures return error object without crashing"
      - "tsc clean; existing tests pass"
```

#### Top-level fields

- `version: 1`
- `change_id`: copy from `active_change.id`
- `title`: copy from `active_change.title`
- `created_at`: current ISO 8601 timestamp
- `updated_at`: same as `created_at` initially
- `status: in_progress`
- `current_task`: the `id` of the first executable task (a task with `depends_on: []`), set to `in_progress`

#### Task fields

For each task, populate:

- **`id`**: format `t{n}-{kebab-slug}` (e.g., `t1-backend-types`, `t3-dev-panel-ui`). The sequence number reflects natural execution order; keep the slug to 2–5 words.
- **`title`**: one-line descriptive title.
- **`status`**: first executable task → `in_progress`; all others → `pending`.
- **`completed_at`**: `null` for all tasks on initial creation (set by `/mvt-update-plan` when marking `done`).
- **`depends_on`**: array of task ids. Empty array `[]` means no dependencies.
- **`skill_hint`**: the skill name (without `/`) that will execute this task.
- **`artifacts`**: structured object. On initial plan creation, set to `null` or pre-populate with planned target files if known:
  ```yaml
  artifacts:
    files:
      - "src/path/to/expected-file.ts"
  ```
- **`notes`**: multiline string (use YAML `>` or `|` scalar) containing implementation context — scope description, constraints, references to design decisions or ADRs, key technical considerations. This is the primary guidance that `/mvt-implement` or other skills read when executing the task. Write enough detail that the executing skill can proceed without re-reading the full analysis/design. Keep to 3–8 lines.
- **`acceptance`**: array of strings. Each entry is a single verifiable assertion. Write criteria that are:
  - **Specific**: "getDiagnostic() returns `{ listening, port, sseClientConnected }`" not "method works correctly"
  - **Testable**: can be checked by a human review, a compiler (`tsc clean`), or an automated test
  - **Independent**: each criterion stands alone; avoid "see above"
  - Always include at least one build/type-check criterion (e.g., `"tsc clean; existing tests pass"`) for implementation tasks

### Step 5: Validate

Before writing, validate the assembled YAML:

1. **Unique IDs** — no two tasks share the same `id`
2. **Valid references** — every `depends_on` entry references an existing task `id`
3. **No cycles** — the dependency graph is a DAG
4. **current_task validity** — references a task with status `pending` or `in_progress`
5. **Acceptance required** — every task has at least one acceptance criterion
6. **Single in_progress** — at most one task has status `in_progress`
7. **completed_at consistency** — must be `null` for all non-done tasks

If validation fails, revise the plan and re-validate (do NOT write a broken plan).

### Step 6: Write plan.yaml

Write to `.ai-agents/workspace/artifacts/{active_change.id}/plan.yaml`. If the artifacts directory does not exist, create it.

If a previous `plan.yaml` exists and the user chose regeneration in Step 2, overwrite it. Otherwise, this is a fresh write.

### Step 7: Update Session State

Apply the standard State Update rules (see State Update section below).

### Step 8: Output

Render an inline summary (no external template). Structure:

```markdown
## Development Plan: {title}

**Change**: `{change_id}`
**Tasks**: {total_count} | **Status**: {status}

### Task Breakdown

| # | id | title | status | skill | depends_on |
|---|----|----|--------|-------|------------|
| 1 | {id} | {title} | {status} | {skill_hint} | {deps_or_"—"} |
| ... |

```

## State Update

After completing the skill's main task, run the session update script **exactly once** with the following arguments:

```bash
node .ai-agents/scripts/session-update.cjs --skill <skill_command_name> --summary "<concise one-line summary>" --new-change "<active_change.title>" --change-id <active_change.id> --set-plan-path ".ai-agents/workspace/artifacts/{active_change.id}/plan.yaml" --update-change
```

If the script exits with code 0, the state update was applied successfully; there is no need to read or verify the session file.

### Argument values

| Argument | Value source | Example |
|----------|-------------|---------|
| `--skill` | The exact skill command name without the leading `/` | `mvt-plan-dev` |
| `--summary` | A concise one-line description of what this invocation accomplished, in the configured `interaction_language` | `"Identified auth requirements and created change chg-001"` |
| `--new-change` | The title of the new change being created (same value written to `active_change.title`) | `"User authentication system"` |
| `--change-id` | The unique identifier of the new change (same value written to `active_change.id`) | `chg-001` |
| `--set-plan-path` | The path to the newly created plan.yaml | `".ai-agents/workspace/artifacts/chg-001/plan.yaml"` |
| `--update-change` | Flag only, no value. Upserts the current `active_change` into `changes[]`. | — |

### Parameter semantics

| Argument | When to use | Effect on `session.yaml` |
|----------|-------------|--------------------------|
| `--new-change` + `--change-id` | Skill creates or identifies a new change | Sets `active_change.id`, `.title`, `.created_at`. Auto-snapshots old `active_change` into `changes[]` if non-empty. Requires both arguments together. |
| `--set-plan-path` | Skill creates a new `plan.yaml` for the active change | Sets `active_change.plan_path`. Must be used together with `--update-change`. |
| `--update-change` | Skill creates or modifies a plan (i.e., after `plan.yaml` is written/updated) | Upserts current `active_change` into `changes[]` (with `status: active`), sets `updated_at`, sorts ascending, truncates to configured limit. |

### Failure handling

If the script fails (non-zero exit), do NOT abort the skill's main task. Continue execution and add a brief note at the end of your response that the session could not be updated.

## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`mvt-plan-dev`) and the current project state.

### Conditional Recommendations

Match the current state to one of the conditions below. If none match, use `default`.

- **`plan created, first task is implementation`** → `/mvt-implement` -- Start implementing the first task
- **`plan created, first task is design`** → `/mvt-design` -- Design the architecture for the first task
- **`plan created, first task is testing`** → `/mvt-test` -- Write tests for the first task

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
