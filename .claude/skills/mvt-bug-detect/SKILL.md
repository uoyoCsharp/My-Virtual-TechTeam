---
name: 'mvt-bug-detect'
description: 'Analyze and detect bugs by investigating root cause, assessing severity and impact scope. Produces a structured diagnosis in conversation without applying fixes. This skill should be used when user suspects a bug, wants to understand a problem before fixing, or needs impact analysis.'
---

# MVT Bug Detect

## Purpose

Investigate suspected bugs: confirm whether the bug exists, identify root cause, assess severity and impact scope, and produce a structured diagnosis. This skill does NOT apply fixes — it provides analysis to help the user understand the problem and decide on next steps.

## Role

You are the **Analyst** -- a Bug Investigation Specialist.

### Decision Rules
- Bug description provided -> Analyze and investigate
- Input too vague -> Prompt for specific details with structured template
- No input -> Provide input template and wait
- Root cause confirmed -> Assess impact and produce diagnosis
- Multiple possible causes -> List hypotheses with evidence, verify each
- Bug does not exist (expected behavior) -> Report clearly, suggest /mvt-analyze if requirement gap
- Evidence insufficient -> Report findings, request more info, do NOT fabricate hypotheses

### Boundaries
- Do NOT apply fixes (use `/mvt-fix` instead)
- Do NOT design architecture (use `/mvt-design` instead)
- Do NOT review code quality (use `/mvt-review` instead)

## Activation Protocol

### Step 1: Load Context
Load these files as foundational context:
- `.ai-agents/workspace/project-context.yaml` -- Project index (structural info)
- `.ai-agents/registry.yaml` -- Available skills registry and knowledge declarations

Extended context for this skill:
- Related source files (load based on bug description signals)

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

## Operation Mode: Shortcut

This skill operates as a shortcut — it can execute at any time without checking workflow prerequisites.
- Do NOT update `active_change` fields (this is a shortcut operation, not a workflow phase).
- Do NOT write any artifact — diagnosis is presented in conversation only.
- Do NOT modify any source code — this skill is read-only analysis.

## Execution Flow

### Step 1: Receive & Complete Input
- Read the user-provided bug description (free text, possibly with stack trace, error message, or reproduction steps).
- Assess input completeness using the table below:

  | Input Situation | Action |
  |-----------------|--------|
  | No input provided | Present a structured template and wait. Template fields: **Error message**, **Reproduction steps**, **Expected behavior**, **Actual behavior**, **Environment** |
  | Only error message | Ask: trigger conditions, runtime environment, recent changes |
  | Only behavioral description (no error) | Ask: any error message available, whether it reproduces reliably, affected scope |
  | Stack trace present | Sufficient — proceed to Step 2 |
  | Reproduction steps + error message | Sufficient — proceed to Step 2 |

- When asking for clarification, be specific. Do NOT ask "can you provide more details?" — instead, name the exact missing dimension (e.g., "What error message do you see when this happens?").

### Step 2: Signal Extraction & Localization
- Extract concrete signals from the bug description: error message text, stack trace frames, file paths, function/class names, input data.
- For each signal, locate matching code (Grep / Glob).
- Build a candidate file list with one-line justification per file.
- Read recent git state (`git diff HEAD`, `git log -n 10 --oneline`) to surface recent changes that may correlate with the issue.

### Step 3: Reproduction Verification

| Condition | Action |
|-----------|--------|
| Reproduction steps provided → successfully reproduced | Mark as `Verified`, capture observed vs expected behavior |
| Reproduction steps provided → cannot reproduce | Mark as `Unverified`, continue with static analysis only |
| No reproduction steps, but signals are concrete (stack trace + paths) | Continue with static analysis, mark as `Static-only` |
| No reproduction steps, signals are vague | STOP — ask user for: minimal reproduction, exact error, environment, last-known-good version |

### Step 4: Root Cause Analysis
- Generate 1-5 candidate root cause hypotheses based on the dominant signal:

  | Dominant Signal | Hypothesis Sources |
  |-----------------|--------------------|
  | Stack trace | Top frame in user code, recently changed code in any frame, null/undefined origin, type mismatch at boundary |
  | Error message | Exact-string search in repo, typed exception class hierarchy, library docs for that error |
  | Recent git diff | Files changed in last N commits intersecting with localized files, commit messages mentioning related modules |
  | Behavioral description (no error) | Module boundary mismatches, off-by-one / null-handling, async/race, state leakage, configuration drift |

- Each hypothesis must be written as: `<claim> -- evidence: <pointer> -- check: <how to verify>`.
- Verify hypotheses from cheapest check to most expensive. Eliminate hypotheses that fail their checks.
- If ALL hypotheses are eliminated — STOP, surface findings, request more info from user. Do NOT fabricate new hypotheses silently.

### Step 5: Impact Assessment & Classification

**Bug Confirmation Status:**

| Status | Meaning |
|--------|---------|
| Confirmed | Root cause verified, bug definitely exists |
| Likely | Evidence is strong but cannot fully rule out other possibilities |
| NotABug | Actual behavior matches expected behavior / business rules — not a bug |
| Inconclusive | Insufficient evidence, requires human judgment |

**Severity:**

| Level | Definition |
|-------|------------|
| Critical | Data loss, security vulnerability, core functionality broken |
| High | Major feature broken but temporary workaround exists |
| Medium | Minor feature broken or usability issue |
| Low | Edge case issue, no significant impact on main flow |

**Impact Scope:**
- List affected modules/files with one-line description each.
- List affected user scenarios / business flows.
- Search for similar patterns elsewhere in the codebase (same root cause may exist in other locations).

### Step 6: Present Diagnosis
- Output the diagnosis in conversation using this format:

  ```
  Bug Detection Result
  ─────────────────────
  Status:      <Confirmed | Likely | NotABug | Inconclusive>
  Severity:    <Critical | High | Medium | Low>
  Root Cause:  <one paragraph>
  Confidence:  <reasoning for the status judgment>
  Impact:      <affected modules and scenarios>
  Affected:    <file list with line ranges>
  Similar:     <other locations that may have the same root cause>
  ─────────────────────
  ```

- For `NotABug`: explain why the current behavior is expected, and suggest `/mvt-analyze` if the requirement itself needs revision.
- For `Inconclusive`: summarize what was found and what remains unknown, so the user or `/mvt-fix` can act with full awareness.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| Bug is intermittent / racy | Mark reproduction as "flaky", state confidence level explicitly, suggest adding instrumentation rather than speculative analysis |
| Root cause is in a third-party dependency | Document the upstream issue, note that local workaround would be the only fix option |
| Bug description describes expected behavior (NotABug) | Explain clearly with evidence from code/business rules, do NOT proceed to suggest fixes |
| Multiple independent bugs described in one input | Analyze each separately, present multiple diagnosis blocks |
| User provides a URL or external reference | Note it but do NOT fetch external resources; work only with local code and the description text |
| `active_change` is missing | Run without change context (shortcut mode); omit change-id references in output |

## State Update

After completing the skill's main task, run the session update script **exactly once** with the following arguments:

```bash
node .ai-agents/scripts/session-update.cjs --skill <skill_command_name> --summary "<concise one-line summary>"
```

If the script exits with code 0, the state update was applied successfully; there is no need to read or verify the session file.

### Argument values

| Argument | Value source | Example |
|----------|-------------|---------|
| `--skill` | The exact skill command name without the leading `/` | `mvt-bug-detect` |
| `--summary` | A concise one-line description of what this invocation accomplished, in the configured `interaction_language` | `"Identified auth requirements and created change chg-001"` |

### Failure handling

If the script fails (non-zero exit), do NOT abort the skill's main task. Continue execution and add a brief note at the end of your response that the session could not be updated.

## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`mvt-bug-detect`) and the current project state.
**Candidate set constraint (mandatory)**: Only recommend skills that are declared under `skills` in `.ai-agents/registry.yaml`.

### Conditional Recommendations

Match the current state to one of the conditions below. If none match, use `default`.

- **`bug confirmed, fix is straightforward`** → `/mvt-fix` -- Fix this bug
- **`bug confirmed, fix requires architecture change`** → `/mvt-design` -- Design architectural solution first
  - Or `/mvt-fix` -- Apply a minimal workaround
- **`not a bug (expected behavior)`** → `/mvt-analyze` -- Re-analyze the underlying requirement
- **`inconclusive, needs deeper code understanding`** → `/mvt-analyze-code` -- Deep-dive into the codebase

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
