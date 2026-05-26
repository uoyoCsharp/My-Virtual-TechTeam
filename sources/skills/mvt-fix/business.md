## Execution Flow

### Step 1: Load Inputs
- **Required**:
  - User-provided bug description (free text, possibly with stack trace, error message, or reproduction steps).
- **Recommended (read if available, do not block on absence)**:
  - `.ai-agents/workspace/project-context.yaml` -- to locate relevant source roots.
  - `.ai-agents/knowledge/project/_generated/project-context.md` -- module/layer map for traceability.
  - Recent git state: `git diff HEAD`, `git log -n 10 --oneline` -- to surface recent changes that may correlate with the regression.
- **Fallback**: if none of the above exists, proceed using the bug description alone and note "context-light fix" in the final fix notes.

### Step 2: Reproduce & Localize
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

### Step 3: Generate Hypotheses
- **What**: produce 1-5 candidate root causes, each with a falsifiable check.
- **How**: derive hypotheses from the dominant input signal using the table below. Combine sources when multiple are available.

  | Dominant signal | Hypothesis sources |
  |-----------------|--------------------|
  | Stack trace | Top frame in user code, recently changed code in any frame, null/undefined origin, type mismatch at boundary |
  | Error message | Exact-string search in repo, typed exception class hierarchy, library docs for that error |
  | Recent git diff | Files changed in last N commits intersecting with localized files (Step 2), commit messages mentioning related modules |
  | Behavioral description (no error) | Module boundary mismatches, off-by-one / null-handling, async/race, state leakage, configuration drift |

- Each hypothesis must be written as: `<claim> -- evidence: <pointer> -- check: <how to verify>`.

### Step 4: Verify Root Cause
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

  | Fix class | Indicator | Strategy |
  |-----------|-----------|----------|
  | One-liner | Typo, off-by-one, missing null check, wrong constant | Apply directly, minimal review |
  | Single-file | Logic localized to one module, no public API change | Apply, list affected callers in fix notes |
  | Multi-module | Touches >1 module or shared utility | List impacted modules, read each call site before editing, group by commit if possible |
  | Cross-architecture | Requires layering change, new dependency, or interface redesign | STOP -- recommend `/mvt-design` (or `/mvt-refactor` if behavior is preserved); do NOT implement here |

- Identify regression risk: which existing tests cover this code? If none, decide whether to add a regression test in Step 7.

### Step 6: User Confirmation
- **When to confirm before applying**:
  - Multi-module class or above.
  - The fix changes a public/exported symbol or a configuration default.
  - The reproduction was unverified (Step 2).
  - The fix deletes existing behavior (not just adjusts it).
- **When to apply silently**:
  - One-liner / single-file class AND fix is purely additive or correctional AND reproduction was verified.
- **Confirmation prompt format**: present `Root cause: ...`, `Proposed change: <files + summary>`, `Risk: <regression scope>`, then ask `Apply? (y / n / show-diff)`.

### Step 7: Apply the Fix
- Make the targeted code change.
- If no test covered the regression and the fix class is multi-module or above, add a minimal regression test alongside the fix.
- Re-run the original repro (if any) to confirm resolution.
- If repro still fails -> revert, return to Step 3 with the new evidence.

### Step 8: Write Fix Notes
- **Path**: `.ai-agents/workspace/artifacts/{change-id}/fix-notes.md` if an `active_change` exists; otherwise inline in the conversation only (no artifact -- shortcut operation).
- **Structure** (each section is a single paragraph or list):
  - `Symptom` -- what the user saw / reported.
  - `Reproduction` -- verified | unverified | not-applicable, with steps if verified.
  - `Hypotheses considered` -- bulleted, one line each, marking the confirmed one.
  - `Root cause` -- one paragraph.
  - `Patch summary` -- files touched + one-line per file.
  - `Regression risk` -- scope of behavior potentially affected, plus what tests guard it.
  - `Follow-ups` -- TODOs, deferred refactors, related issues.

### Step 9: (session update handled by shared section)

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| Bug is intermittent / racy | Mark reproduction as "flaky", state confidence level explicitly, prefer adding instrumentation over speculative fix |
| Fix would require breaking a downstream API | STOP -- escalate to `/mvt-design` or `/mvt-refactor`; do not silently break contracts |
| Root cause is in a third-party dependency | Document the upstream issue, apply a minimal local workaround clearly labeled as temporary |
| User aborts at Step 6 | Do not write fix notes; record the diagnosis as a comment in the conversation only |
| Fix relies on changes the user has uncommitted in another branch | Surface the conflict before editing; do not overwrite |
| `active_change` is missing entirely | Apply fix without writing artifact (shortcut mode), summarize result in conversation |
