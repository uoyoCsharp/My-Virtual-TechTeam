---
name: 'mvt-check-context'
description: 'Analyze context token load and provide optimization recommendations. This skill should be used when user wants to check how much context MVTT loads, identify large files, or optimize workspace size for better performance.'
---

# MVT Context Check

## Purpose

Analyze the total context information that MVTT loads at runtime, estimate token consumption, assess health status, and provide actionable optimization recommendations.

## Role

You are the **Conductor** -- a Workflow Coordinator.

### Decision Rules
- Total tokens <= 12,000 -> Report as "Healthy"
- Total tokens 12,001-25,000 -> Report as "Borderline", suggest optimizations
- Total tokens > 25,000 -> Report as "Oversized", strongly recommend cleanup

### Boundaries
- Do NOT modify any files (use `(Only analyze and recommend)` instead)
- Do NOT clean up artifacts (use `/mvt-cleanup` instead)
- Do NOT modify context (use `/mvt-manage-context` instead)

## Activation Protocol

### Step 1: Load Context
Load these files as foundational context:
- `.ai-agents/workspace/project-context.yaml` -- Project index (structural info)
- `.ai-agents/registry.yaml` -- Available skills registry and knowledge declarations

Extended context for this skill:
- .ai-agents/config.yaml -- Framework configuration (to be scanned for size)

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

### Step 4: Pre-flight Checks
- No blocking checks required.

## Execution Flow

### Step 1: Load Inputs
- **Recommended**:
  - `.ai-agents/knowledge/core/manifest.yaml` -- to filter `core/_framework/` (excluded) from `core/user/` (in-scope).
- **Fallback**: missing `core/manifest.yaml` -> treat all `core/*` files as user-origin (over-counts; flag in report).

### Step 2: Determine In-Scope Files
This skill measures only files the **user** can reduce or relocate. Framework-fixed overhead is excluded.

**In scope (user-actionable):**
- Index: `.ai-agents/workspace/project-context.yaml`.
- Semantic context: `.ai-agents/knowledge/project/_generated/project-context.md` (always the flat path, regardless of project count).
- Shared knowledge: every entry in `registry.yaml > knowledge._all` and `knowledge.{projectName}` (map-aware -- traverse ALL project keys in the knowledge map). For the `core` entry, scan only files marked as user-origin per `core/manifest.yaml` (or whose path begins with `user/`); skip files under `core/_framework/`.
- Per-skill knowledge: every entry in `registry.yaml > skills.*.knowledge._all` and `skills.*.knowledge.{projectName}` (map-aware -- traverse ALL project keys for each skill), grouped by skill.
- Artifacts: all files under `.ai-agents/workspace/artifacts/` recursively. **Exclude the `_archived/` subdirectory** — it contains completed changes archived by `/mvt-cleanup` and should not count toward the active workspace token budget.

**Out of scope (do NOT scan):**
- `.claude/skills/mvt-*/SKILL.md` -- framework-shipped, not user-editable.
- `.ai-agents/knowledge/core/_framework/**` -- framework-shipped.
- `.ai-agents/config.yaml`, `.ai-agents/workspace/session.yaml`, `.ai-agents/registry.yaml` -- small, required, and addressed via `/mvt-config` or `/mvt-manage-context`, not here.

### Step 3: Estimate Token Consumption
- **What**: produce a per-file tokens estimate and per-category subtotals, with **per-project breakdown**.
- **How**:
  1. For each in-scope file: tokens ~= `characters / 4`.
  2. Group by category: `Index`, `Semantic Context`, `Shared Knowledge`, `Per-Skill Knowledge`, `Artifacts`.
  3. For Shared Knowledge, compute total once -- this is per-skill overhead (loaded by every skill invocation).
  4. For Per-Skill Knowledge, compute totals per skill so users can see which skill is heaviest.
  5. Identify the Top 5 largest single files across the whole in-scope set.
  6. **Per-project breakdown**: for multi-project workspaces, also compute token costs per project:
     - `knowledge._all` = shared across all projects
     - `knowledge.{projectName}` = project-specific overhead
     - `skills.*.knowledge.{projectName}` = per-skill per-project overhead
     Display as a separate table: `project | knowledge tokens | per-skill tokens | total`.
  7. **Global summary**: total tokens across all projects + `_all` overhead loaded every time.

### Step 4: Apply Thresholds and Health Status
- **What**: assign each file/category a status of `healthy | borderline | oversized`.
- **How**: read thresholds from `.ai-agents/config.yaml > preferences.context_thresholds.*` if present; otherwise use the defaults below.

  | Subject | healthy | borderline | oversized |
  |---------|---------|------------|-----------|
  | Total in-scope tokens | <= 12000 | 12001-25000 | > 25000 |
  | Single file tokens | <= 3000 | 3001-6000 | > 6000 |
  | `project-context.md` tokens | <= 4000 | 4001-8000 | > 8000 |
  | Shared Knowledge total tokens | <= 6000 | 6001-12000 | > 12000 |
  | Single change-id artifacts directory tokens | <= 3000 | 3001-8000 | > 8000 |

- Overall workspace status = the worst status across all subjects above.

### Step 5: Generate Recommendations
- **What**: produce a list of specific, actionable recommendations. Each entry is `(trigger, message, suggested skill)`.
- **How**: walk the table; emit a recommendation for every row whose trigger fires.

  | Trigger | Message template | Suggested skill |
  |---------|------------------|-----------------|
  | `project-context.md` is `oversized` | "project-context.md is {N} tokens. Regenerate with leaner sections." | `/mvt-analyze-code` |
  | `project-context.md` is `borderline` AND last `/mvt-analyze-code` ran > 30 days ago | "project-context.md is {N} tokens and may be stale. Consider regenerating." | `/mvt-analyze-code` |
  | Total artifacts tokens > artifacts threshold OR > 3 completed changes still in `artifacts/` (excluding `_archived/`) | "Workspace has {N} tokens of historical artifacts. Archive completed changes." | `/mvt-cleanup` |
  | A specific change-id directory is `oversized` | "artifacts/{id} alone is {N} tokens. Summarize this change." | `/mvt-cleanup` |
  | Shared Knowledge total is `oversized` | "Shared knowledge totals {N} tokens (loaded by every skill). Move skill-specific entries to per-skill." | `/mvt-manage-context move` |
  | A single Shared Knowledge file is `oversized` | "{path} is {N} tokens. Split or move to per-skill." | `/mvt-manage-context move` |
  | Per-skill Knowledge entry exists in `registry.yaml` but its referenced files are missing | "{skill} declares knowledge `{id}` but `{path}` is missing." | `/mvt-manage-context remove` (or restore the file) |
  | A knowledge file exists on disk but no `registry.yaml` entry references it | "{path} is unused (not loaded by any skill)." | `/mvt-manage-context remove` |
  | Two knowledge entries reference identical content (same hash) | "{a} and {b} are duplicates. Consolidate." | manual edit |

- **Constraints on recommendations**:
  - Never recommend changes to framework files (`_framework/`, `mvt-*/SKILL.md`).
  - Never recommend deletion without an `/mvt-manage-context` or `/mvt-cleanup` command -- those skills own the actual mutation.
  - If no triggers fire, return a single line: "Workspace context is healthy ({N} tokens total)."

### Step 6: Generate Report
- Render the report in this order:
  1. **Summary** -- one line: total tokens + overall status.
  2. **Per-Category Breakdown** -- table: `category | files | tokens | status`.
  3. **Top 5 Largest Files** -- table: `path | tokens | category | status`.
  4. **Per-Skill Knowledge Cost** -- table: `skill | tokens` (sorted desc); include shared knowledge as a separate row labeled `(shared, loaded every time)`.
  5. **Per-Project Token Accounting** -- table: `project | knowledge tokens | per-skill tokens | total` (only for multi-project workspaces; for single-project, omit this section).
  6. **Recommendations** -- numbered list from Step 5; if empty, render the healthy line.
  7. **Excluded Scope Note** -- one paragraph reminding the user that framework files (`_framework/`, `mvt-*/SKILL.md`, `config.yaml`, `session.yaml`, `registry.yaml`) were not measured here.
- The report is conversation output; this skill does NOT write any artifact.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| `registry.yaml` references a knowledge id whose source path is empty / missing | Include in Step 5 recommendations; do NOT count missing files toward token totals |
| `core/manifest.yaml` cannot be parsed | Treat the whole `core/` tree as in-scope (over-counts); add a note in the report |
| Workspace has zero artifacts | Skip the artifacts category in Step 6; do not error |
| Workspace exceeds the artifacts threshold AND the user just ran `/mvt-cleanup` (within last hour per `history`) | Surface but downgrade to a one-line note ("recently cleaned -- remaining {N} tokens are likely active work") |
| User passes a path argument | This skill ignores arguments; print a one-line note and run as normal (do not narrow scope to a single file -- that is `/mvt-status` territory) |
| Token estimate disagrees with model's actual consumption | This is expected; the `chars/4` heuristic is an approximation. State this caveat in the Summary line |
| Two skills declare the same knowledge id | Count the file once for storage but report it under both skills in the Per-Skill table; flag the duplication in Step 5 |

## State Update

This skill is read-only and does NOT modify `.ai-agents/workspace/session.yaml`.

## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`mvt-check-context`) and the current project state.

### Conditional Recommendations

Match the current state to one of the conditions below. If none match, use `default`.

- **`context oversized or borderline`** → `/mvt-cleanup` -- Archive old artifacts to reduce context
  - Or `/mvt-manage-context` -- Move per-skill knowledge to reduce shared load
- **`context healthy`** → `/mvt-status` -- Check overall project status

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
