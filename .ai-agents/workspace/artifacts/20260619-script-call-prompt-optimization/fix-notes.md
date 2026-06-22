# Fix Notes: Review Post-Cleanup (W1, S1, S2)

## Symptom
Review found 1 Warning and 2 Suggestions in the `session_sync` implementation:
- W1: `catch {}` empty block lacks intent documentation
- S1: `epic.epic_id || epic.id` dead-code fallback (schema uses `epic_id` only)
- S2: `projectDir` variable declared but unused

## Input Source
Review artifact (`review.md`), source 1a.

## Reproduction
Not applicable — static code quality findings, not a bug.

## Hypotheses considered
Pre-verified by review; skips Steps 2-4 per SKILL.md source 1a protocol.

## Root cause
Review found 3 minor code quality issues after the `session_sync` implementation. All are cosmetic/dead-code, zero impact on behavior.

## Patch summary
- `sources/scripts/epic-update.js` — removed `|| epic.id` fallback (dead code); expanded catch comment
- `test/epic-update.test.ts` — removed `projectDir` variable and assignment, inlined `tmpDir` directly

## Regression risk
None. Existing 52 epic-update tests + 268 full-suite pass. No behavior change from any of the three diffs.

## Follow-ups
None.
