# Code Review Report

## Summary

**Review Target**: Epic-change linking mechanism (epic_id propagation across skills)

**Files Reviewed**:

| # | File | Focus |
|---|------|-------|
| 1 | `sources/scripts/session-update.js` | `--new-change` epic_id overwrite logic |
| 2 | `sources/sections/session-update.md` | Shared template `--epic-id` conditional block |
| 3 | `sources/skills/mvt-analyze/manifest.yaml` | `link_subchange_to_epic: true` (correct) |
| 4 | `sources/skills/mvt-plan-dev/manifest.yaml` | Missing `link_subchange_to_epic` |
| 5 | `sources/skills/mvt-decompose/manifest.yaml` | Epic creation flow |
| 6 | `sources/skills/mvt-update-plan/manifest.yaml` | `update_change` without `--new-change` |
| 7 | `sources/skills/mvt-update-plan/business.md` | Epic advancement check (Step 5) |
| 8 | `test/session-update.test.ts` | Test coverage for epic_id scenarios |

**Aspect**: Full review (architecture, quality, errors, edge cases, tests)

**Fallbacks**: No `design.md` for this review scope -- Group A (Design Compliance) limited to mechanism-level analysis.

| Severity | Count |
|----------|-------|
| Critical | 1 |
| Warning | 3 |
| Suggestion | 2 |

**Verdict**: Request changes -- 1 Critical issue causes confirmed data loss (epic_id wiped on every plan-dev invocation within epic context).

## Critical Issues

### C1: `--new-change` unconditionally resets `epic_id` to empty string

**File**: `sources/scripts/session-update.js` (line 234)
**Severity**: Critical
**Group**: D (Edge Cases) -- state leakage across skill invocations

```javascript
// Line 230-234 (current)
session.active_change.id = args["change-id"];
session.active_change.title = args["new-change"];
session.active_change.created_at = now;
session.active_change.plan_path = "";
session.active_change.epic_id = args["epic-id"] || "";
```

**Observation**: When `--new-change` is invoked without `--epic-id`, `epic_id` is force-reset to `""`. This destroys any existing epic linkage on the active_change. The same block also resets `plan_path` and `created_at`, causing collateral data loss when the flag is used on an already-existing change.

**Confirmed trigger path**:
1. `/mvt-analyze` creates change with `--epic-id` -> `epic_id` set correctly
2. `/mvt-plan-dev` calls `--new-change` (same change-id, no `--epic-id`) -> `epic_id` wiped to `""`
3. Downstream `/mvt-update-plan` Step 5 (Epic Advancement Check) reads empty `epic_id` -> skips epic advancement entirely

**Impact**: All epic-context workflows silently lose their epic association after plan-dev runs. Epic advancement, child status tracking, and resume-in-epic-context all break.

**Recommendation**: Two complementary fixes:

1. **Script-level** (defensive): preserve existing `epic_id` when `--epic-id` is not explicitly passed:
   ```javascript
   session.active_change.epic_id = args["epic-id"] || session.active_change.epic_id || "";
   ```

2. **Template-level** (root fix): make `--new-change` conditional in `session-update.md` so plan-dev does not re-create an existing change. Add a `create_change` param distinct from `update_active_change`.

## Warnings

### W1: `mvt-plan-dev/manifest.yaml` generates `--new-change` for existing changes

**File**: `sources/skills/mvt-plan-dev/manifest.yaml` (lines 72-77)
**Severity**: Warning
**Group**: B (Code Quality) -- semantic mismatch between flag and intent

```yaml
params:
  current_skill: mvt-plan-dev
  update_active_change: true    # <-- generates --new-change
  set_plan_path: true
  update_change: true
```

**Observation**: `update_active_change: true` unconditionally generates `--new-change` in the session-update command. But plan-dev's preflight **BLOCKs** if `active_change.id` is empty, meaning the change always already exists when plan-dev runs. Using `--new-change` on an existing change is semantically wrong -- it resets `created_at`, `plan_path`, and `epic_id`.

**Recommendation**: Replace `update_active_change: true` with a narrower param (e.g., `set_change_fields: true`) that only generates `--set-plan-path` and `--update-change` without `--new-change`. Alternatively, make `--new-change` conditional in the template (see C1 recommendation #2).

### W2: Missing regression test for epic_id overwrite scenario

**File**: `test/session-update.test.ts` (lines 305-372)
**Severity**: Warning
**Group**: E (Tests) -- missing scenario coverage

**Observation**: Existing tests cover:
- `--new-change --epic-id` writes epic_id (line 308)
- `--close-change` preserves epic_id in snapshot (line 333)
- `--close-change` clears active_change.epic_id (line 354)
- Backward compatibility with old session without epic fields (line 377)

**Missing scenario**: `--new-change` called on an active_change that already has `epic_id` set (without passing `--epic-id`). This is exactly the bug scenario. A regression test should assert:

```typescript
it("preserves existing epic_id when --new-change omits --epic-id", () => {
  const session = baseSession();
  session.active_change = {
    id: "20260608-sub", title: "Sub", created_at: "...",
    plan_path: "", epic_id: "epic-20260608-demo",
  };
  writeSession(session);
  update(["--new-change", "Sub", "--change-id", "20260608-sub"]);
  const s = readSession();
  expect(s.active_change.epic_id).toBe("epic-20260608-demo"); // would FAIL on current code
});
```

**Recommendation**: Add this test case after fixing C1 to prevent regression.

### W3: `session-update.js` `--new-change` resets `created_at` and `plan_path` on re-invocation

**File**: `sources/scripts/session-update.js` (lines 232-233)
**Severity**: Warning
**Group**: D (Edge Cases) -- unintended side effects

```javascript
session.active_change.created_at = now;    // resets creation timestamp
session.active_change.plan_path = "";       // wipes existing plan path
```

**Observation**: When `--new-change` is called with the same change-id (as plan-dev does), these fields are reset even though they should be preserved. `created_at` should reflect the original creation time; `plan_path` should not be wiped if a plan already exists.

**Recommendation**: Guard these fields similarly to the proposed `epic_id` fix:
```javascript
session.active_change.created_at = session.active_change.created_at || now;
session.active_change.plan_path = args["set-plan-path"] || session.active_change.plan_path || "";
```

## Suggestions

### S1: Split `--new-change` into `--create-change` vs `--refresh-change`

**File**: `sources/sections/session-update.md`
**Severity**: Suggestion
**Group**: B (Code Quality) -- separation of concerns

**Observation**: The `--new-change` flag conflates two distinct operations: creating a new change (set id, title, created_at, clear plan_path) and refreshing an existing change (snapshot to changes[]). Splitting them would make the API more explicit and prevent accidental data resets.

**Recommendation**: Consider introducing `--refresh-change` that only performs the auto-snapshot (upsert to changes[]) without resetting active_change fields. Reserve `--new-change` for actual new change creation.

### S2: Add epic-context validation in `--new-change`

**File**: `sources/scripts/session-update.js`
**Severity**: Suggestion
**Group**: C (Error Handling) -- proactive validation

**Observation**: When `active_epic.id` is non-empty and `--new-change` is called without `--epic-id`, the script silently resets `epic_id` to `""`. A warning would alert the caller to the potential oversight.

**Recommendation**: Add a `console.warn` when this condition is detected:
```javascript
if (session.active_epic?.id && !args["epic-id"]) {
  console.warn("Warning: --new-change without --epic-id in active epic context. epic_id will be empty.");
}
```

## Highlights

- **H1**: `mvt-update-plan/business.md` Step 5 (Epic Advancement Check) correctly reads `active_change.epic_id` and gracefully handles the empty case (line 83: "If empty -> skip this step"). The downstream consumer is well-designed; the problem is purely in the data provider.
- **H2**: Test suite at `test/session-update.test.ts` lines 305-371 has solid coverage for the happy path and close-change scenarios. The `preserves epic_id in changes[] snapshot on --close-change` test (line 333) is a good pattern that should be extended to the overwrite scenario.
- **H3**: The shared `session-update.md` template uses Mustache-style conditionals (`{{#link_subchange_to_epic}}`) cleanly. The template mechanism itself is sound; the issue is that `mvt-plan-dev` doesn't declare the parameter.

## Skipped Checks

| Group | Reason |
|-------|--------|
| A (Design Compliance) | No `design.md` for this review scope; analysis limited to mechanism-level review |
| F (Security) | No auth/data sensitivity concerns in session-update mechanism |

## Recommended Next Skill

- `/mvt-fix` -- Apply fixes for C1 (script-level preserve + template conditional) and W1-W3 (manifest param, regression test, field guards)
