# Implementation: Activation-Phase Load Parallelization

## Task: t1-reframe-stages — Reframe Stage 1/2/4/5 reads as interpretation (ADR-3)

### Implementation Summary

Reframed the activation-protocol stages in the three shared sections so they read as *interpretation of already-loaded content* rather than independent per-stage file reads. This is the ADR-3 wording change and the prerequisite baseline for the batch-load preamble (t2) and the single-project fast path (t4), both of which further edit `activation-load-context.md`. No batch preamble and no single-project early-exit were added in this task. Every file reference is preserved so activation coverage stays auditable. No recompile performed (deferred to t6 per plan).

## Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `sources/sections/activation-load-context.md` | modify | Stage 1 now states the foundational files are read once at activation start (do not re-read); Stage 2 reads `projects[]` "from the already-loaded `project-context.yaml`". |
| `sources/sections/activation-load-config.md` | modify | Stage 4 enforces preferences "from the already-loaded `config.yaml`" instead of issuing a fresh read. |
| `sources/sections/activation-preflight.md` | modify | Stage 5 evaluates checks against the "already-loaded `session.yaml` and `project-context.yaml`". |

## Design Compliance

- **Files touched == Change Tracking**: passed — exactly the 3 section files listed in t1's `artifacts.files`; no extras.
- **Module/layer placement**: passed — all three are shared instruction sections under `sources/sections/`.
- **Key Interfaces match**: passed — the `activation_reads` param contract is ADR-2/t2 scope and was NOT introduced here; existing template tokens (`{{#checks}}`, `{{?extended_context}}`, `{{#extended_context}}`) were left untouched.
- **Forbidden imports**: not-applicable — markdown instruction files.
- **Boundary error handling**: not-applicable.
- **New external deps**: passed — none.
- **Batch Load reference**: Stage 1 now points to a "**Batch Load** above" that lands in t2. Until t2 ships this is an intentional transitional state in source; the plan fixes recompilation/verification at t6, so no compiled artifact ships mid-sequence.

## Deviations from Design

None.

## Self-Check Results

- Type-checker: not-applicable — only markdown instruction sources changed; no `tsc` target covers `sources/sections/*.md`.
- Template tokens preserved: verified by inspection — no `{{...}}` block was added, removed, or altered, so section-loader rendering of these files is unaffected aside from the reworded prose.
- Recompile / render verification: intentionally deferred to t6 (`mvt-test`), which owns the full verification matrix and `.claude/skills/*/SKILL.md` regeneration.

## Open TODOs

- t2 (`mvt-implement`): add the "Batch Load (do this first)" preamble and `activation_reads` param to `activation-load-context.md`. The Stage 1 wording added here forward-references that preamble.
- t6 (`mvt-test`): recompile all skills and run the verification matrix; confirm each compiled `SKILL.md` still names every activation file.

## Task: t2-batch-preamble — Add parallel Batch Load preamble + activation_reads param (ADR-1, ADR-2)

### Implementation Summary

Added a `### Batch Load (do this first)` block at the head of `## Activation Protocol` in `activation-load-context.md`. It instructs a single parallel read of the three universal base files (`project-context.yaml`, `registry.yaml`, `config.yaml`) with literal full paths, plus an explicit MUST-NOT-re-read rule, and a `{{#activation_reads}}` templated list that appends skill-declared extra files under `.ai-agents/workspace/`. It also notes that the only legitimately deferred reads are Stage 3 knowledge files. This realizes ADR-1 (injection point) and the param contract of ADR-2 (the manifest wiring for the 16 preflight skills is t3).

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `sources/sections/activation-load-context.md` | modify | Insert the Batch Load preamble + `{{#activation_reads}}` block before Stage 1. |

### Design Compliance

- **Files touched == Change Tracking**: passed — only `activation-load-context.md`, exactly t2's `artifacts.files`.
- **Key Interfaces match**: passed — preamble lists the 3 base files with literal paths and a MUST-NOT-re-read rule; `{{#activation_reads}}` renders appended files with the `.ai-agents/workspace/{{.}}` prefix, matching the design's Key Interfaces contract.
- **Forbidden imports / boundary error handling / external deps**: not-applicable / passed — markdown section, no deps.
- **Render verification (the binding t2 acceptance)**: passed via the build engine (`dist/build/section-loader.js applyParams`):
  - With `activation_reads: [session.yaml]` → batch lists 4 files incl. `.ai-agents/workspace/session.yaml`.
  - With no param → `{{#activation_reads}}` block renders nothing; only the 3 base files appear. A skill passing no param does NOT name `session.yaml` in its compiled preamble.

### Deviations from Design

None.

### Self-Check Results

- Render test: executed against the existing build engine; both param-present and param-absent cases produce the expected output (shown in conversation).
- Note: `dist/` reflects the engine, which is unchanged by this task; the engine correctly expands the new template. Full recompile of `.claude/skills/*/SKILL.md` and `vitest` are deferred to t6.

### Open TODOs

- t3 (`mvt-implement`): wire `activation_reads: [session.yaml]` into the 16 preflight skill manifests; confirm the 8 non-preflight skills stay bare.
- t6 (`mvt-test`): recompile + verification matrix.

## Task: t3-wire-preflight-manifests — Wire activation_reads into 16 preflight manifests (ADR-2)

### Implementation Summary

Added `activation_reads: [session.yaml]` to the `activation-load-context` section params of all 16 skills that include `activation-preflight` (they read `session.yaml` at activation). The 8 non-preflight skills were deliberately left untouched. Injection was done via a CRLF-aware script (these manifests use CRLF), then validated: all 16 parse as valid YAML with the param present, and all 8 non-preflight manifests confirmed free of `activation_reads`.

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `sources/skills/{mvt-analyze, mvt-analyze-code, mvt-cleanup, mvt-create-skill, mvt-decompose, mvt-design, mvt-fix, mvt-implement, mvt-init, mvt-plan-dev, mvt-resume, mvt-review, mvt-status, mvt-sync-context, mvt-test, mvt-update-plan}/manifest.yaml` | modify (16 files) | Add `activation_reads: [session.yaml]` to the activation-load-context section params (created a `params:` block for the 5 that lacked one). |

### Design Compliance

- **Files touched == Change Tracking**: passed — exactly the 16 preflight skills listed in t3's `artifacts.files`.
- **Key Interfaces match**: passed — param name/value matches t2's `{{#activation_reads}}` contract; value is `session.yaml` (rendered to `.ai-agents/workspace/session.yaml`).
- **manifest YAML validity**: passed — all 16 parsed via the `yaml` library without error.
- **No contamination**: passed — the 8 non-preflight skills (bug-detect, check-context, config, help, manage-context, quick-dev, refactor, template) verified to contain no `activation_reads`.

### Deviations from Design

None. (Implementation detail: edits applied by script rather than per-file hand-edit because the 16 manifests are CRLF and the change is identical/mechanical; result was machine-validated.)

## Task: t4-single-project-fastpath — Promote single-project fast path (ADR-4)

### Implementation Summary

Promoted the buried "skip the rest of this step" prose in Stage 2 of `activation-load-context.md` into an explicit **Single-project fast path** early-exit: when `projects.length == 1`, set PS to the sole project, skip the rest of Stage 2 (no Mode A/B reasoning), and skip Stage 3's per-project knowledge loop. Stage 3's knowledge block now states explicitly that the `_all` load is the complete load in this path — the per-project loop is preserved only for the multi-project Mode A/B.

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `sources/sections/activation-load-context.md` | modify | Stage 2 single-project early-exit; Stage 3 explicit `_all`-only note for the fast path. |

### Design Compliance

- **Files touched == Change Tracking**: passed — only `activation-load-context.md`, t4's `artifacts.files`.
- **`_all` load preserved**: passed — Stage 3 explicitly keeps the `_all` load in the fast path; only the per-project loop is skipped.
- **Render check**: passed — section still renders via the build engine after the edit (fast-path text and `_all`-preserved note both present).

### Deviations from Design

None.

## Task: t5-mvt-status-hardening — Existence-only check + glob as source of truth (ADR-5)

### Implementation Summary

Hardened `mvt-status/business.md`: Step 1 now checks `project-context.md` presence only (`test -f`) and forbids reading its contents. Step 3 was reordered to make the `artifacts/*/plan.yaml` glob the authoritative source of live plans; `changes[]` is consulted only to enrich metadata, and a `changes[].plan_path` is read only after the glob confirms it exists. A dangling `changes[]` pointer renders with the existing `(missing)` marker without an attempted read.

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `sources/skills/mvt-status/business.md` | modify | Step 1 existence-only; Step 3 glob-first / read-after-existence. |

### Design Compliance

- **Files touched == Change Tracking**: passed — only `business.md`, t5's `artifacts.files`.
- **`(missing)` marker preserved**: passed — dangling-pointer rows still render with `(missing)` per the Edge Cases table; the change only removes the wasted read.
- **No interface change**: passed — output columns and section order unchanged; only the read strategy changed.

### Deviations from Design

None.

## Self-Check Results (t3/t4/t5)

- t3: all 16 manifests machine-validated (valid YAML + param present); 8 non-preflight manifests confirmed untouched.
- t4: `activation-load-context.md` re-rendered cleanly via `dist/build/section-loader.js`.
- t5: markdown-only edits; no type-checker target.
- Full recompile of `.claude/skills/*/SKILL.md` and `vitest` remain deferred to t6 (the verification gate), which also diffs `/mvt-status` output for equivalence.

## Task: t7-extended-context-two-wave — Two-wave load model for extended_context (ADR-6)

### Implementation Summary

Extended the Batch Load preamble in `activation-load-context.md` to a two-wave model and fixed the ADR-3 Stage 1 inconsistency. Wave 1 is the existing parallel base-file batch. A new Wave 2 paragraph instructs: after `session.yaml` is parsed in Wave 1, read the concrete change-scoped Extended Context files (`analysis.md`/`design.md`/`plan.yaml`/static templates) in a single parallel sub-batch, while discovery-type entries ("scan project root", "load source files based on bug description", "scan artifacts/") are explicitly deferred to runtime and not batched. Stage 1 now labels the foundational files as Wave 1 and marks the Extended Context list as "NOT part of Wave 1", handled per the Wave 2 rule — removing the earlier implication that extended_context belonged to the base batch. No new param and no engine change: the existing `extended_context` list and `{{?}}`/`{{#}}` tokens are reused.

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `sources/sections/activation-load-context.md` | modify | Add Wave 2 paragraph to the Batch Load preamble; reword Stage 1 to label Wave 1 and reclassify Extended Context as Wave 2 / deferred. |

### Design Compliance

- **Files touched == Change Tracking**: passed — only `activation-load-context.md`, exactly t7's `artifacts.files`.
- **ADR-6 match**: passed — two-wave model, discovery entries deferred, and the Stage 1 inconsistency all addressed as specified.
- **No new param / no engine change**: passed — reused the existing `extended_context` list and template tokens.
- **Render verification (binding t7 acceptance)**: passed via the build engine (`dist/build/section-loader.js applyParams`):
  - With `extended_context` → Wave 2 paragraph present, Stage 1 "NOT part of Wave 1" block present, entries render.
  - Without `extended_context` → Stage 1 conditional block correctly stripped; the general Wave 2 rule paragraph remains a no-op ("only if this skill declares Extended Context below").

### Deviations from Design

None.

### Self-Check Results

- Render test: executed against the build engine for both param-present and param-absent cases; output matches ADR-6 (shown in conversation).
- Full recompile of `.claude/skills/*/SKILL.md` and `vitest` remain deferred to t6.

### Open TODOs

- t6 (`mvt-test`): recompile + verification matrix; confirm the Wave 2 wording renders correctly in the ~11 skills that declare `extended_context` and is absent in those that do not.

## Task: t8-merge-activation-sections — Merge 3 activation sections into one activation-protocol.md (ADR-7)

### Implementation Summary

Created `sources/sections/activation-protocol.md` by concatenating the final content of the three activation sections (load-context → load-config → preflight) in order, with the entire Stage 5 wrapped so it disappears for non-preflight skills. Migrated all 24 skill manifests so each references `activation-protocol.md` exactly once, collapsing the former three section entries into one with merged params (`activation_reads` + `extended_context` + `checks`). Deleted the three old section files. Migration was done via a line-range slicing script (text-preserving, not a YAML round-trip, to avoid reformatting the manifests' inline markdown blocks), then machine-validated structurally and by end-to-end compile.

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `sources/sections/activation-protocol.md` | create | Single merged Activation Protocol (Stages 1–5). |
| `sources/sections/activation-load-context.md` | delete | Merged into activation-protocol.md. |
| `sources/sections/activation-load-config.md` | delete | Merged. |
| `sources/sections/activation-preflight.md` | delete | Merged. |
| `sources/skills/*/manifest.yaml` (24 files) | modify | Collapse 3 activation section entries → 1, merge params. |

### Design Compliance

- **Files touched == Change Tracking**: passed — activation-protocol.md + 24 manifests + 3 deletions, matching t8's scope.
- **All 24 manifests**: reference activation-protocol.md exactly once, no residual references to the 3 old sections, all parse as valid YAML (machine-verified).
- **Param preservation**: each skill's `activation_reads` / `extended_context` / `checks` preserved verbatim.
- **End-to-end compile**: `assembleFromManifest` produces valid output with no leftover `{{` tokens for preflight (design, status → Stage 5 present) and non-preflight (bug-detect, help, create-skill → Stage 5 absent) skills.

### Deviations from Design

1. **`has_preflight` param introduced (ADR-7 said it would not be).** ADR-7's stated decision was to gate Stage 5 on the truthiness of the existing `checks` list via `{{?checks}}`. Implementation revealed this is **not reliable in the current engine**: `expandConditionals` uses a non-greedy regex, so an outer `{{?checks}}` wrapping an inner `{{#checks}}` loop closes at the *inner* `{{/checks}}`, leaving a stray `{{/checks}}` in the output (observed in a render test). Switched to a distinct outer key `{{?has_preflight}}` (verified: distinct-key nesting expands correctly and the stage vanishes when absent). The 16 preflight manifests now also carry `has_preflight: true`. This is ADR-7's rejected alternative (a), adopted because the chosen approach is engine-infeasible. Recommend updating ADR-7 status/decision to reflect this.

2. **Fixed a latent t3 bug (out of original t8 scope, in-scope for correctness).** `mvt-create-skill` had `activation_reads: [session.yaml]` from t3, but it is NOT a preflight skill (no `activation-preflight` section) and does not read session.yaml at activation. t3's edit list conflated "skills with params" with "preflight skills". Removed the stray `activation_reads` from mvt-create-skill so it does not load session.yaml needlessly — consistent with ADR-2. No other skill was affected (audited: this was the only `activation_reads`-without-`has_preflight` mismatch).

### Self-Check Results

- Structural audit (all 24 manifests): parse OK, single proto reference, no old refs, no activation_reads/has_preflight mismatch — all pass.
- End-to-end compile via `assembleFromManifest` for 5 representative skills: pass, no leftover tokens.
- Render check via `section-loader`: preflight renders Stage 5 with check rows; non-preflight omits Stage 5 entirely; no stray `{{...}}`.
- Full recompile of `.claude/skills/*/SKILL.md` and `vitest` deferred to t6.

### Open TODOs

- t6 (`mvt-test`): recompile all skills; the SKILL.md diff will be large (every skill's activation block re-emitted from one source) — confirm semantic equivalence, not byte-identity. Update any render/section-loader test that referenced the 3 old section filenames.
- Design hygiene: ADR-7 should be amended to record that `has_preflight` was necessary (engine limitation). Consider via `/mvt-design` or a doc fix.

## Post-t8 Follow-up — Condense rewrite + downstream reference fixes

These changes happened after t8 was implemented, on the same `activation-protocol.md` and on a skill that references it. They are recorded here (not folded into t8's section) because they are corrective follow-ups, several driven by a `/mvt-review` pass and by user-spotted defects. They are not yet tracked as plan tasks.

### F1 — Condensed `activation-protocol.md` from 5 Stages to a 2-block (Load / Resolve) structure

- **What**: Rewrote `sources/sections/activation-protocol.md` (~92 → ~60 source lines). Replaced the five numbered Stages with two topic blocks: **Load** (all read mechanics: Wave 1 parallel batch, deferred knowledge, Wave 2 extended-context) and **Resolve** (decisions only: Project Scope, Knowledge, Config, Pre-flight). Deleted the old Stage 1 (it only restated the batch file list and the no-re-read rule). Collapsed each duplicated rule to a single home: "never re-read" stated once, file list once, single-project fast path once, Wave 2 once.
- **Why**: Incremental parallelization edits had left the same rule restated across multiple stages, making the prompt long and harder for an AI to execute.
- **Verification**: Template tokens preserved verbatim (`{{#activation_reads}}`, `{{?extended_context}}`, `{{?has_preflight}}`, `{{#checks}}`). Engine render checked for 3 scenarios (full preflight+ec / bare non-preflight / preflight-no-ec): no leftover `{{`, all load-bearing rules present. Confirmed no source file references Stage numbers, so the structural change breaks no cross-references.
- **Review outcome** (`/mvt-review`): verdict **Approve with comments**. 16 load-bearing rules each traced to a home in the new structure — "semantic zero-loss" claim verified. Open items raised by the review: (W-1) design.md / ADRs still describe the 5-Stage structure → needs an ADR-8 for the condense decision; (W-2) t6's "output identical to baseline" acceptance must be relaxed to **semantic** equivalence since the activation block's rendered structure changed; (S-1) the knowledge-protocol worked example (`source: ... + files:[...]` → resolved path) was dropped and could be restored.

### F2 — Fixed stale references in `mvt-create-skill/business.md`

Triggered by analyzing this change's impact on `mvt-create-skill` (a self-contained skill generator that copies standard sections from its own compiled SKILL.md rather than referencing build-time section files).

- **F2a (line ~80)**: Pre-flight checks row pointed at `activation-preflight.md` (deleted in t8). **Root issue corrected** (not just the filename): `mvt-create-skill` must never reference a `sources/sections/*.md` build-time file — its generated skills are self-contained. First pass wrongly swapped to `activation-protocol.md` (same class of error); corrected to refer to "the Pre-flight part of the Activation Protocol copied into the generated SKILL.md" — a product-level concept, not a source filename. (Defect caught by the user.)
- **F2b (line ~89)**: The standard-sections enumeration listed "Load Config, Pre-flight" as siblings of Activation Protocol (5-Stage-era phrasing). Updated to "Activation Protocol, Language Constraint, Output Format Constraint, State Update, Next Steps" and noted that config preferences + pre-flight are *inside* the Activation Protocol block.
- **F2c (lines ~213-217)**: The standard-section copy table listed Load Config / Language Constraint / Pre-flight as sub-entries of Activation Protocol, and mis-attributed Language Constraint (a pre-existing error — it is a separate shared section). Rewrote: Activation Protocol copied as one whole Load+Resolve block; Language Constraint and Output Format Constraint listed as their own sections.
- **Verification**: zero `sources/sections/*.md` filename references remain in `mvt-create-skill/business.md`; the only `.../SKILL.md` reference points at the final product (`.claude/skills/<existing>/SKILL.md`), which is correct.

### Follow-up Files Touched

| Path | Action | Driver |
|------|--------|--------|
| `sources/sections/activation-protocol.md` | modify (condense rewrite) | F1 |
| `sources/skills/mvt-create-skill/business.md` | modify (3 reference fixes) | F2a/b/c |

### Lesson recorded

When updating references during a section rename/merge, verify the **reference type** is correct, not just the name. `mvt-create-skill` must reference product-level concepts (headings in the generated SKILL.md), never build-time `sources/sections/*.md` files. This constraint should be stated explicitly when ADR-8 is written.

### Open follow-up TODOs (not yet plan tasks)

- ADR-8: record the 5-Stage → 2-block condense decision and the "mvt-create-skill references product concepts, not source files" constraint (review W-1; F2 lesson).
- Relax t6 acceptance to semantic equivalence (review W-2).
- Optionally restore the knowledge-protocol worked example in `activation-protocol.md` (review S-1).
- These post-t8 follow-ups (F1, F2) are not represented as plan tasks; decide whether to add a tracking task or fold them into t6's verification scope.

## Change Tracking

- Plan task `t1-reframe-stages`: done (marked via `/mvt-update-plan`).
- Plan task `t2-batch-preamble`: done.
- Plan task `t3-wire-preflight-manifests`: done.
- Plan task `t4-single-project-fastpath`: done.
- Plan task `t5-mvt-status-hardening`: done.
- Plan task `t7-extended-context-two-wave`: implementation complete; awaiting `/mvt-update-plan t7-extended-context-two-wave done`.
- Plan task `t8-merge-activation-sections`: implementation complete (+ post-t8 follow-ups F1/F2 above); awaiting `/mvt-update-plan t8-merge-activation-sections done`.
- Plan task `t6-recompile-verify`: pending (final gate; depends on t7, t8).
