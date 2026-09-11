# Fix Notes: quick-dev admission model — prompt corrections

Covers two consecutive `/mvt-fix` rounds against the t4 prompt review. Round 1 closed the review's Critical and Warning findings; round 2 tightened instruction density in the text round 1 added.

## Symptom

`/mvt-review` on task t4 returned **Request changes**: 1 Critical, 3 Warning, 7 Suggestion against the regenerated `mvt-quick-dev` and `mvt-analyze` prompts. A follow-up review of round 1's own edits — scoped to instruction density — returned **Approve with comments**: 4 Warning, 8 Suggestion.

## Input Source

Direct user input: review findings delivered in conversation. Neither review was persisted to `review.md` (user chose Skip both times), so the findings themselves are recorded here.

## Reproduction

Not applicable. The review targets are Markdown/YAML prompt content with no executable path. Verification substituted regeneration plus content comparison against `design.md` Key Interfaces.

## Root cause

**Round 1 (Critical).** QD-4 required replacing the prohibition-style Boundaries with default-routing plus waiver. The shared section `sources/sections/role-header.md` hardcodes the `Do NOT` prefix and exposes only a `guidance` string appended in parentheses, so the implementer could not satisfy QD-4 through manifest params. The result kept a hard prohibition alongside the waiver clause; combined with Rule 2 of the shared Turn Boundary Contract ("never act outside the Boundaries unless the user invokes the owning skill"), the structural-waiver path — the only new critical path this change introduces — carried two opposing instructions. The three Warnings were term drift in the same family: two token spellings (`waive:` vs `waived:`), a `Mechanical Sweep` tier lacking an architectural-neutrality qualifier so that a cross-repo or interface-changing sweep could shadow the Structural warning, and a stale `simple change` label in `mvt-analyze` that RT-1 explicitly prohibits.

**Round 2 (instruction density).** Round 1 prioritized semantic completeness and did not retire the text it superseded. Waiver semantics ended up stated both in three per-boundary `guidance` clauses and in `boundaries_note`; tier precedence was restated at Step 2 and Step 5 in different wording; and several rationale clauses ("so the trail stays greppable", "it counts as the user's authorization") carried no instruction. The `guidance` clauses also referenced `QD-2` and `QD-5`, which are `design.md` numbers with no anchor in the runtime prompt.

## Patch summary

### Round 1 — correctness

| File | Change |
|------|--------|
| `sources/sections/role-header.md` | Added optional `boundaries_note` block. Block-scoped vars are exempt from `validator.ts` param completeness checks, so skills that omit the param render unchanged. |
| `sources/skills/mvt-quick-dev/manifest.yaml` | Passed a waiver-override note stating that Boundaries are default routing and that a granted waiver overrides Rule 2 for the named risk. |
| `sources/skills/mvt-quick-dev/business.md` | Two-axis classification with Structural precedence (Step 2 and Step 5); `Mechanical Sweep` gained the architectural-neutrality qualifier; `waived: <risk>` trail format aligned with the WS-1 approval token; batch-splitting semantics; `Maps to` header; tier-agnostic edge row; Step 2 heading. |
| `sources/skills/mvt-analyze/business.md` | Step 4 heading; Example 2 completed to all six criteria; ambiguity branch now asks and re-assesses instead of routing away. |
| `sources/skills/mvt-analyze/manifest.yaml` | Removed the stale `simple change` label from `primary_desc` and from the quick-dev boundary. |

### Round 2 — instruction density

| File | Change |
|------|--------|
| `sources/skills/mvt-quick-dev/manifest.yaml` | Deleted all three `guidance` clauses (75 words, and the only `QD-2` / `QD-5` references); `boundaries_note` reduced 85 to 52 words. |
| `sources/skills/mvt-quick-dev/business.md` | Step 2 "How" reduced 75 to 33 words with the precedence detail moved to Step 5 alone; Step 5 precedence line de-cross-referenced; removed an invented per-batch reporting instruction; WS-1 `waiver_text` cell reduced to one clause with the canonical token list lifted to its own line; Step 8 waiver line 40 to 28 words; removed a duplicated waiver-trail mention from an edge row. |
| `sources/skills/mvt-analyze/business.md` | Removed a non-instructional clause from the ambiguity branch. |

Roughly 200 words of duplication, rationale, and dangling references were removed across the two runtime prompts, with no instruction lost.

Regenerated (never hand-edited): `.claude/skills/mvt-quick-dev/SKILL.md`, `.claude/skills/mvt-analyze/SKILL.md`, plus `.ai-agents/registry.yaml` and `.ai-agents/.mvtt-manifest.json` refreshed by `mvtt update`.

## Regression risk

No runtime code changed; `src/` and `test/` are untouched in both rounds. The shared-template extension is opt-in, confirmed by `git diff --stat` showing only the two intended `SKILL.md` files changed out of 25. Full vitest suite green after each round (391/391, 15 files); `git diff --check` clean.

Behavioral risk is concentrated in quick-dev runtime classification: Structural signals now dominate `Mechanical Sweep` and `Wide`, so some sweeps that previously proceeded silently will surface the waiver menu. That is the intended effect of analysis R7. No test covers the gated prompt logic (per R8), and no regression test was added.

Round 2 removed text, so the semantic checks were re-run explicitly: the waiver override still names Rule 2, Structural precedence still binds at Step 5, and the `waived:` trail token still maps to the WS-1 approval token.

## Follow-ups

1. **Design record incomplete.** Three rules now live in the prompts but not in `design.md` Key Interfaces: tier precedence (QD-1 is silent on it), batch-splitting semantics (sourced from analysis R5, which QD-2 dropped), and the `boundaries_note` shape as a template-constrained realization of QD-4. `implementation.md` still records `Deviations from Design: None` for t1. Resolve via `/mvt-design` (preferred, since `design.md` is the t4 acceptance baseline) or by recording the deviation in `implementation.md`.
2. **Session history gap.** The second `/mvt-review` state update was interrupted, so no history entry exists for that review.
3. `Do NOT` remains the boundary prefix; waiver semantics are carried by the adjacent override paragraph rather than by replacing the prefix. Changing this would require a shared-template contract change affecting all skills.
