---
id: 'review-output'
version: '1.0'
skill: 'mvt-review'
---

# Code Review Report

## Review Scope

- Review target source: `implementation.md` -> `Files Touched`.
- Reviewed files (full-depth):
  - `sources/scripts/session-update.js`
  - `sources/sections/session-update.md`
  - `sources/skills/mvt-cleanup/manifest.yaml`
  - `sources/skills/mvt-cleanup/business.md`
  - `test/session-update.test.ts`
- Inputs available: `design.md` + `implementation.md` (Group A enabled), single-project workspace (`mvtt`).
- Note: build/test were intentionally not executed during implement stage; this review is static + contract-based.

## Summary

- Critical: 1
- Warning: 1
- Suggestion: 1
- Verdict: **Request changes**

The implementation mostly follows design intent and keeps module boundaries clean, but one contract-breaking defect remains in CLI parsing/validation: `--remove-change` and `--remove-epic` without a value are parsed as boolean `true` and bypass the new non-empty-value guard, directly violating ADR-5/Phase A expectations and causing deterministic mismatch with newly added tests.

## Critical Issues

1. **Missing-value validation can be bypassed for new remove flags (broken contract + likely test failure)**

- Severity: Critical
- Location:
  - `sources/scripts/session-update.js:75`
  - `sources/scripts/session-update.js:138`
  - `sources/scripts/session-update.js:437`
  - `test/session-update.test.ts:579`
  - `test/session-update.test.ts:671`
- Observation:
  - `parseArgs()` stores `true` when a flag has no following value (`if (next && !next.startsWith("--")) ... else args[key] = true`).
  - Validation checks only `String(args["remove-change"]).trim()` / `String(args["remove-epic"]).trim()` for emptiness.
  - For `args[key] === true`, `String(true)` is `"true"`, so validation passes.
  - Result: `--remove-change` (without value) is accepted, then interpreted as id `"true"`, then emits warning and exits `0` instead of exiting `1` for missing value.
  - This violates design ADR-5 and the Phase A validation rule (“non-empty value required”), and conflicts with new tests intended to enforce rejection.
- Recommendation:
  - In `validate()`, explicitly reject non-string values for `remove-change` / `remove-epic` (e.g., `args[key] === true`), or change `parseArgs()` to preserve empty-string/missing-value semantics for these flags and make missing value a hard error.
  - Add explicit tests for the no-value form:
    - `update(["--remove-change"])` -> exit `1`
    - `update(["--remove-epic"])` -> exit `1`

## Warnings

1. **State-update command rendering for mvt-cleanup is over-eager and can conflict with action-specific rows**

- Severity: Warning
- Location:
  - `sources/skills/mvt-cleanup/manifest.yaml:78`
  - `sources/skills/mvt-cleanup/manifest.yaml:79`
  - `sources/sections/session-update.md:10`
  - `sources/sections/session-update.md:20`
  - `sources/skills/mvt-cleanup/business.md:99`
- Observation:
  - `mvt-cleanup` manifest enables `remove_change: true` and `remove_epic: true` unconditionally.
  - Therefore the shared State Update command always renders both `--remove-change <ids>` and `--remove-epic <ids>` placeholders.
  - But Step 9 includes scenarios that should not include those flags (e.g., close-only row), and Step 10 instructs dropping empty remove flags manually.
  - This creates operational ambiguity with the shared rule “Use only the flags rendered in the command above.”
- Recommendation:
  - Keep one source of truth by clarifying in Step 10 that rendered optional placeholders are action-dependent and may be omitted when no ids exist, or split cleanup state-update rendering into action-specific command blocks without always-on remove placeholders.

## Suggestions

1. **Implementation artifact counts are stale after test expansion**

- Severity: Suggestion
- Location:
  - `.ai-agents/workspace/artifacts/20260622-session-archive-sync/implementation.md` (Implementation Summary / Self-Check sections)
- Observation:
  - Artifact text still references “12 new cases”, while current `test/session-update.test.ts` now includes 14 cases in newly added review-target blocks.
- Recommendation:
  - Refresh the count in `implementation.md` to keep review handoff and future `/mvt-resume` context accurate.

## Skipped Checks

- Group F (Security): skipped — no auth/data-sensitivity scope in this change and no `--aspect security` request.

## Recommended Next Skill

`/mvt-fix` -- 修复 remove flag 的缺参校验缺陷（Critical）并补充 no-value 测试用例后，再进行复审。

## Highlights

- Positive: Module boundaries are respected; no cross-layer imports or new external dependencies were introduced.
- Positive: The new remove-flag logic was inserted in the intended lifecycle position (after `--close-epic`, before atomic write), matching design intent.
- Positive: `mvt-cleanup` Step 9/10 now explicitly covers close+archive combination scenarios, reducing ambiguity versus earlier versions.
