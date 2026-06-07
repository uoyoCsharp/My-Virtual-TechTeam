# Architecture Design: Multi-Project Workflow Support (OPT-2026-002)

> Source: `analysis.md` (this change) + proposal OPT-2026-002 v2.4 + design-review-v3.md.
> Change-id: `20260605-multi-project-workflow-support`
> Subject system: the MVTT framework itself (YAML schemas, the shared activation section, skill instruction Markdown, two deterministic scripts, and the `src/` reconcile layer).

## Overview

Make the MVTT **workflow layer** project-aware so one workspace can drive a multi-project repo, while a single-project repo (`projects.length == 1`) behaves exactly as today with zero new prompts. The work spans four artifact classes, layered by the proposal's dependency chain:

1. **Foundation** — automatic current-project resolution via a 3-priority rule in the shared activation section (no session-level anchor).
2. **Plan attribution** — a `project` array on plan tasks, validated deterministically by `plan-update.js`; per-project `in_progress` advancement.
3. **Project-scoped context** — a 2x2 (skill-axis × project-axis) knowledge model expressed as project-keyed `knowledge` maps in `registry.yaml`, resolved by a project-aware activation step with two loading modes (plan-driven vs. non-plan on-demand).
4. **Structured handoff** — a `deliverables` field carrying the downstream-facing contract, maintained interactively by `mvt-implement`.

### Architectural concerns

| Concern | Source of evidence | Priority |
|---------|--------------------|----------|
| Backward compatibility (single-project = no behavior change) | analysis BR-1, proposal §5.2 | must |
| Preserve user-added knowledge bindings across `mvtt update` | `src/fs/registry-merge.ts`, memory `mvtt-registry-preservation` | must |
| Determinism of `plan.yaml` mutation (script, not LLM) | memory `mvtt-determinism-decisions`, proposal §5.4 | must |
| No silent full-context loading in multi-project repos | analysis BR-2 | must |
| Cross-session persistence of handoff contracts | analysis S3-* | should |
| Avoid schema/merge drift between `install` and `update` | `registry-merge.ts` comment lines 205-208 | must |
| Token accounting accuracy after context split | analysis A-3 | should |
| Single source of truth for current-project state (no dual-persist) | design-review-v3 D-R2 | must |
| Project naming safety (reserved `_all` key) | design-review-v3 decision 5 | must |

### Key finding overriding proposal §8

Proposal §8 asserts "no `src/` TypeScript changes." This **cannot hold**: the S1-4 breaking change (registry `knowledge` from list → project-keyed map) breaks `src/fs/registry-merge.ts`, which hardcodes `knowledge.shared` and `skills.<name>.knowledge` as **arrays** to preserve user bindings on update (lines 118-128, 145-160). Leaving it unchanged would silently drop user-added project-scoped bindings on every `mvtt update`. The design therefore **expands scope to `src/`** (ADR-6) — a deliberate, recorded override of §8.

## Architecture Decision Records

### ADR-1: Single-project collapse keys on `projects.length == 1`, not on name

| Field | Content |
|-------|---------|
| Status | accepted |
| Context | The proposal uses `name == "default"` and `projects.length == 1` interchangeably; this very repo has `name="mvtt"`, length 1, so they diverge. Concern: backward-compatibility must-have. |
| Decision | All project-scoping branches gate on `projects.length == 1`. When true: PS = the sole project, activation skips every project-keyed lookup beyond `_all`, no project prompt ever fires, and `mvt-analyze-code` keeps the flat `_generated/project-context.md` path. The project's `name` is cosmetic in this mode. |
| Alternatives | Gate on `name == "default"` — rejected: would force this repo (and any single project not literally named "default") into multi-project prompting, a behavior regression. |
| Consequences | (+) Zero-config back-compat for all existing single-project installs regardless of name. (-) The literal `"default"` convention loses meaning as a gate; documented as convention-only. |

### ADR-2: Registry knowledge becomes a project-keyed map with reserved `_all` key

| Field | Content |
|-------|---------|
| Status | accepted |
| Context | Knowledge has two orthogonal scope axes (skill × project). A flat list cannot express the project axis. Concern: no-silent-full-load, clean 2x2 model. |
| Decision | Every `knowledge` block — top-level and each `skills.<name>.knowledge` — becomes a map keyed by project name, with reserved key `_all` = all projects. Skill axis = which layer the block lives in; project axis = which map key. **Two loading modes** (see Flow 2): **Mode A (plan-driven skills)**: activation resolves PS first, then loads the union: `knowledge._all` ∪ `knowledge[P]`∀P∈PS ∪ `skills[S].knowledge._all` ∪ `skills[S].knowledge[P]`∀P∈PS. **Mode B (non-plan skills)**: activation loads `knowledge._all` ∪ `skills[S].knowledge._all` only; the skill identifies relevant projects during execution and reads project-specific knowledge on demand. |
| Alternatives | (a) Per-entry `project:` field filtered at activation — rejected: requires scanning/filtering, less cohesive. (b) Defer restructure — rejected: abandons the 2x2 model and S1-4. |
| Consequences | (+) Direct key lookup, semantically cohesive. (-) Breaking change to registry shape (ADR-3); forces `registry-merge.ts` rewrite (ADR-6); `mvt-manage-context` must learn the map shape; non-plan skills need explicit project-identification instructions in their business.md. |

### ADR-3: Breaking registry migration — old lists move under `_all`

| Field | Content |
|-------|---------|
| Status | accepted |
| Context | Green-field premise permits breaking changes. The shipped `registry.yaml` and any installed user copy use the flat form. |
| Decision | `knowledge.shared` (list) → `knowledge._all` (same list). `skills.<name>.knowledge` (flat list) → `skills.<name>.knowledge._all` (same list). Multi-project semantic `project-context` entries move from shared to `knowledge.<projectName>`. Single-project repos use only `_all` (today's content + one nesting level). The framework `registry.yaml` is rewritten by hand as part of this change. |
| Alternatives | Dual-read both shapes indefinitely — rejected: permanent complexity for a green-field framework. |
| Consequences | (+) One clean shape everywhere. (-) Existing installed registries need migration handled by the merge rewrite (ADR-6) on next `mvtt update`. |

### ADR-4: `task.project` is an array, validated in `plan-update.js` via caller-supplied `--projects`

| Field | Content |
|-------|---------|
| Status | accepted |
| Context | Tasks must declare their project(s); validation must be deterministic (not LLM). `plan-update.js` currently has no project-root awareness and only holds the plan object. Concern: determinism must-have. |
| Decision | Add `project: string[]` to the task schema. Validation lives in `validatePlan`, gated by a new `--projects "a,b"` arg the **caller skill** supplies (read from `project-context.yaml > projects[].name`). When the list has > 1 entry, every task's `project` must be a non-empty array with each element ∈ the list. When `--projects` is absent or only `default`, missing `project` is allowed and treated as `["default"]`. **Cross-project `depends_on` is allowed**. A `skipped` task satisfies `depends_on` (the dependency is resolved even if not completed); a `blocked` task does not. Cross-project advancement emits a `project_switch` notification. **Project naming constraint**: names must match `[a-zA-Z0-9][a-zA-Z0-9_-]*` (no leading underscore). Validated by `mvt-init` and `plan-update.js --projects`. |
| Alternatives | Script self-reads `project-context.yaml` via `findProjectRoot()` — rejected: introduces project-root + disk coupling. Prohibit cross-project `depends_on` — rejected: multi-project repos genuinely have cross-project dependencies. |
| Consequences | (+) Determinism preserved; cross-project dependencies supported with clear semantics. (-) Correctness depends on callers passing the right `--projects`; `recomputeCurrentTask` must use `resolvedIds` (done + skipped) instead of `doneIds`. |

### ADR-5: Deliverables — content in `implementation.md`, `{ freshness }` pointer in `plan.yaml`, enum-validated but non-blocking

| Field | Content |
|-------|---------|
| Status | accepted |
| Context | Downstream tasks need a persisted, structured contract. `implementation.md` already accumulates per-task sections keyed by `## Task: {task_id}`. Concern: cross-session persistence; determinism of plan writes. |
| Decision | Deliverables **content** is free-structured Markdown under the task's existing `implementation.md` section (soft skeleton: "Public Interface / Data Shapes / Usage Constraints"). `plan.yaml`'s `task.deliverables` holds **only** `{ freshness: current|stale }` — the implementation.md section is derivable from the task id, so no redundant file/anchor is stored. `validatePlan`: if `deliverables` is present, `freshness` must be `current` or `stale` (else reject as malformed), but a `stale` value **never blocks** a write — staleness is surfaced by `mvt-resume`/`mvt-status`, not enforced. **Parameter contract**: `--deliverables-pointer current` writes `task.deliverables = { freshness: current }`; `--mark-deliverable-stale <task_id>` writes `downstream task.deliverables.freshness = stale`. |
| Alternatives | (a) Store file+heading anchor — rejected: duplicates task-id-derivable info, drifts on rename. (b) Store inline summary in plan.yaml — rejected: splits contract across two files. (c) Block on stale — rejected: over-couples plan mutation to handoff state. |
| Consequences | (+) Single source of truth for content; minimal plan footprint; integrity without over-enforcement. (-) Resume/status must read `implementation.md` to render the actual contract. |

### ADR-6: Expand scope to `src/fs/registry-merge.ts` (override proposal §8)

| Field | Content |
|-------|---------|
| Status | accepted |
| Context | ADR-2/3 change the registry shape that `mergeRegistry` reconciles. The module's binding-preservation invariant is implemented against arrays. Concern: preserve-user-bindings must-have. |
| Decision | Rewrite `mergeRegistry` to be map-aware: diff `knowledge` per project key (including `_all`) instead of per array; re-graft user-added bindings under the correct project key on framework skills; preserve `_all` semantics. **Both merge paths must be updated**: (1) top-level `knowledge` map and (2) per-skill `skills.<name>.knowledge` map — the latter is structurally identical to (1) but operates independently per skill entry. Update `test/fs/registry-merge.test.ts` to cover map-shaped registries and project-keyed binding preservation. `RegistryDoc.knowledge` type loosens from `{ shared?: unknown[] }` to a project-keyed map. No other `src/` module needs changes. |
| Alternatives | Ship schema without touching merge — rejected: silently drops user project-scoped bindings on `mvtt update`. |
| Consequences | (+) Invariant preserved under the new shape; install/update stay byte-identical. (-) Overrides §8; adds one TS module rewrite + test to scope. |

### ADR-7: `mvt-analyze-code` writes per-project semantic files only in multi-project mode

| Field | Content |
|-------|---------|
| Status | accepted |
| Context | Layer-1 file split. `_generated/` is already a `user_data_dir` (install-manifest.yaml:35), written at runtime by the skill, never CLI-owned. |
| Decision | Single-project (`length == 1`): keep flat `knowledge/project/_generated/project-context.md` (zero migration). Multi-project: write `knowledge/project/_generated/{name}/project-context.md` per project, replacing whole-file instead of in-file section replacement. Existing flat multi-project workspaces auto-split on the next `/mvt-analyze-code --all` (analysis BR-9). No `install-manifest.yaml` change: the `{name}/` subdir nests under the existing `_generated/` user-data entry. The manifest mechanism simply ensures directory existence (`mkdirSync(dir, { recursive: true })`) — it never tracks, matches, or protects file contents within `user_data_dirs`. Subdirectories are inherently safe because the manifest never manages their contents. |
| Alternatives | Classify `_generated/{name}/` as `generated` — rejected: `_generated/` is `user_data_dirs` (written by skills at runtime, not managed by the CLI). BR-10's premise that `_generated/` is `generated` was mistaken and is corrected here. |
| Consequences | (+) Simpler skill logic (whole-file write); no CLI/manifest change. (-) Auto-split migration is implicit; `mvt-sync-context` must route to the right per-project file (A-4). |

### ADR-8: Per-project independent `in_progress` advancement (overrides global-unique constraint)

| Field | Content |
|-------|---------|
| Status | accepted |
| Context | `plan-update.js` enforces a global "at most one `in_progress` task" rule (`validatePlan` line 204-209) and `recomputeCurrentTask` advances a single `current_task` (lines 126-172). In a multi-project repo, this serializes all project work: task t1 (project: ["api"]) being `in_progress` blocks t2 (project: ["web"]) from starting until t1 completes. This fundamentally contradicts the design intent of "one workspace drives a multi-project repo." |
| Decision | `validatePlan` allows one `in_progress` **per project**. `plan.current_task: string` becomes `plan.current_tasks: Record<string, string>` (project name → task id). Single-project repos also use `current_tasks` (no backward-compatible `current_task` field — green-field premise). `recomputeCurrentTask` advances each project's task independently. When advancement crosses a project boundary, the JSON output includes a `project_switch` notification: `{"project_switch": {"from": ["web"], "to": ["api"]}}`. `findCycle` runs per-project subgraph (tasks are partitioned by their `project` array; cross-project dependencies are included in both subgraphs for cycle detection). When a cross-project task (project: ["web","api"]) is `in_progress`, each involved project's key in `current_tasks` points to it. Plan completion: `current_tasks` is an empty object `{}`. |
| Alternatives | (B) Global singular + project preference — rejected: still serializes cross-project work. (C) Global singular + manual switch — rejected: shifts burden to the user. |
| Consequences | (+) True multi-project parallelism; per-project task progress independent. (-) `plan.yaml` schema change (`current_task` → `current_tasks`); all skills consuming plan JSON must update; `recomputeCurrentTask` and `findCycle` require significant rewrite. |

## Module Design

The "modules" here are framework artifacts. Each maps to one or more concerns.

| Artifact | Type | Responsibility | Change |
|----------|------|----------------|--------|
| `sources/defaults/session.yaml` | schema | No `active_project` field added (single-source-of-truth decision) | none |
| `sources/defaults/project-context.yaml` | schema | Add `source_paths: []` empty default per project entry | modify |
| `sources/sections/activation-load-context.md` | shared section | Resolve PS (3-priority rule, two loading modes) + load 2x2 knowledge union | modify |
| `registry.yaml` (framework) | schema/data | Restructure `knowledge` to project-keyed maps with `_all` | modify (breaking) |
| `sources/scripts/session-update.js` | script | No `--set-active-project` needed | none |
| `sources/scripts/plan-update.js` | script | `--projects` validation, per-project `in_progress`, `current_tasks`, `--deliverables-pointer current`, freshness enum, `--mark-deliverable-stale`, `resolvedIds` (done+skipped), `project_switch` notification | modify |
| `src/fs/registry-merge.ts` | TS module | Map-aware merge preserving project-keyed bindings (both top-level and per-skill knowledge maps) | modify (ADR-6) |
| `test/fs/registry-merge.test.ts` | test | Cover map-shaped merge + project-keyed binding preservation | modify |
| `test/plan-update.test.ts` | test | Cover per-project in_progress, resolvedIds, project_switch, skipped-satisfies-depends-on | modify |
| `sources/skills/mvt-plan-dev/business.md` | skill | `project` array on tasks, auto-infer, pass `--projects`, read `current_tasks` | modify |
| `sources/skills/mvt-update-plan/business.md` | skill | Pass `--projects`; deliverables stale flow; read `current_tasks` | modify |
| `sources/skills/mvt-implement/business.md` | skill | Remove hardcoded `coding-standards.md` path; deliverables interaction (a)/(b) | modify |
| `sources/skills/mvt-analyze-code/business.md` | skill | Per-project file output (ADR-7); populate `source_paths` | modify |
| `sources/skills/mvt-sync-context/business.md` | skill | Route to per-project semantic file (4-level fallback chain) | modify |
| `sources/skills/mvt-manage-context/business.md` | skill | Map-aware add/remove/list/move/rename; two-question → 4-quadrant routing table | modify |
| `sources/skills/mvt-init/business.md` | skill | Detect monorepo sub-projects; interactive refresh (remove `--refresh` flag); validate project naming constraint; prompt `mvt-analyze-code` after project changes | modify |
| `sources/skills/mvt-status/business.md` | skill | Per-project progress grouping; read `current_tasks` | modify |
| `sources/skills/mvt-check-context/business.md` | skill | Per-project token accounting; map-aware structure | modify |
| `sources/skills/mvt-resume/business.md` | skill | Surface cross-project `current_tasks` switches + stale deliverables; handle `project_switch` | modify |
| `sources/skills/mvt-quick-dev/business.md` | skill | Remove hardcoded `coding-standards.md` reference; add on-demand project identification + knowledge loading instructions (Mode B) | modify |
| `sources/skills/mvt-fix/business.md` | skill | Add on-demand project identification + knowledge loading instructions (Mode B) | modify |
| `sources/skills/mvt-refactor/business.md` | skill | Add on-demand project identification + knowledge loading instructions (Mode B) | modify |
| `sources/skills/mvt-review/business.md` | skill | Remove `naming-conventions.md` dead reference; add on-demand project identification + knowledge loading instructions (Mode B) | modify |
| `sources/skills/mvt-test/business.md` | skill | Add on-demand project identification + knowledge loading instructions (Mode B) | modify |
| `sources/skills/mvt-quick-dev/manifest.yaml` | manifest | Remove `coding-standards.md` from `extended_context` | modify |

## Key Interfaces

### `session.yaml` schema

No changes. `active_project` is **not** added — the current-project signal is resolved at activation time and not persisted, avoiding dual-source-of-truth issues.

### `project-context.yaml` schema addition

```yaml
projects:
  - name: "mvtt"               # Must match [a-zA-Z0-9][a-zA-Z0-9_-]* (no leading underscore)
    path: "."
    type: "cli-tool"
    tech_stack: { ... }
    source_paths:               # NEW: populated by mvt-analyze-code; used for PS resolution priority 2
      - "src/"
      - "test/"
```

### `registry.yaml` knowledge shape (after ADR-2/3)

```yaml
knowledge:                          # top level = all skills
  _all:                             # quadrant 1: all projects, all skills
    - id: core
      source: knowledge/core/
      files_from_manifest: true
  web:                              # quadrant 3: web project, all skills
    - id: project-context
      source: knowledge/project/_generated/web/
      files: ["project-context.md"]

skills:
  mvt-implement:
    knowledge:                      # skill layer = this skill only
      _all:                         # quadrant 2: all projects, this skill
        - id: general-review
          type: static
          source: knowledge/principle/
          files: ["general-review.md"]
      web:                          # quadrant 4: web project × this skill
        - id: coding-standards
          type: static
          source: knowledge/principle/web/
          files: ["coding-standards.md"]
```

### `task` schema additions (plan.yaml)

```yaml
- id: "t1-api-contract"
  project: ["web", "api"]           # ADR-4: array, each ∈ projects[].name
  deliverables:                     # ADR-5: present only if task exposes a contract
    freshness: current              # current | stale
  # ...existing fields unchanged
```

### `plan.yaml` schema change (ADR-8)

```yaml
# BEFORE:
current_task: "t1"

# AFTER:
current_tasks:                      # one key per project
  web: "t3"
  api: "t1"
# Empty object {} when plan is done
```

### Script CLI additions

```bash
# session-update.js — NO CHANGES (no --set-active-project)

# plan-update.js (ADR-4, ADR-5, ADR-8)
node .ai-agents/scripts/plan-update.cjs --plan <p> --task <id> --status <st> \
  --projects "web,api" \
  [--deliverables-pointer current] \
  [--mark-deliverable-stale <downstream_task_id>]
```

### `mergeRegistry` (ADR-6, TS signature unchanged, behavior generalized)

```ts
// RegistryDoc.knowledge: was { shared?: unknown[] } & Dict
//                        now Record<string, unknown[]>   (project-keyed, incl. "_all")
// RegistryDoc.skills.<name>.knowledge: was unknown[] | undefined
//                                       now Record<string, unknown[]> | undefined
function mergeRegistry(framework: RegistryDoc, user: RegistryDoc):
  { merged: RegistryDoc; result: Omit<RegistryMergeResult, "written" | "backup"> }
// Per project key (including _all):
//   TOP-LEVEL knowledge: framework baseline + user additions not in framework (keyed by id, then stableKey)
//   PER-SKILL knowledge: same logic, applied independently per skill entry
```

### Project naming constraint

```
projects[].name must match: [a-zA-Z0-9][a-zA-Z0-9_-]*
- No leading underscore (protects _all reserved key)
- No commas or spaces (safe for CSV parameters)
- Validated by: mvt-init, plan-update.js --projects
```

## Data Flow

### Flow 1: Project resolution at skill activation (3-priority, two modes)

```mermaid
sequenceDiagram
    participant S as Skill (activation section)
    participant PY as project-context.yaml
    participant PL as plan.yaml
    participant U as User

    S->>PY: read projects[]
    alt projects.length == 1
        S->>S: PS = [sole project]; skip all prompts (ADR-1)
    else multi-project
        alt Mode A: Plan-driven skill
            S->>PL: current_tasks[P]? (priority 1)
            alt found
                S->>S: PS = resolved project(s)
            else
                S->>S: reverse-lookup file paths vs projects[].path / source_paths (priority 2)
                alt unique hit
                    S->>S: PS = matched project
                else ambiguous (priority 3)
                    S->>U: offer candidates (smart-preselected); never silent full-load
                    U-->>S: pick
                end
            end
        else Mode B: Non-plan skill
            S->>S: load _all knowledge only (no PS resolution at activation)
            Note over S: Project identified during execution from file paths / change description
            S->>S: on-demand load project-specific knowledge
        end
    end
    S->>S: load knowledge union (Flow 2)
```

Error path: if PS resolution yields a project name absent from `projects[]` (stale plan), drop it and fall through to the next priority; if none resolve, fall to priority-3 prompt.

### Flow 2: 2x2 knowledge union load (ADR-2)

**Mode A — Plan-driven skills** (pure key lookup, no scan):

1. Load `knowledge._all`.
2. For each P in PS: load `knowledge[P]` (skip if key absent).
3. Load `skills[S].knowledge._all`.
4. For each P in PS: load `skills[S].knowledge[P]` (skip if key absent).

Cross-project task (PS = `["web","api"]`) loads the **union** of both projects' quadrant-3 and quadrant-4 entries.

**Mode B — Non-plan skills** (activation + on-demand):

1. At activation: load `knowledge._all` + `skills[S].knowledge._all` only.
2. During execution: identify relevant project(s) from the change target (file paths, change description).
3. On demand: read `knowledge[P]` and `skills[S].knowledge[P]` entries from registry, then load the referenced files.

### Flow 3: Deliverables handoff (ADR-5)

```mermaid
sequenceDiagram
    participant I as mvt-implement
    participant PL as plan.yaml
    participant IM as implementation.md
    participant PU as plan-update.cjs
    participant U as User

    I->>PL: reverse-dep lookup: any task depends_on current?
    alt downstream consumers exist
        alt deliverables already exist (re-impl / rescope)
            I->>U: "impl changed, downstream [list] depend on it — update deliverables? (y/n)"
        else first time
            I->>U: "downstream [list] will consume this — generate deliverables? (default y)"
        end
        opt user agrees
            I->>IM: write/refresh deliverables section under ## Task: {id}
        end
        I->>PU: --deliverables-pointer current (freshness=current on this task)
        I->>PU: --mark-deliverable-stale <each downstream id>   (interaction b)
    else no downstream
        I->>I: skip silently (no prompt)
    end
```

Error path: if `plan-update.cjs` rejects (e.g. malformed freshness), `mvt-implement` surfaces stderr and leaves `implementation.md` as written (content is source of truth; pointer retried).

### Flow 4: `mvtt update` registry reconciliation (ADR-6)

1. `materializeProject` → `updateRegistry(projectRoot, packageRoot)`.
2. `mergeRegistry` reads framework (new map shape) + user (possibly old flat shape or new map shape).
3. Normalize user flat `knowledge.shared`/`skills.*.knowledge` arrays → treat as the `_all` key (migration of installed registries, ADR-3).
4. Per project key: framework baseline + user additions (keyed by `id` then `stableKey`), preserving project-scoped bindings.
5. Per-skill knowledge: same merge logic applied independently to each `skills.<name>.knowledge` map.
6. Serialize; install and update share the one merge path (no drift).

Error path: unreadable framework registry → `written: false` (existing behavior retained).

## mvt-manage-context: Map-Aware Operations

### Two-question routing table (add subcommand)

| Question 1: Scope | Question 2: Breadth | Registry key path |
|--------------------|---------------------|-------------------|
| global | all skills | `knowledge._all` |
| project-specific | all skills | `knowledge.{projectName}` |
| global | specific skill | `skills.{name}.knowledge._all` |
| project-specific | specific skill | `skills.{name}.knowledge.{projectName}` |

### Per-subcommand behavior under map structure

| Subcommand | Behavior |
|------------|----------|
| **add** | Route via two-question table above. `_all` has heavier semantics than the old `shared` — promote to `_all` means loaded by every skill across every project; confirmation flow should reflect this weight. |
| **remove** | Search across all project keys in the map (traverse `knowledge._all`, `knowledge.web`, `knowledge.api`, etc. and same per skill). |
| **list** | Group by project × skill (3D table). Orphan entries (project key not in `projects[]`) are flagged. |
| **move** | Support cross-key movement (e.g. `_all` → `web`, `web` → `api`). |
| **rename** | Update the reference under the correct project key. |

## mvt-sync-context: Per-Project Routing

4-level fallback chain (no `active_project`):

1. `task.project` exists → route to that project's `_generated/{name}/project-context.md`.
2. Artifact file paths match a unique project's `source_paths` or `path` → route to that project.
3. Current operation's file path reverse-lookup against `projects[].path` → route to that project.
4. List candidate projects for user selection.

Cross-project changes (task spanning multiple projects): split write per project — each project's file receives only its relevant knowledge entries.

## mvt-init: Interactive Refresh Model

No `--refresh` flag. MVTT's design principle is "feedback and choice," not parameterized modes.

When `mvt-init` is executed and existing artifacts are detected:

1. **Prompt user**: "Existing MVTT configuration found. Refresh to re-scan project structure?" (y/n)
2. On confirm → re-scan project structure → generate proposed `project-context.yaml`.
3. **Compare** new vs existing `projects[]`. If project changes detected (added/removed/renamed sub-projects) → **show diff**: "+N added / -N removed" and confirm before writing.
4. **Preserve** existing: `session.yaml > history`, `config.yaml > preferences`, user-added custom fields in `project-context.yaml`.
5. After writing → **prompt user**: "Project structure updated. Recommend running `/mvt-analyze-code` to sync semantic context."
6. **Validate** project names against naming constraint (`[a-zA-Z0-9][a-zA-Z0-9_-]*`).

## Hardcoded Knowledge Path Removal

The following hardcoded references to knowledge files in skill instructions must be removed. After 2x2 matrix is established, knowledge content is loaded exclusively through the registry knowledge mechanism — skill instructions reference "the knowledge loaded by activation" rather than specific file paths.

| File | Line | Removal |
|------|------|---------|
| `sources/skills/mvt-implement/business.md` | 8, 34 | Remove `coding-standards.md` hardcoded references; replace with "Follow the coding standards loaded by activation (if any)" |
| `sources/skills/mvt-quick-dev/business.md` | 67 | Remove `coding-standards.md` hardcoded reference; same replacement |
| `sources/skills/mvt-quick-dev/manifest.yaml` | 42 | Remove `coding-standards.md` from `extended_context` |
| `sources/skills/mvt-review/business.md` | 42 | Remove `naming-conventions.md` dead reference (file does not exist) |

**Convention**: `extended_context` is used exclusively for dynamic path resolution (e.g. `{active_change.id}/implementation.md`). All declarative knowledge content is loaded through the registry knowledge mechanism.

## File Structure

| Path | Module role |
|------|-------------|
| `sources/defaults/project-context.yaml` | Add `source_paths` field per project entry |
| `sources/sections/activation-load-context.md` | PS resolution (3-priority, two modes) + 2x2 union (Flow 1, 2) |
| `registry.yaml` | project-keyed knowledge maps |
| `sources/scripts/plan-update.js` | `--projects`, per-project `in_progress`, `current_tasks`, `--deliverables-pointer current`, freshness, `--mark-deliverable-stale`, `resolvedIds`, `project_switch` |
| `src/fs/registry-merge.ts` | map-aware merge (ADR-6), both top-level and per-skill knowledge maps |
| `test/fs/registry-merge.test.ts` | map-merge coverage |
| `test/plan-update.test.ts` | per-project in_progress, resolvedIds, project_switch, skipped-satisfies-depends-on |
| `sources/skills/mvt-plan-dev/business.md` | task `project` array + `--projects` + read `current_tasks` |
| `sources/skills/mvt-update-plan/business.md` | `--projects` + stale flow + read `current_tasks` |
| `sources/skills/mvt-implement/business.md` | remove hardcoded standard + deliverables interaction |
| `sources/skills/mvt-analyze-code/business.md` | per-project `_generated/{name}/` output + populate `source_paths` |
| `sources/skills/mvt-sync-context/business.md` | per-project routing (4-level fallback) |
| `sources/skills/mvt-manage-context/business.md` | 4-quadrant routing table + map-aware list/remove/move/rename |
| `sources/skills/mvt-init/business.md` | monorepo detection + interactive refresh (no --refresh) + naming constraint |
| `sources/skills/mvt-status/business.md` | per-project progress + read `current_tasks` |
| `sources/skills/mvt-check-context/business.md` | per-project accounting + map shape |
| `sources/skills/mvt-resume/business.md` | cross-project switch + stale surfacing + `project_switch` |
| `sources/skills/mvt-quick-dev/business.md` | remove hardcoded standard + Mode B project identification |
| `sources/skills/mvt-quick-dev/manifest.yaml` | remove `coding-standards.md` from extended_context |
| `sources/skills/mvt-fix/business.md` | Mode B project identification + on-demand loading |
| `sources/skills/mvt-refactor/business.md` | Mode B project identification + on-demand loading |
| `sources/skills/mvt-review/business.md` | remove dead reference + Mode B project identification + on-demand loading |
| `sources/skills/mvt-test/business.md` | Mode B project identification + on-demand loading |

Note: every `sources/skills/*/business.md` edit requires a rebuild (`mvtt build`) to regenerate the assembled `.claude/skills/mvt-*/SKILL.md` and the local `.ai-agents` deployment. The `activation-load-context.md` section is shared, so its edit propagates to **all** skills that include it on rebuild.

## Implementation Guidelines

Implement in the proposal's risk-ascending order (analysis §5). Suggested task grouping for `/mvt-plan-dev`:

1. **Foundation** — the PS-resolution step in `activation-load-context.md` (the single-project `length==1` no-op path first, so back-compat is provable before any multi-project branch). Two modes: plan-driven (3-priority) and non-plan (on-demand). Acceptance: single-project install shows zero behavior change.
2. **Plan attribution (ADR-4, ADR-8)** — `plan-update.js --projects` validation + per-project `in_progress` + `current_tasks` + `resolvedIds` (done+skipped) + `project_switch` notification + `findCycle` per-project subgraph + `mvt-plan-dev`/`mvt-update-plan` passing `--projects`. Produces the richest current-project signal for the foundation.
3. **Registry restructure + merge (ADR-2/3/6)** — hand-rewrite `registry.yaml`, rewrite `mergeRegistry` (both top-level and per-skill knowledge maps) + test together (schema and merge must land in one commit to keep install/update consistent). Then the 2x2 union load in activation, then `mvt-manage-context` 4-quadrant routing table.
4. **Adjacent project-awareness** — `mvt-init` interactive refresh + monorepo detection + naming constraint, `mvt-status` grouping, `mvt-check-context` accounting, `mvt-sync-context` routing (4-level fallback), `mvt-analyze-code` per-project split (ADR-7) + `source_paths` population, hardcoded knowledge path removal, Mode B instructions in non-plan skill business.md files.
5. **Deliverables (ADR-5)** — `plan-update.js` deliverables/freshness/stale args + `mvt-implement` interaction + `mvt-resume`/`mvt-status` stale surfacing.

Hard invariant for every task: `projects.length == 1` ⇒ today's behavior, zero new prompts (ADR-1).

Determinism boundary: all `plan.yaml` mutation (project validation, deliverables pointer, freshness, stale marking, per-project advancement) stays in `plan-update.js`; y/n interaction is skill-layer only.

Single-source-of-truth: no `active_project` in `session.yaml`. Current-project state is resolved at activation time from plan signals or path inference, never persisted separately.

## Change Tracking

Files expected to be **modified**:

- `sources/defaults/project-context.yaml` (add `source_paths`)
- `sources/sections/activation-load-context.md`
- `registry.yaml`
- `sources/scripts/plan-update.js`
- `src/fs/registry-merge.ts` *(ADR-6, overrides proposal §8)*
- `test/fs/registry-merge.test.ts`
- `test/plan-update.test.ts`
- `sources/skills/mvt-plan-dev/business.md`
- `sources/skills/mvt-update-plan/business.md`
- `sources/skills/mvt-implement/business.md`
- `sources/skills/mvt-analyze-code/business.md`
- `sources/skills/mvt-sync-context/business.md`
- `sources/skills/mvt-manage-context/business.md`
- `sources/skills/mvt-init/business.md`
- `sources/skills/mvt-status/business.md`
- `sources/skills/mvt-check-context/business.md`
- `sources/skills/mvt-resume/business.md`
- `sources/skills/mvt-quick-dev/business.md`
- `sources/skills/mvt-quick-dev/manifest.yaml`
- `sources/skills/mvt-fix/business.md`
- `sources/skills/mvt-refactor/business.md`
- `sources/skills/mvt-review/business.md`
- `sources/skills/mvt-test/business.md`

No change required: `sources/defaults/session.yaml` (no `active_project`), `install-manifest.yaml` (ADR-7: `_generated/` is `user_data_dirs` — manifest only ensures directory existence, never manages contents), `sources/scripts/session-update.js` (no `--set-active-project`).

Runtime-created (by skills, not this change): `knowledge/project/_generated/{name}/project-context.md`, `knowledge/principle/{name}/*.md`.

> Scope is ~23 files across schema, scripts, one TS module, and 14 skills, with one breaking change (ADR-3), one scope expansion (ADR-6), and one fundamental DAG restructuring (ADR-8). This exceeds the 5-file / 1-module threshold → `/mvt-plan-dev` is the required next step.
