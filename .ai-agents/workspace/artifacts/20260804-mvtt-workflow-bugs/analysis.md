---
id: 20260804-mvtt-workflow-bugs
title: MVTT Workflow Bug Remediation
status: analyzed
created_at: 2026-08-04
source: mvtt-issues.md and bug-detect investigation
---

# Requirements Analysis: MVTT Workflow Bug Remediation

## Feature Overview

This change defines remediation requirements for three confirmed or likely MVTT workflow defects recorded in `mvtt-issues.md`: archived artifact discovery can rely on an executor's soft filtering, completed changes are not consistently represented in `session.changes[]`, and registered epic children without a `plan.yaml` have no supported completion path. The scope is the MVTT workflow prompts, session-state mutation contract, and their test coverage; it does not prescribe an implementation architecture.

## Actors

- MVTT framework user: starts, completes, resumes, reviews, and cleans up changes.
- Workflow skill executor: follows rendered skill instructions and invokes the state-update scripts.
- `session-update.cjs`: persists active-change and recent-change lifecycle state.
- `epic-update.cjs`: marks epic children terminal and selects the next executable child.
- `/mvt-cleanup`: archives completed change artifacts using `session.changes[]` as lifecycle input.

## Requirements

### R1: Exclude Archived Artifacts Deterministically

1. Plan discovery in `/mvt-status` and `/mvt-resume` must use only immediate children of `artifacts/` as candidates.
2. Context aggregation and token accounting must exclude all files below `artifacts/_archived/`.
3. If a discovery operation receives a nested or recursive result, it must discard every path containing an `_archived` directory segment before reading file content.
4. Each affected skill must perform a final candidate-set check: no plan, artifact, or token input may originate below `_archived/`.
5. The change must preserve the ability of `/mvt-cleanup` to read and move archived directories as part of its own archive operation.

### R2: Make Change Lifecycle State Consistent

1. A `changes[]` entry must represent a real, non-empty change id. State updates must never create an entry whose `id` is empty.
2. While a change remains open with an in-progress plan, its indexed status must be `active`.
3. When a plan transitions to `done`, the corresponding change must become eligible for the terminal `done` lifecycle state without requiring epic membership.
4. Closing a change must produce exactly one indexed entry for that change, with `status: done`, and then clear `active_change`.
5. Epic advancement must not subsequently create an empty active entry or overwrite the completed child state.
6. Cleanup eligibility must remain based on a trustworthy terminal status. A completed plan must not remain permanently ineligible solely because its indexed status was stale.
7. A migration or consistency-repair path must reconcile existing entries where a readable plan is `done` but the indexed change is `active`, and must identify entries referencing missing or archived parent epics.

### R3: Support Plan-Less Registered Change Completion

1. `/mvt-update-plan` must retain its task-level validation for plan-backed changes.
2. When `active_change.plan_path` is empty or missing, a registered change must have an explicit supported completion route instead of an unconditional dead end.
3. For a plan-less change linked to an active epic, the completion route must allow the user to either:
   - mark the child done and advance `epic.current_change`; or
   - mark the child done without advancing the epic.
4. After either plan-less epic outcome succeeds, the session change must close with `status: done` and `active_change` must clear.
5. For a plan-less non-epic change, the route must allow the user to close the registered change without inventing a task or plan.
6. `/mvt-quick-dev` remains a non-tracked shortcut unless its contract is explicitly expanded. Its existing conversation-only behavior must not silently mutate an unrelated active change.
7. If the framework retains a requirement that all epic children have plans, it must enforce and document that requirement before implementation begins rather than leaving completion impossible after work is done.

### R4: Cover Workflow Sequences With Tests

1. Tests must cover the full state-update sequence for a completed non-epic plan.
2. Tests must cover epic advancement followed by the normal skill State Update, asserting no empty `changes[]` entry is created.
3. Tests must cover plan-less epic completion and both advance/defer outcomes.
4. Tests must cover archived-path exclusion even when a discovery provider returns nested paths.
5. Tests must cover reconciliation of stale `active` entries for completed plans and detect dangling epic references.

## Domain Concepts

| Term | Meaning |
|---|---|
| Active change | The single in-flight change stored in `session.active_change`. |
| Indexed change | A lifecycle snapshot in `session.changes[]`, used by status, sync, and cleanup workflows. |
| Plan-backed change | A change with a valid `active_change.plan_path` and task-level progress in `plan.yaml`. |
| Plan-less change | A registered change with no `plan.yaml`, including a quick-path or single-pass workflow. |
| Terminal change | A change whose indexed status is `done` or `abandoned`; this analysis focuses on `done`. |
| Epic child | A change represented in an epic's `children[]` and controlled by `epic.current_change`. |
| Archived artifact | A completed change directory below `artifacts/_archived/`, outside live workflow discovery. |

## Business Rules

- `_archived` is a terminal storage boundary for live plan discovery, resume candidates, context aggregation, and token accounting.
- A plan status and a change lifecycle status must not contradict after a successful completion operation.
- `active_change` and `changes[]` serve different roles: the former represents one open change; the latter contains valid historical/indexed entries only.
- A completion action is atomic at the workflow level: either both epic/session outcomes succeed, or a divergence is reported and no follow-on state update may corrupt the already-applied result.
- A plan-less registered change may bypass task updates, but it must not bypass explicit user confirmation for lifecycle closure or epic advancement.
- Cleanup must remove `changes[]` entries only for directories actually moved to `_archived/`.

## Ambiguities & Questions

1. Should a completed non-epic plan close automatically as soon as its last task is marked done, or remain open for review/test/sync until the user explicitly closes it?
2. Should plan-less completion be implemented within `/mvt-update-plan`, `/mvt-implement`, a new dedicated completion skill, or a documented mandatory plan-creation rule? This requires an architecture decision.
3. Is backward reconciliation expected to mutate session state automatically, or should it be a dry-run/report followed by explicit confirmation?
4. Should `_archived` filtering be standardized through a shared executable helper, or duplicated as hard instructions in each affected skill? This requires an implementation design decision.

## Change Tracking

- Change id: `20260804-mvtt-workflow-bugs`
- Status: Requirements analyzed; implementation design and fixes are pending.
- Evidence: ISS-002 was reproduced in a temporary MVTT workspace. ISS-001 is a likely executor-guard defect; ISS-003 is confirmed by the plan-path preflight and available script capabilities.