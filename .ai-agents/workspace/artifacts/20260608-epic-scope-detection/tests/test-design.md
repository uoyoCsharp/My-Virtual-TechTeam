---
id: 'test-output'
version: '1.0'
skill: 'mvt-test'
---

# Test Design: Epic Decomposition Layer (t8-tests)

## Scope

Target files:
- `sources/scripts/epic-update.js` (built to `dist/scripts/epic-update.cjs`)
- `sources/scripts/session-update.js` (built to `dist/scripts/session-update.cjs`)

Fallback: implementation.md Files Touched for t1 and t2.

## Test Framework & Layout

- **Framework**: Vitest v2
- **Layout**: `test/{script-name}.test.ts` mirroring `sources/scripts/`
- **Pattern**: Real filesystem operations into `os.tmpdir()`, `spawnSync` for script execution (matching plan-update.test.ts)

## Test Scenarios

### epic-update.cjs (46 cases)

| # | Category | Scenario | Granularity |
|---|----------|----------|-------------|
| 1-7 | --validate | Valid epic, duplicate change_ids, dangling depends_on, cycle, multiple active, current_change points to done, all done but in_progress, no-write-on-validate | Unit |
| 8-13 | --complete-child | Normal advancement, array-order tie-break, last-child auto-done, unresolved deps block, unknown id, abandoned children skipped | Unit |
| 14-21 | --set-child-status | Done via complete-child, abandoned on non-active child, pending, reject multiple active, reject invalid status, reject missing --child-status, clear completed_at on revert, allow active when no other | Unit |
| 22-26 | --switch-active | Atomic demote+promote, reject unresolved deps, no-op when already active, reject unknown id, allow with resolved deps | Unit |
| 27-33 | --add-child | Basic append with title/scope, with depends_on, reject duplicate id, reject missing id, reject missing --child-title, reject invalid depends_on (validation), multiple children in one invocation | Unit |
| 34-36 | Output protocol | Single-line JSON on stdout, plain-text stderr on failure, progress object fields | Unit |
| 37-46 | Edge cases | Empty children array, missing --epic, no operation, epic file not found, malformed YAML, valid YAML but not object, updated_at timestamp, temp file cleanup, validation abort on cycle | Unit |

### session-update.cjs (17 cases)

| # | Category | Scenario | Granularity |
|---|----------|----------|-------------|
| 1-4 | --new-epic | Creates active_epic, requires --epic-id, snapshots old active_epic, no snapshot when empty | Unit |
| 5-6 | --set-epic-path | Sets epic_path, rejects when no active epic | Unit |
| 7-8 | --set-epic-status | Updates epics[] status, rejects when no active epic | Unit |
| 9 | --close-epic | Sets epics[] done and clears active_epic | Unit |
| 10-11 | Combo validation | Rejects --close-epic with --new-epic, rejects orphan --epic-id | Unit |
| 12-15 | --new-change --epic-id | Writes epic_id to active_change, writes to history, preserves in changes[] on close, resets on active_change after close | Unit |
| 16-17 | Backward compat | Old session.yaml without epic fields (add change), old session.yaml when adding epic | Unit |

## Granularity Decisions

All scenarios are **unit** tests: deterministic scripts with real filesystem I/O into temp directories. No mocks needed -- `spawnSync` invokes the built scripts directly.

## Implementation Issues Found

None. All 63 new tests pass (46 + 17), plus all 169 existing tests remain green (232 total).

## Suggested Run Commands

```bash
npx vitest run test/epic-update.test.ts
npx vitest run test/session-update.test.ts
npx vitest run
```
