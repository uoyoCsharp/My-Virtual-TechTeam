# Code Review Report

## Review Scope

Reviewed the Epic Decomposition Layer prompt changes in `sources/skills/**/business.md`, scoped to the files listed by the current in-progress plan and implementation record:

| File | Review focus |
|------|--------------|
| `sources/skills/mvt-decompose/business.md` | Epic creation flow, child decomposition rules, artifact writing instructions |
| `sources/skills/mvt-analyze/business.md` | Epic detection gate and epic-child mode |
| `sources/skills/mvt-update-plan/business.md` | Plan completion to epic advancement handoff |
| `sources/skills/mvt-status/business.md` | Epic progress and epic-pending display |
| `sources/skills/mvt-resume/business.md` | Epic context recovery and epic-pending resume path |
| `sources/skills/mvt-help/business.md` | Next-skill routing and workflow diagram |
| `sources/skills/mvt-cleanup/business.md` | Epic-safe cleanup and batch archive behavior |

The raw branch diff includes many additional `sources/skills/*/business.md` files from broader framework changes. Those were not treated as part of this focused review unless they intersected the Epic Decomposition Layer task.

Design and implementation artifacts were available, so design-compliance checks were included. Project semantic context was available, so layer and business-rule checks were included.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| Warning | 4 |
| Suggestion | 3 |

Verdict: Approve with comments.

The prompt set mostly matches the Epic Decomposition Layer requirements: `mvt-analyze` routes epic-scale input to `mvt-decompose`, `mvt-update-plan` owns advancement rather than cleanup, and status/resume/help now recognize epic-pending state. The remaining issues are prompt reliability problems rather than immediate source-code defects: one cleanup rule appears unable to identify completed epic directories correctly, project defaults are hardcoded in a way that can become stale, and a few instructions should be tightened so future agents do not infer the wrong epic context.

## Critical Issues

None.

## Warnings

### W1. Batch archive candidate rule cannot reliably match completed epic directories

Location: `sources/skills/mvt-cleanup/business.md:35`

Observation: The batch archive rule is keyed on a `changes[]` entry with `status: done`, non-empty `epic_id`, and a change-id that matches `active_epic.id`. That combines sub-change state with epic identity. In the design, an Epic is not a Change, sub-change ids do not use the `epic-` prefix, and epic directories live under `artifacts/{epic-id}/`. A completed epic may therefore never become a batch archive candidate through this rule.

Recommendation: Detect completed epic directories from the artifact inventory instead: directory id starts with `epic-`, contains `epic.yaml`, and `epic.yaml.status == done`. Then read `epic.yaml.children[]` for the batch archive options. Keep the separate `changes[]` + `epic_id` rule only for sub-change integrity warnings.

### W2. Hardcoded `project: ["default"]` can create stale project attribution

Location: `sources/skills/mvt-decompose/business.md:39`

Observation: The decompose prompt tells the agent to default each child project hint to `["default"]`. The activation protocol and project context use actual `project-context.yaml > projects[].name` values; this workspace's single project is named `mvtt`, not `default`. In multi-project workspaces this is more risky, because downstream project-scoped knowledge loading depends on valid project names.

Recommendation: Replace the hardcoded default with the resolved project scope: single-project workspaces should use the sole project name, and multi-project workspaces should require the child-specific project array from the matched scope. If unknown, ask rather than writing `default`.

### W3. Within-epic resume assumes `active_epic.epic_path` matches `active_change.epic_id`

Location: `sources/skills/mvt-resume/business.md:19`, `sources/skills/mvt-resume/business.md:101`

Observation: The within-epic branch triggers on `active_change.epic_id`, but the Epic Context section reads `epic.yaml` via `active_epic.epic_path`. If `active_epic` is empty, stale, or points at a different epic, the report can show the wrong epic or fail even though the change still has a valid `epic_id` back-reference.

Recommendation: Resolve the parent epic by id first: compare `active_change.epic_id` to `active_epic.id`; if it does not match, search `session.epics[]` for that id and use its `epic_path`. If neither path exists, render the plan resume and add a bounded warning that epic context could not be loaded.

### W4. Cleanup prompt emits emoji even when configuration disables emoji output

Location: `sources/skills/mvt-cleanup/business.md:10`, `sources/skills/mvt-cleanup/business.md:60`

Observation: The prompt instructs the agent to label warnings with `⚠️`, while `config.yaml` sets `preferences.output.no_emojis: true`. This can make the skill violate its own configuration foundation in user-visible output.

Recommendation: Use plain text such as `WARNING: unsynced` in the prompt, or explicitly say to render the warning marker according to `preferences.output.no_emojis`.

## Suggestions

### S1. Make `mvt-decompose` self-contained for the required `epic.yaml` top-level fields

Location: `sources/skills/mvt-decompose/business.md:59`

Observation: The business flow says `epic.yaml` follows the schema in Artifact Structure, but the flow itself only restates child status and `current_change`. This is correct when assembled with the manifest's inline Artifact Structure, but the operational step would be more robust if it repeated the must-have fields that downstream skills consume.

Recommendation: In Step 5, explicitly name `version`, `epic_id`, `title`, `created_at`, `updated_at`, `status: in_progress`, `vision`, `current_change`, and `children[]` as required before writing.

### S2. Clarify that epic-child analysis should not re-decompose the current child by default

Location: `sources/skills/mvt-analyze/business.md:9`, `sources/skills/mvt-analyze/business.md:10`

Observation: Epic-child scenarios A and B proceed to Step 3, which is Epic Detection. If a child scope still contains several capability words, an agent could re-route to `/mvt-decompose` even though the child came from a curated epic decomposition.

Recommendation: Add a note that, in epic-child mode, Step 3 should treat the selected child scope as the intended change boundary unless the user explicitly expands the request beyond that child or the scope is clearly still epic-scale.

### S3. Normalize `--set-child-status` examples to the script's documented flag form

Location: `sources/skills/mvt-update-plan/business.md:101`, `sources/scripts/epic-update.js:21`

Observation: The script currently accepts the positional form used by the prompt, but its usage block and error text emphasize `--set-child-status <change_id> --child-status <status>`. Keeping both forms in docs increases the chance that future edits or tests encode different interfaces.

Recommendation: Prefer the explicit documented form in prompts: `epic-update.cjs --epic <path> --set-child-status <active_change.id> --child-status done`.

## Highlights

- `sources/skills/mvt-analyze/business.md` correctly inserts Epic Detection before Quick Path and preserves a reversible `n` branch back to standard analysis.
- `sources/skills/mvt-update-plan/business.md` correctly keeps epic advancement in the skill layer and leaves `plan-update.cjs` as a pure plan mutator.
- `sources/skills/mvt-status/business.md`, `sources/skills/mvt-resume/business.md`, and `sources/skills/mvt-help/business.md` consistently route epic-pending state to `/mvt-analyze`, which matches the intended recovery flow.
- `sources/skills/mvt-cleanup/business.md` correctly avoids using cleanup as the epic advancement trigger, aligning with BR-14.

## Skipped Checks

| Check | Reason |
|-------|--------|
| Full review of every `main...HEAD` changed `sources/skills/*/business.md` file | The user's request targeted this task's prompt changes; the branch contains broader framework edits outside the Epic Decomposition Layer scope. |
| Runtime behavior validation | This review is read-only. No tests or skill executions were run as part of the review. |

## Recommended Next Skill

`/mvt-fix` -- Address the warning-level prompt issues before treating the Epic Decomposition Layer prompts as finalized.