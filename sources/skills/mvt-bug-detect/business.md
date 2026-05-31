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
