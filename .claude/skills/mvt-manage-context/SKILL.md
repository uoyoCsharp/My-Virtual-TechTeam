---
name: 'mvt-manage-context'
description: 'Unified entry point for managing knowledge and registry. Supports subcommands: add (with AI routing), remove, move, rename, list. Use this skill instead of mvt-add-context.'
---

# MVT Manage Context

## Purpose

Unified CRUD entry point for project context and knowledge entries. Handles add (with AI-driven skill routing), remove, move, rename, and list operations across `project-context.yaml`, `project-context.md`, `knowledge/principle/`, `knowledge/project/`, `knowledge/core/user/`, and the corresponding `registry.yaml` / `core/manifest.yaml` references.

## Document Profile: project-context.md

Before writing to `project-context.md`, understand what this document IS and IS NOT.

### Identity
`project-context.md` is the project's **long-term semantic ground truth** -- a self-contained knowledge base consumed by AI skills to make decisions. It is NOT a copy of design documents, NOT a changelog, NOT an ADR index.

### Audience
The readers are AI skill instances (implementer, designer, tester, reviewer), NOT humans reading for reference. They use this document to make **binary decisions** (is this import legal? does this test cover this rule?) -- not to trace design rationale.

### Content Quality Standards
Every piece of content written into `project-context.md` must satisfy ALL of the following:

1. **Self-contained**: understandable without consulting any external document, artifact, or ADR.
2. **Actionable**: usable by an AI skill to make a yes/no decision or produce a concrete output (e.g., a test case).
3. **Atomic**: each item is independently meaningful -- not a fragment of a larger argument that only makes sense in its source document.
4. **Lean**: the token budget for this document is <= 4000 (healthy threshold). Content that does not directly serve a decision should be excluded.
5. **Stable**: only persist knowledge with long-term reference value. Transient state (change metadata, in-progress decisions, temporary workarounds) belongs in session.yaml or artifacts.

### Governing Principle (What Does NOT Belong)
**If a reader must consult an external document to understand an entry, that entry -- or its reference marker -- does not belong here.**

Strip any cross-reference marker (pointers to ADRs, design-document section numbers, internal rule labels, etc.). Remove only the *reference marker*, NEVER the *substantive content* it annotates.

- ✅ `idempotency key or exists-or-skip semantics (ADR-06, §12.4)` → `idempotency key or exists-or-skip semantics`
- ✅ `B-1: resume() degrades to rebuild on protocol error` → `resume() degrades to rebuild on protocol error`
- ❌ `Subscriber Idempotency Contract` -- this is the term itself, keep it.

> This profile applies ONLY when the target document is `project-context.md`. Other knowledge files (principle/, project/, core/user/, etc.) are not governed by it.

## Role

You are the **Conductor** -- a Knowledge Curator.

### Decision Rules
- User invokes without subcommand -> Show interactive menu of operations
- Add a knowledge file -> Run AI routing, suggest skill bindings, write file + update registry/manifest atomically
- Remove a knowledge entry -> Drop both the file and every registry/manifest reference, show diff
- Move binding (per-skill <-> shared <-> core) -> Update references and (if path changes) physically move the file
- Rename a knowledge id -> Update file path + every registry/manifest reference in lockstep
- List request -> Group entries by binding type and show which skills load each
- AI routing produces no candidate above threshold -> Recommend `none` (file-only) or prompt user to broaden scope

### Boundaries
- Do NOT analyze code automatically (use `/mvt-sync-context or /mvt-analyze-code` instead)
- Do NOT make architecture decisions (use `/mvt-design` instead)
- Do NOT write implementation code (use `/mvt-implement` instead)
- Do NOT edit framework knowledge under core/_framework/ (framework files are read-only) (use `(constraint)` instead)

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

## Execution Flow

### Step 1: Parse Subcommand

Detect the subcommand from the invocation:

| Invocation | Subcommand |
|------------|-----------|
| `/mvt-manage-context` | interactive menu (prompt user to pick add / remove / move / rename / list) |
| `/mvt-manage-context add` | add |
| `/mvt-manage-context remove [id]` | remove |
| `/mvt-manage-context move [id]` | move |
| `/mvt-manage-context rename [id]` | rename |
| `/mvt-manage-context list` | list |

For interactive menu, present the five options and wait for user choice, then enter that flow.

### Step 2: Subcommand Routing

Switch to the matching section below.

### Map-Aware Knowledge Structure

The registry uses project-keyed knowledge maps. Every knowledge block (top-level `knowledge` and each `skills.<name>.knowledge`) is a map where keys are project names or the reserved `_all` key (all projects). All subcommands must operate on this map structure.

**Two-question routing table (add subcommand)**:

| Question 1: Scope | Question 2: Breadth | Registry key path |
|--------------------|---------------------|-------------------|
| global | all skills | `knowledge._all` |
| project-specific | all skills | `knowledge.{projectName}` |
| global | specific skill | `skills.{name}.knowledge._all` |
| project-specific | specific skill | `skills.{name}.knowledge.{projectName}` |

**`_all` promotion confirmation**: routing to `knowledge._all` or `skills.{name}.knowledge._all` means the entry will be loaded by every skill across every project (or every project for that skill). When the add flow routes to `_all`, prompt: "This knowledge will be loaded by ALL skills across ALL projects. Confirm? (y/n)" -- default to **n** for project-specific entries, default to **y** only when the user explicitly chose scope=global.

---

## Subcommand: add

### 2.1 Collect content
Prompt user for the knowledge content. Accept either:
- Pasted text -> save to a new file
- Path to an existing file -> import in place

### 2.2 Detect knowledge type
Classify the content into one of:
- `principle` -- coding standards, naming conventions, review rules, team policies
- `project` -- domain knowledge, business rules, API specs, integration notes
- `core/user` -- universal principles the user wants applied to **every** skill (rare; explicit opt-in)

The skill should suggest a type based on content keywords; the user confirms or overrides.

### 2.3 AI Routing -- Two-question routing + skill scoring

1. **Question 1: Scope** -- Ask: "Is this knowledge global (applies to all projects) or project-specific?"
   - `global` -> keys under `_all`
   - `project-specific` -> ask which project (list from `project-context.yaml > projects[].name`); key under `{projectName}`
2. **Question 2: Breadth** -- Ask: "Should this knowledge be loaded by all skills or a specific skill?"
   - `all skills` -> top-level `knowledge` map
   - `specific skill` -> AI-score each skill for relevance (see below)
3. Read `.ai-agents/registry.yaml` > `skills.*` -- collect every skill's `name` and `description`.
4. For each skill, score relevance to the content on a 0-100 scale:
   - 90-100: directly aligned (e.g., review rules + `mvt-review`)
   - 70-89: strongly relevant
   - 50-69: tangentially relevant
   - 0-49: weak match
5. Read `.ai-agents/config.yaml` > `preferences.context_routing.relevance_threshold` (default 70 if missing).
6. Display **all** skills sorted by score descending. Do not truncate -- the user sees the full list with scores.
   - Skills at or above threshold: pre-checked, shown with `[High]` / `[Med]` markers (or stars in emoji mode).
   - Skills below threshold: collapsed under an "expand" prompt; not pre-checked.
7. Combine the two questions with the scoring to determine the registry key path per the routing table above.

### 2.4 Accept user input
Accept any of:
- `Enter` (empty input) -- confirm pre-checked selection
- Comma-separated indices (e.g. `1,3,5`) -- custom skill selection
- `s` -- promote to **global** (write to `registry.yaml > knowledge._all`)
- `c` -- promote to **core** (write to `.ai-agents/knowledge/core/user/{filename}` + append entry to `core/manifest.yaml` with `origin: user`)
- `n` -- **none** (file-only; not auto-loaded)
- `m` -- **manual** mode (display the full skill list including below-threshold for direct picking)
- `expand` -- show below-threshold skills inline

### 2.5 Resolve target path

| User choice | File destination | Registry / manifest update |
|------------|-----------------|----------------------------|
| Per-skill (any subset) | `.ai-agents/knowledge/{type}/{filename}` (`type` = `principle` or `project`) | For each chosen skill: append entry to `registry.yaml > skills.{name}.knowledge.{projectKey}[]` with `type: static`, `source: knowledge/{type}/`, `files: [{filename}]`. `projectKey` = `_all` if scope=global, or `{projectName}` if project-specific. |
| `s` (shared / global + all skills) | `.ai-agents/knowledge/{type}/{filename}` | Append to `registry.yaml > knowledge._all[]` with the same `type: static` shape |
| `c` (core) | `.ai-agents/knowledge/core/user/{filename}` | Append to `core/manifest.yaml > files[]` with `path: user/{filename}`, `origin: user`, `auto_load: true` |
| `n` (none) | `.ai-agents/knowledge/{type}/{filename}` | No registry/manifest change |

If the user chose multiple bindings (e.g., shared + per-skill review), apply each rule.

### 2.6 Write atomically
1. Write the knowledge file.
2. Update `registry.yaml` (and/or `core/manifest.yaml`) with all references.
3. If any write fails, roll back: delete the new file, revert the registry/manifest edits.

### 2.7 Report
Use the `add / move / rename` output format from the manifest. Show:
- The routing decision table (skill, score, bound or not)
- The files modified
- Token impact estimate (sum of file size / 4)

---

## Subcommand: remove

### 3.1 Identify target
- If `[id]` was provided: jump to 3.2
- Otherwise: list all knowledge entries with their IDs and locations (same format as `list`), prompt user to pick one

### 3.2 Confirm deletion
Show the entry's file path, all binding references (shared / per-skill / core), and ask user to confirm.

### 3.3 Drop references
- `registry.yaml > knowledge._all[]` -- remove entries whose path matches
- `registry.yaml > knowledge.{projectName}[]` -- traverse ALL project keys, remove entries whose path matches
- `registry.yaml > skills.*.knowledge._all[]` -- remove every per-skill _all entry whose path matches
- `registry.yaml > skills.*.knowledge.{projectName}[]` -- traverse ALL project keys for each skill, remove entries whose path matches
- `core/manifest.yaml > files[]` -- if the file lives under `core/user/`, remove the matching entry

### 3.4 Delete file
Delete the physical file. If multiple entries pointed to the same file, only delete after all references are cleared.

### 3.5 Report
Use the `remove` output format. Show every reference dropped.

---

## Subcommand: move

### 4.1 Identify source
- If `[id]` was provided: jump to 4.2
- Otherwise: prompt user to pick from `list` output

### 4.2 Show current binding
Display where the entry is currently bound (shared / per-skill / core / none).

### 4.3 Prompt for new binding
Use the same two-question routing as `add` step 2.3 (Scope + Breadth -> registry key path). Support cross-key movement:
- `_all` -> `{projectName}` (narrow from global to project-specific)
- `{projectName}` -> `_all` (promote to global; apply `_all` promotion confirmation)
- `{projectName1}` -> `{projectName2}` (move between projects)

### 4.4 Apply changes
- Update registry / manifest references atomically:
  - Remove old references that no longer apply
  - Add new references for newly chosen bindings
- If the new binding requires the file to live in a different directory (e.g., promoting a `principle/` file to `core/user/`):
  - Move the physical file
  - Update the `path` field in every retained reference to match

### 4.5 Report
Use the `add / move / rename` output format. Highlight which references moved.

---

## Subcommand: rename

### 5.1 Identify source
Same as `move` step 4.1.

### 5.2 Prompt for new id
- Validate uniqueness against existing entries (under the same binding scope)
- Validate filename safety (no path separators, no leading dots)

### 5.3 Apply changes
- Rename the physical file (`old/path/old-id.md` -> `old/path/new-id.md`)
- Update every retained reference in `registry.yaml` and `core/manifest.yaml` to point to the new path

### 5.4 Report
Use the `add / move / rename` output format.

---

## Subcommand: list

### 6.1 Read sources
- `.ai-agents/registry.yaml` > `knowledge._all[]`, `knowledge.{projectName}[]`, `skills.*.knowledge._all[]`, `skills.*.knowledge.{projectName}[]` -- traverse ALL project keys
- `.ai-agents/knowledge/core/manifest.yaml` > `files[]`
- Walk `.ai-agents/knowledge/{principle,project}/` for files not referenced anywhere (Unbound)

### 6.2 Group and render
Use the `list` output format. Group by **project x skill** (3D table). Each row should answer: where is the file, which project(s) does it serve, and which skills load it?

Flag **orphan entries** -- entries under a project key not in `projects[].name` from `project-context.yaml`.

### 6.3 Health hints
At the bottom of the list, optionally surface:
- "N file(s) present but unbound -- consider `/mvt-manage-context move` or `/mvt-manage-context remove`"
- "Total token cost (auto-loaded): ~X tokens" -- approximate

---

## Cross-cutting rules

- **Atomicity**: file system writes and registry/manifest writes must succeed together. On partial failure, restore the previous state.
- **No edits to framework files**: never write to `.ai-agents/knowledge/core/_framework/`. If user content would land there by accident, redirect to `core/user/`.
- **Backups**: before mutating `registry.yaml` or `core/manifest.yaml`, copy them to `.ai-agents/.backup/{filename}-{timestamp}.yaml`.
- **Idempotency**: re-running the same `add` (same content + same bindings) should detect the existing entry and offer "skip / overwrite / cancel" rather than silently duplicating.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| File path points outside `.ai-agents/knowledge/` | Reject with error: knowledge files must reside under the managed directory tree |
| `registry.yaml` or `core/manifest.yaml` is malformed (parse error) | Abort the operation; print the parse error; suggest manual fix or restore from `.ai-agents/.backup/` |
| User attempts to `remove` a core framework file (`core/_framework/*`) | Refuse: framework files are read-only and managed by the installer |
| `add` target file already exists on disk but has no registry entry | Offer "register existing / overwrite / cancel" instead of blindly writing |
| `move` destination binding already has an entry with the same id | Prompt for rename or cancel; do not silently overwrite |
| Disk write fails mid-operation (permission denied, disk full) | Roll back all registry/manifest changes using the backup copies; report partial failure |

## Output Format

No external template -- output is inline. Format depends on subcommand:

### add / move / rename
```markdown
## Knowledge Updated

### Operation: {add | move | rename}

### Routing Decision
| Skill | Score | Bound? |
|-------|-------|--------|
| mvt-review | 92 | Yes |
| mvt-test | 85 | Yes |
| mvt-implement | 60 | No (below threshold) |

### Files Modified
- `.ai-agents/knowledge/{path}` -- {created | moved | renamed}
- `.ai-agents/registry.yaml` -- {entries added/removed}
- `.ai-agents/knowledge/core/manifest.yaml` -- {entry added/removed} (if applicable)
```

### remove
```markdown
## Knowledge Removed

### Removed entry: `{id}`
- File: `.ai-agents/knowledge/{path}` (deleted)
- References dropped from:
  - `registry.yaml > knowledge._all` (if applicable)
  - `registry.yaml > knowledge.{projectName}` (if applicable)
  - `registry.yaml > skills.{name}.knowledge` x N (if applicable)
  - `core/manifest.yaml > files[]` (if applicable)
```

### list
```markdown
## Knowledge Inventory

### Shared (all skills)
| id | path | type |
|----|------|------|

### Per-Skill
| id | path | bound to |
|----|------|----------|

### Core (user contributions)
| id | path | auto_load |
|----|------|-----------|

### Unbound (file present but not auto-loaded)
| id | path |
|----|------|
```

## State Update

This skill is read-only and does NOT modify `.ai-agents/workspace/session.yaml`.

## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`mvt-manage-context`) and the current project state.
**Candidate set constraint (mandatory)**: Only recommend skills that are declared under `skills` in `.ai-agents/registry.yaml`.

### Conditional Recommendations

Match the current state to one of the conditions below. If none match, use `default`.

- **`knowledge added or moved`** → `/mvt-check-context` -- Verify context health after the change
- **`knowledge removed`** → `/mvt-check-context` -- Confirm token savings
- **`large knowledge files detected`** → `/mvt-cleanup` -- Clean up workspace to reduce context load

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
