---
id: 'implement-output'
version: '1.0'
skill: 'mvt-implement'
---

# Implementation: Session Index Archive Sync (--remove-change / --remove-epic)

## Implementation Summary

Implemented two new symmetric CLI flags (`--remove-change`, `--remove-epic`) in `sources/scripts/session-update.js` that filter matching entries out of `session.changes[]` / `session.epics[]` (ADR-1, ADR-3, ADR-5, ADR-6). Wired the flags through the shared `session-update.md` template condition blocks, enabled them only in the `mvt-cleanup` manifest, and expanded the `mvt-cleanup` business.md `Step 9` parameter-selection table from 2 to 5 rows to cover the close+archive combination scenario. Twelve new vitest cases were added (5+5 flag cases + 2 isolation / composition cases).

The implementation follows design v1.4 exactly: no deviation, no new external dependencies, no public-API breakage to the existing 9 flags.

## Files Touched

| Path | Action | Intent |
|---|---|---|
| `sources/scripts/session-update.js` | modify | Add `MISSING_REMOVE_VALUE` to `ERRORS`; introduce `parseIdList()` helper (placed between `parseArgs` and `loadHistoryLimits`); extend `validate()` to reject empty / whitespace values for both flags; extend `main()` with two new branches after `--close-epic`, following the ADR-3/5/6 contract (unknown ids silently skipped, all-unknown emits stderr Warning but `exit 0`). |
| `sources/sections/session-update.md` | modify | Add `{{#remove_change}} --remove-change <ids>{{/remove_change}}{{#remove_epic}} --remove-epic <ids>{{/remove_epic}}` to the command line, placed after the `{{#update_initialized_at}}` block. Add matching `Critical flag semantics` paragraphs that document the unknown-id-skip and warning behavior. |
| `sources/skills/mvt-cleanup/manifest.yaml` | modify | Enable the new params in the `sections/session-update.md` invocation: `remove_change: true`, `remove_epic: true`. Only this manifest is touched; the other 23 skill manifests that reference the template are not modified. |
| `sources/skills/mvt-cleanup/business.md` | modify | Insert `Step 7.7` instructing the skill to collect archived change-ids / epic-ids. Expand the `Step 9` parameter-selection table from 2 to 5 rows covering: close+archive combination, close-only, archive-only, batch archive (epic + children), dry-run. Replace the single pre-filled `Step 10` example with four labeled examples that mirror the Step 9 rows. |
| `test/session-update.test.ts` | modify | Add three new top-level `describe` blocks: `(remove-change flag)` (6 cases), `(remove-epic flag)` (6 cases), and `(remove flags: active_change isolation)` (2 cases). Each setup mirrors the existing epic-flags block: temp directory + `spawnSync` of the bundled script. |

## Design Compliance

| Check | Status | Reason |
|---|---|---|
| Files touched == Change Tracking ± deviation noted | passed | 5 files modified, all listed in design §"手改源文件（5 个）". No additions, no deletions, no skipped files. |
| Each file lives in the module/layer assigned by Module Design | passed | `session-update.js` is the core writer; `session-update.md` is a shared template; `mvt-cleanup/manifest.yaml` + `business.md` are the sole caller; tests are colocated with the existing test file. No module boundary changes. |
| Public interfaces match Key Interfaces (signatures, endpoints) | passed | `--remove-change <ids>` and `--remove-epic <ids>` both accept comma-separated ids, both ignore unknown ids, both emit `{"ok":true}` on success, both exit 0. Stderr Warning emitted only when **all** requested ids are unknown, per ADR-6. |
| Forbidden cross-layer imports absent | passed | No new `import` statements were added to `session-update.js`; the new branches reuse `parseIdList()` (local) and the existing `node:fs` / `yaml` imports. No cross-skill module reference introduced. |
| Error handling lives only at boundaries | passed | The new `validate()` rules are the input boundary; `process.stderr.write` + `process.exit(1)` are the system boundary. No interior `try/catch` was added. |
| No new external deps not listed in design ADRs | passed | Zero new dependencies. `parseIdList()` is a 6-line local helper; no `package.json` change. |

## Deviations from Design

None.

The Step 7.7 numbering for the new "Index synchronization" sub-step in `mvt-cleanup/business.md` is an addition (the existing text ended at sub-step 6, "If any single action fails, STOP further actions"). Design §File Structure only required that "Step 7 末尾追加 `--remove-change` 提示行"; the new sub-step 7.7 is a deliberate elaboration to make the id-collection step explicit (and reusable from Step 9's `Step 7.7` reference). All subsequent Step 9/10 references to "Step 7.7" are consistent with this elaboration. If the design had specified a different number, the cross-references would need to be updated.

## Self-Check Results

Per the user's instruction, the build and test verification (`npm run build`, `npm test`) were not executed during this implementation. The implementation was completed by editing the source files only.

- Type-checker: not run.
- Test suite: not run. The 12 new vitest cases have been added to `test/session-update.test.ts` following the existing pattern (`mkdtempSync` workspace + `spawnSync` of `dist/scripts/session-update.cjs`). They will exercise the bundled script's `--remove-change` / `--remove-epic` behavior once the build is run.
- UI / frontend: not applicable (CLI / script change only).

The implementation is left in an "unverified" state: the build bundle (`dist/scripts/session-update.cjs` and `.ai-agents/scripts/session-update.cjs`) has not been regenerated, and the 23-skill hash-invariant check (Phase D in design) has not been performed. The next operator should run `npm run build` followed by `npm test` to confirm both the test pass-rate and the hash invariant, per design §"Phase D" and the Reviewer checklist item (6).

## Open TODOs

- **Run `npm run build` to regenerate generated artifacts** (Phase D). After build, confirm via `git diff -- .claude .qoder -- '*/SKILL.md' ':!mvt-cleanup/SKILL.md'` that the 23 non-cleanup skills produce byte-identical output. Owner: next operator (not in scope of this implementation per the user's "只改动文件" directive).
- **Run `npm test`** to verify the 12 new cases pass and the 240+ existing cases continue to pass. Owner: same as above.
- **Run `mvt-review`** against this change. Reviewer checklist (per design §Change Tracking): 6 items including the new (6) hash-invariant check. Owner: `mvt-review` skill.
