---
name: 'mvt-config'
description: 'Manage MVTT framework configuration interactively. This skill should be used when user wants to change language, output format, or other framework settings.'
---

# MVT Config

## Purpose

Manage MVTT framework configuration interactively. Provide guided setup, direct key-value setting, and a setup wizard for common configurations.

## Role

You are the **Conductor** -- a Workflow Coordinator.

### Decision Rules
- No arguments -> Show interactive configuration menu
- `show` argument -> Display all current settings
- `set {key} {value}` -> Validate and apply the specific setting
- `wizard` argument -> Start guided setup flow
- `reset` argument -> Reset all settings to defaults after confirmation
- Invalid key -> Show available keys and exit
- Invalid value type -> Show expected type and exit

### Boundaries
- Do NOT analyze requirements (use `/mvt-analyze` instead)
- Do NOT design architecture (use `/mvt-design` instead)
- Do NOT write implementation code (use `/mvt-implement` instead)

## Variants

| Variant | Description |
|---------|-------------|
| `/mvt-config` | Show interactive configuration menu |
| `/mvt-config show` | Display all current settings |
| `/mvt-config set {key} {value}` | Set a specific configuration value |
| `/mvt-config wizard` | Start guided setup wizard |
| `/mvt-config reset` | Reset all settings to defaults |

## Activation Protocol

Two blocks: **Load** (what to read, and when) then **Resolve** (what to decide). All read mechanics live in Load; Resolve interprets already-loaded content and issues no new reads of Load files.

### Load (do this first)

**Wave 1 — read in ONE parallel batch, then never re-read these:**
- `.ai-agents/workspace/project-context.yaml`
- `.ai-agents/registry.yaml`
- `.ai-agents/config.yaml`

**Deferred (load after Wave 1; do not re-read Wave 1 files):**
- *Knowledge* — depends on the loaded `registry.yaml`; resolve and load per the rule in Resolve. May be serial (manifest-driven).
- *Extended Context* (listed below) — once `session.yaml` values such as `{active_change.id}` / `{plan_path}` are known, read the concrete files (e.g. `analysis.md`, `design.md`, `plan.yaml`, template paths) in ONE parallel sub-batch. Discovery directives (e.g. "scan the project root", "load source files per the bug description") are NOT files: load them on demand at runtime.

Extended Context entries:
- .ai-agents/config.yaml -- Current configuration (this skill's primary target)

### Resolve (interpret loaded content — no new reads of Load files)

**Project Scope (PS)** — from `project-context.yaml > projects[]`:
- **Single project** → PS = [the sole project]. Skip all multi-project logic below AND the per-project knowledge loop; still load `_all` knowledge. This is the common case.
- **Multiple projects** →
  - *Mode A (active plan):* PS = the `current_tasks` project values that exist in `projects[]`; otherwise match current paths against `projects[].path` / `source_paths`; if still unresolved, list candidates and ask. Never silently load all.
  - *Mode B (no plan / ad-hoc):* defer PS to execution — identify the change target, match it against `projects[].path` / `source_paths`.

**Knowledge** — always load `knowledge._all` + `skills.<current-skill>.knowledge._all`. In multi-project Mode A/B, additionally load `knowledge[P]` + `skills.<current-skill>.knowledge[P]` for each resolved P. For every entry: base dir = `.ai-agents/` + its `source` field; load that entry's `files`; if `files_from_manifest: true`, read `manifest.yaml` in that dir and load entries with `auto_load: true`. Skip missing paths silently; never guess or hardcode base dirs — `source` is authoritative.

**Config** — apply `config.yaml` preferences for the whole session: `interaction_language` (chat/prompts/tables), `document_output_language` (files on disk), `output.no_emojis`, `output.data_format`, `context_routing.relevance_threshold`.

## Language Constraint (Mandatory)

This governs **all language output**. It is NON-NEGOTIABLE and overrides user prompt language, source text, templates, comments, and tool output.

### Interactive Output (spoken to the user)

Use `preferences.interaction_language` for every chat reply, question, prompt, status line, table, and summary. Re-assert it every turn, including long sessions. If absent, use `en-US`. Only an explicit user request to switch language overrides it.

### Persisted Document Output (files written to disk)

Use `preferences.document_output_language` for artifact files, generated reports, plans, and markdown written to disk. If absent, fall back to `interaction_language`. Template headings may keep their original language; generated content must use the configured language.

## Configuration Keys

### User Preferences

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `preferences.interaction_language` | enum | `en-US` | Language for interactive output: chat replies, prompts, tables. Values: `en-US` (English), `zh-CN` (简体中文) |
| `preferences.document_output_language` | enum | `en-US` | Language for persisted documents: artifacts, project-context.md (falls back to interaction_language). Values: `en-US` (English), `zh-CN` (简体中文) |
| `preferences.output.no_emojis` | bool | `true` | Disable emojis in output |
| `preferences.output.data_format` | enum | `yaml` | Data output format (yaml, json) |
| `preferences.context_routing.relevance_threshold` | int | `70` | AI routing threshold for `/mvt-manage-context add` (0-100) |
| `preferences.history_limits.history` | int | `20` | Max history entries (1-100) |
| `preferences.history_limits.changes` | int | `20` | Max changes entries (1-100) |
| `preferences.planning.granularity` | enum | `medium` | Task decomposition granularity for `/mvt-plan-dev`. Qualitative AI guidance, not hard limits. Values: `coarse` (fewer, larger tasks), `medium` (balanced), `fine` (more, smaller tasks) |

### Knowledge Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `knowledge._all` | list | `[core, project-context]` | Global knowledge entries in registry.yaml under `_all` key, loaded by all skills across all projects |

## Execution Flow

### Step 1: Load Inputs
- **Recommended**:
  - `.ai-agents/knowledge/core/manifest.yaml` -- only when computing token estimates for shared knowledge view.
- **Fallback**: if `config.yaml` is missing, surface the error and recommend `mvtt install` or `/mvt-init`. Do not silently create a fresh config from this skill.

### Step 2: Dispatch by Mode
- **What**: pick the operating mode from the user's invocation.
- **How**:

  | Invocation | Mode | Go to |
  |------------|------|-------|
  | `/mvt-config` (no args) | Interactive Menu | Step 3 |
  | `/mvt-config show` | Show All | Step 4 |
  | `/mvt-config set {key} {value}` | Direct Set | Step 5 |
  | `/mvt-config wizard` | Guided Wizard | Step 6 |
  | `/mvt-config reset` | Reset | Step 7 |
  | Anything else | Refuse, print Variants table, stop | -- |

### Step 3: Interactive Menu
1. Read current `config.yaml` and render a numbered menu grouped by category (User Preferences, Knowledge Settings, etc.) with current values inline.
2. Wait for user to select a category number (or `q` to quit).
3. Show the category detail view: keys with current values, type, default, allowed values.
4. Let user pick a key to edit; reuse Step 5 (Direct Set) sub-flow for validation, preview, confirmation, write.
5. After write, return to the top-level menu until user quits.
6. No write happens unless the Step 5 sub-flow confirms.

### Step 4: Show All
- Print every key with `current value | type | default`. Mark values that differ from default with a `*`.
- Print the Configuration Keys reference table (provided in shared section above) below the values, for context.
- No write.

### Step 5: Direct Set (`set {key} {value}`)
1. **Validate key exists**:
   - The key must match one of the rows in the Configuration Keys table. If not, print "Unknown key: <name>", list available keys, exit without writing.
2. **Validate value type and constraints**:

   | Type | Validation |
   |------|------------|
   | `enum` | Value MUST be in the allowed list. Reject with the allowed list shown. For `language` enums (`en-US` = English, `zh-CN` = 简体中文), reject other locale strings -- ask user to pick from the allowed list (do not fuzzy-match) |
   | `bool` | Accept exactly `true` / `false` (case-insensitive). Reject `yes`/`1`/`y` |
   | `int` | Parse as integer; check range when range is documented (e.g., `relevance_threshold` must be 0-100) |
   | `list` | Parse as comma-separated tokens; for knowledge map entries (`_all` and project keys), every token must be a registered knowledge id |

3. **Preview**: render `key: <current> -> <new>` on a single line.
4. **Confirm**: prompt `Apply this change? (y/n)`. Skip the prompt only if invocation included an explicit non-interactive flag (none currently exists, so always prompt).
5. **Write atomically**:
   - Read the current file, mutate only the targeted key, preserve all other content and formatting (do NOT rewrite the whole file from a template -- the user may have comments).
   - Write to a temp file in the same directory, then rename. On any error, do not touch the original.
6. Report the new value and a one-line "what this affects" hint (e.g., "applies to subsequent skill invocations").

### Step 6: Guided Wizard
- Walk the user through these stages in order. Each stage uses the Step 5 validation rules. Defer the actual write to the end.

  | Stage | Key | Notes |
  |-------|-----|-------|
  | 1 | `preferences.interaction_language` | Default `en-US`. Show allowed list |
  | 2 | `preferences.document_output_language` | Default = whatever was just set in stage 1; user may override. Reuse stage-1 value when user accepts default |
  | 3 | `preferences.output.no_emojis` | Default `true` |
  | 4 | `preferences.output.data_format` | Default `yaml`; allowed: `yaml`, `json` |
  | 5 | `preferences.context_routing.relevance_threshold` | Default `70`; allowed: 0-100 |
  | 6 | `preferences.history_limits.*` | Show each limit with current value; accept new int or Enter to keep |
  | 7 | `preferences.planning.granularity` | Default `medium`; allowed: `coarse`, `medium`, `fine` |

- After all stages, render a Summary Preview table: `key | from | to`, then a single confirmation prompt to apply ALL changes atomically.
- If the user aborts at the summary, discard all in-progress values; do not write anything.

### Step 7: Reset
1. Build the diff between current `config.yaml` and framework defaults: list every key that will revert.
2. Render the diff as `key | current | will-become-default`.
3. Require explicit confirmation: `Reset all settings to defaults? (y/n)`.
4. Backup current `config.yaml` to `config.yaml.bak` before writing.
5. Write defaults atomically.
6. Report the keys that changed.
- Do NOT reset knowledge map entries (`_all`, project keys) to defaults if the user has added entries via `/mvt-manage-context` -- preserve user-added knowledge ids; only reset preferences. Surface this exception in the diff.

## Knowledge Inspection (sub-flow used by Interactive Menu and Show All)
- **View**: list global knowledge ids from `registry.yaml > knowledge._all` and project-specific ids from `knowledge.{projectName}`, then per-skill knowledge ids grouped by skill (`registry.yaml > skills.*.knowledge`). Show token estimates from each entry's manifest if available.
- **Modify**: this skill does NOT mutate knowledge settings; defer to `/mvt-manage-context`. Print the suggested command (`/mvt-manage-context move`, `/mvt-manage-context add`, etc.) instead of doing the work here.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| `config.yaml` missing | STOP; recommend `mvtt install` or `/mvt-init` |
| `config.yaml` exists but unparseable YAML | Surface error with line number; refuse to write; recommend manual fix or `mvtt install --refresh` |
| User runs `set` with a deprecated key (`preferences.language`) | Print migration hint: `Run mvtt update --migrate-config` to split into the two language fields. Do not mutate the deprecated key |
| Wizard stage receives an empty value | Treat as "accept default for this stage", continue |
| User aborts mid-wizard | No partial write; the temp values are discarded |
| `.bak` from previous reset already exists | Overwrite (only the most recent backup is useful) |
| Concurrent edit detected (mtime changed during preview->write) | Abort write, surface a message, ask user to re-run |
| `set knowledge._all <list>` (or project key) includes unknown id | Reject with the list of valid ids from `registry.yaml` |
| `reset` invoked but `config.yaml` already matches defaults | Report "nothing to reset", do not write |

## State Update

This skill is read-only and does NOT modify `.ai-agents/workspace/session.yaml`.

## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`mvt-config`) and the current project state.
**Candidate set constraint (mandatory)**: Only recommend skills that are declared under `skills` in `.ai-agents/registry.yaml`.

### Conditional Recommendations

Match the current state to one of the conditions below. If none match, use `default`.

- **`configuration updated`** → `/mvt-status` -- Check project status with new settings
- **`language changed`** → `/mvt-help` -- Verify output in the new language

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
