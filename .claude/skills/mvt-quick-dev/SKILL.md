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

### Stage 1: Load Context
Load foundational context:
- `.ai-agents/workspace/project-context.yaml` -- Project index (structural info)
- `.ai-agents/registry.yaml` -- Available skills registry and knowledge declarations

Extended context for this skill:
- .ai-agents/knowledge/project/_generated/project-context.md -- Module/layer map (optional)
- Target source files (load based on change description)

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

After the skill's main task, run the session update script **exactly once**:

```bash
node .ai-agents/scripts/session-update.cjs --skill mvt-quick-dev --summary "<concise one-line summary>" --no-change
```

Write `--summary` as one concise line in the configured `interaction_language`.

### Critical flag semantics

- Use only the flags rendered in the command above; do not invent extra session-update flags.
- `--no-change` forces `history[].change_id` to empty instead of falling back to `active_change.id`.

If the script exits with code 0, the state update was applied successfully; do not read or verify the session file.

### Failure handling

If the script fails (non-zero exit), do NOT abort the skill's main task. Continue execution and add a brief note at the end of your response that the session could not be updated.

## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`mvt-quick-dev`) and the current project state.
**Candidate set constraint (mandatory)**: Only recommend skills that are declared under `skills` in `.ai-agents/registry.yaml`.

### Conditional Recommendations

Match the current state to one of the conditions below. If none match, use `default`.

- **`change applied, tests exist for affected code`** → `/mvt-test` -- Run tests on the changed code
- **`change applied, no tests exist`** → `/mvt-review` -- Quick review of the change
- **`change was more complex than expected`** → `/mvt-analyze` -- Do a full analysis for this change

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
