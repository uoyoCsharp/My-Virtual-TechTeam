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
  2. Derive dependencies from `Module Design`, `Key Interfaces`, and `Data Flow`.
  3. Order files dependency-first: shared types/contracts -> dependency-free internals -> dependents -> entry points/controllers/routes/UI shells.
  4. For async/event flows: event schemas first; then producers and consumers after shared contracts. Put producers before consumers only when consumers import producer-side types.
  5. Group consecutive files that share a single conceptual change into one commit boundary.
  6. For each file, decide: `create | modify | delete`, and write a one-line intent.
- **Plan-aware behavior**: if `plan.yaml` exists, resolve one active task before planning. Candidate task ids come from deduplicated `current_tasks`; if one remains, use it. If several remain, prefer an explicit user task id, then match current paths against each candidate's `artifacts.files` and project paths; if still ambiguous, ask the user. Treat the resolved task's `artifacts.files` as a starting-scope hint only; `design.md` Change Tracking remains authoritative. Confirm Step 3 before touching files beyond the hint, and never absorb files that belong to another task.
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
- **How**: run the checks below and record the result in `implementation.md > Design Compliance`. `mvt-review` will use this section as an input and independently verify claimed passes or undocumented deviations.

  | Check | Mode | Failure level | Action on failure |
  |-------|------|---------------|-------------------|
  | Files touched == Change Tracking ± deviation noted | Auto (mechanical list compare) | WARN-and-document | Update `Deviations from Design` OR revert extras |
  | Each file lives in the module/layer assigned by `Module Design` | Semi-auto (path heuristic; downgrade to Manual if design tables lack path/module mapping) | WARN-and-document | Move file or mark deliberate exception with rationale |
  | Public interfaces match `Key Interfaces` (signatures, endpoints) | Semi-auto (grep can find declarations; signature compatibility is Manual) | BLOCK | Adjust to match OR stop and require `/mvt-design` re-run for a deliberate contract change |
  | Forbidden cross-layer imports absent | Auto (mechanical grep against `project-context.md` rules) | BLOCK | Fix before artifact write |
  | Error handling lives only at boundaries listed in design | Manual (read code) | FIX-in-place | Refactor or document why an interior catch was needed |
  | No new external deps not listed in `design.md` ADRs | Auto (mechanical manifest diff; Manual if no manifest exists) | BLOCK | Remove the dependency OR stop and add an ADR via `/mvt-design` |

- **On any BLOCK failure**: stop, fix, re-run Step 5. Do not proceed to Step 6.
- **If `design.md` is missing**: skip only the checks that require design (`Change Tracking`, `Module Design`, `Key Interfaces`, boundary error-handling list, external-dependency ADRs). Still run forbidden import checks when `project-context.md` contains layer or import rules.

### Step 6: Run Quick Self-Check
- **What**: light-weight verification before handing off to `/mvt-review` or `/mvt-test`.
- **How**:
  1. If a type-checker is configured for the project (`tsc`, `mypy`, `cargo check`, etc.), run it on changed files only. Surface failures.
  2. If a fast-running test target exists for the affected module, suggest the command but do not auto-run unless user explicitly approved.
  3. UI/frontend changes: per project rules, ask user to verify in browser; do NOT claim "tested" if you only ran type-check.

### Step 7: Write Artifact
- **Path**: `.ai-agents/workspace/artifacts/{change-id}/implementation.md` — always this filename, one file per change. Never per-task suffixed names.
- **Template**: load from the **Artifact Structure** section below. Follow the HTML comments for what each section should contain; strip comments from the final artifact.
- **Multi-task accumulation**: if `plan.yaml` drives implementation across separate invocations, append a `## Task: {id} — {title}` section per task — never overwrite a *different* task's section. If `## Task: {id}` for the *same* task already exists (re-implementation after `blocked` or rescope), replace that section's content in place — preserve any `### Deliverables` subsection within it. Single-task or plan-less: write at top level without a task wrapper.
- **Required coverage**: cover only content that is applicable to this implementation. Preserve enough information for downstream skills to understand what changed, files touched, design compliance, deviations, validation results, and open TODOs. Do not create empty or artificial sections just because an item is named here; if the template omits or renames a section, place applicable content in the closest relevant section.
- The artifact is a record, not the code. Reference file paths and summarise intent — do NOT paste source listings.

### Step 8: Deliverables Handoff (if applicable)

**SKIP this step entirely** (go directly to Step 9) if ANY of the following is true:
- No `plan.yaml` exists for the active change (`active_change.plan_path` is empty or the file does not exist).
- No task in `plan.tasks[]` has a `depends_on` entry that includes the current task id (i.e., the current task has zero downstream dependents).

> These are hard guards. Do NOT prompt the user about deliverables unless BOTH guards pass.

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

- **After writing deliverables**, call `plan-update.cjs` with both deliverables flags in a single invocation. Use the command below as authoritative:
  ```bash
  node .ai-agents/scripts/plan-update.cjs \
    --plan "<active_change.plan_path>" \
    --task <current_task_id> \
    --deliverables-pointer current \
    --mark-deliverable-stale <downstream_task_id1>[,<downstream_task_id2>,...]
  ```
  Use this exact metadata-only command. Do NOT add `--status`, hand-edit `plan.yaml`, choose `current_tasks`, or read `.cjs`/`.js` source.
  Pass ALL downstream dependent task ids as a comma-separated list to `--mark-deliverable-stale` so that `/mvt-resume` and `/mvt-status` can surface the stale warning.
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
| `design.md` missing | WARN, ask user; if they proceed, mark artifact "Source: conversation only"; in Step 5 skip checks that require design.md but still run forbidden import checks from `project-context.md` when rules exist |
| Implementation reveals the design is infeasible | STOP at Step 4, document the blocker in conversation, recommend `/mvt-design` re-run -- do not silently improvise an alternative |
| Type-checker fails on pre-existing errors unrelated to the change | Note in artifact, do not attempt blanket fixes outside scope |
| User aborts at Step 3 confirmation | Do not write any source files or artifact |
| File listed in `Change Tracking` no longer exists in the working tree | Surface, ask user whether design is stale or file was deleted in a parallel change |
| Implementation must touch a file outside the active project (other repo / submodule) | STOP -- this is out of scope for `/mvt-implement`; surface and ask user to plan it as a separate change |
| Plan task is `blocked` or `done` already | Refuse to implement that task; ask user to pick another task from `current_tasks` or run `/mvt-update-plan` |
| Deliverables already exist and user declines to update | Leave existing deliverables in place; do not call `plan-update.cjs` with deliverables flags |
| `plan-update.cjs` rejects deliverables pointer | Surface error; leave `implementation.md` as written (content is source of truth, pointer can be retried) |
| Re-implementing a task whose `## Task: {id}` section already exists in `implementation.md` | Immediately before editing, re-read `implementation.md` and verify there is exactly one matching `## Task: {id}` heading. Replace that section's content in place; preserve any `### Deliverables` subsection within it. Do NOT create a second `## Task: {id}` section. If zero or multiple matching headings exist, stop and ask the user to resolve the artifact manually. |
