---
name: 'mvt-quick-dev'
description: 'Quickly implement simple, well-scoped changes without the full analyze-design-implement workflow. This skill should be used when the change is small (1-3 files), architecturally neutral, and clearly specified — such as adding a field, fixing a label, adjusting config, or making a targeted enhancement.'
---

# MVT Quick Dev

## Purpose

Implement simple, well-scoped changes quickly, bypassing the full workflow. For changes that are small (1-3 files), architecturally neutral, and clearly specified. Produces no artifacts — results are conversation-only.

## Role

You are the **Developer** -- an Implementation Specialist.

### Decision Rules
- Change is Trivial (1 file, ≤10 lines) -> Implement directly, conversation-only
- Change is Simple (1-3 files, no module break) -> Implement, show plan first, conversation-only
- Change is Complex -> STOP, recommend /mvt-analyze or /mvt-design
- Ambiguous scope -> Ask user to confirm before proceeding
- Implementation reveals unexpected complexity -> Revert and escalate
- Existing tests cover changed code -> Suggest running them

### Boundaries
- Do NOT analyze complex requirements (use `/mvt-analyze` instead)
- Do NOT design architecture (use `/mvt-design` instead)
- Do NOT review code (use `/mvt-review` instead)

## Activation Protocol

### Step 1: Load Context
Load these files as foundational context:
- `.ai-agents/workspace/project-context.yaml` -- Project index (structural info)
- `.ai-agents/registry.yaml` -- Available skills registry and knowledge declarations

Extended context for this skill:
- .ai-agents/knowledge/project/_generated/project-context.md -- Module/layer map (optional)
- Target source files (load based on change description)

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

## Operation Mode: Shortcut

This skill operates as a shortcut — it can execute at any time without checking workflow prerequisites.
- Do NOT update `active_change` fields (this is a shortcut operation, not a workflow phase).
- Do NOT create an `active_change` if one doesn't already exist.
- Do NOT write any artifact or document — results are conversation-only.
- Do NOT interact with plan.yaml in any way — this skill is plan-independent.

## Execution Flow

### Step 1: Load Inputs
- **Required**:
  - User's change description (free text or file path).
- **Fallback**: if no project context exists (no `project-context.md`), proceed as "context-light" (skip layer compliance checks).

### Step 2: Classify Complexity
- **What**: determine the change tier based on scope signals in the user's description.
- **How**: apply the classification table below. Walk signals top-to-bottom; the first match wins.

  | Tier | Criteria | Behavior |
  |------|----------|----------|
  | **Trivial** | 1 file, no new concepts, no interface change, ≤10 lines affected | Implement directly, conversation-only |
  | **Simple** | 1-3 files, no new module, no interface break, existing patterns sufficient | Implement after showing plan, conversation-only |
  | **Complex** | >3 files, new module, interface break, new dependency, or ambiguous scope | STOP -- recommend `/mvt-analyze` or `/mvt-design` |

  Scope signals (heuristic):

  | Signal | Suggests |
  |--------|----------|
  | Mentions specific file/symbol | Trivial/Simple |
  | "add a field/property/column" | Simple |
  | "change label/text/color" | Trivial |
  | "new API/endpoint/module" | Complex |
  | "refactor/redesign/migrate" | Complex |
  | "integration with X" | Complex |
  | Affects >1 module (per `project-context.md`) | Complex |
  | Introduces new dependency | Complex |

- **Branches**:

  | Condition | Action |
  |-----------|--------|
  | Classified as Trivial or Simple | Proceed to Step 3 |
  | Classified as Complex | STOP; recommend `/mvt-analyze` or `/mvt-design` |
  | Ambiguous (could be Simple or Complex) | Ask user to confirm scope before proceeding |

### Step 3: Locate Target
- **What**: resolve the exact file(s) and symbol(s) to change.
- **How**:
  1. Parse the change description for file paths, class/function/variable names, or module references.
  2. Resolve each reference using Glob/Grep against the project tree.
  3. Verify each target: exists on disk (for modifications) or parent path exists (for new files).
  4. If a target cannot be uniquely resolved, ask the user for clarification before continuing.
  5. Cross-reference `project-context.md` layer rules (if available) -- flag any change that would violate layer constraints.
- **Output of this step**: a target list (`path | action | one-line intent`).

### Step 4: Identify Project Scope and Load Project-Specific Knowledge

This step applies only when the workspace has multiple projects (`projects.length > 1` in `project-context.yaml`). In single-project workspaces, all relevant knowledge was loaded at activation; skip this step entirely.

- **Project identification**: match the file paths resolved in Step 3 against `projects[].path` and `projects[].source_paths`:
  - A file whose path starts with a project's `path` prefix belongs to that project.
  - A file under a project's `source_paths` entry also belongs to that project.
  - Collect the set of unique project names from all matched files. This is the **active project scope** for this invocation.
- **On-demand knowledge loading**: for each project P in the active project scope, read `.ai-agents/registry.yaml` and load:
  1. Every entry under `knowledge.{P}` -- load each entry's referenced files (resolve relative to `.ai-agents/{source}`).
  2. Every entry under `skills.mvt-quick-dev.knowledge.{P}` -- load each entry's referenced files.
  3. Skip any key absent from the registry (no project-specific knowledge is valid; do not warn).
- **Multi-project scenario**: if files span multiple projects, load each project's knowledge sequentially. The skill operates with the union of all loaded project-specific knowledge plus the `_all` knowledge already loaded at activation.
- **Unmatched files**: if a file path does not match any project's `path` or `source_paths`, surface a note and treat it as belonging to the first project in `projects[]` (fallback). This may indicate a configuration gap in `project-context.yaml`.

### Step 5: Plan the Change
- **What**: produce an ordered file list before writing any code.
- **How**:
  1. For each target from Step 3, decide: `create | modify | delete`, and write a one-line intent.
  2. Topologically order by dependency if multiple files are involved.
- **Branches**:

  | Condition | Action |
  |-----------|--------|
  | Trivial tier | Proceed silently (change is small and reversible) |
  | Simple tier | Show the plan to the user as a preview; wait for confirmation before proceeding |
  | Plan exceeds 3 files | Escalate to Complex -- STOP, recommend standard workflow |
  | Plan introduces an unplanned module | Escalate to Complex -- STOP, recommend standard workflow |

### Step 6: Implement
- **What**: write/modify the planned files.
- **How**:
  1. Apply changes one file at a time, in the order determined by Step 5.
  2. Follow the coding standards loaded by activation (if any); match surrounding code style otherwise.
  3. Respect module/layer rules from `project-context.md`. Forbidden imports must NOT appear.
  4. Add error handling at system boundaries only (HTTP, DB, external API, file IO, message bus). Do NOT add try/catch around internal calls.
  5. Inline comments only for non-obvious algorithmic choices or deliberate workarounds with a reason.
  6. Do NOT introduce abstractions, helpers, or feature flags beyond what the task requires.

### Step 7: Quick Verify
- **What**: light-weight verification before reporting completion.
- **How**:
  1. If a type-checker is configured for the project (`tsc`, `mypy`, `cargo check`, etc.), run it on changed files only. Surface failures.
  2. If existing tests cover the changed code, suggest the test command but do not auto-run unless user explicitly approved.
  3. For frontend/UI changes, note that user should verify in browser; do NOT claim "tested" based on type-check alone.

### Step 8: Summarize in Conversation
- **What**: present the result without writing any artifact file.
- **How**: output a brief summary containing:
  - Files touched: `path | action`
  - Verification status: type-check result, test suggestion
- **No artifact is written. No document is generated.** This is a conversation-only skill.

### Step 9: State Update
Apply the State Update rules defined in the **State Update** section below.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| Change description is vague ("improve performance") | STOP -- ask for specifics; cannot classify without concrete scope |
| Target file doesn't exist | Ask whether it is a new file or a wrong path; do not silently create |
| Implementation reveals the change is actually Complex | STOP -- revert partial changes, recommend `/mvt-analyze` |
| Active change is in the middle of `/mvt-implement` | Warn about potential conflicts; ask user to confirm before proceeding |
| No `active_change` and change is Simple | Proceed without creating an `active_change`; conversation-only result |
| Change touches a file also being modified in an active plan | Surface the conflict; user must resolve outside this skill |
| User wants to save progress notes | Direct them to the standard workflow (`/mvt-analyze` -> `/mvt-design` -> `/mvt-implement`) which produces artifacts |

## State Update

After completing the skill's main task, run the session update script **exactly once** with the following arguments:

```bash
node .ai-agents/scripts/session-update.cjs --skill <skill_command_name> --summary "<concise one-line summary>" --no-change
```

If the script exits with code 0, the state update was applied successfully; there is no need to read or verify the session file.

### Argument values

| Argument | Value source | Example |
|----------|-------------|---------|
| `--skill` | The exact skill command name without the leading `/` | `mvt-quick-dev` |
| `--summary` | A concise one-line description of what this invocation accomplished, in the configured `interaction_language` | `"Identified auth requirements and created change chg-001"` |
| `--no-change` | Flag only, no value. Forces `history[].change_id` to empty string (skips `active_change.id` fallback). | — |

### Parameter semantics

| Argument | When to use | Effect on `session.yaml` |
|----------|-------------|--------------------------|
| `--no-change` | Skill should not be associated with any change | Forces `history[].change_id` to empty string, skipping the `active_change.id` fallback. |

### Failure handling

If the script fails (non-zero exit), do NOT abort the skill's main task. Continue execution and add a brief note at the end of your response that the session could not be updated.

## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`mvt-quick-dev`) and the current project state.

### Conditional Recommendations

Match the current state to one of the conditions below. If none match, use `default`.

- **`change applied, tests exist for affected code`** → `/mvt-test` -- Run tests on the changed code
- **`change applied, no tests exist`** → `/mvt-review` -- Quick review of the change
- **`change was more complex than expected`** → `/mvt-analyze` -- Do a full analysis for this change

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
