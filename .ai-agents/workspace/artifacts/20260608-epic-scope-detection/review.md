# Code Review Report (Round 2: Post-Fix Verification + New Findings)

## Review Scope

Follow-up review of the Epic Decomposition Layer (OPT-2026-003) prompt set after the `/mvt-fix` pass that addressed the prior review's 4 Warnings (W1-W4) and 1 promoted Suggestion (S2). This round verifies the fixes are correctly applied, surfaces any regression introduced by the fixes, and hunts for defects not found in round 1.

| File | Review focus |
|------|--------------|
| `sources/skills/mvt-decompose/business.md` | New skill: epic decomposition flow, child DAG rules, project hint guidance, self-validation |
| `sources/skills/mvt-analyze/business.md` | Modified: Step 3 Epic Detection, epic-child mode pre-check, renumbered Steps 4-7 |
| `sources/skills/mvt-update-plan/business.md` | Modified: Step 5 Epic Advancement Check |
| `sources/skills/mvt-status/business.md` | Modified: Epic Progress section, epic-pending state detection, next-step resolution |
| `sources/skills/mvt-resume/business.md` | Modified: Step 1a epic state check, Step 7 Epic Context with path validation |
| `sources/skills/mvt-help/business.md` | Modified: decision table row, workflow mermaid diagram |
| `sources/skills/mvt-cleanup/business.md` | Modified: epic integrity check, batch archive action |

Design and implementation artifacts from `.ai-agents/workspace/artifacts/20260608-epic-scope-detection/` are available; design-compliance and cross-file consistency checks were run. Project semantic context (project-context.yaml) is available; layer- and naming-consistency checks were run.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| Warning  | 3 |
| Suggestion | 5 |

Verdict: **Approve with comments.**

The 4 Warnings from round 1 are all correctly addressed. One Warning (W2) is only partially resolved — the single-project case still hardcodes `["default"]`, which is a residual bug because the actual project name in this workspace is `mvtt`. Three new Warnings and five new Suggestions were identified, mostly concerning edge cases in the within-epic + plan-complete state and minor prompt-clarity gaps. None block deployment; all are reliability/clarity improvements that would tighten the prompts against edge inputs.

## Round 1 Fix Verification

| ID | Status | Evidence |
|----|--------|----------|
| **W1** (cleanup batch archive detection) | **FIXED** | `mvt-cleanup/business.md:35` now uses artifact-inventory-based detection: directory id starts with `epic-` AND contains `epic.yaml` with `status: done`. Replaces the prior changes[]-based rule. |
| **W2** (hardcoded `["default"]` in decompose) | **PARTIALLY FIXED** | `mvt-decompose/business.md:39` was updated to be context-aware for multi-project, but the single-project case still writes `["default"]`. This is incorrect for this workspace (`projects[].name == "mvtt"`). See new Warning N1. |
| **W3** (resume epic path mismatch) | **FIXED** | `mvt-resume/business.md:101` (Step 7 item 2) now compares `active_change.epic_id` to `active_epic.id` first, falls back to `session.epics[]` search, and emits a bounded warning when neither path resolves. |
| **W4** (cleanup emoji markers) | **FIXED** | No emoji characters remain in `mvt-cleanup/business.md`. Lines 10 and 60 use plain `WARNING:` text. |
| **S2** (epic-child re-decompose loop) | **FIXED** | `mvt-analyze/business.md:51` adds the "Epic-child mode note" instructing the agent to treat the selected child scope as the intended change boundary in scenarios A/B. |

## Critical Issues

None.

## Warnings

### N1. Residual W2: single-project child `project` hint still hardcoded to `["default"]`

Location: `sources/skills/mvt-decompose/business.md:39`

Observation: The round-1 fix made the multi-project case context-aware, but the single-project case still instructs the agent to write `["default"]`. In this workspace the actual `project-context.yaml > projects[].name` is `mvtt`, not `default`. The downstream `plan-update.cjs` and `mvt-status` read `project` from children via YAML, and project-scoped knowledge loading keys off `projects[].name`. Writing `["default"]` would silently miss the knowledge binding for this workspace.

Recommendation: Replace the single-project clause to read the sole project name from `project-context.yaml > projects[].name` and use that exact value. Example phrasing: `For single-project workspaces: use the sole project name from project-context.yaml > projects[].name (e.g., ["mvtt"] in this workspace). For multi-project workspaces: must match one of the registered project names; if uncertain, ask the user.`

### N2. `mvt-status` and `mvt-resume` have a gap for the within-epic + plan-complete state

Location: `sources/skills/mvt-status/business.md:73-79` (Step 5), `sources/skills/mvt-resume/business.md:23-32` (Step 2)

Observation: When a child change has `active_change.id` set, `active_change.epic_id` set (within-epic), and the plan is `done` (current_tasks empty because plan is complete but advancement has not been triggered), the existing rules fail to map to a sensible next step:

- `mvt-status` Step 5 rule 1 requires `current_tasks` has entries — fails when empty.
- `mvt-status` Step 5 rule 2 requires `active_change.id` empty — fails.
- `mvt-resume` Step 1a condition 1 sets `within_epic = true` and continues to Step 2, which filters plans to `status == "in_progress"` only, hitting the "no active plans" branch in Step 3 and suggesting `/mvt-plan-dev` or `/mvt-analyze`.

Neither skill surfaces `/mvt-update-plan` as the natural next step (which would trigger the Step 5 epic advancement prompt). The user could be left thinking the plan is in an unsynced or undefined state.

Recommendation: In `mvt-status` Step 5, add a rule between 1 and 2: `active_change.id` non-empty AND `active_change.epic_id` non-empty AND `current_tasks` empty (plan complete) -> suggest `/mvt-update-plan` to trigger epic advancement. In `mvt-resume` Step 1a condition 1, detect the plan-complete case and render an explicit "Plan complete within epic; run /mvt-update-plan to advance" message.

### N3. `mvt-decompose` Step 5 self-validation failure path is unspecified

Location: `sources/skills/mvt-decompose/business.md:63-74`

Observation: The skill instructs the agent to verify a self-validation checklist (unique change_ids, valid depends_on refs, no cycles, exactly one active child, current_change matches, non-empty title/scope) **before writing** the artifacts. The optional `--validate` call after writing is also described. However, neither path specifies what to do if validation FAILS:

- Self-validation fail: should the agent fix and re-write, abort, or write anyway with a warning?
- `epic-update.cjs --validate` non-zero exit: should the agent re-edit epic.yaml, abort, or proceed?

The current prompt is silent, so different agents (or the same agent on different days) could take different actions, breaking the determinism goal.

Recommendation: Add explicit failure handling after the self-validation checklist: `If any check fails, return to Step 4 to fix the affected child, then re-validate. Do not write epic.yaml while any check fails.` Add a parallel clause for the `--validate` post-write: `If --validate exits non-zero, the YAML is invalid; do NOT call session-update.cjs --new-epic; fix epic.yaml and re-run --validate until it passes.`

## Suggestions

### N4. `mvt-help` textual fallback omits the epic dimension

Location: `sources/skills/mvt-help/business.md:76`

Observation: The mermaid fallback in Edge Cases is a single line: `init -> analyze-code -> analyze -> design -> [plan-dev] -> implement -> review -> test`. This predates the epic dimension and does not mention `decompose` or the epic-child branch. After this change, the fallback is now incomplete and could mislead a user who happens to be in an environment that cannot render mermaid.

Recommendation: Extend the fallback string to: `init -> analyze-code -> analyze -> [decompose (epic) -> analyze (epic-child)] -> design -> [plan-dev] -> implement -> review -> test`.

### N5. `mvt-analyze` Step 3 weak-signal examples are empty

Location: `sources/skills/mvt-analyze/business.md:36-37`

Observation: The two weak-signal rows have `--` in the Example column. While the design intentionally marks them as "corroboration only", an LLM evaluating them benefits from a concrete example to anchor its judgment. Without one, the LLM could either over- or under-count weak signals, shifting the trigger threshold unpredictably.

Recommendation: Add one short example per weak signal, e.g., `Multiple actors with multiple independent main flows | "Customer places order, admin reviews analytics, vendor updates inventory"` and `No single cohesive acceptance criterion | "A system that is fast, secure, and free"`. Keep them illustrative rather than definitive.

### N6. `mvt-decompose` change_id slug format is under-specified

Location: `sources/skills/mvt-decompose/business.md:35`

Observation: The prompt says `{YYYYMMDD}-{slug}` but does not constrain the slug character set, length, or normalization. Risk: a child named "User Login & Profile Setup" could become `user-login-profile-setup` (kebab) or `User-Login-and-Profile-Setup` (title case) depending on the LLM. Inconsistencies would surface as file path casing issues on case-sensitive filesystems and aesthetic drift in artifact directories.

Recommendation: Add a one-line constraint: `slug: lowercase ASCII, kebab-case, [a-z0-9-]+, 1-4 words (e.g., "user-auth", "catalog-search")`. Optionally cross-link to the analogous `mvt-analyze` Step 7 (line 108) which has the same gap; align both.

### N7. `mvt-update-plan` Step 5 `(n)` reminder phrasing is misleading

Location: `sources/skills/mvt-update-plan/business.md:98`

Observation: The `(n)` path says: `Change remains open. Run /mvt-update-plan <task> done again later to close and advance.` But the plan is already done — running `/mvt-update-plan <task> done` would be a no-op re-emission of the same state, not a way to close and advance. The user would more likely take a different action (e.g., fix a review finding, run a test, then come back to update-plan with new context).

Recommendation: Soften the reminder to: `Change remains open. Run other skills (e.g., /mvt-review, /mvt-test, /mvt-fix) as needed; run /mvt-update-plan again when ready to advance the epic.`

### N8. `mvt-cleanup` Step 7 2a batch archive default and "selective" auto-exclusion behavior

Location: `sources/skills/mvt-cleanup/business.md:72-79`

Observation: The batch-archive three-option table does not specify a default, and the "Selective" option does not clarify what happens if the user picks an in-progress child — the edge case (line 121) says it will be excluded with a note, but this auto-exclusion is not surfaced at the selection point. A user who picks an in-progress child for inclusion could be confused when it is silently dropped.

Recommendation: (1) Add a default column or note: `Default: "Epic only" (least destructive)`. (2) In the Selective option, add a clarifying line: `Note: in-progress or pending children will be auto-excluded with a note, even if explicitly selected.`

## Highlights

- Round-1 W1, W3, W4 and the promoted S2 are all correctly applied. The fix in `mvt-resume` (Step 7 item 2) for the within-epic path validation is a textbook example of a robust fallback chain (primary match -> search epics[] -> bounded warning).
- The Step 1a epic-state check in `mvt-resume` cleanly separates within-epic, epic-pending, and normal flows with explicit skip instructions (`Skip Steps 2-6 and go directly to Step 7`), avoiding redundant work.
- `mvt-status` Epic Progress section (4a) is well-structured: explicit file-resolution failure handling, progress computation, internal-progress lookup only for the active child (avoiding the N+1 read), and a context line that distinguishes within-epic vs epic-pending recommendations.
- `mvt-help` decision table places the epic-pending check before the generic no-requirements check, ensuring the more specific state always wins (correct first-match-wins ordering).
- The mermaid diagram in `mvt-help` Step 4 correctly models the two routing decisions (simple change vs epic scale) with dotted lines and a shared downstream, and uses `<br/>` in the node label to make the epic-child variant visually distinct from the regular analyze node.
- `mvt-cleanup` Step 7 2a presents the three batch-archive options in increasing destructiveness order (epic only -> all children -> selective), which is the right default ordering for user safety.

## Skipped Checks

| Check | Reason |
|-------|--------|
| Runtime behavior validation | This review is read-only. No skill executions were run; all findings are static analysis against the prompts and design. |
| Test coverage analysis for prompt reliability | The 232 vitest cases cover `epic-update.cjs` and `session-update.cjs`; there are no automated tests for business.md interpretation by an LLM. This is expected for prompt content. |
| Cross-language interaction (zh-CN vs en-US) | All checked prompts are written in en-US, which matches the configured `document_output_language` and is appropriate for files on disk. No translation defects detected. |

## Recommended Next Skill

`/mvt-fix` -- Address Warnings N1 (residual W2), N2 (within-epic + plan-complete gap), and N3 (decompose self-validation failure path). The three Warnings are not blocking but would meaningfully tighten the prompt set against edge inputs that the prior review did not exercise. After fixes, re-run `/mvt-review` to verify.
