## Execution Flow

### Step 1: Load Inputs
- **Required**:
  - The actual source files referenced in the design's `File Structure` and `Change Tracking` sections.
- **Fallback**:
  - If `design.md` is missing, surface a WARN and ask the user whether to (a) run `/mvt-design` first or (b) proceed using their conversational description as the design (mark artifact with "Source: conversation only").
  - If coding standards are not loaded by activation, fall back to language/framework defaults inferred from `project-context.yaml`.

### Step 2: Plan the Implementation
- **What**: produce an ordered file list with the smallest possible commit boundary per group.
- **How**:
  1. Take `Change Tracking` from `design.md` as the source of truth for which files are in scope.
  2. Topologically order files by dependency: domain entities -> repositories/adapters -> use-case/services -> controllers/UI.
  3. Group consecutive files that share a single conceptual change into one commit boundary.
  4. For each file, decide: `create | modify | delete`, and write a one-line intent.
- **Plan-aware behavior**: if `plan.yaml` is present, identify the active task from `current_tasks` (the entry matching the current project, or the sole entry in single-project mode), then treat that task's `artifacts.files` (cross-reference `plan.tasks[*].artifacts.files`) as a **starting-scope hint, not a hard ceiling**. The source of truth for scope remains `design.md`'s `Change Tracking` (per Step 2.1). When `artifacts.files` is `null` or empty, derive scope entirely from `Change Tracking`. If implementation reveals files beyond this hint are genuinely required, do NOT silently expand — surface them via Step 3 confirmation and never absorb files that clearly belong to a different task.
- **Output of this step**: an in-conversation list shown to user as a preview, with no write yet.

### Step 3: Confirm Scope (when needed)
- **Confirm before writing if any are true**:
  - The plan touches > 5 files.
  - The plan introduces a new public API (exported symbol, HTTP endpoint, CLI flag).
  - The plan deletes existing code (delete count > 0).
  - The plan deviates from `design.md` (e.g., adds files not in `Change Tracking` or skips files listed there).
  - The plan touches files beyond the active task's `artifacts.files` hint (state which files are added and why, in one line each).
- **Otherwise**: proceed silently.
- **On deviation from design**: explain the deviation reason in one line; if the deviation is structural (new module, layer change, interface break), STOP and recommend re-running `/mvt-design`.

### Step 4: Implement Code
- **What**: write/modify the planned files, one commit-group at a time.
- **How**:
  1. For each commit-group: write all files, then move on. Do not interleave groups.
  2. Follow the coding standards loaded by activation (if any). Match the surrounding code style if standards are silent.
  3. Respect module/layer rules from `project-context.md`. Forbidden imports must NOT appear; use the abstractions defined in `design.md`'s `Key Interfaces`.
  4. Add error handling at system boundaries only (HTTP, DB, external API, file IO, message bus). Do NOT add try/catch around internal calls "just in case".
  5. Inline comments only for: non-obvious algorithmic choices, deliberate workarounds with a reason, interface contracts not expressible in code. Never narrate WHAT the code does.
  6. Do NOT introduce abstractions, helpers, or feature flags beyond what the task requires.

### Step 5: Verify Design Compliance
- **What**: confirm the implementation matches the design before writing the artifact.
- **How**: run the checks below. Each is either Auto (mechanical / scriptable / type-checker) or Manual (read the design + diff).

  | Check | Mode | Action on failure |
  |-------|------|-------------------|
  | Files touched == Change Tracking ± deviation noted | Auto (compare lists) | Update artifact's deviation log OR revert extras |
  | Each file lives in the module/layer assigned by `Module Design` | Auto (path match against design table) | Move file or mark deliberate exception with rationale |
  | Public interfaces match `Key Interfaces` (signatures, endpoints) | Auto (grep for declarations) | Adjust to match OR raise as deliberate change requiring `/mvt-design` re-run |
  | Forbidden cross-layer imports absent | Auto (grep import paths against `project-context.md` rules) | BLOCK -- must fix before artifact write |
  | Error handling lives only at boundaries listed in design | Manual (read code) | Refactor or document why an interior catch was needed |
  | No new external deps not listed in `design.md` ADRs | Auto (diff package manifests) | Either remove or add an ADR via `/mvt-design` |

- **On any BLOCK failure**: stop, fix, re-run Step 5. Do not proceed to Step 6.

### Step 6: Run Quick Self-Check
- **What**: light-weight verification before handing off to `/mvt-review` or `/mvt-test`.
- **How**:
  1. If a type-checker is configured for the project (`tsc`, `mypy`, `cargo check`, etc.), run it on changed files only. Surface failures.
  2. If a fast-running test target exists for the affected module, suggest the command but do not auto-run unless user explicitly approved.
  3. UI/frontend changes: per project rules, ask user to verify in browser; do NOT claim "tested" if you only ran type-check.

### Step 7: Write Artifact
- **Path and template**: as defined in the **Artifact Structure** section below. The artifact filename is ALWAYS `implementation.md` — one file per change, never per task. Do NOT invent task-suffixed names like `implementation-t1.md`.
- **Multi-task plans (single-file accumulation)**: when `plan.yaml` drives the change and you implement tasks across separate invocations, all task implementations accumulate into the **same** `implementation.md`:
  1. If `implementation.md` does not yet exist -> create it from the template.
  2. If it already exists -> read it, then **append** a new `## Task: {current_task_id} — {task_title}` section for this task. Do NOT overwrite prior tasks' sections.
  3. Under that task section, place this invocation's required content (the headings below). Keep earlier tasks' sections intact.
  4. For single-task or plan-less changes, write the content at the top level without a per-task wrapper (existing behavior).
- **Required content** (mapped to template headings):
  - `Implementation Summary` -- one paragraph: what was built, scope.
  - `Files Touched` -- table: path | create/modify/delete | one-line intent.
  - `Design Compliance` -- summary of Step 5 checks (passed / deviated, with reasons).
  - `Deviations from Design` -- empty list is acceptable; otherwise list each deviation with rationale.
  - `Self-Check Results` -- type-check status, suggested test commands (Step 6).
  - `Open TODOs` -- anything deferred for `/mvt-review`, `/mvt-test`, or follow-up changes.
- The actual source code goes to the project tree; the artifact is a record, not the code itself.

### Step 8: Deliverables Handoff (if applicable)

This step applies only when `plan.yaml` exists and the current task has downstream dependents (other tasks whose `depends_on` includes the current task).

- **Check for downstream dependents**: scan `plan.tasks[]` for any task whose `depends_on` array includes the current task id. If none exist, skip this step silently.
- **Prompt the user**:
  - If `task.deliverables` already exists (re-implementation / rescope): "Implementation changed, and downstream task(s) {ids} depend on it. Update deliverables? (y/n)"
  - If this is the first time (no `deliverables` field on the task): "Downstream task(s) {ids} will consume this task's output. Generate deliverables? (default y)"
- **On confirmation**, append a deliverables subsection under the task's existing `## Task: {id}` section in `implementation.md` (if multi-task plan) or as a dedicated section (if single-task). Use this soft skeleton:

  ```markdown
  ### Deliverables

  #### Public Interface
  {Describe exported symbols, function signatures, endpoint contracts that downstream tasks rely on.}

  #### Data Shapes
  {Describe data structures, types, schemas that flow between this task and downstream consumers.}

  #### Usage Constraints
  {Document invariants, preconditions, or side effects that downstream tasks must respect.}
  ```

- **After writing deliverables**, call `plan-update.cjs` with both flags in a single invocation:
  ```bash
  node .ai-agents/scripts/plan-update.cjs \
    --plan "<active_change.plan_path>" \
    --task <current_task_id> \
    --status <current_status> \
    --deliverables-pointer current \
    --mark-deliverable-stale <downstream_task_id1>[,<downstream_task_id2>,...]
  ```
  The `--status` must be the task's current status (typically `in_progress` at this point, since Step 9 has not yet run). Pass ALL downstream dependent task ids as a comma-separated list to `--mark-deliverable-stale` so that `/mvt-resume` and `/mvt-status` can surface the stale warning.
- **On user decline**: do not write deliverables and do not call `plan-update.cjs` with the deliverables flags. The downstream tasks will not receive stale warnings, which is acceptable if the user considers the contract unchanged.
- **Error handling**: if `plan-update.cjs` rejects (e.g., malformed freshness), surface stderr and leave `implementation.md` as written. The deliverables content is the source of truth; the pointer can be retried via `/mvt-update-plan`.

### Step 9: Plan-Aware Progress Hint (if applicable)
- If `plan.yaml` exists and `current_tasks` identifies the active task for this implementation, suggest the user run `/mvt-update-plan <task-id> done` (or `blocked` with reason).
- If the files actually touched differ from the active task's `artifacts.files` (extra files added during Step 3, or planned files left untouched), explicitly remind the user to run `/mvt-update-plan` so the plan's `artifacts.files` reflects reality for `/mvt-resume` and future sessions.
- Do NOT modify `plan.yaml` directly from this skill; it is owned by `/mvt-update-plan`.
- Do NOT modify `changes` directly; it is owned by `/mvt-plan-dev` / `/mvt-update-plan`.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| `design.md` missing | WARN, ask user; if they proceed, mark artifact "Source: conversation only" and skip Step 5 design-match checks |
| Implementation reveals the design is infeasible | STOP at Step 4, document the blocker in conversation, recommend `/mvt-design` re-run -- do not silently improvise an alternative |
| Type-checker fails on pre-existing errors unrelated to the change | Note in artifact, do not attempt blanket fixes outside scope |
| User aborts at Step 3 confirmation | Do not write any source files or artifact |
| File listed in `Change Tracking` no longer exists in the working tree | Surface, ask user whether design is stale or file was deleted in a parallel change |
| Implementation must touch a file outside the active project (other repo / submodule) | STOP -- this is out of scope for `/mvt-implement`; surface and ask user to plan it as a separate change |
| Plan task is `blocked` or `done` already | Refuse to implement that task; ask user to pick another task from `current_tasks` or run `/mvt-update-plan` |
| Deliverables already exist and user declines to update | Leave existing deliverables in place; do not call `plan-update.cjs` with deliverables flags |
| `plan-update.cjs` rejects deliverables pointer | Surface error; leave `implementation.md` as written (content is source of truth, pointer can be retried) |
