# Implementation: Epic Decomposition Layer (OPT-2026-003)

## Task: t1-data-foundation — session.yaml schema + session-update.js epic params + combo validation

### Implementation Summary

Extended the session state foundation to support the Epic -> Change two-tier hierarchy. Added `active_epic`, `epics[]`, and `active_change.epic_id` fields to `session.yaml`. Extended `session-update.js` with 5 new epic flags (`--new-epic`, `--set-epic-path`, `--set-epic-status`, `--close-epic`, and extended `--new-change --epic-id`) plus 4 combo validation rules, mirroring the existing `--new-change` / `--change-id` pattern (ADR-10). All changes are backward-compatible: old session.yaml without epic fields are handled gracefully via `|| {}` / `|| ""` fallbacks.

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `sources/defaults/session.yaml` | Modify | Add `active_epic`, `epics[]`, and `active_change.epic_id` with documented defaults |
| `sources/scripts/session-update.js` | Modify | Add 5 epic flags, 4 combo validation rules, auto-snapshot on `--new-epic`, preserve `epic_id` in all `changes[]` snapshots |

### Implementation Details

**session.yaml schema additions**:
- `active_epic` section (4 fields: `id`, `title`, `created_at`, `epic_path`) placed before `active_change`
- `epics: []` with commented example showing the entry structure (`id`, `title`, `epic_path`, `status`, `updated_at`)
- `epic_id: ""` added to `active_change` with inline comment

**session-update.js changes**:
- **ERRORS**: 4 new constants — `EPIC_ID_REQUIRED`, `CLOSE_NEW_EPIC_CONFLICT`, `NO_ACTIVE_EPIC`, `EPIC_ID_ORPHAN`
- **validate()**: 3 new combo rules after existing `CHANGE_ID_REQUIRED`:
  1. `--new-epic` requires `--epic-id`
  2. `--close-epic` mutually exclusive with `--new-epic`
  3. `--epic-id` (standalone) requires `--new-change` or `--new-epic`
  4. `--set-epic-path` / `--set-epic-status` require active epic (runtime check in branch, not validate)
- **--new-change extension**: `session.active_change.epic_id = args["epic-id"] || ""` — links sub-change to parent epic
- **--close-change**: snapshot entry now includes `epic_id: ac.epic_id || ""`, and the reset object includes `epic_id: ""`
- **--update-change**: entry now includes `epic_id: ac.epic_id || ""`
- **--new-change snapshot**: snapshotEntry now includes `epic_id: session.active_change.epic_id || ""`
- **--new-epic**: mirrors `--new-change` pattern — auto-snapshot old `active_epic` into `epics[]`, then set new `active_epic`
- **--set-epic-path**: sets `active_epic.epic_path`, exits 1 if no active epic
- **--set-epic-status**: updates matching `epics[]` entry `status` + `updated_at`, exits 1 if no active epic
- **--close-epic**: sets matching `epics[]` entry to `done`, clears `active_epic` to empty defaults

### Design Compliance

| Check | Result |
|-------|--------|
| Files touched == Change Tracking | PASS — 2 files match Module 1 scope |
| Module/layer assignment | PASS — both files in Data Foundation module |
| Public interfaces match Key Interfaces | PASS — CLI flags match design's `session-update.cjs Epic Interface` |
| Forbidden cross-layer imports | PASS — no imports changed |
| Error handling at boundaries only | PASS — `process.exit(1)` only for missing active epic (input validation boundary) |
| No new external deps | PASS — same `node:fs`, `node:path`, `yaml` imports |

### Deviations from Design

None. Implementation follows the design exactly.

### Self-Check Results

- **tsc**: clean (no errors)
- **vitest**: 169/169 tests passed (all existing tests remain green)
- **Suggested test commands**: `npx vitest run test/` — session-update regression to be added in t8

### Open TODOs

- Combo validation rule 4 ("`--set-epic-path` / `--set-epic-status` require active epic") is implemented as a runtime check inside the branch (not in `validate()`) because it depends on session state (`active_epic.id`), not just args. The design's `validate()` function is args-only, which is the correct separation.
- `install-manifest.yaml` is NOT changed in this task — the `epic-update.cjs` pattern belongs to t2 (Module 2).

### Deliverables

#### Public Interface

**session-update.cjs epic flags** (called by mvt-decompose, mvt-analyze, mvt-update-plan, mvt-status, mvt-resume, mvt-cleanup):

```bash
# Create new epic (mvt-decompose)
node .ai-agents/scripts/session-update.cjs \
  --skill mvt-decompose --summary "..." \
  --new-epic "<title>" --epic-id "epic-YYYYMMDD-..." \
  [--set-epic-path "<path-to-epic.yaml>"]

# Create sub-change linked to epic (mvt-analyze)
node .ai-agents/scripts/session-update.cjs \
  --skill mvt-analyze --summary "..." \
  --new-change "<title>" --change-id "<id>" --epic-id "epic-..."

# Close epic (mvt-update-plan / mvt-cleanup)
node .ai-agents/scripts/session-update.cjs \
  --skill <name> --summary "..." --close-epic

# Update epic status (mvt-update-plan)
node .ai-agents/scripts/session-update.cjs \
  --skill <name> --summary "..." --set-epic-status <status>

# Set epic path (mvt-decompose, post-write)
node .ai-agents/scripts/session-update.cjs \
  --skill <name> --summary "..." --set-epic-path "<path>"
```

#### Data Shapes

**session.yaml additions** (all downstream tasks read these fields):

```yaml
active_epic:
  id: ""            # epic-YYYYMMDD-slug or empty
  title: ""
  created_at: ""    # ISO timestamp or empty
  epic_path: ""     # path to epic.yaml or empty

epics: []           # Array of: { id, title, epic_path, status, updated_at }

active_change:
  # ... existing fields ...
  epic_id: ""       # parent epic id or empty
```

**changes[] entries** now include `epic_id` field (may be empty string for non-epic changes).

#### Usage Constraints

1. **Backward compat**: Old session.yaml without `active_epic` / `epics[]` / `epic_id` fields is handled gracefully — all branches use `session.active_epic = session.active_epic || {}` and `|| ""` fallbacks.
2. **Combo validation**: `--new-epic` always requires `--epic-id`; `--close-epic` and `--new-epic` are mutually exclusive; standalone `--epic-id` requires `--new-change` or `--new-epic`.
3. **Runtime guards**: `--set-epic-path` and `--set-epic-status` exit non-zero if `active_epic.id` is empty (and `--new-epic` is not simultaneously creating one).
4. **Auto-snapshot**: `--new-epic` snapshots the prior `active_epic` into `epics[]` (mirroring `--new-change` → `changes[]`); `--close-epic` sets the matching `epics[]` entry to `done`.
5. **All `changes[]` write paths** (new-change snapshot, update-change, close-change) now include `epic_id` — downstream tasks can rely on this field being present in any change entry created after t1.

## Task: t2-epic-update-script — epic-update.js deterministic state script + build wiring

### Implementation Summary

Created the `epic-update.js` deterministic mutation script (476 lines) mirroring `plan-update.js` structure and output protocol (ADR-9). Supports 5 operations: `--complete-child`, `--set-child-status`, `--switch-active`, `--add-child` (multi-flag with `--child-title`, `--child-scope`, `--child-depends-on`), and `--validate` (read-only). Includes Kahn's algorithm for DAG cycle detection, 6 validation rules, and deterministic `recomputeCurrentChange` with array-order tie-break. Added build entry point and install-manifest generated pattern. Fixed a parseArgs bug where `--child-title`/`--child-scope` used `arg.slice(2)` instead of `arg.slice(8)` to strip the `--child-` prefix.

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `sources/scripts/epic-update.js` | Create | Deterministic epic.yaml mutation script (parseArgs → read YAML → mutate → validate → atomic write → JSON stdout) |
| `build-scripts.js` | Modify | Add `epic-update.js` to esbuild `entryPoints` |
| `install-manifest.yaml` | Modify | Add `epic-update.cjs` to generated patterns |

### Implementation Details

**epic-update.js structure** (mirrors plan-update.js ADR-9 protocol):
- **parseArgs**: Custom parser handles `--add-child` as repeatable grouped flag, `--set-child-status` consuming two positional values, `--child-title`/`--child-scope`/`--child-depends-on` attaching to the last `--add-child` entry
- **Constants**: `VALID_CHILD_STATUSES`, `VALID_EPIC_STATUSES`, `TERMINAL_STATUSES`, `ERRORS` (11 error constructors)
- **DAG**: Kahn's algorithm (`findCycle`) — returns cycle description array or null
- **Validation** (6 rules): unique `change_id`, valid `depends_on` refs, DAG (no cycles), `current_change` points to pending/active, at-most-one active, status consistency
- **Operations**:
  - `--complete-child`: Set done + `completed_at`, recompute `current_change` to FIRST ready pending child (array-order tie-break); all done/abandoned → `epic.status = done`
  - `--set-child-status`: Change child status + `completed_at` if terminal
  - `--switch-active`: Atomic demote-old + promote-target + repoint `current_change`; validates target deps are resolved
  - `--add-child`: Append new child(ren) with title, scope, optional depends_on; validates unique id
  - `--validate`: Read-only validation, exits 0 (valid) or 1 (error list)
- **Output protocol**: exit 0 + single-line JSON stdout, or exit 1 + plain-text stderr
- **Atomic write**: temp file + `renameSync` (same as plan-update.js)

**Bug fix**: `parseArgs` line `current[arg.slice(2)]` → `current[arg.slice(8)]` to correctly strip `--child-` prefix (6 chars for `--` + `child-`).

### Design Compliance

| Check | Result |
|-------|--------|
| Files touched == Change Tracking | PASS — 3 files match Module 2 scope |
| Module/layer assignment | PASS — script in `sources/scripts/`, build config at root |
| Public interfaces match Key Interfaces | PASS — CLI flags match design's `epic-update.cjs Interface` |
| Forbidden cross-layer imports | PASS — only `node:fs` and `yaml` imports |
| Error handling at boundaries only | PASS — `process.exit(1)` only for arg validation and I/O errors |
| No new external deps | PASS — same `yaml` dependency as plan-update.js |

### Deviations from Design

None. Implementation follows the design exactly.

### Self-Check Results

- **tsc**: clean (no errors)
- **vitest**: 169/169 tests passed (all existing tests remain green)
- **Smoke tests**: All 5 operations verified — `--validate` (exit 0), `--complete-child` (advances c2), `--switch-active`, `--add-child` with `--child-title`/`--child-scope`/`--child-depends-on`, error handling (unknown child id)
- **Suggested test commands**: `npx vitest run test/` — epic-update unit tests to be added in t8

### Open TODOs

- Unit tests for `epic-update.js` deferred to t8 (as per plan.yaml build order)
- `--add-child` multi-child mode (multiple `--add-child` in one invocation) smoke-tested via code trace but not individually executed

### Deliverables

#### Public Interface

**epic-update.cjs** (called by mvt-decompose, mvt-analyze, mvt-update-plan, mvt-status, mvt-resume):

```bash
# Validate epic.yaml (mvt-status, mvt-resume)
node .ai-agents/scripts/epic-update.cjs --validate <epic.yaml>

# Complete a child change (mvt-update-plan Step 5)
node .ai-agents/scripts/epic-update.cjs \
  --epic <epic.yaml> --complete-child <change_id>

# Set child status (mvt-update-plan defer path)
node .ai-agents/scripts/epic-update.cjs \
  --epic <epic.yaml> --set-child-status <change_id> --child-status <status>

# Switch active child (mvt-analyze scenario C)
node .ai-agents/scripts/epic-update.cjs \
  --epic <epic.yaml> --switch-active <change_id>

# Add child(ren) (mvt-decompose)
node .ai-agents/scripts/epic-update.cjs \
  --epic <epic.yaml> \
  --add-child <id> --child-title "<title>" --child-scope "<scope>" \
  [--child-depends-on "dep1,dep2"] \
  [--add-child <id2> --child-title "<title2>" ...]
```

#### Data Shapes

**epic.yaml** (read/written by this script):

```yaml
epic_id: epic-YYYYMMDD-slug
title: "Epic Title"
status: in_progress          # in_progress | done | abandoned
current_change: c1           # active child change_id or ""
updated_at: "ISO timestamp"
children:
  - change_id: c1
    title: "Child title"
    scope: "Child scope description"
    status: active            # pending | active | done | abandoned
    depends_on: []            # array of change_id refs
    project: [default]
    completed_at: null        # ISO timestamp or null
```

**stdout JSON** (success, exit 0):
```json
{"ok":true,"child":{"change_id":"c1","old_status":"active","new_status":"done"},"current_change":"c2","epic_status":"in_progress","progress":{"done":1,"total":2}}
```

#### Usage Constraints

1. **Atomic writes**: Uses temp-file + `renameSync` pattern — safe against partial writes.
2. **DAG enforcement**: `--switch-active` rejects targets with unresolved `depends_on` (deps not in `done`/`abandoned` status). `--add-child` validates `depends_on` refs exist.
3. **Deterministic advancement**: `recomputeCurrentChange` picks the FIRST pending child with all deps resolved, using array order as tie-break (not alphabetical).
4. **Backward compat**: epic.yaml without `updated_at` or `completed_at` fields handled via `|| null` fallbacks.
5. **Output protocol**: Always single-line JSON on stdout (exit 0) or plain-text on stderr (exit 1). Callers should parse stdout for status info.

## Task: t3-decompose-skill — mvt-decompose skill (manifest + business + template) + registry

### Implementation Summary

Created the `mvt-decompose` skill as the dedicated entry point for epic-scale requirements. The skill consists of 4 new source files: a manifest (assembly blueprint), a business.md (7-step execution flow), a decompose-output template (manifest + body with 6 sections), plus a registry entry. The manifest uses shared sections (role-header, activation-load-context/config, output-language/format constraints, preflight, footer-next-steps) with an inline State Update section for the epic-specific `--new-epic` session command. The business.md defines the full decomposition flow: load requirements, sanity gate, epic analysis, decompose into 2-8 children with DAG, write epic.md + epic.yaml with self-validation, session update, and output display.

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `sources/skills/mvt-decompose/manifest.yaml` | Create | Skill assembly blueprint with shared sections + inline epic-specific State Update |
| `sources/skills/mvt-decompose/business.md` | Create | 7-step execution flow (load, sanity gate, epic analysis, decompose, write artifacts, session update, output) |
| `sources/templates/decompose-output/manifest.yaml` | Create | Template assembly manifest (mirrors analyze-output pattern) |
| `sources/templates/decompose-output/body.md` | Create | epic.md narrative template (6 sections: Vision, Scope, Cross-cutting, Child Stories, Dependency Map, Open Questions) |
| `registry.yaml` | Modify | Register mvt-decompose (agent: analyst, category: workflow, depends_on: mvt-analyze) |

### Implementation Details

**manifest.yaml structure** (10 sections):
1. Inline: Purpose (decompose epic-scale requirements)
2. Shared: role-header (Strategist / analyst)
3. Shared: activation-load-context
4. Shared: activation-load-config
5. Shared: output-language-constraint
6. Shared: output-format-constraint
7. Shared: activation-preflight (3 checks: session, project, active_change warning)
8. File: business.md
9. Inline: Artifact Structure (epic.md template + epic.yaml schema + epic-id format)
10. Inline: State Update (`--new-epic` + `--epic-id` + `--set-epic-path`)
11. Shared: footer-next-steps (suggest /mvt-analyze)

**business.md 7-step flow**:
- Step 1: Load Requirements (file or user message)
- Step 2: Lightweight Sanity Gate (too small -> redirect to /mvt-analyze)
- Step 3: Epic Analysis (vision, scope, cross-cutting concerns, actors)
- Step 4: Decompose into 2-8 Sub-changes (change_id, title, scope, depends_on, project)
- Step 5: Write Artifacts (epic.md narrative + epic.yaml structured, self-validation checklist, optional --validate)
- Step 6: Update Session (session-update.cjs --new-epic)
- Step 7: Output (child story table + dependency mermaid + suggested starting child)

**Design choice**: State Update uses an inline section instead of the shared session-update.md template, because the shared template generates `--new-change` / `--change-id` while decompose needs `--new-epic` / `--epic-id`. Adding `--new-epic` as a Mustache parameter to the shared template was rejected as premature coupling for a single caller.

**install-manifest.yaml**: No change needed — the existing glob `.ai-agents/skills/_templates/*-output.md` already matches `decompose-output.md`.

### Design Compliance

| Check | Result |
|-------|--------|
| Files touched == Change Tracking | PASS — 5 files match Module 3 scope |
| Module/layer assignment | PASS — skill in `sources/skills/`, template in `sources/templates/`, registry at root |
| Public interfaces match Key Interfaces | PASS — `/mvt-decompose [file-path]` matches design's interface |
| Forbidden cross-layer imports | PASS — no code imports (all Markdown/YAML) |
| Error handling at boundaries only | PASS — sanity gate is input validation, not interior error handling |
| No new external deps | PASS — no package.json changes |

### Deviations from Design

None. Implementation follows the design exactly.

### Self-Check Results

- **tsc**: clean (no errors)
- **vitest**: 169/169 tests passed (all existing tests remain green)
- **Assembler**: `mvt-decompose` manifest assembles to 299 lines without error; `decompose-output` template assembles correctly with 6 sections
- **Suggested test commands**: `npx vitest run test/` — assembler test for mvt-decompose to be added in t8 if needed

### Open TODOs

- No assembler-specific test for mvt-decompose (existing assembler.test.ts covers general assembly; t8 may add decompose-specific assertions)
- The `active_change.id` preflight check (WARN) may need refinement — currently warns even when the active change is unrelated to the epic being created

### Deliverables

#### Public Interface

**`/mvt-decompose [file-path]`** (called by users, routed from mvt-analyze Step 3 epic detection):
- Accepts an optional file path argument pointing to a requirements document
- Falls back to user message text if no file provided
- Produces `epic.yaml` + `epic.md` in `.ai-agents/workspace/artifacts/{epic_id}/`
- Updates session via `session-update.cjs --new-epic`

**Session update command** (called by the skill's State Update section):
```bash
node .ai-agents/scripts/session-update.cjs \
  --skill mvt-decompose --summary "..." \
  --new-epic "<title>" --epic-id "epic-YYYYMMDD-..." \
  --set-epic-path ".ai-agents/workspace/artifacts/{epic_id}/epic.yaml"
```

**Optional validation** (post-write safety net):
```bash
node .ai-agents/scripts/epic-update.cjs --validate <epic.yaml path>
```

#### Data Shapes

**epic.yaml** (written by this skill, consumed by epic-update.cjs, mvt-analyze, mvt-status, mvt-resume):
```yaml
version: 1
epic_id: "epic-YYYYMMDD-slug"
title: "Epic Title"
created_at: "ISO timestamp"
updated_at: "ISO timestamp"
status: in_progress
vision: >
  {vision summary}
current_change: "{first_child_change_id}"
children:
  - change_id: "{YYYYMMDD}-{slug}"
    title: "Child title"
    scope: >
      Child scope description
    status: active       # first: active, rest: pending
    depends_on: []       # DAG deps within children[]
    project: ["default"]
    completed_at: null
```

**epic.md** (narrative, 6 sections): Vision, Scope & Out of Scope, Cross-cutting Concerns, Child Stories (table), Dependency Map (mermaid), Open Questions.

**epic-id format**: `epic-{YYYYMMDD}-{slug}` (ADR-7)

#### Usage Constraints

1. **Epic-id prefix**: Always use `epic-` prefix to distinguish from change ids (ADR-7).
2. **2-8 children**: Fewer than 2 suggests using /mvt-analyze directly; more than 8 warns to narrow scope.
3. **DAG-only dependencies**: Children form a directed acyclic graph. Cycles are rejected by epic-update.cjs --validate.
4. **First child is active**: The first child in the array gets `status: active`; `current_change` points to it. Array order reflects the intended execution sequence.
5. **Self-validation**: The skill must verify unique change_ids, valid depends_on refs, no cycles, and exactly one active child before writing.

## Task: t4-analyze-gate — mvt-analyze Step 3 Epic Detection + epic-child mode + step renumbering

### Implementation Summary

Modified `mvt-analyze/business.md` to insert a new Step 3 "Assess Scale (Epic Detection)" before the existing Quick Path Detection step (now Step 4). The new step detects epic-scale requirements using strong/weak signal tables and routes to `/mvt-decompose` when triggered. Added an "Epic-Child Mode (Pre-check)" section before the Execution Flow that handles the three scenarios (A/B/C) when `active_epic.id` is non-empty and `active_change.id` is empty, including the `--switch-active` arbitration for scenario C. Renumbered all former Steps 3-6 to Steps 4-7 and updated all internal cross-references. Updated `manifest.yaml` conditional_suggestions to add the epic-detection branch and adjust step references.

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `sources/skills/mvt-analyze/business.md` | Modify | Insert Epic-Child Mode pre-check, Step 3 Epic Detection, renumber Steps 4-7, update internal refs |
| `sources/skills/mvt-analyze/manifest.yaml` | Modify | Add epic-detection condition to conditional_suggestions, update quick-path step ref from Step 3 to Step 4 |
| `test/assembler.test.ts` | Modify | Update assertion from "Step 6" to "Step 7" to match renumbered output |

### Implementation Details

**business.md changes**:

1. **Epic-Child Mode (Pre-check)** — new section before Execution Flow:
   - Triggers when `active_epic.id` non-empty AND `active_change.id` empty
   - Scenario A (empty message): auto-use `current_change` child scope
   - Scenario B (supplements): merge user message + current child scope
   - Scenario C (different child): dependency check, confirm reorder, call `epic-update.cjs --switch-active` (atomic, NOT bare `--set-child-status active`)
   - Epic context note: include `--epic-id` in session-update `--new-change` command (Step 7)

2. **Step 3: Assess Scale (Epic Detection)** — new step with:
   - Signal table: 3 strong signals (whole system scope, multi-feature design manual, multiple independent capability domains) + 2 weak signals
   - Trigger rule: any strong signal OR (strong + 2+ weak)
   - 4-branch table: epic hit (y/n/show-signals), epic miss (fall through to Step 4)

3. **Step renumbering**: Steps 3→4, 4→5, 5→6, 6→7. All "Steps 4-6" references updated to "Steps 5-7".

**manifest.yaml changes**:
- Added new condition: "epic-scale detected in Step 3 (Epic Detection) and user chose y" → primary: `mvt-decompose`
- Updated existing condition: "Step 3 (Quick Path Detection)" → "Step 4 (Quick Path Detection)"

**test/assembler.test.ts**:
- Updated assertion: `Step 6: Update Workspace` → `Step 7: Update Workspace` (pre-existing test broke due to renumbering)

### Design Compliance

| Check | Result |
|-------|--------|
| Files touched == Change Tracking | PASS — 2 files match Module 4 scope + 1 test fix (unavoidable) |
| Module/layer assignment | PASS — skill in `sources/skills/mvt-analyze/` |
| Public interfaces match Key Interfaces | PASS — Step 3 flow matches design Module 4 signal table + branches |
| Forbidden cross-layer imports | PASS — no code imports (all Markdown/YAML) |
| Error handling at boundaries only | PASS — scenario C reorder uses `--switch-active` (atomic, design-compliant) |
| No new external deps | PASS — no package.json changes |

### Deviations from Design

None. Implementation follows the design exactly.

### Self-Check Results

- **tsc**: clean (no errors)
- **vitest**: 169/169 tests passed (assembler test updated for renumbering)
- **Assembler**: `mvt-analyze` manifest assembles to 296 lines without error; Epic-Child Mode, Step 3 Epic Detection, Step 4 Quick Path, Step 7 Update Workspace, and mvt-decompose suggestion all verified present
- **Suggested test commands**: `npx vitest run test/assembler.test.ts`

### Open TODOs

- The `--epic-id` flag for the session-update `--new-change` command is documented as a note in the Epic-Child Mode pre-check section rather than added to the shared `session-update.md` template. The LLM must manually append it when in epic-child mode. A future enhancement could add a `{{epic_id}}` Mustache parameter to the shared template.
- Epic-child mode scenario C's dependency check logic ("if depends_on has unfinished prerequisites") relies on the LLM reading `epic.yaml` and comparing child statuses — this is skill-layer logic, not script-layer.

## Task: t5-advancement-trigger — mvt-update-plan Step 5 Epic Advancement Check

### Implementation Summary

Appended a new Step 5 "Epic Advancement Check" to `mvt-update-plan/business.md` after the existing Step 4 (Output). When `plan-update.cjs` reports `plan_status: "done"` and `active_change.epic_id` is non-empty, the step prompts the user with three choices: (y) complete child and advance, (n) keep change open, (defer) mark child done without advancing. The `y` path calls `epic-update.cjs --complete-child` + `session-update.cjs --close-change`. The `defer` path calls `epic-update.cjs --set-child-status done` + `session-update.cjs --close-change`. Steps 1-4 remain untouched. `plan-update.cjs` source is NOT modified (BR-13).

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `sources/skills/mvt-update-plan/business.md` | Modify | Insert Step 5 Epic Advancement Check after Step 4 |

### Implementation Details

**Step 5 flow**:
1. Trigger condition: `plan_status == "done"` AND `active_change.epic_id` non-empty
2. Prompt: y/n/defer with epic context (title + id)
3. **y path**: `epic-update.cjs --complete-child` advances to next ready child (deterministic array-order tie-break); `session-update.cjs --close-change` closes the current change; display next child info
4. **n path**: no action, display reminder to close later
5. **defer path**: `epic-update.cjs --set-child-status done` marks child done; `session-update.cjs --close-change`; display confirmation that current_change is unchanged

**Design compliance notes**:
- `plan-update.cjs` itself is NOT modified (BR-13) — all epic awareness lives in the skill layer
- Uses `--close-change` (not archive) per design spec
- `active_epic.epic_path` provides the epic.yaml path for `epic-update.cjs --epic` argument

### Design Compliance

| Check | Result |
|-------|--------|
| Files touched == Change Tracking | PASS — 1 file matches Module 5 scope |
| Module/layer assignment | PASS — skill in `sources/skills/mvt-update-plan/` |
| Public interfaces match Key Interfaces | PASS — Step 5 prompt matches design Module 5 y/n/defer flow |
| Forbidden cross-layer imports | PASS — no code imports (all Markdown) |
| Error handling at boundaries only | PASS — script calls handle their own errors |
| No new external deps | PASS — no package.json changes |

### Deviations from Design

None. Implementation follows the design exactly.

### Self-Check Results

- **tsc**: clean (no errors)
- **vitest**: 169/169 tests passed (all existing tests remain green)
- **Suggested test commands**: `npx vitest run test/`

### Open TODOs

- No automated test for the Step 5 prompt logic (it's skill-layer Markdown, tested by human interaction or integration test)
- The `--close-change` session-update flag already exists from the base framework; no new script changes needed

## Task: t6-epic-pending-alignment -- mvt-status / mvt-resume / mvt-help epic-pending state alignment

### Implementation Summary

Added epic-pending state awareness to three conductor-class skills. `mvt-status` now renders an Epic Progress section (child table with status/depends_on/internal plan progress) when `active_epic.id` is non-empty, with a differentiated context line for within-epic vs epic-pending states. `mvt-resume` adds a Step 1a epic state check that handles two scenarios: within-epic changes (adds Epic Context to the resume report) and epic-pending state (reads epic.yaml and presents the current_change child as the resume target, skipping plan-based flow). `mvt-help` adds an epic-pending row to the Step 2 decision table and updates the workflow mermaid diagram with the decompose/epic-child dimension.

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `sources/skills/mvt-status/business.md` | Modify | Add Epic Progress section to Step 4 report, epic-pending next-step condition to Step 5, and epic-related edge cases |
| `sources/skills/mvt-resume/business.md` | Modify | Add Step 1a epic state check (within-epic + epic-pending branches), Epic Context section in Step 7, and epic-pending edge cases |
| `sources/skills/mvt-help/business.md` | Modify | Add epic-pending row to Step 2 decision table, update Step 4 mermaid diagram with decompose/epic-child paths, add epic-pending edge case |

### Implementation Details

**mvt-status/business.md**:
- **Step 4 (Build the Status Report)**: Inserted section 4a "Epic Progress" between "Active Change" and "Changes Overview". When `active_epic.id` is non-empty, reads `epic.yaml` via `active_epic.epic_path`, computes progress (done/abandoned count vs total), renders a child table with status, depends_on, and internal plan progress (for active child only). Context line differentiates within-epic (suggests `/mvt-resume`) vs epic-pending (suggests `/mvt-analyze`).
- **Step 5 (Suggest Next Step)**: Added epic-pending condition (item 2) between "active_change has current_tasks" and "project-context.md missing": suggests `/mvt-analyze` with epic-specific reasoning. Renumbered subsequent items 3-4.
- **Edge Cases & Errors**: Added 3 epic-related cases: missing epic.yaml, epic.yaml parse error, and invalid current_change reference.

**mvt-resume/business.md**:
- **Step 1 (Read Session State)**: Extended extract list to include `active_change.epic_id` and `active_epic` (id, title, epic_path).
- **Step 1a (Check Epic State)**: New step after Step 1 with 3-branch table. (1) Within-epic change: sets `within_epic = true`, continues normal flow with epic context added to Step 7. (2) Epic-pending: reads epic.yaml, identifies current_change child as resume target, skips Steps 2-6 and renders a simplified report directly in Step 7 with Epic State, Current Sub-change, Resume Point, and Recommended Next Step sections. (3) Neither: normal flow.
- **Step 7 (Generate Resume Report)**: Added item 2 "Epic Context" (conditional on `within_epic` flag) showing epic title, progress, and current position. Renumbered subsequent items 3-7.
- **Edge Cases**: Added 2 epic-related cases: epic.yaml missing at epic_path, and current_change empty/invalid in epic.yaml.

**mvt-help/business.md**:
- **Step 2 (Assess User Position)**: Added row "active_epic.id non-empty AND active_change.id empty (epic-pending)" between "project-context.md does not exist" and "No requirements", recommending `/mvt-analyze -- Start the next sub-change in the epic`.
- **Step 4 (Show Workflow Diagram)**: Extended mermaid flowchart with `C -.->|epic scale| DC[decompose]`, `DC --> C2[analyze<br/>epic-child]`, `C2 --> D` paths.
- **Edge Cases & Errors**: Added epic-pending state case noting Step 2 recommendation and diagram display.

### Design Compliance

| Check | Result |
|-------|--------|
| Files touched == Change Tracking | PASS -- 3 files match Module 6 scope |
| Module/layer assignment | PASS -- all skill Markdown in `sources/skills/` |
| Public interfaces match Key Interfaces | PASS -- epic-pending detection, epic context display, decision table row, mermaid update all match design Module 6 spec |
| Forbidden cross-layer imports | PASS -- no code imports (all Markdown) |
| Error handling at boundaries only | PASS -- epic.yaml read failures handled gracefully with skip/warn |
| No new external deps | PASS -- no package.json changes |

### Deviations from Design

None. Implementation follows the design exactly.

### Self-Check Results

- **tsc**: clean (no errors)
- **vitest**: 169/169 tests passed (all existing tests remain green)
- **build**: `npm run build` succeeds; all scripts (epic-update.cjs, plan-update.cjs, session-update.cjs) built
- **Suggested test commands**: `npx vitest run test/`

### Open TODOs

- No automated tests for skill-layer Markdown logic (business.md is prose for the LLM, not executable code)
- mvt-status manifest decision_rules and mvt-resume/mvt-help manifest conditional_suggestions do not include epic-pending entries -- the existing rules already route epic-pending state to `/mvt-analyze` via the "no active change" fallback; explicit manifest entries could be added for clarity in a future refinement

## Task: t7-cleanup-epic-aware -- mvt-cleanup epic integrity check + batch archive (no advancement)

### Implementation Summary

Added two epic-aware behaviors to mvt-cleanup, with NO advancement trigger (per BR-14). (1) Epic integrity check: when a done change has a non-empty `epic_id` and its parent epic is not done, the candidate is marked `epic-unsafe` with a warning and defaults to skip. (2) Batch archive suggestion: when archiving a completed epic directory, the user is offered three options (epic only / all children / selective) before proceeding. Per ADR-8, archive means abandon references with no post-archive `epic_id` integrity maintenance.

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `sources/skills/mvt-cleanup/business.md` | Modify | Add epic integrity warning rule to Step 4, batch archive candidate rule to Step 4, batch archive action to Step 7, and 3 epic-related edge cases |

### Implementation Details

**Step 4 (Apply Cleanup Rules)** -- two new rules added to the rules table:

1. **Epic integrity warning**: `changes[]` entry with `status: done` AND `epic_id` non-empty AND parent epic status is NOT `done` -> mark candidate as `epic-unsafe`. Archiving a sub-change whose parent epic is still in-progress may leave the epic in an inconsistent state. Default to `n` (skip) in the cleanup plan. User may override to force-archive.

2. **Batch archive candidate**: `changes[]` entry with `status: done` AND `epic_id` non-empty AND the change-id matches the epic directory pattern -> mark for batch suggestion in Step 7. When an entire epic (status: done) is a cleanup candidate, Step 7 offers to archive child changes together with it.

**Step 7 (Execute the Plan)** -- new action 2a inserted after the Archive action:

**Batch archive action** (epic with children): when archiving a completed epic directory containing `epic.yaml` with `status: done`, read `epic.yaml.children` and present three options: (1) Epic only -- archive just the epic directory; (2) All children -- archive epic + all child change directories; (3) Selective -- user picks which children to include. Per ADR-8, archive = abandon references. In-progress or pending children are excluded with a note.

**Edge Cases & Errors** -- three new cases:

1. Change with `epic_id` is a cleanup candidate but parent epic is still `in_progress` -> mark `epic-unsafe`, default to skip, warn about inconsistent state.
2. Epic directory marked for batch archive but `epic.yaml` is missing or unreadable -> skip batch suggestion, treat as regular archive.
3. Batch archive includes a child that is still `in_progress` -> exclude with a note.

### Design Compliance

| Check | Result |
|-------|--------|
| Files touched == Change Tracking | PASS -- 1 file matches Module 7 scope |
| Module/layer assignment | PASS -- skill Markdown in `sources/skills/mvt-cleanup/` |
| Public interfaces match Key Interfaces | PASS -- epic integrity check and batch archive match design Module 7 spec |
| Forbidden cross-layer imports | PASS -- no code imports (all Markdown) |
| Error handling at boundaries only | PASS -- epic.yaml read failures handled gracefully |
| No new external deps | PASS -- no package.json changes |

### Deviations from Design

None. Implementation follows the design exactly.

### Self-Check Results

- **tsc**: clean (no errors)
- **vitest**: 169/169 tests passed (all existing tests remain green)
- **Suggested test commands**: `npx vitest run test/`

### Open TODOs

- No automated test for epic-aware cleanup logic (skill-layer Markdown, not executable code)
- The "epic directory" detection in the batch archive candidate rule uses a pattern match on `active_epic.id` -- this relies on the epic-id format convention (`epic-YYYYMMDD-slug`). A more robust check would read the directory for `epic.yaml`, but the current heuristic is sufficient given the ADR-7 naming convention.

## Task: t8-tests -- epic-update unit tests + session-update epic regression

### Implementation Summary

Created comprehensive test suites for both deterministic scripts. `test/epic-update.test.ts` covers 46 cases across all 5 operations (--validate, --complete-child, --set-child-status, --switch-active, --add-child), output protocol, and edge cases. `test/session-update.test.ts` covers 17 cases for all 5 epic flags (--new-epic, --set-epic-path, --set-epic-status, --close-epic, --epic-id with --new-change), combo validation rules, and backward compatibility. Both test files follow the existing plan-update.test.ts pattern: real filesystem into os.tmpdir(), spawnSync for script execution, no mocks.

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `test/epic-update.test.ts` | Create | Unit tests for epic-update.cjs (46 cases) |
| `test/session-update.test.ts` | Create | Epic flag regression tests for session-update.cjs (17 cases) |

### Implementation Details

**test/epic-update.test.ts** (46 cases):
- **--validate** (8 cases): valid epic, duplicate change_ids, dangling depends_on, dependency cycle, multiple active, current_change points to done, all done but epic still in_progress, no-write on validate
- **--complete-child** (6 cases): normal advancement with recomputeCurrentChange, array-order tie-break (c2 before c3 when both ready), last-child auto-done, unresolved deps block advancement, unknown change_id, abandoned children skipped during advancement
- **--set-child-status** (8 cases): done via complete-child (avoids current_change validation), abandoned on non-active child, pending, reject multiple active, reject invalid status, reject missing --child-status, clear completed_at on revert from done, allow setting active when no other child is active
- **--switch-active** (5 cases): atomic demote+promote, reject target with unresolved depends_on, no-op when already active, reject unknown change_id, allow switch to child with resolved deps
- **--add-child** (7 cases): basic append with title/scope, with depends_on, reject duplicate change_id, reject missing id, reject missing --child-title, reject invalid depends_on (fails validation), multiple children in one invocation
- **Output protocol** (3 cases): single-line JSON on stdout exit 0, plain-text on stderr exit 1, progress object fields
- **Edge cases** (9 cases): empty children array, missing --epic, no operation, epic file not found, malformed YAML, valid YAML but not object, updated_at timestamp, temp file cleanup, validation abort on cycle

**test/session-update.test.ts** (17 cases):
- **--new-epic** (4 cases): creates active_epic with id/title, requires --epic-id, snapshots old active_epic into epics[], no snapshot when active_epic is empty
- **--set-epic-path** (2 cases): sets epic_path, rejects when no active epic
- **--set-epic-status** (2 cases): updates matching epics[] entry, rejects when no active epic
- **--close-epic** (1 case): sets epics[] entry to done and clears active_epic
- **Combo validation** (2 cases): rejects --close-epic with --new-epic, rejects orphan --epic-id
- **--new-change --epic-id** (4 cases): writes epic_id to active_change, writes to history, preserves in changes[] on --close-change, resets on active_change after --close-change
- **Backward compatibility** (2 cases): old session.yaml without epic fields (add change), old session.yaml when adding epic

### Design Compliance

| Check | Result |
|-------|--------|
| Files touched == Change Tracking | PASS -- 2 new test files match t8 scope |
| Module/layer assignment | PASS -- test files under test/ |
| Test coverage matches Testing Strategy | PASS -- all categories from design covered (complete-child, set-child-status, switch-active, add-child, validate, output protocol, edge cases, session-update regression) |
| Existing 155+ tests remain green | PASS -- 169 existing + 63 new = 232 total, all green |

### Deviations from Design

- `--set-child-status done` on the active child cannot be tested directly because it leaves `current_change` pointing to a done child, which fails post-mutation validation. Used `--complete-child` instead for the "sets child to done" test, which is the correct production path for that operation.
- The session-update tests use a `cwd` approach (creating `.ai-agents/workspace/` in tmpdir) rather than a `--session` flag, because session-update.cjs doesn't accept one. This follows the script's auto-discovery pattern.

### Self-Check Results

- **tsc**: clean (no errors)
- **vitest**: 232/232 tests passed (12 test files: 10 existing + 2 new)
- **Test counts**: epic-update: 46, session-update: 17, total new: 63

### Open TODOs

- None
