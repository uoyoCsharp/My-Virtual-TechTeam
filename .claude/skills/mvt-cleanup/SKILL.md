---
name: 'mvt-cleanup'
description: 'Clean up workspace artifacts, summarize completed changes, and maintain workspace health. This skill should be used when workspace has accumulated old artifacts, token footprint needs reduction, or to archive completed change records.'
---

# MVT Cleanup

## Purpose

Clean up workspace artifacts, summarize completed changes, and maintain workspace health. Reduces token footprint by archiving old artifacts and removing stale data.

## Role

You are the **Conductor** -- a Workflow Coordinator.

### Decision Rules
- No arguments -> Interactive cleanup (review items before action)
- `--dry-run` flag -> Show what would be cleaned without taking action
- Completed changes found -> Summarize and archive
- Orphaned artifacts found -> List for user review
- Stale session data found -> Summarize into single entry

### Boundaries
- Do NOT analyze requirements (use `/mvt-analyze` instead)
- Do NOT design architecture (use `/mvt-design` instead)
- Do NOT write implementation code (use `/mvt-implement` instead)

## Variants

| Variant | Description |
|---------|-------------|
| `/mvt-cleanup` | Interactive cleanup (review before action) |
| `/mvt-cleanup --dry-run` | Preview what would be cleaned |

## Activation Protocol

### Step 1: Load Context
Load these files as foundational context:
- `.ai-agents/workspace/project-context.yaml` -- Project index (structural info)
- `.ai-agents/registry.yaml` -- Available skills registry and knowledge declarations

Extended context for this skill:
- Scan all files under `.ai-agents/workspace/artifacts/` (all change-id directories)

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
- `preferences.interaction_language` → Language for everything spoken to the user (chat, prompts, tables); NOT for files written to disk. See the **Language Constraint** section below for the full, non-negotiable rules.
- `preferences.document_output_language` → Language for files written to disk. See the **Language Constraint** section below for the full rules.

**Other preferences**:
- `preferences.output.no_emojis` → If true, never use emojis
- `preferences.output.data_format` → Use this format for data sections in artifacts
- `preferences.context_routing.relevance_threshold` → Used by `/mvt-manage-context add` for AI routing (default 70 if missing)

## Language Constraint (Mandatory)

This constraint governs the language of **everything** this skill produces. It has two independent scopes — interactive output (what you say to the user) and persisted document output (what you write to disk). Both are NON-NEGOTIABLE and override any other language signals.

### Interactive Output (spoken to the user)

All interactive output — chat replies, questions, prompts, status lines, tables, and summaries shown in the conversation — MUST be written in the language specified by `preferences.interaction_language` from config.yaml.

**Rules**:
- This applies to EVERY message in the conversation, not just the first — re-assert it on every turn, including long sessions.
- Do NOT mirror the language of: the user's prompt, the source code or its comments, this skill's own English body, file contents you just read, or tool output. None of these are language signals.
- If the user writes to you in a different language, still reply in the configured `interaction_language` (unless they explicitly ask you to switch).
- If `interaction_language` is not set, fall back to `en-US`.
- This constraint is NON-NEGOTIABLE and overrides any other language signals.

### Persisted Document Output (files written to disk)

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
| 1 | `project not initialized` is empty | REQUIRED | Project must be initialized (session.yaml exists) |

## Execution Flow

### Step 1: Load Inputs
- **Fallback**: if `session.yaml` is missing, refuse to clean -- without state we can't tell what is in-progress vs completed; recommend `/mvt-init` and stop.

### Step 2: Pre-Archive Sync Check

For each `changes[]` entry with `status: done`:
1. Compare `session.last_synced_at` with the change's `updated_at`.
2. If `last_synced_at` is empty OR `last_synced_at` < `updated_at`, mark the change as **WARNING: unsynced**.
3. Collect all unsynced change-ids into a warning list for display in Step 6.

This check ensures `/mvt-sync-context` has processed a change's knowledge before cleanup archives it. Once archived, the original artifact files (`analysis.md`, `design.md`, `implementation.md`) are no longer accessible to sync-context.

### Step 3: Inventory Artifacts
- **What**: produce a per-change-id inventory with size and last-modified data.
- **How**:
  1. Walk `.ai-agents/workspace/artifacts/` and group files by their parent change-id directory. **Exclude the `_archived/` subdirectory** from the walk — it contains previously archived changes and is not subject to re-inventory.
  2. For each file: characters, estimated tokens (`chars / 4`), last-modified (mtime).
  3. For each change-id directory, sum tokens and file count.
  4. Mark each change-id as `active | in-recent-changes | unindexed | legacy-pattern`:
     - `active` if it matches `session.active_change.id`.
     - `in-recent-changes` if it appears in `session.changes[]` (any status).
     - `unindexed` if neither condition holds and it sits under `artifacts/`.
     - `legacy-pattern` if the directory is `knowledge/patterns/` or matches other legacy markers.

### Step 4: Apply Cleanup Rules
- **What**: compute Cleanup Candidates from the inventory.
- **How**: run the rules table below. A single change-id may match multiple rows; collect all proposed actions.

  | Source | Rule | Proposed action |
  |--------|------|-----------------|
  | `changes[]` entry with `status: done` AND any task in plan is older than the active change's start | Summarize: generate a `summary.md` from the change's artifacts, then move the **entire** `artifacts/{id}/` directory (including `summary.md`) to `artifacts/_archived/{id}/` |
  | `changes[]` entry with `status: done` AND `epic_id` non-empty AND parent epic status is NOT `done` | **Epic integrity warning**: mark the candidate as `epic-unsafe` -- archiving a sub-change whose parent epic is still in-progress may leave the epic in an inconsistent state. Default to `n` (skip) in the cleanup plan. User may override to force-archive. |
  | Artifact directory under `artifacts/` whose id starts with `epic-` AND contains `epic.yaml` with `status: done` | **Batch archive candidate**: mark for batch suggestion in Step 7 -- read `epic.yaml.children[]` for child change-ids to offer as batch archive options alongside the epic |
  | Change-id directory marked `unindexed` | List for user review (do NOT auto-archive -- could be in-flight work the user just hasn't registered) |
  | `history` entries beyond the most recent N (from `config.yaml > preferences.history_limits.history`, default 20) | Truncate via `session-update.cjs --truncate-history <N>` |
  | Directory `knowledge/patterns/` exists | Flag for deletion (legacy pattern data; no replacement) |
  | Empty change-id directories (zero files inside) | Propose deletion of the directory itself |

- For each candidate, compute: `current size (tokens)` -> `projected size (tokens)`, expected savings.

### Step 5: Present Cleanup Plan
- Render the plan as a table:

  | Item | Category | Current Size | Action | Result |
  |------|----------|-------------|--------|--------|
  | {change-id or path} | {completed | unindexed | stale-history | legacy} | ~{tokens} | {summarize | archive | review-only | delete} | ~{reduced tokens} |
  | **Total** | | **{total}** | | **{new_total} ({savings} saved)** |

- Below the table, list any items marked `review-only` (unindexed) with a one-line note: user must decide manually.
- If `--dry-run` is set, STOP here. Print "(dry run -- no changes applied)" and exit cleanly.

### Step 6: Confirm Before Destructive Steps
- **Always require confirmation** if the plan includes any of:
  - File deletion (legacy patterns, empty dirs).
  - `summarize` action (collapses multi-file content).
  - `archive` action (moves entire change-id directory into `artifacts/_archived/`).
- If the Step 2 warning list is non-empty, prepend it to the confirmation prompt:
  > WARNING: The following changes have NOT been synced by `/mvt-sync-context`. Archiving them will permanently lose their knowledge for aggregation:
  > - {change-id}: {title}
  > Options: `y` = archive anyway, `n` = cancel, `sync-first` = abort and run `/mvt-sync-context` first, `show-details` = per-file breakdown.
- If no unsynced warnings, use the standard prompt: `Apply cleanup plan? (y / n / show-details)`. `show-details` prints the per-file actions, then re-asks.
- User chooses `sync-first` → stop cleanup, print "Run `/mvt-sync-context` first, then re-run `/mvt-cleanup`." and exit.
- Do NOT silently delete. Do NOT skip confirmation when `--dry-run` is absent.

### Step 7: Execute the Plan
- **What**: apply the confirmed actions.
- **How**:
  1. **Summarize action**: read the full set of files in the change-id directory; produce a `summary.md` with: title, change-id, status, key decisions (list each ADR/decision title), final outcomes, list of original files. Write `summary.md` into the change-id directory, then move the **entire** `artifacts/{id}/` directory to `artifacts/_archived/{id}/` (summary.md travels with it).
  2. **Archive action** (no summarize): move the **entire** `artifacts/{id}/` directory to `artifacts/_archived/{id}/`. No internal path restructuring needed.
  2a. **Batch archive action** (epic with children): when archiving a completed epic (the change-id is an epic directory containing `epic.yaml` with `status: done`), read `epic.yaml.children` and present the user with three options before proceeding:

       | Option | Description |
       |--------|-------------|
       | Epic only | Archive only the epic directory (leave child change directories in place) |
       | All children | Archive the epic directory AND move all child change directories (`artifacts/{child_id}/`) to `artifacts/_archived/{child_id}/` |
       | Selective | User picks which children to include alongside the epic |

     Per ADR-8: archive = abandon references; no post-archive `epic_id` integrity maintenance. Child changes that are also `status: done` are eligible for batch archiving; in-progress or pending children are excluded with a note.

  3. **Delete action**: remove only the items explicitly marked for deletion in the confirmed plan; never recurse beyond what was listed.
  4. **Stale history truncation**: call `session-update.cjs --truncate-history <N>` where N is from `config.yaml > preferences.history_limits.history` (default 20).
  5. All file mutations atomic where possible (write-temp + rename, copy-then-delete for moves).
  6. If any single action fails, STOP further actions; report what completed, what failed, and leave a recoverable state (do not partially overwrite a file with truncated content).

### Step 8: Report Result
- Print the actually-applied actions (may differ from the plan if Step 7 stopped early).
- Show new totals: files cleaned, tokens saved.
- Recommend `/mvt-check-context` to validate the post-cleanup state if savings exceed ~5k tokens.

### Step 9: Session Update Parameter Selection

Based on the actual cleanup actions performed, choose the appropriate session-update parameter combination:

| Actual cleanup action | session-update parameters |
|----------------------|---------------------------|
| Closed `active_change` (all plan tasks completed) | `--close-change --truncate-history <N>` |
| Only truncated history / archived old changes (active_change still in progress) | `--truncate-history <N>` (**do NOT** pass `--close-change`) |
| `--dry-run` mode (no modifications made) | **Do NOT call** session-update script; only record history |

N is read from `config.yaml > preferences.history_limits.history` (default 20).

### Step 10: State Update
Apply the State Update rules defined in the **State Update** section below.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| `active_change.id` directory matches a "stale completed" rule | Skip cleanup of the active change; never archive in-progress work |
| `--dry-run` set | Stop after Step 5; do not request confirmation; do not modify any file |
| Plan would archive ALL artifacts (workspace becomes empty) | Require an extra confirmation: `This will archive every artifact. Continue? (y/n)` |
| User aborts at Step 6 confirmation | Report "no changes applied" |
| `artifacts/_archived/{id}/` already exists from a prior run | Preserve existing content; merge or skip with a note — do not overwrite |
| File targeted for action no longer exists (concurrent removal) | Skip with a note; do not error out the whole run |
| Unindexed change-id directory contains only `plan.yaml` | List as review-only; suggest user runs `/mvt-update-plan` or registers it via `/mvt-plan-dev` instead of cleaning |
| `session.yaml.bak` present from a previous failed run | Overwrite during Step 7 collapse (only the most recent backup is useful) |
| Change with `epic_id` is a cleanup candidate but parent epic is still `in_progress` | Mark as `epic-unsafe`; default to skip. User may override to force-archive. Warn: "This change belongs to in-progress epic '{title}'. Archiving it separately may leave the epic in an inconsistent state." |
| Epic directory marked for batch archive but `epic.yaml` is missing or unreadable | Skip batch suggestion; treat as a regular archive candidate |
| Batch archive includes a child that is still `in_progress` | Exclude that child from the batch with a note: "Child {id} is in_progress and cannot be archived." |

## State Update

After completing the skill's main task, run the session update script **exactly once** with the following arguments:

```bash
node .ai-agents/scripts/session-update.cjs --skill <skill_command_name> --summary "<concise one-line summary>" --close-change --truncate-history <count>
```

If the script exits with code 0, the state update was applied successfully; there is no need to read or verify the session file.

### Argument values

| Argument | Value source | Example |
|----------|-------------|---------|
| `--skill` | The exact skill command name without the leading `/` | `mvt-cleanup` |
| `--summary` | A concise one-line description of what this invocation accomplished, in the configured `interaction_language` | `"Identified auth requirements and created change chg-001"` |
| `--close-change` | Flag only, no value. Snapshots `active_change` into `changes[]` with `status: done`, then clears `active_change`. | — |
| `--truncate-history` | Number of most recent history entries to keep (read from `config.yaml > preferences.history_limits.history`, default 20); older entries are discarded. | `20` |

### Parameter semantics

| Argument | When to use | Effect on `session.yaml` |
|----------|-------------|--------------------------|
| `--close-change` | All plan tasks are completed | Snapshots `active_change` into `changes[]` with `status: done`, then clears all `active_change` fields. |
| `--truncate-history` | Maintenance: trim old history entries | Keeps the most recent N entries in `history[]`, discards older ones. |

### Failure handling

If the script fails (non-zero exit), do NOT abort the skill's main task. Continue execution and add a brief note at the end of your response that the session could not be updated.

## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`mvt-cleanup`) and the current project state.
**Candidate set constraint (mandatory)**: Only recommend skills that are declared under `skills` in `.ai-agents/registry.yaml`.

### Conditional Recommendations

Match the current state to one of the conditions below. If none match, use `default`.

- **`cleanup freed significant tokens`** → `/mvt-check-context` -- Validate post-cleanup context health
- **`active change still in progress`** → `/mvt-resume` -- Resume work on the active change
- **`no active changes remain`** → `/mvt-analyze` -- Start a new feature

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
