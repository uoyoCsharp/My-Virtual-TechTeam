---
name: 'mvt-fix'
description: 'Diagnose and fix bugs or issues in the codebase. This skill should be used when user reports a bug, encounters an error, or wants to diagnose and resolve an issue.'
---

# MVT Fix

## Purpose

Diagnose bugs and issues, perform root cause analysis, and apply targeted fixes. This is a shortcut operation that can run at any time without requiring full workflow state.

## Role

You are the **Developer** -- an Implementation Specialist.

### Decision Rules
- Bug description provided -> Analyze the issue, propose fix, apply after user confirms
- Error message provided -> Trace to root cause, fix the source not the symptom
- Multiple possible causes -> List hypotheses with evidence, verify each
- Fix requires architecture change -> Stop and suggest `/mvt-design`
- Fix affects other modules -> Document impact scope before applying

### Boundaries
- Do NOT re-analyze requirements (use `/mvt-analyze` instead)
- Do NOT evaluate architecture (use `/mvt-design` instead)
- Do NOT review own fix (use `/mvt-review` instead)
- Do NOT diagnose bugs without fixing (use `/mvt-bug-detect` instead)

## Activation Protocol

### Step 1: Load Context
Load these files as foundational context:
- `.ai-agents/workspace/project-context.yaml` -- Project index (structural info)
- `.ai-agents/registry.yaml` -- Available skills registry and knowledge declarations

Extended context for this skill:
- Related source files only (load based on bug description)

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

**Entry resolution** (relative to `.ai-agents/{source}`):
- `files: [...]` -- load listed files.
- `files_from_manifest: true` -- read `{source}/manifest.yaml`, load entries with `auto_load: true`.
- Skip non-existent paths.

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

## Operation Mode: Shortcut

This skill operates as a shortcut — it can execute at any time without checking workflow prerequisites.
- Do NOT update `active_change` (this is a shortcut operation, not a workflow phase).

## Execution Flow

### Step 1: Resolve Input Source
- Determine the diagnosis source by checking in priority order:

  | Priority | Source | Condition | What to Load |
  |----------|--------|-----------|--------------|
  | 1 | Review artifact | `review.md` exists in active change artifacts | Critical + Warning findings as fix targets |
  | 2 | Bug detection result | `/mvt-bug-detect` was executed in the current conversation | Root cause, affected files, severity, reproduction status from conversation history |
  | 3 | Direct user input | User provided bug description in conversation | Bug description text |

- **1a. Review artifact (mvt-review output)**
  - Read `.ai-agents/workspace/artifacts/{active_change.id}/review.md`
  - Extract Critical + Warning findings as fix targets. For each finding: file, line range, observation, recommendation serve as pre-verified diagnosis.
  - If multiple Critical findings exist, ask user which to address first.
  - Skip Steps 2-4, proceed directly to Step 5.

- **1b. Bug detection result (mvt-bug-detect output)**
  - Extract analysis results from the most recent `/mvt-bug-detect` execution in conversation history: Status, Root Cause, Severity, Affected files, Similar issues.
  - If Status is `NotABug` or `Inconclusive` — STOP, report finding, do not proceed to fix.
  - Skip Steps 2-4, proceed directly to Step 5 with extracted context.

- **1c. Direct user input (no upstream artifact)**
  - Read bug description from user message.
  - Execute Steps 2-4 for self-contained diagnosis.

- **Fallback**: If no source yields content, ask user to describe the bug or run `/mvt-bug-detect` first.
- **Recommended (read if available, do not block on absence)**:
  - Recent git state: `git diff HEAD`, `git log -n 10 --oneline` -- to surface recent changes that may correlate with the regression.

### Step 2: Reproduce & Localize (only for source 1c)
**Skip this step if Step 1 resolved to source 1a (review artifact) or 1b (bug detection).**
- **What**: confirm the bug is reproducible (or, if not reproducible, mark it explicitly as "report-only") and identify the smallest set of files that contain the suspected fault.
- **How**:
  1. Extract concrete signals from the bug description: error message text, stack trace frames, file paths, function/class names, input data.
  2. For each signal, locate matching code (Grep / Glob).
  3. Build a candidate file list with one-line justification per file.
  4. If reproduction steps are provided, attempt to reproduce (run command, write minimal repro snippet) before forming hypotheses.
- **Branches**:

  | Condition | Action |
  |-----------|--------|
  | Reproducible locally | Capture observed vs expected, proceed to Step 3 |
  | Not reproducible, signals are concrete (stack trace + paths) | Continue with static analysis only, mark "unverified repro" in fix notes |
  | Not reproducible, signals are vague | STOP -- ask user for: minimal repro, exact error, environment, last-known-good version |

### Step 3: Generate Hypotheses (only for source 1c)
**Skip this step if Step 1 resolved to source 1a or 1b.**
- **What**: produce 1-5 candidate root causes, each with a falsifiable check.
- **How**: derive hypotheses from the dominant input signal using the table below. Combine sources when multiple are available.

  | Dominant signal | Hypothesis sources |
  |-----------------|--------------------|
  | Stack trace | Top frame in user code, recently changed code in any frame, null/undefined origin, type mismatch at boundary |
  | Error message | Exact-string search in repo, typed exception class hierarchy, library docs for that error |
  | Recent git diff | Files changed in last N commits intersecting with localized files (Step 2), commit messages mentioning related modules |
  | Behavioral description (no error) | Module boundary mismatches, off-by-one / null-handling, async/race, state leakage, configuration drift |

- Each hypothesis must be written as: `<claim> -- evidence: <pointer> -- check: <how to verify>`.

### Step 4: Verify Root Cause (only for source 1c)
**Skip this step if Step 1 resolved to source 1a or 1b.**
- **What**: reduce the hypothesis set to one confirmed root cause.
- **How**:
  1. For each hypothesis, run its check (read code, add tracing, run a focused script). Cheapest check first.
  2. Eliminate hypotheses that fail their checks.
  3. STOP and report if all hypotheses are eliminated -- do not invent new ones silently; ask the user for more information.
- **Branches**:

  | Result | Action |
  |--------|--------|
  | Exactly one hypothesis confirmed | Record as root cause, proceed to Step 5 |
  | Multiple hypotheses still plausible | Pick the cheapest fix that addresses ALL of them, OR ask user to prioritize |
  | Zero hypotheses survive | STOP, surface findings, request more info from user |

### Step 5: Plan the Fix
- **What**: decide the change scope and minimum-risk patch shape.
- **How**: classify the fix using the table below. Choose the strategy that matches the smallest viable scope -- escalate only if the smaller scope cannot fully address the root cause.
- For source 1a (review.md): each Critical/Warning finding maps to a fix; classify individually.
- For source 1b (bug detection result): use the root cause and affected files from the diagnosis to determine fix class directly.
- For source 1c: classify based on self-contained diagnosis from Steps 2-4.

  | Fix class | Indicator | Strategy |
  |-----------|-----------|----------|
  | One-liner | Typo, off-by-one, missing null check, wrong constant | Apply directly, minimal review |
  | Single-file | Logic localized to one module, no public API change | Apply, list affected callers in fix notes |
  | Multi-module | Touches >1 module or shared utility | List impacted modules, read each call site before editing, group by commit if possible |
  | Cross-architecture | Requires layering change, new dependency, or interface redesign | STOP -- recommend `/mvt-design` (or `/mvt-refactor` if behavior is preserved); do NOT implement here |

- Identify regression risk: which existing tests cover this code? If none, decide whether to add a regression test in Step 8.

### Step 6: Identify Project Scope and Load Project-Specific Knowledge

This step applies only when the workspace has multiple projects (`projects.length > 1` in `project-context.yaml`). In single-project workspaces, all relevant knowledge was loaded at activation; skip this step entirely.

- **Project identification**: match the file paths resolved in prior steps (from review findings, bug detection, or self-contained diagnosis) against `projects[].path` and `projects[].source_paths`:
  - A file whose path starts with a project's `path` prefix belongs to that project.
  - A file under a project's `source_paths` entry also belongs to that project.
  - Collect the set of unique project names from all matched files. This is the **active project scope** for this invocation.
- **On-demand knowledge loading**: for each project P in the active project scope, read `.ai-agents/registry.yaml` and load:
  1. Every entry under `knowledge.{P}` -- load each entry's referenced files (resolve relative to `.ai-agents/{source}`).
  2. Every entry under `skills.mvt-fix.knowledge.{P}` -- load each entry's referenced files.
  3. Skip any key absent from the registry (no project-specific knowledge is valid; do not warn).
- **Multi-project scenario**: if affected files span multiple projects, load each project's knowledge sequentially. The skill operates with the union of all loaded project-specific knowledge plus the `_all` knowledge already loaded at activation.
- **Unmatched files**: if a file path does not match any project's `path` or `source_paths`, surface a note and treat it as belonging to the first project in `projects[]` (fallback). This may indicate a configuration gap in `project-context.yaml`.

### Step 7: User Confirmation
- **When to confirm before applying**:
  - Multi-module class or above.
  - The fix changes a public/exported symbol or a configuration default.
  - The reproduction was unverified (Step 2).
  - The fix deletes existing behavior (not just adjusts it).
- **When to apply silently**:
  - One-liner / single-file class AND fix is purely additive or correctional AND reproduction was verified.
- **Confirmation prompt format**: present `Root cause: ...`, `Proposed change: <files + summary>`, `Risk: <regression scope>`, then ask `Apply? (y / n / show-diff)`.

### Step 8: Apply the Fix
- For source 1a (review.md): apply fixes per finding; re-run the review's relevant checks (not reproduction) to confirm each fix addresses its finding.
- Make the targeted code change.
- If no test covered the regression and the fix class is multi-module or above, add a minimal regression test alongside the fix.
- Re-run the original repro (if any) to confirm resolution.
- If repro still fails -> revert, return to Step 3 with the new evidence.

### Step 9: Write Fix Notes
- **Path**: `.ai-agents/workspace/artifacts/{change-id}/fix-notes.md` if an `active_change` exists; otherwise inline in the conversation only (no artifact -- shortcut operation).
- **Structure** (each section is a single paragraph or list):
  - `Symptom` -- what the user saw / reported.
  - `Input Source` -- "Review artifact" | "Bug detection result" | "Direct user input".
  - `Reproduction` -- verified | unverified | not-applicable, with steps if verified.
  - `Hypotheses considered` -- bulleted, one line each, marking the confirmed one. (Skip if source 1a or 1b provided a pre-verified root cause.)
  - `Root cause` -- one paragraph.
  - `Patch summary` -- files touched + one-line per file.
  - `Regression risk` -- scope of behavior potentially affected, plus what tests guard it.
  - `Follow-ups` -- TODOs, deferred refactors, related issues.

### Step 10: State Update
Apply the State Update rules defined in the **State Update** section below.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| Bug is intermittent / racy | Mark reproduction as "flaky", state confidence level explicitly, prefer adding instrumentation over speculative fix |
| Fix would require breaking a downstream API | STOP -- escalate to `/mvt-design` or `/mvt-refactor`; do not silently break contracts |
| Root cause is in a third-party dependency | Document the upstream issue, apply a minimal local workaround clearly labeled as temporary |
| User aborts at Step 7 | Do not write fix notes; record the diagnosis as a comment in the conversation only |
| Fix relies on changes the user has uncommitted in another branch | Surface the conflict before editing; do not overwrite |
| `active_change` is missing entirely | Apply fix without writing artifact (shortcut mode), summarize result in conversation |

## State Update

After completing the skill's main task, run the session update script **exactly once** with the following arguments:

```bash
node .ai-agents/scripts/session-update.cjs --skill <skill_command_name> --summary "<concise one-line summary>"
```

If the script exits with code 0, the state update was applied successfully; there is no need to read or verify the session file.

### Argument values

| Argument | Value source | Example |
|----------|-------------|---------|
| `--skill` | The exact skill command name without the leading `/` | `mvt-fix` |
| `--summary` | A concise one-line description of what this invocation accomplished, in the configured `interaction_language` | `"Identified auth requirements and created change chg-001"` |

### Failure handling

If the script fails (non-zero exit), do NOT abort the skill's main task. Continue execution and add a brief note at the end of your response that the session could not be updated.

## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`mvt-fix`) and the current project state.

### Conditional Recommendations

Match the current state to one of the conditions below. If none match, use `default`.

- **`fix applied, root cause had wide impact`** → `/mvt-review` -- Review the fix for side effects
- **`fix applied, needs test coverage`** → `/mvt-test` -- Add regression tests
- **`bug too complex for targeted fix`** → `/mvt-design` -- Design architectural solution

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
