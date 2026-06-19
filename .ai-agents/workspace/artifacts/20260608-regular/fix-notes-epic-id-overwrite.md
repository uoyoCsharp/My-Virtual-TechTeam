# Fix Notes: epic_id Overwrite Bug

## Symptom

`session.yaml` shows `epic_id: ""` in both `active_change` and `changes[]` entries, even when the change was created within an epic context via `/mvt-analyze`. This causes `/mvt-update-plan` Step 5 (Epic Advancement Check) to silently skip epic advancement.

## Input Source

Review artifact (`.ai-agents/workspace/artifacts/_ad-hoc-review-20260619-epic-linking/review.md`) — 1 Critical, 3 Warnings.

## Reproduction

Verified via code tracing. Confirmed trigger path:
1. `/mvt-analyze` creates change with `--epic-id` -> `epic_id` set correctly
2. `/mvt-plan-dev` calls `--new-change` (same change-id, no `--epic-id`) -> `epic_id` wiped to `""`
3. Downstream skills read empty `epic_id` -> epic context lost

## Root Cause

`session-update.js` line 234: `session.active_change.epic_id = args["epic-id"] || ""` unconditionally resets `epic_id` when `--epic-id` is not passed. The `--new-change` block also resets `created_at` and `plan_path` on every invocation, causing collateral data loss when re-invoked on the same change (as `/mvt-plan-dev` does).

## Patch Summary

| File | Change |
|------|--------|
| `sources/scripts/session-update.js` | `--new-change` block uses `isSameChange` guard: preserves `created_at`/`plan_path` only when re-invoking on same change; `epic_id` always preserved via `||` fallback |
| `test/session-update.test.ts` | Added 3 regression tests: epic_id preservation, same-change created_at/plan_path preservation, and switch-change field reset |

## Regression Risk

- All 241 tests pass (including 3 new regression tests)
- The `|| ""` fallback ensures backward compatibility with old session.yaml files lacking epic fields
- The `isSameChange` guard distinguishes same-change re-invocation from cross-change switch, preventing data contamination
- `epic_id` is always preserved (belongs to epic context, not to the change itself)

## Fix Rounds

1. **Round 1** (C1 original): Unconditional reset of `epic_id`/`created_at`/`plan_path` → changed to preserve via `||` fallback
2. **Round 2** (C1 regression): Preserve logic contaminated `created_at`/`plan_path` when switching to different change → added `isSameChange` guard (`session.active_change.id === args["change-id"]`) before overwriting `id`

## Follow-ups

- **W1 (deferred)**: `mvt-plan-dev/manifest.yaml` still uses `update_active_change: true` which generates `--new-change` on existing changes. Functionally harmless after this fix, but semantically incorrect. Consider introducing a `create_change` param distinct from `update_active_change` in a future refactor.
- **S1**: Split `--new-change` into `--create-change` vs `--refresh-change` for cleaner API semantics
- **S2**: Add `console.warn` when `--new-change` omits `--epic-id` in active epic context
- **~~Round 2 C1~~ (resolved)**: `created_at`/`plan_path` preserve contamination when switching changes → fixed with `isSameChange` guard
