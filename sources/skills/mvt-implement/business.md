## Execution Flow

### Step 1: Load Inputs
- **Required**:
  - The actual source files referenced in the design's `File Structure` and `Change Tracking` sections.
- **Fallback**:
  - If `design.md` is missing, surface a WARN and ask the user whether to (a) run `/mvt-design` first or (b) proceed using their conversational description as the design (mark artifact with "Source: conversation only").
  - If `coding-standards.md` is missing, fall back to language/framework defaults inferred from `project-context.yaml`.

### Step 2: Plan the Implementation
- **What**: produce an ordered file list with the smallest possible commit boundary per group.
- **How**:
  1. Take `Change Tracking` from `design.md` as the source of truth for which files are in scope.
  2. Topologically order files by dependency: domain entities -> repositories/adapters -> use-case/services -> controllers/UI.
  3. Group consecutive files that share a single conceptual change into one commit boundary.
  4. For each file, decide: `create | modify | delete`, and write a one-line intent.
- **Plan-aware behavior**: if `plan.yaml` is present, restrict scope to the files implied by `current_task` (cross-reference `plan.tasks[*].artifacts.files`); do NOT silently expand into other tasks.
- **Output of this step**: an in-conversation list shown to user as a preview, with no write yet.

### Step 3: Confirm Scope (when needed)
- **Confirm before writing if any are true**:
  - The plan touches > 5 files.
  - The plan introduces a new public API (exported symbol, HTTP endpoint, CLI flag).
  - The plan deletes existing code (delete count > 0).
  - The plan deviates from `design.md` (e.g., adds files not in `Change Tracking` or skips files listed there).
- **Otherwise**: proceed silently.
- **On deviation from design**: explain the deviation reason in one line; if the deviation is structural (new module, layer change, interface break), STOP and recommend re-running `/mvt-design`.

### Step 4: Implement Code
- **What**: write/modify the planned files, one commit-group at a time.
- **How**:
  1. For each commit-group: write all files, then move on. Do not interleave groups.
  2. Follow `coding-standards.md`. Match the surrounding code style if standards are silent.
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
- **Path**: `.ai-agents/workspace/artifacts/{active_change.id}/implementation.md`.
- **Template**: `.ai-agents/skills/_templates/implement-output.md` (custom override at `_templates/custom/...` takes precedence).
- **Required content** (mapped to template headings):
  - `Implementation Summary` -- one paragraph: what was built, scope.
  - `Files Touched` -- table: path | create/modify/delete | one-line intent.
  - `Design Compliance` -- summary of Step 5 checks (passed / deviated, with reasons).
  - `Deviations from Design` -- empty list is acceptable; otherwise list each deviation with rationale.
  - `Self-Check Results` -- type-check status, suggested test commands (Step 6).
  - `Open TODOs` -- anything deferred for `/mvt-review`, `/mvt-test`, or follow-up changes.
- The actual source code goes to the project tree; the artifact is a record, not the code itself.

### Step 8: Plan-Aware Progress Hint (if applicable)
- If `plan.yaml` exists and a single `current_task` covers this implementation, suggest the user run `/mvt-update-plan <task-id> done` (or `blocked` with reason).
- Do NOT modify `plan.yaml` directly from this skill; it is owned by `/mvt-update-plan`.
- Do NOT modify `changes` directly; it is owned by `/mvt-plan-dev` / `/mvt-update-plan`.

### Step 9: (session update handled by shared section)
- Standard `history` entry must include `change_id`. All other state mutations are delegated.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| `design.md` missing | WARN, ask user; if they proceed, mark artifact "Source: conversation only" and skip Step 5 design-match checks |
| Implementation reveals the design is infeasible | STOP at Step 4, document the blocker in conversation, recommend `/mvt-design` re-run -- do not silently improvise an alternative |
| Type-checker fails on pre-existing errors unrelated to the change | Note in artifact, do not attempt blanket fixes outside scope |
| User aborts at Step 3 confirmation | Do not write any source files or artifact |
| File listed in `Change Tracking` no longer exists in the working tree | Surface, ask user whether design is stale or file was deleted in a parallel change |
| Implementation must touch a file outside the active project (other repo / submodule) | STOP -- this is out of scope for `/mvt-implement`; surface and ask user to plan it as a separate change |
| Plan task is `blocked` or `done` already | Refuse to implement that task; ask user to pick another `current_task` or run `/mvt-update-plan` |
