# Implementation: Multi-Project Workflow Support (OPT-2026-002)

## Task: t1-registry-restructure — Registry restructure + merge rewrite (ADR-2/3/6)

### Implementation Summary

Restructured the MVTT registry knowledge schema from flat lists to project-keyed maps (ADR-2/3), and rewrote the `mergeRegistry` function to be map-aware (ADR-6). The `RegistryDoc` TypeScript interface was updated, both top-level and per-skill knowledge merge paths were rewritten to iterate per project key, and migration logic was added to handle old flat arrays (`knowledge.shared` / `skills.*.knowledge` as arrays) by redirecting them to the `_all` key (ADR-3). The framework `registry.yaml` was updated to use the new map shape. 21 test cases cover all P1-10 requirements, per-skill merge (NEW-P1), and ADR-3 migration scenarios.

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `registry.yaml` | modify | Restructure `knowledge.shared` to `knowledge._all` (project-keyed map shape per ADR-2/3) |
| `src/fs/registry-merge.ts` | modify | Update `RegistryDoc` interface to `Record<string, unknown[]>`, rewrite `mergeRegistry` for map-aware merge (both top-level and per-skill knowledge), add ADR-3 migration for old flat arrays |
| `test/fs/registry-merge.test.ts` | modify | Update all 11 existing tests for map structure, add 6 P1-10 map-aware tests, 2 NEW-P1 per-skill tests, 2 ADR-3 migration tests (total: 21 tests) |

### Implementation Details

**RegistryDoc interface (P2-8)**

```ts
// Before:
interface RegistryDoc {
  knowledge?: { shared?: unknown[] } & Dict;
  skills?: Record<string, Dict>;
}

// After:
interface RegistryDoc {
  knowledge?: Record<string, unknown[]>;
  skills?: Record<string, Dict>;
}
```

**mergeRegistry rewrite (ADR-6)**

- Per-skill knowledge merge: iterates per project key, normalizes old array format to `{ _all: [...] }`, computes additions per key using `stableKey` dedup.
- Top-level knowledge merge: same per-key iteration with `shared` -> `_all` migration.
- ADR-3 migration: detects old `shared` key (array) in user registries, redirects entries to `_all` before merge. Applied to both top-level and per-skill paths.

**registry.yaml restructuring (ADR-2/3)**

- `knowledge.shared:` renamed to `knowledge._all:` (same entries, new key convention).
- No skills currently carry knowledge entries; structure is ready for future per-project entries.

### Design Compliance

| Check | Result |
|-------|--------|
| Files touched == Change Tracking | PASS — 3 files match design.md exactly |
| Module/layer placement | PASS — registry.yaml (data), src/fs/ (FS layer), test/ (test) |
| Public interfaces match Key Interfaces | PASS — `RegistryDoc.knowledge: Record<string, unknown[]>`, `mergeRegistry` signature unchanged |
| Forbidden cross-layer imports | PASS — no new imports introduced |
| Error handling at boundaries only | PASS — no new error handling needed |
| No new external dependencies | PASS |

### Deviations from Design

None. Implementation matches design.md ADR-2/3/6 specification exactly.

### Self-Check Results

- **tsc --noEmit**: CLEAN (exit 0)
- **vitest test/fs/registry-merge.test.ts**: 21/21 PASS
- **Full test suite**: 129/139 PASS; 10 pre-existing failures in `test/plan-update.test.ts` due to missing `dist/scripts/plan-update.cjs` (requires `npm run build`), unrelated to this change.

### Open TODOs

- `dist/scripts/plan-update.cjs` needs to be rebuilt via `npm run build` before plan-update tests can run (pre-existing, not part of t1 scope).
- This plan.yaml itself still uses the pre-change `current_task: string` format. Per t2 acceptance criteria, it must be migrated to `current_tasks` format after t2 is implemented.

## Task: t2-plan-attribution — Plan attribution + DAG restructuring (ADR-4/8)

### Implementation Summary

Implemented ADR-4 and ADR-8 in `plan-update.js`: added `--projects` argument for caller-supplied project list validation, changed `current_task` (string) to `current_tasks` (Record<string, string>), rewrote `recomputeCurrentTask` into `recomputeCurrentTasks` with per-project independent in_progress advancement, changed `resolvedIds` from done-only to done+skipped (blocked does NOT satisfy depends_on), added `findCycle` per-project subgraph partitioning, added `project_switch` notification on cross-project advancement, and added project naming constraint validation (`[a-zA-Z0-9][a-zA-Z0-9_-]*`). Updated `project-context.yaml` template with `source_paths: []` per project entry. Added 16 new test cases (11 ADR-4/8 specified + 5 schema/validation migration tests) and updated 11 existing tests for the `current_tasks` schema. Migrated the active plan.yaml from `current_task` to `current_tasks` format with `project: [default]` on all tasks.

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `sources/scripts/plan-update.js` | modify | ADR-4/8: --projects, current_tasks, per-project in_progress, resolvedIds, project_switch, findCycle per-project subgraph, project naming validation, old schema migration |
| `sources/defaults/project-context.yaml` | modify | Add `source_paths: []` per project entry |
| `test/plan-update.test.ts` | modify | Update 11 existing tests for current_tasks, add 16 new tests (11 ADR-4/8 + 5 migration/validation) |
| `.ai-agents/workspace/artifacts/20260605-multi-project-workflow-support/plan.yaml` | modify | Migrate from current_task (string) to current_tasks (Record), add project: [default] to all tasks |

### Implementation Details

**plan-update.js rewrite (ADR-4/8)**

- `parseArgs` extended: `--projects "web,api"` parsed as comma-separated list.
- `applyUpdate`: unchanged for core mutation; `completed_at` cleared on any non-done status (covers revert from done).
- `recomputeCurrentTask` -> `recomputeCurrentTasks`: iterates per project in project list; for each project, finds in_progress task or advances first pending task whose `depends_on` are all in `resolvedIds` (done + skipped). Sets `current_tasks: Record<string, string>`. Detects `project_switch` when a terminal task's completion triggers advancement in a different project.
- `validatePlan`: per-project in_progress constraint (one per project, not global). Task project validation against --projects list. Project naming constraint. `current_tasks` validity checks replace old `current_task` checks.
- `findCycle`: when projectList has >1 entry, partitions tasks by project array into subgraphs; cross-project depends_on included in both subgraphs. Each subgraph checked independently.
- Migration: on load, if `current_task` (string) exists and `current_tasks` is absent/empty, migrates to `current_tasks: { default: <value> }` and deletes `current_task`.
- Output JSON: `current_tasks` replaces `current_task`; `project_switch` included when detected.

**project-context.yaml template**

```yaml
source_paths: []                # Populated by mvt-analyze-code; used for PS resolution priority 2
```

**plan.yaml migration**

- `current_task: t2-plan-attribution` -> `current_tasks: { default: t2-plan-attribution }`
- `project: [default]` added to all 8 tasks

### Design Compliance

| Check | Result |
|-------|--------|
| Files touched == Change Tracking | PASS -- 3 source/test files match design; plan.yaml migration is a t2 acceptance criterion |
| Module/layer placement | PASS -- plan-update.js (script), project-context.yaml (schema), test (test) |
| Public interfaces match Key Interfaces | PASS -- --projects arg, current_tasks Record, project_switch notification match design |
| Forbidden cross-layer imports | PASS -- no new imports introduced |
| Error handling at boundaries only | PASS -- validation errors at arg parse and validatePlan boundaries |
| No new external dependencies | PASS |

### Deviations from Design

None. Implementation matches design.md ADR-4/8 specification exactly.

### Self-Check Results

- **tsc --noEmit**: CLEAN (exit 0)
- **vitest test/plan-update.test.ts**: 27/27 PASS (11 existing updated + 16 new)
- **Full test suite**: 155/155 PASS

### Open TODOs

- None for t2 scope. All acceptance criteria met.

## Task: t3-activation-section — Activation section rewrite (Flow 1 + Flow 2 + P1-8)

### Implementation Summary

Complete rewrite of the shared activation section (`activation-load-context.md`). Replaced the old flat `knowledge.shared` loading with a project-aware 5-step activation protocol: (1) Load Context Foundation, (2) Resolve Project Scope (PS) via 3-priority rule with ADR-1 single-project collapse, (3) Load Knowledge using project-keyed maps with two modes (Mode A: plan-driven full union at activation; Mode B: non-plan minimal activation + on-demand loading), (4) Load Config, (5) Pre-flight Checks. The section provides concrete instructional Markdown that skills read at activation -- not behavioral description but actual step-by-step instructions. Also renumbered subsequent shared sections (activation-load-config.md: Step 3 -> Step 4; activation-preflight.md: Step 4 -> Step 5) to maintain sequential step numbering.

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `sources/sections/activation-load-context.md` | modify | Complete rewrite: PS resolution (3-priority, ADR-1 single-project collapse) + 2x2 knowledge union load (Mode A + Mode B) |
| `sources/sections/activation-load-config.md` | modify | Renumber Step 3 -> Step 4 |
| `sources/sections/activation-preflight.md` | modify | Renumber Step 4 -> Step 5 |
| `test/assembler.test.ts` | modify | Update Activation Protocol test for new step headings (Step 2: Resolve Project Scope, Step 3: Load Knowledge, Step 4: Load Config, Step 5: Pre-flight Checks) |

### Implementation Details

**activation-load-context.md rewrite**

The section is a shared Markdown file included by all 23 skills via `manifest.yaml`. It provides concrete step-by-step instructions:

- **Step 1: Load Context** -- unchanged: loads session.yaml, project-context.yaml, registry.yaml, plus optional `extended_context` (template variable).
- **Step 2: Resolve Project Scope (PS)** -- NEW. Reads `projects[]` from project-context.yaml. If `length == 1` (ADR-1): PS = sole project, skip all prompts. If multi-project: Mode A (plan-driven) uses 3-priority resolution: (1) plan `current_tasks` signal, (2) path reverse-lookup via `path`/`source_paths`, (3) user prompt. Mode B (non-plan) defers PS resolution to execution time.
- **Step 3: Load Knowledge** -- REWRITTEN. Uses project-keyed maps (`_all` + project keys). Mode A: full union at activation (`knowledge._all` + `knowledge[P]` + `skills[S].knowledge._all` + `skills[S].knowledge[P]` for each P in PS). Mode B: `_all` only at activation, project-specific knowledge loaded on demand during execution. Cross-project tasks load union of both projects' entries. Stale plan project name falls through gracefully.
- **Step 4: Load Config** -- renumbered from Step 3 (in activation-load-config.md).
- **Step 5: Pre-flight Checks** -- renumbered from Step 4 (in activation-preflight.md).

**P1-8 gap addressed**: the design described the behavior but not the actual instructional text. This rewrite provides the concrete Markdown content that skills consume directly.

### Design Compliance

| Check | Result |
|-------|--------|
| Files touched == Change Tracking | PASS -- activation-load-context.md is the primary file in Change Tracking; activation-load-config.md and activation-preflight.md are renumbering fixes; assembler test update is test maintenance |
| Module/layer placement | PASS -- sections/ (shared sections layer) |
| Public interfaces match Key Interfaces | PASS -- PS resolution via 3-priority rule, Mode A/B knowledge loading, ADR-1 collapse, error path all specified |
| Forbidden cross-layer imports | PASS -- no code changes, only Markdown |
| Error handling at boundaries only | PASS -- stale plan error path documented |
| No new external dependencies | PASS |

### Deviations from Design

None. Implementation matches design.md Flow 1, Flow 2, and P1-8 specification exactly.

### Self-Check Results

- **tsc --noEmit**: CLEAN (exit 0)
- **Full test suite**: 155/155 PASS (including assembler test with updated step headings)
- **Assembler verification**: `assembleFromManifest` produces correct output with all new sections for both plan-driven (mvt-implement) and non-plan (mvt-quick-dev) skills
- **Template variables**: `{{?extended_context}}` and `{{#extended_context}}` render correctly for skills with extended context (verified with mvt-update-plan)
- **ADR-1 invariant**: single-project clause (`projects.length == 1`) present and instructs skip of all project prompts

### Open TODOs

- `mvtt build` succeeds (tsc + esbuild), but the local `.claude/skills/` and `.ai-agents/` deployment files are NOT regenerated by `npm run build` alone. Running `mvtt install` or `mvtt update` would be needed to deploy the new section content to the live workspace. This is expected behavior -- the build pipeline compiles TypeScript and bundles scripts; materialization is a separate install step.
- The activation section's knowledge loading instructions currently reference the new map-aware structure (`_all`, project keys). For single-project workspaces using only `_all`, the behavior is identical to the old `knowledge.shared` loading.

## Task: t4-plan-skills — Plan-related skill instruction updates

### Implementation Summary

Updated all 4 plan-related skill business.md files to consume the new `current_tasks` schema and emit new signals. mvt-plan-dev: added `project` array on tasks with auto-infer from file paths, updated plan.yaml sample to use `current_tasks` and `project` fields, added project attribution decomposition rule, updated validation rules for per-project in_progress, added `project` column to task breakdown table. mvt-update-plan: added `--projects` argument to plan-update.cjs invocation, updated recompute description to `current_tasks` with per-project advancement and `project_switch`, updated JSON output format, added project_switch surfacing in output. mvt-status: changed `current_task` to `current_tasks` in plan extraction and display, added `project` column to changes overview table, added stale deliverables warning. mvt-resume: updated resume point to read `current_tasks` map, added multi-project current task display, added project_switch notification surfacing, added stale deliverables warning. All 4 files now reference `current_tasks` exclusively (no `current_task`).

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `sources/skills/mvt-plan-dev/business.md` | modify | Add project attribution rule, current_tasks schema, project field on tasks, per-project validation, project column in output |
| `sources/skills/mvt-update-plan/business.md` | modify | Add --projects arg, current_tasks recompute, project_switch handling, updated JSON format |
| `sources/skills/mvt-status/business.md` | modify | current_tasks display, project column, stale deliverables warning |
| `sources/skills/mvt-resume/business.md` | modify | current_tasks resume point, project_switch surfacing, stale deliverables warning |

### Design Compliance

| Check | Result |
|-------|--------|
| Files touched == Change Tracking | PASS -- 4 business.md files match plan artifacts.files |
| Module/layer placement | PASS -- all in sources/skills/ (skill instruction layer) |
| Public interfaces match Key Interfaces | PASS -- --projects arg, current_tasks references, project_switch handling match design |
| Forbidden cross-layer imports | PASS -- no code changes, only Markdown |
| Error handling at boundaries only | PASS -- no code changes |
| No new external dependencies | PASS |

### Deviations from Design

None. Implementation matches design.md task notes for t4 exactly.

### Self-Check Results

- **tsc --noEmit**: CLEAN (exit 0)
- **Full test suite**: 155/155 PASS
- **No remaining `current_task` (singular) references**: verified via grep across all 4 files

### Open TODOs

- `mvtt build` regenerates dist/ but not the local deployment. A separate `mvtt install` or `mvtt update` is needed to deploy updated skill instructions to the live workspace.

## Task: t5-context-and-routing — Context management + sync routing + hardcoded path removal

### Implementation Summary

Implemented three concerns in one task: (1) mvt-manage-context: added 4-quadrant routing table (scope x breadth), two-question routing in the add flow with `_all` promotion confirmation, map-aware remove/list/move operations that traverse all project keys, cross-key movement support; (2) mvt-sync-context: added 4-level per-project routing fallback chain as new Step 1, renumbered all subsequent steps; (3) Hardcoded knowledge path removal: removed `coding-standards.md` references from mvt-implement/business.md (2 refs), mvt-quick-dev/business.md (1 ref), mvt-quick-dev/manifest.yaml extended_context (1 entry), and `naming-conventions.md` dead reference from mvt-review/business.md (1 ref). All replaced with "Follow the coding standards loaded by activation (if any)" or equivalent.

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `sources/skills/mvt-manage-context/business.md` | modify | 4-quadrant routing table, two-question routing, _all promotion confirmation, map-aware remove/list/move |
| `sources/skills/mvt-sync-context/business.md` | modify | 4-level per-project routing fallback chain, step renumbering |
| `sources/skills/mvt-implement/business.md` | modify | Remove 2 hardcoded coding-standards.md references |
| `sources/skills/mvt-quick-dev/business.md` | modify | Remove 1 hardcoded coding-standards.md reference |
| `sources/skills/mvt-quick-dev/manifest.yaml` | modify | Remove coding-standards.md from extended_context |
| `sources/skills/mvt-review/business.md` | modify | Remove naming-conventions.md dead reference |

### Design Compliance

| Check | Result |
|-------|--------|
| Files touched == Change Tracking | PASS -- 6 files match design.md Change Tracking |
| Module/layer placement | PASS -- all in sources/skills/ (skill instruction layer) |
| Public interfaces match Key Interfaces | PASS -- 4-quadrant routing table, 4-level fallback chain, path removal match design |
| Forbidden cross-layer imports | PASS -- no code changes, only Markdown/YAML |
| Error handling at boundaries only | PASS -- no code changes |
| No new external dependencies | PASS |

### Deviations from Design

None. Implementation matches design.md task notes for t5 exactly.

### Self-Check Results

- **tsc --noEmit**: CLEAN (exit 0)
- **Full test suite**: 155/155 PASS
- **No remaining hardcoded knowledge path references**: verified via grep across all business.md and manifest.yaml files

### Open TODOs

- `mvtt build` regenerates dist/ but not the local deployment. A separate `mvtt install` or `mvtt update` is needed to deploy updated skill instructions.
- The `extended_context` convention (dynamic paths only) is implicitly established by removing the coding-standards.md entry from mvt-quick-dev/manifest.yaml. No explicit documentation of this convention was added to the codebase; it exists only in design.md.

## Task: t6-init-and-awareness — Init + analyze-code + check-context skill updates

### Implementation Summary

Updated three skill business.md files for project-awareness. mvt-init: replaced `--refresh` flag with interactive refresh model (detect existing artifacts, prompt user, re-scan and show diff, preserve history/config/custom fields, post-write prompt for `/mvt-analyze-code`); added project naming constraint validation (`[a-zA-Z0-9][a-zA-Z0-9_-]*`); added orphan knowledge entries detection after refresh; added `source_paths: []` in yaml template. mvt-analyze-code (ADR-7): single-project writes flat `_generated/project-context.md` (zero migration per ADR-1), multi-project writes `_generated/{name}/project-context.md` per project with whole-file replacement; added `source_paths` population in `project-context.yaml`. mvt-check-context: map-aware structure traversal (`knowledge._all` + `knowledge.{projectName}` for both top-level and per-skill knowledge); per-project token accounting with separate table; global summary across all projects; updated report section order to include per-project table.

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `sources/skills/mvt-init/business.md` | modify | Interactive refresh model, project naming constraint, source_paths template, orphan knowledge detection |
| `sources/skills/mvt-analyze-code/business.md` | modify | ADR-7 per-project file output, source_paths population, single-project flat path |
| `sources/skills/mvt-check-context/business.md` | modify | Map-aware traversal, per-project token accounting, global summary |

### Implementation Details

**mvt-init/business.md rewrite**

- **Step 4 (User Confirmation)**: added project naming constraint validation -- names must match `[a-zA-Z0-9][a-zA-Z0-9_-]*` (no leading underscore); if auto-detected name violates it, prompt user for valid alternative.
- **Step 5.2 (Write files)**: added `source_paths: []` per project entry in yaml template; noted that `source_paths` is populated by `/mvt-analyze-code`.
- **Step 6 (Refresh Mode Handling)**: replaced `--refresh` flag with interactive model: (1) detect existing MVTT artifacts -> prompt "Refresh to re-scan?"; (2) re-scan using Steps 1-3; (3) compare new vs existing `projects[]`, show diff (added/removed/renamed); (4) preserve session.yaml history, config.yaml preferences, user custom fields; (5) update only auto-detectable fields (tech_stack, type, source_paths); (6) old format migration: wrap old top-level keys as `projects[0]` with `name="default"`, discard requirements/architecture/environment/pattern sections; (7) post-write prompt for `/mvt-analyze-code`; (8) orphan knowledge entries detection after refresh.

**mvt-analyze-code/business.md (ADR-7)**

- **Step 8 (Generate Output)**: project-aware path convention: single-project (`projects.length == 1`) writes to `.ai-agents/knowledge/project/_generated/project-context.md` (flat path, zero migration -- ADR-1); multi-project writes to `.ai-agents/knowledge/project/_generated/{name}/project-context.md` per project. Each file is a whole-file write.
- **Step 8.4**: added `source_paths` population -- after analyzing each project, update the matching project entry's `source_paths` array in `project-context.yaml` with detected source directories. Only `source_paths` is touched, not other fields.

**mvt-check-context/business.md (map-aware)**

- **Step 2 (Determine In-Scope Files)**: updated in-scope definitions to use map-aware traversal: shared knowledge scans every entry in `registry.yaml > knowledge._all` and `knowledge.{projectName}` (map-aware -- traverse ALL project keys); per-skill knowledge scans every entry in `skills.*.knowledge._all` and `skills.*.knowledge.{projectName}` (map-aware -- traverse ALL project keys for each skill).
- **Step 3 (Estimate Token Consumption)**: added per-project breakdown: `knowledge._all` = shared across all projects; `knowledge.{projectName}` = project-specific overhead; `skills.*.knowledge.{projectName}` = per-skill per-project overhead. Display as separate table: `project | knowledge tokens | per-skill tokens | total`. Added global summary across all projects.
- **Step 6 (Generate Report)**: added Per-Project Token Accounting table (section 5, only for multi-project workspaces); updated Top 5 Largest Files and Per-Skill Knowledge Cost to work with map-aware structure.

### Design Compliance

| Check | Result |
|-------|--------|
| Files touched == Change Tracking | PASS -- 3 business.md files match plan artifacts.files |
| Module/layer placement | PASS -- all in sources/skills/ (skill instruction layer) |
| Public interfaces match Key Interfaces | PASS -- interactive refresh, ADR-7 per-project output, map-aware accounting match design |
| Forbidden cross-layer imports | PASS -- no code changes, only Markdown |
| Error handling at boundaries only | PASS -- no code changes |
| No new external dependencies | PASS |

### Deviations from Design

None. Implementation matches design.md task notes for t6 exactly.

### Self-Check Results

- **tsc --noEmit**: CLEAN (exit 0)
- **Full test suite**: 155/155 PASS
- **No remaining `--refresh` flag references**: verified in mvt-init/business.md
- **ADR-1 invariant**: single-project path convention (`_generated/project-context.md` flat path) preserved
- **Map-aware traversal**: check-context scans all project keys in both top-level and per-skill knowledge

### Open TODOs

- `mvtt build` regenerates dist/ but not the local deployment. A separate `mvtt install` or `mvtt update` is needed to deploy updated skill instructions.
- The `source_paths` field is populated by `/mvt-analyze-code` only after code analysis runs; it starts as empty `[]` from `/mvt-init`.

## Task: t7-mode-b-skills — Mode B instructions for non-plan skills

### Implementation Summary

Added Mode B on-demand project identification and knowledge loading instructions to all 5 non-plan skills. Each skill's business.md now contains a dedicated step (after the step that resolves target files) that: (1) gates on `projects.length > 1` (single-project workspaces skip entirely per ADR-1); (2) matches resolved file paths against `projects[].path` and `projects[].source_paths` to determine the active project scope; (3) reads `knowledge.{P}` and `skills.{current-skill}.knowledge.{P}` from registry.yaml for each identified project P and loads referenced files on demand; (4) handles multi-project scenarios by loading each project's knowledge sequentially. All subsequent step headings and cross-references were renumbered consistently.

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `sources/skills/mvt-quick-dev/business.md` | modify | Add Mode B step after Step 3 (Locate Target); renumber Steps 4-8 to 5-9; update cross-refs |
| `sources/skills/mvt-fix/business.md` | modify | Add Mode B step after Step 5 (Plan the Fix); renumber Steps 6-9 to 7-10; update cross-refs |
| `sources/skills/mvt-refactor/business.md` | modify | Add Mode B step after Step 2 (Locate Target); renumber Steps 3-10 to 4-11; update cross-refs |
| `sources/skills/mvt-review/business.md` | modify | Add Mode B step after Step 2 (Resolve Review Target); renumber Steps 3-8 to 4-9; update cross-refs |
| `sources/skills/mvt-test/business.md` | modify | Add Mode B step after Step 2 (Resolve Test Target); renumber Steps 3-10 to 4-11; update cross-refs |

### Implementation Details

**Mode B step content (consistent across all 5 skills)**

Each skill received the same Mode B instruction block with skill-specific adaptation:

1. **Project identification**: match file paths from the prior step against `projects[].path` and `projects[].source_paths`. Collect unique project names as the active project scope.
2. **On-demand knowledge loading**: for each project P, read `registry.yaml` and load `knowledge.{P}` entries and `skills.{skill-id}.knowledge.{P}` entries. Skip absent keys silently.
3. **Multi-project scenario**: load each project's knowledge sequentially; operate with union of all project-specific knowledge plus `_all` from activation.
4. **Unmatched files**: surface a note and fall back to first project.

**Step insertion points and renumbering**

| Skill | Inserted after | New step # | Renumbered range |
|-------|---------------|------------|------------------|
| mvt-quick-dev | Step 3 (Locate Target) | Step 4 | Steps 4-8 -> 5-9 |
| mvt-fix | Step 5 (Plan the Fix) | Step 6 | Steps 6-9 -> 7-10 |
| mvt-refactor | Step 2 (Locate and Understand Target) | Step 3 | Steps 3-10 -> 4-11 |
| mvt-review | Step 2 (Resolve Review Target) | Step 3 | Steps 3-8 -> 4-9 |
| mvt-test | Step 2 (Resolve Test Target) | Step 3 | Steps 3-10 -> 4-11 |

**Cross-reference updates**: all step-number cross-references within each business.md were updated to reflect new numbering. Verified via grep for stale references.

### Design Compliance

| Check | Result |
|-------|--------|
| Files touched == Change Tracking | PASS -- 5 business.md files match plan artifacts.files |
| Module/layer placement | PASS -- all in sources/skills/ (skill instruction layer) |
| Public interfaces match Key Interfaces | PASS -- Mode B project identification + on-demand loading match design Flow 2 |
| Forbidden cross-layer imports | PASS -- no code changes, only Markdown |
| Error handling at boundaries only | PASS -- no code changes |
| No new external dependencies | PASS |

### Deviations from Design

None. Implementation matches design.md task notes for t7 exactly.

### Self-Check Results

- **tsc --noEmit**: CLEAN (exit 0)
- **Full test suite**: 155/155 PASS
- **Mode B step present in all 5 non-plan skills**: verified via grep
- **Each skill references its own skill-specific knowledge path**: verified (skills.mvt-quick-dev, skills.mvt-fix, skills.mvt-refactor, skills.mvt-review, skills.mvt-test)
- **ADR-1 invariant**: each Mode B step gates on `projects.length > 1`; single-project workspaces skip entirely

### Open TODOs

- `mvtt build` regenerates dist/ but not the local deployment. A separate `mvtt install` or `mvtt update` is needed to deploy updated skill instructions.

## Task: t8-deliverables — Deliverables handoff implementation (ADR-5)

### Implementation Summary

Implemented ADR-5 deliverables handoff. Extended plan-update.js with two new CLI args: `--deliverables-pointer current` (writes `task.deliverables = { freshness: current }`) and `--mark-deliverable-stale <task_id>` (writes downstream `task.deliverables.freshness = stale`). Both args can be passed in a single invocation. Added `VALID_FRESHNESS` constant and enum validation in `validatePlan` (rejects invalid values; stale never blocks writes). Added deliverables interaction step to mvt-implement/business.md (Step 8): after implementing a task with downstream dependents, prompt user for deliverables generation, write soft-skeleton Markdown in implementation.md, then call plan-update.cjs with both deliverables flags. Added 9 ADR-5 test cases covering pointer, stale marking, combined invocation, validation, stale-not-blocking, and error paths. mvt-resume and mvt-status already surface stale deliverables warnings (added in t4); no changes needed.

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `sources/scripts/plan-update.js` | modify | ADR-5: --deliverables-pointer current, --mark-deliverable-stale <id>, freshness enum validation |
| `sources/skills/mvt-implement/business.md` | modify | ADR-5: deliverables interaction step (Step 8), downstream dependent prompt, soft-skeleton deliverables in implementation.md |
| `test/plan-update.test.ts` | modify | ADR-5: 9 test cases for deliverables pointer, stale marking, combined invocation, validation, error paths |

### Implementation Details

**plan-update.js (ADR-5)**

- `VALID_FRESHNESS = ["current", "stale"]` constant added.
- `ERRORS` object extended: `INVALID_FRESHNESS`, `STALE_TASK_NOT_FOUND`, `INVALID_DELIVERABLES_POINTER`.
- `applyUpdate`: after setting `completed_at`, if `args["deliverables-pointer"]` is "current", set `task.deliverables = { freshness: "current" }`. If `args["mark-deliverable-stale"]` is a task_id, find that task and set `deliverables.freshness = "stale"` (create object if absent). Non-existent stale target is silently skipped.
- `validatePlan`: added freshness enum check -- if `task.deliverables` exists, `freshness` must be in `VALID_FRESHNESS`. Stale is a valid state and never blocks a write.
- `applyUpdate` error return: if `--deliverables-pointer` value is not "current", returns an error object that the main function checks before proceeding.

**mvt-implement/business.md (ADR-5)**

- New Step 8: Deliverables Handoff. Gated on `plan.yaml` existing and the current task having downstream dependents.
- Two prompt branches: (a) deliverables already exist -> "update?"; (b) first time -> "generate? (default y)".
- On confirmation: write soft-skeleton Markdown (Public Interface / Data Shapes / Usage Constraints) under the task's section in implementation.md.
- Call plan-update.cjs with `--deliverables-pointer current` and `--mark-deliverable-stale <each_downstream_id>` in a single invocation.
- Old Step 8 (Plan-Aware Progress Hint) renumbered to Step 9.
- Two new edge cases added: user declines deliverables update, and plan-update.cjs rejects the pointer.

**Test cases (9 new)**

| # | Test description |
|---|-----------------|
| ADR-5 #1 | --deliverables-pointer current sets task.deliverables.freshness = "current" |
| ADR-5 #2 | --mark-deliverable-stale sets downstream task's freshness = "stale" |
| ADR-5 #3 | Both args in a single invocation |
| ADR-5 #4 | validatePlan rejects invalid freshness values |
| ADR-5 #5 | Stale deliverables never block writes |
| ADR-5 #6 | --mark-deliverable-stale with non-existent task does not error |
| ADR-5 #7 | --deliverables-pointer current overwrites existing stale deliverables |
| ADR-5 #8 | --mark-deliverable-stale preserves existing deliverables object shape |
| ADR-5 #9 | --deliverables-pointer with invalid value is rejected |

### Design Compliance

| Check | Result |
|-------|--------|
| Files touched == Change Tracking | PASS -- 3 source/test files match design; mvt-resume and mvt-status already have stale warnings from t4 |
| Module/layer placement | PASS -- plan-update.js (script), mvt-implement (skill), test (test) |
| Public interfaces match Key Interfaces | PASS -- --deliverables-pointer current, --mark-deliverable-stale <id>, freshness enum match design |
| Forbidden cross-layer imports | PASS -- no new imports introduced |
| Error handling at boundaries only | PASS -- validation errors at arg parse and validatePlan boundaries |
| No new external dependencies | PASS |

### Deviations from Design

None. Implementation matches design.md ADR-5 specification exactly.

### Self-Check Results

- **tsc --noEmit**: CLEAN (exit 0)
- **npm run build**: SUCCESS (dist/scripts/plan-update.cjs regenerated)
- **vitest test/plan-update.test.ts**: 36/36 PASS (27 existing + 9 new ADR-5)
- **Full test suite**: 164/164 PASS

### Open TODOs

- `mvtt build` regenerates dist/ but not the local deployment. A separate `mvtt install` or `mvtt update` is needed to deploy updated skill instructions.
- This is the final task in the plan. All 8 tasks are now complete.
