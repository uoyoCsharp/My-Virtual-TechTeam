---
id: 'review-output'
version: '1.0'
skill: 'mvt-review'
change_id: '20260619-script-callability'
---

# Code Review Report

## Review Scope

| Item | Value |
|------|-------|
| Change ID | `20260619-script-callability` |
| Aspect | full (all axes) |
| Files reviewed | 23 modified/untracked files (build pipeline, script headers, constraint section, standalone docs, 6 skill manifests, 6 business.md, 3 test files, implementation.md) |
| Design artifact | `design.md` (ADR-1 through ADR-6) |
| Implementation artifact | `implementation.md` (v2 hybrid architecture) |
| Fallbacks applied | none — all Group A inputs present |

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1 |
| Warning | 3 |
| Suggestion | 2 |

**Verdict: Request changes.** One Critical finding documents an undocumented behavioral change in `session-update.js` that contradicts the design's scope declaration ("No script behavior changes"). The implementation artifact's design compliance table also misrepresents this change. Three Warnings address scope drift and consistency gaps. The core hybrid architecture design (standalone `.md` docs + constraint section + conditional rendering) is sound and well-executed.

## Critical Findings

### C1: Undocumented behavioral change in `session-update.js`

| Field | Value |
|-------|-------|
| File | `sources/scripts/session-update.js` |
| Lines | 209-215 (diff context) |
| Severity | Critical |

**Observation**: The design document explicitly declares the subject system as "the MVTT framework documentation/assembly layer (shared sections, skill manifests, business.md prose). No script behavior, section-loader engine, or build pipeline changes." However, `session-update.js` contains a functional behavioral change beyond the documented header pointer update:

```javascript
// Now set new active_change (preserve fields only when re-invoking on same change)
const isSameChange = session.active_change.id === args["change-id"];
session.active_change.id = args["change-id"];
session.active_change.title = args["new-change"];
session.active_change.created_at = isSameChange ? (session.active_change.created_at || now) : now;
session.active_change.plan_path = isSameChange ? (session.active_change.plan_path || "") : "";
session.active_change.epic_id = args["epic-id"] || session.active_change.epic_id || "";
```

This changes the semantics of `--new-change` + `--change-id` when re-invoked on the same change: `created_at` and `plan_path` are now preserved instead of being reset. The `epic_id` fallback chain (`args["epic-id"] || session.active_change.epic_id || ""`) also changes behavior when `--epic-id` is omitted.

The implementation artifact's design compliance table claims BR1 "No script behavior change" is satisfied with "Only header comments modified" — this is factually incorrect for this file.

**Recommendation**: Either (a) revert the behavioral change to align with the design scope (header-only modification), or (b) document the behavioral change explicitly in the implementation.md, update the design's scope declaration, and ensure the change has adequate test coverage (it does — 3 new tests exist in `test/session-update.test.ts`). If choosing (b), also update the design compliance table to reflect the actual scope.

## Warnings

### W1: Build pipeline changes exceed design scope

| Field | Value |
|-------|-------|
| Files | `build-scripts.js`, `src/fs/materialize.ts` |
| Severity | Warning |

**Observation**: The design declares "No... build pipeline changes" in the subject system scope. However, two build pipeline files were modified:

- `build-scripts.js`: Added `.md` copy step (new imports, new loop).
- `src/fs/materialize.ts`: Changed skip filter from `.cjs`-only to `.cjs` + `.md`.

The implementation.md does acknowledge these changes in its "Deployment pipeline changes" section, but the design compliance table still claims BR3 "Build pipeline extended (not broken)" as satisfied without noting the scope discrepancy.

**Recommendation**: Update the design document's scope declaration to include "build pipeline extension for `.md` deployment" as an in-scope change, or document this as an accepted deviation in the implementation.md's "Deviations from Design" section.

### W2: `script-usage-rule.md` session-update block lacks command template

| Field | Value |
|-------|-------|
| File | `sources/sections/script-usage-rule.md` |
| Severity | Warning |

**Observation**: The `{{#uses_session_update}}` block renders only a pointer ("see the State Update section for the exact command with this skill's flags") without a minimal command template. In contrast, the `{{#uses_plan_update}}` and `{{#uses_epic_update}}` blocks each render a concrete minimal command with required flags. This inconsistency means the session-update constraint block provides no immediate command reference — the AI must navigate to a different section to find the command.

**Recommendation**: Add a minimal command template to the `{{#uses_session_update}}` block, e.g.:
```bash
node .ai-agents/scripts/session-update.cjs --skill <skill_name> --summary "<summary>" [flags]
```
This aligns the three blocks structurally and gives the AI an immediate command anchor.

### W3: `mvt-cleanup` manifest adds `script-usage-rule.md` with `uses_session_update: true` — marginal value

| Field | Value |
|-------|-------|
| File | `sources/skills/mvt-cleanup/manifest.yaml` |
| Severity | Warning |

**Observation**: `mvt-cleanup` already has `sections/session-update.md` with `params: { truncate_history: true, close_change: true }`, which renders the full session-update command with pre-filled examples. Adding `sections/script-usage-rule.md` with `uses_session_update: true` renders a redundant pointer ("see the State Update section") on top of the already-loaded State Update section. The `mvt-cleanup/business.md` also already contains a pre-filled example command.

**Recommendation**: Either remove the `script-usage-rule.md` entry from `mvt-cleanup`'s manifest (since the State Update section already provides full coverage), or keep it solely for the "Never read source files" general rule — but document this rationale explicitly.

## Suggestions

### S1: Standalone `.md` docs are well-structured

The `sources/scripts/plan-update.md` and `sources/scripts/epic-update.md` files are comprehensive, well-organized, and follow a consistent structure (command template, argument values table, parameter semantics, output interpretation). The "Do NOT read the `.cjs` or `.js` source" directive is appropriately reinforced. No changes needed.

### S2: Consider adding a drift-detection test

The current test suite validates that sections render correctly, but does not detect drift between the standalone `.md` reference docs and the actual script flag sets. A future enhancement could grep the `.js` source for `args[` patterns and compare against the `.md` documentation to catch undocumented flags.

## Skipped Checks

| Group | Reason |
|-------|--------|
| Group E (Tests) — partial | Test coverage for the `session-update.js` behavioral change exists (3 new tests). However, the `build-scripts.js` `.md` copy step has no dedicated test — it is only validated implicitly by the materialize test's file-matching logic. Consider adding a targeted test for the copy step. |

## Recommended Next Skill

- `/mvt-fix` — Address C1 (undocumented behavioral change) and W1 (scope drift) before merge.
- `/mvt-test` — Add test coverage for the `build-scripts.js` `.md` copy step if keeping the build pipeline changes.
