---
id: 'analyze-output'
version: '1.0'
skill: 'mvt-analyze'
---

# Requirements Analysis: Script Callability — Eliminate AI Reading Script Source

## Feature Overview

**Problem statement**: When executing skills that must call `.ai-agents/scripts/*.cjs` to update progress, the AI frequently cannot determine the correct command from the rendered `SKILL.md` alone. It falls back to reading the `.js` source files under `sources/scripts/` to confirm flag names and semantics, incurring unnecessary context-token cost and latency on every affected skill invocation.

**Goal**: Ensure every rendered `SKILL.md` that must call a script contains a self-contained, copy-runnable command contract — including the full set of flags that skill actually uses, with concrete pre-filled examples — so the AI never needs to open script source to execute a state update.

**Scope boundary**: This change targets the *documentation/assembly layer* (shared sections, skill manifests, business.md prose). It does **not** alter script behavior, the section-loader engine, or the build pipeline.

## Actors

| Actor | Role in this feature |
|-------|----------------------|
| **AI agent (skill executor)** | Primary consumer of rendered `SKILL.md`; must derive the exact script command from the document alone. |
| **Framework maintainer (skill author)** | Writes `manifest.yaml` + `business.md`; must keep script-call documentation in sync with actual script flags. |
| **End user** | Indirect beneficiary via faster skill execution and lower token consumption; no direct interaction with scripts. |

## Requirements

### R1 — Self-contained command contract per script
Every rendered `SKILL.md` that invokes a script must contain, within the document itself, the complete command template for that script — all flags the skill uses, with a value-source table — without requiring the AI to read any `.js` source.

### R2 — Shared sections for all three scripts
The framework must provide a shared section for each script it ships, mirroring the existing `sections/session-update.md` pattern:
- `sections/session-update.md` (exists)
- `sections/plan-update.md` (missing — must be created)
- `sections/epic-update.md` (missing — must be created)

Each shared section is the single authoritative source for that script's command template, argument table, and parameter-semantics table, referenced by skills via `type: shared` in their manifest.

### R3 — Conditional rendering must not hide flags a skill actually uses
A skill's `manifest.yaml` flags (e.g. `update_active_change`, `close_change`, `new_epic`) must be audited and aligned with the flags its `business.md` actually invokes. When a skill's business logic calls a flag, the manifest must enable the corresponding conditional block so the rendered `SKILL.md` documents it.

### R4 — Concrete pre-filled example per skill
In addition to the generic template, each skill's State Update (or equivalent) block must include at least one skill-specific, pre-filled example command with every flag the skill uses substituted with realistic placeholder values. Concrete examples reduce AI uncertainty and source-reading more than abstract templates alone.

### R5 — Single authoritative usage source
The complete flag list and semantics for each script must live in exactly one place (the shared section), not duplicated across `business.md` prose and script header comments. Script header comments may remain as developer-facing docs but must not be the only complete reference.

### R6 — No behavior change
This change must not alter any script's CLI surface, output format, or exit-code contract. It is purely a documentation/assembly-layer change. Existing tests (`test/section-loader.test.ts`, `test/assembler.test.ts`) must remain green; new tests may be added for the new sections.

## Domain Concepts

| Concept | Definition |
|---------|------------|
| **Shared section** | A markdown file under `sources/sections/` containing a Mustache template, referenced by skills via `type: shared` + `source: sections/<name>.md` in `manifest.yaml`. Rendered with per-skill `params`. |
| **Conditional rendering** | Mustache blocks (`{{#flag}}...{{/flag}}`, `{{^flag}}`, `{{?flag}}`) in a shared section that include/exclude content based on boolean params supplied by each skill's manifest. |
| **Script callability** | The property that a rendered `SKILL.md` contains enough information for the AI to construct and run the correct script command without external file reads. |
| **Value-source table** | A table mapping each CLI flag to where its value comes from at runtime (e.g. `--skill` ← "the skill command name without leading `/`"). |
| **Parameter-semantics table** | A table mapping each flag to *when to use it* and *its effect on the target YAML file*. |
| **Section loader** | `src/build/section-loader.ts` — resolves `type: shared` sections from `sourcesDir`, applies Mustache params, strips empty conditional tables. |

## Business Rules

### BR1 — Shared section is the single source of truth
For any script, its shared section (under `sources/sections/`) is the only place that documents the full command template and flag semantics. `business.md` files may reference the section ("see State Update section") but must not re-document individual flags inline.

### BR2 — Manifest flags must match business.md script calls
For each skill, the set of conditional flags enabled in its `manifest.yaml` `session-update.md` (or new `plan-update.md` / `epic-update.md`) `params` must be a superset of the flags its `business.md` instructs the AI to pass. A mismatch is a defect.

### BR3 — Every script gets a shared section
A script shipped under `sources/scripts/` that is callable by skills must have a corresponding shared section under `sources/sections/`. No script may rely solely on `business.md` prose or header comments for its usage documentation.

### BR4 — Pre-filled example is skill-specific
The concrete example command in a skill's rendered output must use that skill's own `--skill` value and the flags its manifest enables — not a generic placeholder. This makes the example directly usable as a sanity check.

### BR5 — Read-only skills are exempt from command contracts
Skills marked `read_only: true` in their session-update params do not call the script and therefore need no command contract (the existing `{{?read_only}}` block already handles this). This exemption must be preserved.

### BR6 — Documentation-only change, no runtime impact
No change to `src/build/section-loader.ts` engine behavior, no change to any `*.cjs` script, no change to `session.yaml` / `plan.yaml` / `epic.yaml` schemas. The build output (rendered `SKILL.md` files) changes in content only.

## Ambiguities & Questions

### Q1 — Should plan-update.md / epic-update.md use the same conditional-flag pattern as session-update.md?
The existing `session-update.md` uses ~15 conditional flags (`update_active_change`, `close_change`, `new_epic`, etc.) because `session-update.cjs` has many modes. `plan-update.cjs` and `epic-update.cjs` have fewer modes but still have conditionally-relevant flags (e.g. `--deliverables-pointer`, `--mark-deliverable-stale` for plan; `--complete-child`, `--switch-active`, `--add-child` for epic).

**Question**: Should the new sections use the same per-flag conditional rendering (each flag gated by a manifest boolean), or render the full flag set unconditionally since these scripts have fewer flags?

**Impact**: Affects how many manifest params each skill must set. Conditional rendering keeps rendered docs lean but reintroduces the "hidden flag" risk (R3) if a manifest forgets a flag. Unconditional rendering is safer for callability but slightly larger per SKILL.md.

**Recommendation for design phase**: Lean toward **unconditional full flag set** for plan/epic sections (fewer flags, lower hidden-flag risk), reserving conditional rendering for the large session-update section. Confirm in `/mvt-design`.

### Q2 — How to keep script header comments and shared sections in sync?
Script headers (`session-update.js` lines 14-33, `epic-update.js` lines 15-37, `plan-update.js` lines 17-27) currently hold the authoritative usage. Once shared sections become the source of truth, the headers risk drifting.

**Question**: Should the build pipeline generate shared sections from script headers (single-source automation), or should headers be reduced to a pointer ("see sections/<name>.md") with the section as manual source of truth?

**Impact**: Automation eliminates drift but adds build complexity. Manual pointer is simpler but relies on maintainer discipline.

**Recommendation for design phase**: Start with **manual section as source of truth + header pointer** (low complexity, matches current architecture). Consider automation only if drift is observed. Confirm in `/mvt-design`.

### Q3 — Scope of the manifest flag audit (R3)
The audit must cover all skills that call scripts. From the bug-detect diagnosis, the highest-friction skills are: `mvt-decompose` (epic-update), `mvt-implement` (plan-update with deliverables flags), `mvt-cleanup` (session-update with `--truncate-history` / `--close-change`), `mvt-update-plan` (plan-update).

**Question**: Should the audit be limited to these four high-friction skills, or extend to every skill that references any script (broader set including `mvt-analyze`, `mvt-plan-dev`, `mvt-fix`, etc.)?

**Impact**: Broader audit is more thorough but larger change surface.

**Recommendation for design phase**: Audit **all** skills that call scripts, but prioritize the four high-friction ones for the first implementation pass. Confirm scope in `/mvt-design`.

### Q4 — Should a "scripts reference" knowledge doc also be created?
The bug-detect diagnosis suggested a single `scripts-reference.md` loaded via activation context. This is an alternative/complement to per-skill shared sections.

**Question**: Is the per-skill shared-section approach (R2) sufficient, or should there also be a consolidated reference loaded once per session via the registry knowledge map?

**Impact**: A consolidated reference adds a second loading path but gives the AI a single lookup for any script. Per-skill sections are co-located with where the command is needed.

**Recommendation for design phase**: Per-skill shared sections (R2) are the primary mechanism; a consolidated reference is optional and only worth adding if per-skill sections prove insufficient in practice. Confirm in `/mvt-design`.

## Change Tracking

| Field | Value |
|-------|-------|
| change-id | 20260619-script-callability |
| title | Script Callability — Eliminate AI Reading Script Source |
| created_at | 2026-06-19 |
| source | `/mvt-analyze` invocation following `/mvt-bug-detect` diagnosis |
| related diagnosis | bug-detect: "AI reads script source as structural documentation gap" |
| next skill | `/mvt-design` — design the shared-section + manifest-audit + pre-filled-example mechanism |
