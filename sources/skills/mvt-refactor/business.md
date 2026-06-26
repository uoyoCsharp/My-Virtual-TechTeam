## Execution Flow

### Step 1: Load Inputs
- **Required**:
  - User-specified target (file path, symbol name, module, or "the code I just wrote").
- **Recommended**:
  - Existing tests covering the target (search by file path, by symbol name, and by sibling test files).
  - `git status` / `git diff` -- to know what is already modified before refactoring.
- **Fallback**: if no target was specified, ask the user. Do not refactor speculatively.

### Step 2: Locate and Understand Target
- **What**: produce a precise list of files and line ranges that constitute the refactoring target, plus a one-paragraph statement of what the code currently does.
- **How**:
  1. Resolve the target: glob/grep for the named symbol or path.
  2. List every caller / dependent: grep for the symbol's exported name across the project (and across packages if it is exported beyond the module).
  3. State the current behavior in plain language; include any non-obvious side effects or invariants you can see in the code.
- **Output of this step**: a target table (`file | range | role`) and a "current behavior" paragraph; both are shown to user before continuing.

### Step 3: Identify Project Scope and Load Project-Specific Knowledge

This step applies only when the workspace has multiple projects (`projects.length > 1` in `project-context.yaml`). In single-project workspaces, all relevant knowledge was loaded at activation; skip this step entirely.

- **Project identification**: match the file paths resolved in Step 2 against `projects[].path` and `projects[].source_paths`:
  - A file whose path starts with a project's `path` prefix belongs to that project.
  - A file under a project's `source_paths` entry also belongs to that project.
  - Collect the set of unique project names from all matched files. This is the **active project scope** for this invocation.
- **On-demand knowledge loading**: for each project P in the active project scope, read `.ai-agents/registry.yaml` and load:
  1. Every entry under `knowledge.{P}` -- load each entry's referenced files (resolve relative to `.ai-agents/{source}`).
  2. Every entry under `skills.mvt-refactor.knowledge.{P}` -- load each entry's referenced files.
  3. Skip any key absent from the registry (no project-specific knowledge is valid; do not warn).
- **Multi-project scenario**: if files span multiple projects, load each project's knowledge sequentially. The skill operates with the union of all loaded project-specific knowledge plus the `_all` knowledge already loaded at activation.
- **Unmatched files**: if a file path does not match any project's `path` or `source_paths`, surface a note and ask the user to choose the project scope. Do not silently fall back to the first project.

### Step 4: Classify Refactoring Type
- **What**: pick the smallest type that covers the requested change. Use the Refactoring Types table above for risk levels.
- **How**: assign one primary type per refactoring task. Multiple types in one run are allowed but each must be tracked separately in the artifact.
- If the request requires `Change Interface/API` AND the symbol is exported beyond the project (public API, library entry point, IPC boundary): STOP -- this is no longer a refactoring task; recommend `/mvt-design`.

### Step 5: Risk Assessment
- **What**: assign a final risk score and decide whether explicit confirmation is needed.
- **How**: combine refactoring type and impact factors.

  | Factor | +risk |
  |--------|-------|
  | Touches > 10 files | +1 |
  | Touches a public/exported symbol | +1 |
  | No existing tests on the target | +1 |
  | Target is in a critical path (auth, payments, persistence boundary, public API) | +1 |
  | User has uncommitted changes overlapping the target | +1 |

- Final risk = type's base level + factors:
  - Low + 0..1 -> proceed silently in Step 8.
  - Medium OR Low + 2 -> require explicit confirmation in Step 7.
  - High OR (Medium + 2) -> require explicit confirmation AND a behavior-preservation strategy from Step 6.

### Step 6: Choose Behavior-Preservation Strategy
- **What**: pick a verification path BEFORE editing.
- **How**: choose the row that matches your test reality.

  | Test reality | Strategy |
  |--------------|----------|
  | Comprehensive tests cover the target | Run them once before changes (capture baseline), once after each step, and once at the end |
  | Some tests exist, gaps known | Do the refactor in incremental steps; after each step, run available tests; for gaps, add a single characterization test BEFORE refactoring (capture current behavior, even if quirky) |
  | No tests exist | Choose ONE: (a) write a minimal characterization test first, OR (b) for Low-risk refactors only, use mechanical refactoring (rename, extract) where the editor / language tooling guarantees behavior. Never attempt High-risk refactors with zero tests |

- Document the chosen strategy in the artifact regardless of risk level.

### Step 7: Confirm with User (when required)
- **Trigger**: per the Step 5 thresholds, or any High-risk type.
- **Format**: present a single screen with:
  - Target summary (Step 2's table, condensed to file count + symbol).
  - Refactoring type and risk level.
  - Number of callers and a list of the top 5 affected files.
  - Behavior-preservation strategy (Step 6).
  - One yes/no prompt: `Proceed with this refactor? (y / n / show-plan)`.

### Step 8: Plan and Execute Incrementally
- **What**: apply the change in the smallest reversible steps.
- **How**:
  1. Break the refactor into ordered sub-steps (e.g., Rename: 1) update declaration, 2) update callers, 3) update tests, 4) update docs).
  2. After each sub-step:
     - Compile / type-check the affected files.
     - If a test command was identified in Step 6, run it (or surface it for user to run if running tests is not allowed in this environment).
     - On failure: revert the sub-step, surface the cause, do NOT continue.
  3. Do not interleave behavior changes (bug fixes, feature toggles) with the refactor. If you spot one, note it for follow-up; do not silently include it.
  4. Do not modify code outside the planned target unless required for compilation/type correctness; record any such "incidental" edits.

### Step 9: Verify Behavior Preservation
- **What**: prove (within the chosen strategy) that observable behavior is unchanged.
- **How**:
  - With tests: all pre-existing tests pass; new characterization tests pass; assert pass count is unchanged or increased.
  - Without tests: list the call sites you visually verified, plus the manual behavior checks you recommend the user run.
- If anything regresses: revert the most recent sub-step, surface the regression, return to Step 8. Do not declare success.

### Step 10: Write Refactor Notes
- **Path**: `.ai-agents/workspace/artifacts/{change-id}/refactor-notes.md` if `active_change` exists; otherwise inline summary in conversation only (shortcut mode).
- **Required content**:
  - `Target` -- file/symbol list, current-behavior paragraph.
  - `Refactoring Type` and final risk level.
  - `Behavior-Preservation Strategy` -- chosen row + tests touched / written.
  - `Steps Applied` -- ordered sub-steps with one-line outcome each.
  - `Incidental Edits` -- any unplanned files touched, with reason.
  - `Verification Result` -- tests run, pass/fail counts; or manual checks recommended.
  - `Follow-ups` -- deferred behavior changes spotted during refactoring.

### Step 11: State Update
Apply the State Update rules defined in the **State Update** section below.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| Target spans multiple repos / submodules | STOP -- out of scope; recommend a coordinated change rather than a single refactor |
| Refactor uncovers a real bug | Pause refactor, document the bug, recommend `/mvt-fix` -- do NOT fix during the refactor |
| Refactor target is dead code | Confirm with user before deleting; offer alternative of marking deprecated first |
| Symbol is referenced via reflection / dynamic dispatch / string lookup | Increase risk by +2; require strategy 6(a) (characterization test) before proceeding |
| User has uncommitted changes overlapping the target | Show diff, recommend committing/stashing first, ask for explicit confirmation if user wants to proceed anyway |
| Type/test failures persist after revert | Surface a clear summary; suggest user re-run the original test baseline to detect a pre-existing failure unrelated to the refactor |
| User aborts at Step 7 | Do not modify any file; report "no changes" |
| Active change is mid-implementation (not yet `done`) | Warn that refactoring during implementation can confuse review/test phases; require explicit confirmation |
