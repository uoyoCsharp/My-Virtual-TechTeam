# Fix Notes

## Symptom

Code review of the Epic Decomposition Layer prompt set (7 skill business.md files) identified 4 Warning-level and 3 Suggestion-level issues. After evaluation, 4 Warnings were confirmed and 1 Suggestion (S2) was promoted to Warning due to real re-decompose risk.

## Input Source

Review artifact (`review.md` in active change artifacts).

## Reproduction

Not applicable (prompt reliability issues, not runtime bugs).

## Root cause

Five prompt-level issues in the Epic Decomposition Layer skill instructions:

1. **W1**: Cleanup Step 4 batch archive detection rule used `changes[]` + `epic_id` + `active_epic.id` pattern matching, which cannot reliably identify completed epic directories (epics are not entries in `changes[]`). The detection logic was inconsistent with Step 7 2a's execution logic.
2. **W2**: Decompose Step 4 defaulted child `project` to `["default"]` unconditionally, which is valid for single-project workspaces but would cause validation failure in multi-project workspaces where `"default"` is not in `projects[].name`.
3. **W3**: Resume Step 7 Epic Context read `epic.yaml` via `active_epic.epic_path` without verifying that `active_change.epic_id` matches `active_epic.id`. A mismatch (partial failure, manual edits) would display wrong epic context.
4. **W4**: Cleanup prompt used emoji markers (`WARNING:`) that conflict with `preferences.output.no_emojis: true` in config.yaml.
5. **S2 (promoted)**: Analyze Step 3 Epic Detection could be triggered in epic-child mode (scenarios A/B), causing a re-decompose loop where a carefully decomposed child scope gets routed back to `/mvt-decompose`.

## Patch summary

- `sources/skills/mvt-cleanup/business.md`: Replaced batch archive detection rule in Step 4 with artifact-inventory-based detection (directory id starts with `epic-` + contains `epic.yaml` with `status: done`). Replaced all emoji markers with plain text `WARNING:`.
- `sources/skills/mvt-decompose/business.md`: Replaced unconditional `default ["default"]` with context-aware guidance: `["default"]` for single-project workspaces, must match `projects[].name` for multi-project workspaces, ask user if uncertain.
- `sources/skills/mvt-resume/business.md`: Added epic path resolution logic in Step 7 Epic Context: compare `active_change.epic_id` to `active_epic.id`, fallback to `session.epics[]` search on mismatch, bounded warning if neither path exists.
- `sources/skills/mvt-analyze/business.md`: Added "Epic-child mode note" after Step 3 branches table, instructing agents to treat the selected child scope as the intended change boundary in epic-child mode.

## Regression risk

Low. All changes are prompt-level (Markdown instructions for AI agents), not executable code. Existing 232 tests all pass. The fixes tighten prompt reliability without changing data schemas, script interfaces, or control flow.

## Follow-ups

- S1 (epic.yaml field self-containment) and S3 (flag form normalization) remain as Suggestions; low priority, deferred.
- Consider auditing other skill business.md files for emoji usage that conflicts with `no_emojis` config.
