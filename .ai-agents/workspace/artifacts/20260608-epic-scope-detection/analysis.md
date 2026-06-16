# Requirements Analysis: Epic Decomposition Layer (OPT-2026-003)

## Feature Overview

Introduce a two-tier requirement hierarchy -- **Epic -> Change** -- into the MVTT framework. When users input large-scale requirements (e.g., "build an e-commerce system", "implement based on this design manual"), the current single-layer `change` model forces the entire epic into one `analysis.md`, one `active_change`, and one `plan.yaml` (capped at 3-10 tasks), causing scope explosion and chaotic development. The proposed solution adds an Epic layer above Change, with a new `mvt-decompose` skill as the dedicated entry point for large requirements, and an "upward detection gate" in `mvt-analyze` that routes epic-level input to `mvt-decompose` (symmetric with the existing downward quick-path gate).

## Actors

| Actor | Role |
|-------|------|
| **User (Developer)** | Inputs requirements at various granularity: task, feature, epic, initiative |
| **Analyst (mvt-analyze)** | Requirements analysis skill -- gains epic detection gate (upward) alongside existing quick-path gate (downward) |
| **Strategist (mvt-decompose)** | New skill for epic-level decomposition; agent reuses `analyst` role |
| **Architect (mvt-design, mvt-plan-dev)** | Downstream consumer -- receives well-scoped sub-changes within the 3-10 task sweet spot |
| **Developer (mvt-implement)** | Downstream consumer -- implements individual sub-changes |
| **Conductor (mvt-status, mvt-resume, mvt-help, mvt-cleanup)** | Session/state management skills that must be aware of epic-pending state |
| **epic-update.cjs** | New deterministic script for epic.yaml state mutations (mirrors plan-update.cjs) |
| **session-update.cjs** | Existing script extended with epic-related parameters |

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | `mvt-analyze` Step 3 detects epic-level input via strong/weak signal heuristics and offers `/mvt-decompose` | Must |
| FR-2 | `mvt-decompose` performs epic-level analysis, decomposes into 2-8 sub-changes with DAG dependencies, writes `epic.yaml` + `epic.md` | Must |
| FR-3 | Each sub-change goes through the standard `analyze -> design -> plan -> implement` pipeline independently | Must |
| FR-4 | Epic state persisted in `epic.yaml` (children, status, current_change pointer, depends_on DAG) | Must |
| FR-5 | `session.yaml` extended with `active_epic`, `epics[]`, and `active_change.epic_id` | Must |
| FR-6 | `epic-update.cjs` handles post-creation state mutations: `--complete-child`, `--set-child-status`, `--add-child`, `--validate` | Must |
| FR-7 | `session-update.cjs` extended with `--new-epic`, `--epic-id`, `--set-epic-path`, `--set-epic-status`, `--close-epic` | Must |
| FR-8 | epic-child mode in `mvt-analyze`: when `active_epic` exists and no `active_change`, use `current_change` scope as input | Must |
| FR-9 | epic-pending state (active_epic non-empty, active_change empty) handled by `mvt-status`, `mvt-resume`, `mvt-help` | Must |
| FR-10 | `mvt-cleanup` triggers epic advancement when archiving a completed sub-change | Must |
| FR-11 | Epic archive suggests batch archiving all child changes; archive = abandon references (ADR-8) | Should |
| FR-12 | `mvt-status` displays epic progress: n/N done table with per-child status, depends_on, and active child's internal plan progress | Should |

### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-1 | Backward compatible: existing changes without `epic_id` treated as "no epic" |
| NFR-2 | Existing 155+ tests remain green; new epic-related tests added |
| NFR-3 | `mvt-sync-context` requires zero changes (transparent to epic layer) |
| NFR-4 | Single-phase delivery (no phasing) -- epic state persistence is required for core value |

## Domain Concepts

| Concept | Definition |
|---------|------------|
| **Epic** | A top-level requirement entity above Change. Represents a large initiative that must be decomposed into multiple sub-changes. Has its own lifecycle (`in_progress`, `done`, `abandoned`), artifacts (`epic.yaml`, `epic.md`), and identity (`epic-{YYYYMMDD}-{slug}`). NOT a special type of change (ADR-1). |
| **Sub-Change** | A standard change that belongs to an epic. Lives at `artifacts/{change-id}/` (flat, not nested -- ADR-4). Linked to parent epic via `active_change.epic_id`. Uses standard `{YYYYMMDD}-{slug}` id format. |
| **epic.yaml** | Structured epic metadata: children list with change_id/title/status/depends_on/scope/project, current_change pointer, DAG dependencies. Initial draft by LLM (mvt-decompose), subsequent state mutations by `epic-update.cjs` (ADR-2). |
| **epic.md** | Narrative epic analysis document: Vision, Scope, Cross-cutting Concerns, Child Stories, Dependency Map, Open Questions. Template defined by `decompose-output.md`. |
| **Epic Detection Gate** | New Step 3 in `mvt-analyze` (integer step, before Quick Path). Triggers on strong signals (whole system/platform scope, design manual reference, multiple independent capability domains) or strong+weak signal combinations. Offers `/mvt-decompose` with reversible user confirmation (y/n/show-signals). |
| **epic-child Mode** | When `active_epic` exists and `active_change.id` is empty, `mvt-analyze` enters epic-child mode: reads `epic.yaml.current_change` scope as requirement input, creates change with `epic_id` back-reference. Handles out-of-order requests via dependency-aware arbitration. |
| **epic-pending State** | First-class intermediate state: `active_epic` non-empty AND `active_change.id` empty AND `epic.yaml.status != done`. Means "epic in progress, previous sub-change done, next not yet started". Must be handled by mvt-status, mvt-resume, mvt-help for cross-session recovery. |
| **current_change Pointer** | Single active sub-change within an epic (ADR-5). Advanced by `epic-update.cjs` based on DAG topology after child completion. |
| **Epic DAG** | Directed acyclic graph formed by `depends_on` arrays across epic children. Enforced by validation (no cycles, valid references, at most one active child). |

## Business Rules

| Rule | Description |
|------|-------------|
| BR-1 | `active_change` must never represent an epic -- only concrete feature-level work. Epic is a separate top-level entity. |
| BR-2 | Epic detection (Step 3) must happen before Quick Path detection (Step 4) and before creating any `active_change`. |
| BR-3 | Epic decomposition targets 2-8 sub-changes. Each sub-change must be "right-sized" -- coverable by one `analyze -> design -> plan(3-10 tasks)` pipeline. |
| BR-4 | `epic.yaml` initial draft by LLM; all subsequent state mutations by `epic-update.cjs` only. LLM must not hand-edit structural state fields after initial creation. |
| BR-5 | Single `current_change` pointer per epic. Sub-changes advance in DAG topological order. No parallel active sub-changes. |
| BR-6 | Epic id format: `epic-{YYYYMMDD}-{slug}` (path-level distinction from change ids in shared `artifacts/` namespace). |
| BR-7 | Sub-change id format: standard `{YYYYMMDD}-{slug}` (no epic prefix). Epic linkage via `active_change.epic_id` only. |
| BR-8 | Epic status enum: `in_progress`, `done`, `abandoned` (no `planning` -- decompose creates epic directly in `in_progress`). |
| BR-9 | `--add-child` uses multi-flag syntax: `--add-child <id> --child-title "..." --child-scope "..." [--child-depends-on "a,b"]`. |
| BR-10 | Archiving an epic suggests (non-mandatory) batch archiving all child changes. Archive = abandon references; no post-archive `epic_id` integrity maintenance. |
| BR-11 | Epic advancement triggered in `mvt-update-plan` skill layer: when `plan-update.cjs` outputs `plan_status: "done"` and `active_change.epic_id` is non-empty, prompt user with (y/n/defer). On `y`: call `epic-update.cjs --complete-child` + `session-update.cjs --close-change` (close but do not archive). On `n`: no advancement, user continues review/test/sync. On `defer`: mark child done but do not advance `current_change`. |
| BR-12 | When `--complete-child` marks the last active/pending child as done, `epic-update.cjs` automatically sets `epic.yaml.status` to `done`. |
| BR-13 | `plan-update.cjs` remains unchanged -- epic awareness lives entirely in the skill layer (`mvt-update-plan/business.md`). |
| BR-14 | `mvt-cleanup` no longer triggers epic advancement; its epic-related role is simplified to pure archiving (archive completed changes/epics to `_archived/`). |

## Ambiguities & Questions

| # | Ambiguity | Status | Resolution |
|---|-----------|--------|------------|
| AQ-1 | Epic artifact path: `artifacts/epic-*/` vs separate `epics/` directory | **Resolved** | Use `artifacts/{epic-id}/` with `epic-` prefix (proposal ADR-7). Override previous "separate epics/ directory" decision. |
| AQ-2 | `--add-child` parameter format | **Resolved** | Multi-flag syntax: `--add-child <id> --child-title "..." --child-scope "..." [--child-depends-on "a,b"]` |
| AQ-3 | `planning` status usage | **Resolved** | Removed. Epic status enum is `in_progress | done | abandoned`. Decompose creates epic directly in `in_progress`. |
| AQ-4 | Epic advancement trigger mechanism | **Resolved** | Plan-done trigger in `mvt-update-plan` skill layer: confirmed advancement (y/n/defer), close change without archiving, `plan-update.cjs` unchanged, last child auto-completes epic, cleanup simplified to archiving only |
| AQ-5 | Epic-child change-id format | **Resolved** | Standard `{YYYYMMDD}-{slug}`, no epic prefix. Linkage via `active_change.epic_id` only. |

## Change Tracking

| Item | Type | Action |
|------|------|--------|
| `sources/defaults/session.yaml` | Modify | Add `active_epic`, `epics[]`, `active_change.epic_id` |
| `sources/scripts/session-update.js` | Modify | Add `--new-epic`, `--epic-id`, `--set-epic-path`, `--set-epic-status`, `--close-epic` + combo validation |
| `sources/scripts/epic-update.js` | New | `--complete-child`, `--set-child-status`, `--add-child`, `--validate` |
| `build-scripts.js` | Modify | Add `epic-update.js` to esbuild entryPoints |
| `sources/skills/mvt-decompose/manifest.yaml` | New | Skill manifest (Strategist/analyst role) |
| `sources/skills/mvt-decompose/business.md` | New | Epic decomposition execution flow |
| `sources/templates/decompose-output.md` | New | `epic.md` chapter template |
| `registry.yaml` | Modify | Register `mvt-decompose` (category: workflow) |
| `sources/skills/mvt-analyze/business.md` | Modify | Add Step 3 Epic Detection, epic-child mode, renumber Steps 3-6 to 4-7 |
| `sources/skills/mvt-analyze/manifest.yaml` | Modify | Add epic detection branch to next-steps |
| `sources/skills/mvt-status/business.md` | Modify | Epic progress view, epic-pending state |
| `sources/skills/mvt-resume/business.md` | Modify | Epic context restoration, epic-pending fallback |
| `sources/skills/mvt-cleanup/business.md` | Modify | Epic integrity check, batch archive suggestion; **no advancement trigger** (simplified to pure archiving) |
| `sources/skills/mvt-update-plan/business.md` | Modify | **Add epic advancement logic**: detect `plan_status: done` + `epic_id` non-empty, prompt user (y/n/defer), call `epic-update.cjs --complete-child` + `session-update.cjs --close-change` |
| `sources/skills/mvt-help/business.md` | Modify | Epic-pending in next-skill decision table + workflow diagram |
| `tests/epic-update.test.ts` | New | epic-update.cjs unit tests |
| `tests/` (session-update) | Modify | Epic parameter regression tests |

## Suggested Next Steps

- `/mvt-design` -- Design architecture for the Epic Decomposition Layer based on this analysis and the OPT-2026-003 proposal
- `/mvt-plan-dev` -- Given the scale of this change (15+ files), generate a structured development plan after design is complete
