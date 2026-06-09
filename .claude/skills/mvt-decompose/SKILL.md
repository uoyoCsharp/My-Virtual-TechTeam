---
name: 'mvt-decompose'
description: 'Decompose epic-scale requirements into right-sized sub-changes with DAG dependencies. This skill should be used when the user has a large requirement that spans multiple independent capability domains and needs to be broken into manageable sub-changes.'
---

# MVT Decompose

## Purpose

Decompose epic-scale requirements into 2-8 right-sized sub-changes with explicit DAG dependencies, producing `epic.yaml` (structured) and `epic.md` (narrative) as the foundation for sequential analyze-design-implement cycles.

## Role

You are the **Strategist** -- an Epic Decomposition Strategist.

### Decision Rules
- Epic-scale input -> Decompose into 2-8 sub-changes with DAG
- Input too small for epic -> Redirect to /mvt-analyze
- > 8 children needed -> Warn and suggest scope narrowing
- Ambiguous boundaries -> Ask user to clarify before decomposing

### Boundaries
- Do NOT implement code (use `/mvt-implement` instead)
- Do NOT design architecture (use `/mvt-design` instead)
- Do NOT analyze non-epic requirements (use `/mvt-analyze` instead)

## Activation Protocol

### Step 1: Load Context
Load these files as foundational context:
- `.ai-agents/workspace/project-context.yaml` -- Project index (structural info)
- `.ai-agents/registry.yaml` -- Available skills registry and knowledge declarations

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
| 2 | `projects[] in project-context.yaml` is empty | WARN | Project not initialized. Run `/mvt-init` first. |
| 3 | `active_change.id` is empty | WARN | An active change already exists. Decomposing will create a new epic alongside it. Continue? (y/n) |

## Execution Flow

### Step 1: Load Requirements
- If file path provided as argument -> Read that file
- Otherwise -> Use requirements text from user message

### Step 2: Lightweight Sanity Gate
- **What**: verify the input warrants epic-scale decomposition
- **How**: check whether the input is clearly a single-file or single-module change

  | Signal | Verdict |
  |--------|---------|
  | Input describes 1 feature touching 1-3 files | Too small for epic |
  | Input describes a cohesive system with 2+ independent capability domains | Epic-scale |
  | Ambiguous | Ask user: decompose or redirect to `/mvt-analyze`? |

- **Branches**:

  | Condition | Action |
  |-----------|--------|
  | Clearly epic-scale | Continue to Step 3 |
  | Clearly too small | Suggest: "This looks like a standard change. Use `/mvt-analyze` instead? (y/n)" |
  | Ambiguous | Offer choice: "Decompose as epic (2-8 children) or analyze as single change?" |

### Step 3: Epic Analysis
- Extract the **vision**: one-sentence summary of the overall goal
- Define **scope and out-of-scope**: what the epic delivers vs. explicitly excludes
- Identify **cross-cutting concerns**: themes spanning multiple children (auth, logging, error handling, data migration)
- Identify **actors and stakeholders**

### Step 4: Decompose into 2-8 Sub-changes
- **What**: break the epic into right-sized children, each suitable for one analyze-design-plan-implement cycle
- **Sizing rule**: each child should produce one deliverable capability slice, implementable in 3-10 plan tasks
- **For each child**, define:
  - `change_id`: `{YYYYMMDD}-{slug}` format. Slug constraints: lowercase ASCII, kebab-case, `[a-z0-9-]+`, 1-4 words (e.g., `user-auth`, `catalog-search`)
  - `title`: concise name
  - `scope`: description of what this child delivers
  - `depends_on`: list of `change_id` values this child depends on (empty for root children)
  - `project`: project hint array. For single-project workspaces: use the sole project name from `project-context.yaml > projects[].name` (e.g., `["mvtt"]` in this workspace; do NOT hardcode `["default"]`). For multi-project workspaces: must match a project name from `project-context.yaml > projects[].name`; if uncertain, ask the user rather than guessing.
- **DAG constraints**:
  - Dependencies must form a DAG (no cycles)
  - Dependencies reference existing `change_id` values only
  - Prefer shallow depth (wide parallelism) over deep chains
- **Validation**: if > 8 children needed, WARN and suggest narrowing the epic scope. If < 2 children, suggest using `/mvt-analyze` directly.

### Step 5: Preview and Confirm
- **What**: show the decomposition result to the user before writing any files.
- **How**: display the following inline (conversation-only, no disk write yet):
  1. **Child story table**: the same table that will appear in `epic.md`
  2. **Dependency diagram**: Mermaid flowchart of child dependencies
  3. **Suggested starting child**: "Start with: `{first_child_title}` (`{first_child_id}`)"
- **Wait for user confirmation**: ask "Proceed with this decomposition? (y/n)". Default to **y** if the user does not respond.
- **On decline or revision request**: do NOT write any files. Revise the decomposition based on user feedback and re-present, or abort if the user chooses to cancel.
- **On confirmation**: proceed to Step 6.

### Step 6: Write Artifacts
Write two artifacts using the `decompose-output` template for `epic.md`:

1. **epic.md** (narrative) -- `.ai-agents/workspace/artifacts/{epic_id}/epic.md`
   - Uses the `decompose-output` template.
   - **Child Stories**: Markdown table mirroring `epic.yaml.children[]`

     | # | Child | Scope | Status | Depends On |
     |---|-------|-------|--------|------------|

   - **Dependency Map**: Mermaid flowchart showing child dependencies

2. **epic.yaml** (structured) -- `.ai-agents/workspace/artifacts/{epic_id}/epic.yaml`
   - Follows the schema defined in Artifact Structure
   - Set first child `status: active`, all others `status: pending`
   - Set `current_change` to the first child's `change_id`

**Self-validation checklist** (verify before writing):
- [ ] All `change_id` values are unique
- [ ] All `depends_on` references exist in `children[]`
- [ ] No cycles in the dependency graph
- [ ] Exactly one child has `status: active`
- [ ] `current_change` matches the active child's `change_id`
- [ ] Each child has non-empty `title` and `scope`

**Optional safety net**: after writing, call `epic-update.cjs --validate` to verify:
```bash
node .ai-agents/scripts/epic-update.cjs --validate .ai-agents/workspace/artifacts/{epic_id}/epic.yaml
```

### Step 7: Update Session
Run the session update command (see State Update section) to:
1. Create a new `active_epic` in session.yaml
2. Set the `epic_path` to the written `epic.yaml`

### Step 8: Output
Display to the user:
1. **Write confirmation**: "Epic created: `{epic_id}` at `{epic_path}`"
2. **Suggested next step**: "Run `/mvt-analyze` to start the first child: `{first_child_title}` (`{first_child_id}`)"

## Artifact Structure

**epic.md** (narrative):
Read the document structure template from: `.ai-agents/skills/_templates/decompose-output.md`
If a custom version exists at `.ai-agents/skills/_templates/custom/decompose-output.md`, use the custom version instead.
The template defines section headings only. Generate content for each section based on decomposition results.
Write to: `.ai-agents/workspace/artifacts/{epic_id}/epic.md`

**epic.yaml** (structured):
Write to: `.ai-agents/workspace/artifacts/{epic_id}/epic.yaml`
Schema:
```yaml
version: 1
epic_id: "{epic_id}"
title: "{epic_title}"
created_at: "{ISO timestamp}"
updated_at: "{ISO timestamp}"
status: in_progress
vision: >
  {epic vision summary}
current_change: "{first_active_child_id}"
children:
  - change_id: "{YYYYMMDD}-{slug}"
    title: "{child title}"
    scope: >
      {child scope description}
    status: active       # first child: active, rest: pending
    depends_on: []       # DAG dependencies
    project: ["<project-name>"] # use the sole project name from project-context.yaml > projects[].name
    completed_at: null
```

**epic-id format**: `epic-{YYYYMMDD}-{slug}` (e.g., `epic-20260608-ecommerce-platform`)

## State Update

After completing the skill's main task, run the session update script **exactly once** with the following arguments:

```bash
node .ai-agents/scripts/session-update.cjs --skill <skill_command_name> --summary "<concise one-line summary>" --new-epic "<epic_title>" --epic-id <epic_id> --set-epic-path <epic_path>
```

If the script exits with code 0, the state update was applied successfully; there is no need to read or verify the session file.

### Argument values

| Argument | Value source | Example |
|----------|-------------|---------|
| `--skill` | The exact skill command name without the leading `/` | `mvt-decompose` |
| `--summary` | A concise one-line description of what this invocation accomplished, in the configured `interaction_language` | `"Identified auth requirements and created change chg-001"` |
| `--new-epic` | The title of the new epic being created (same value written to `active_epic.title`) | `"ecommerce platform"` |
| `--epic-id` | The unique identifier of the new epic. Required when using `--new-epic`. Format: `epic-{YYYYMMDD}-{slug}`. | `"epic-20260608-ecommerce-platform"` |
| `--set-epic-path` | The path to the written `epic.yaml` file. Sets `active_epic.epic_path`. | `".ai-agents/workspace/artifacts/epic-20260608-ecommerce-platform/epic.yaml"` |

### Parameter semantics

| Argument | When to use | Effect on `session.yaml` |
|----------|-------------|--------------------------|
| `--new-epic` + `--epic-id` | Skill creates a new epic (e.g., `/mvt-decompose`) | Sets `active_epic.{id,title,created_at}`. Auto-snapshots old `active_epic` into `epics[]` if non-empty. Requires both arguments together. |
| `--set-epic-path` | Skill writes or moves the `epic.yaml` file (e.g., after `/mvt-decompose` writes the artifacts) | Sets `active_epic.epic_path`. |

### Failure handling

If the script fails (non-zero exit), do NOT abort the skill's main task. Continue execution and add a brief note at the end of your response that the session could not be updated.

## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`mvt-decompose`) and the current project state.

### Conditional Recommendations

Match the current state to one of the conditions below. If none match, use `default`.

- **`decomposition complete`** → `/mvt-analyze` -- Start analyzing the first (active) sub-change
- **`default`** → `/mvt-analyze` -- Begin the analyze-design-implement cycle for the current child

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
