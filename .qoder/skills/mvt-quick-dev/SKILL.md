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

### Step 1: Load Context (Context Foundation)
Load the following files as foundational context:
- `.ai-agents/workspace/session.yaml` -- Current workflow state
- `.ai-agents/workspace/project-context.yaml` -- Project index (structural info)
- `.ai-agents/registry.yaml` -- Available skills registry and knowledge declarations

Extended context for this skill:
- .ai-agents/knowledge/project/_generated/project-context.md -- Module/layer map (optional)
- .ai-agents/knowledge/principle/coding-standards.md -- Coding standards (optional)
- Target source files (load based on change description)

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

### Step 4: Plan the Change
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

### Step 5: Implement
- **What**: write/modify the planned files.
- **How**:
  1. Apply changes one file at a time, in the order determined by Step 4.
  2. Follow `coding-standards.md` if available; match surrounding code style otherwise.
  3. Respect module/layer rules from `project-context.md`. Forbidden imports must NOT appear.
  4. Add error handling at system boundaries only (HTTP, DB, external API, file IO, message bus). Do NOT add try/catch around internal calls.
  5. Inline comments only for non-obvious algorithmic choices or deliberate workarounds with a reason.
  6. Do NOT introduce abstractions, helpers, or feature flags beyond what the task requires.

### Step 6: Quick Verify
- **What**: light-weight verification before reporting completion.
- **How**:
  1. If a type-checker is configured for the project (`tsc`, `mypy`, `cargo check`, etc.), run it on changed files only. Surface failures.
  2. If existing tests cover the changed code, suggest the test command but do not auto-run unless user explicitly approved.
  3. For frontend/UI changes, note that user should verify in browser; do NOT claim "tested" based on type-check alone.

### Step 7: Summarize in Conversation
- **What**: present the result without writing any artifact file.
- **How**: output a brief summary containing:
  - Files touched: `path | action`
  - Verification status: type-check result, test suggestion
- **No artifact is written. No document is generated.** This is a conversation-only skill.

### Step 8: State Update
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
