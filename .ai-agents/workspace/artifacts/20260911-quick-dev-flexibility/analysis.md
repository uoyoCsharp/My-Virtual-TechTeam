# Requirements Analysis: Relax mvt-quick-dev Admission Model

## Feature Overview

Redesign the admission and gating model of the `mvt-quick-dev` shortcut skill so that multi-file, architecturally neutral changes — including mechanical sweeps and cross-repository edits — can be completed quickly without forcing the full analyze-design-implement workflow. File count is demoted from a hard gate to a risk signal; structural signals trigger specific warnings and the user decides via waiver confirmations. The `mvt-analyze` Quick Path router is aligned to the same model. Requirements source: conversation only (four consultation rounds, scope confirmed by the user).

## Actors

* Framework User (developer invoking skills) — primary actor; confirms plans, grants waivers, owns cross-repo commit coordination.
* Skill Router (LLM) — selects skills via frontmatter descriptions; affected by the description wording change.
* mvt-analyze (upstream router) — offers the quick path to qualifying requirements; its Step 4 criteria must mirror the new model or routing becomes inconsistent.

## Requirements

### R1 — Two-axis classification with new tiers

Replace the single-axis Trivial / Simple / Complex tiers with scope (blast radius) crossed with architectural impact, plus two new categories. Assumes the existing tier names may be kept where they still apply.

* Trivial: 1 file, ≤10 lines, no interface change → implement directly.
* Simple: 1–3 files, architecturally neutral → implement after plan preview.
* Mechanical Sweep (new): any file count, one single 1:1 transform, no logic change (rename propagation, label/text sync, config passthrough, formatting) → declare the transform pattern, implement, verify with a batch zero-residue check.
* Wide (new): more than 3 files, architecturally neutral → mandatory plan preview plus confirmation; never a STOP.
* Structural (replaces Complex): new module, interface change, new dependency, or cross-layer edit → specific warning plus a decision menu.

### R2 — Three-layer escalation, zero hard STOPs and zero forced transfers

No structural signal may hard-STOP or force a transfer to the standard workflow. Assumes confirmation menus follow the shared confirmation-prompt pattern.

* L1 (scope signals): warning plus default proceed; raises preview and verification depth only.
* L2 (structural signals): specific warning plus an explicit menu — Proceed (waive) / Split into batches / Cancel. Transfer to the standard workflow is offered, never forced.
* Non-policy behaviors only: asking for clarification when scope is ambiguous (missing input, not a gate), and surfacing the limitation when a target is physically unreachable (e.g., repository not checked out).

### R3 — Step 2 classification becomes provisional

Step 2 (classify from the description) is labeled a preliminary assessment; the decisive classification moves to Step 5 after the real file list is resolved. Assumes the branch tables in both steps are rewritten accordingly.

### R4 — Guardrail ladder

Verification and preview depth scale with scope. Assumes the existing type-check and test-suggestion steps are strengthened, not replaced.

* 1–3 files, neutral: plan preview; type-check suggested.
* 4–10 files: mandatory preview with risk note and rollback story; type-check required; tests suggested; commit per concept.
* Mechanical sweep: transform-pattern declaration; mandatory batch verification command proving zero residue of the old pattern; single commit.
* Structural: execute the mandated countermeasure (enumerate all call sites for interface changes; locate module placement per project-context rules for new modules; record rationale for new dependencies; explicit recorded exemption for cross-layer edits); small reversible steps.

### R5 — Informed-consent rules

* Every warning names the concrete contract, the discovered call sites, and the consequence; generic "risky, proceed?" prompts do not count as informed consent.
* Each waiver confirmation quotes the specific waived risk; the waiver is recorded in the session-update summary (existing pipeline, compact one-line form such as `waived: x, y`).
* Single-concept principle: one invocation does exactly one thing; mixed unrelated intents are split or declined.
* Batch splitting is always available as a third option: 2–3 batches, each small, type-check between batches.

### R6 — Router alignment in mvt-analyze Step 4

The second file-count gate must be updated together with quick-dev. Assumes both skills are changed in the same change.

* Scope criterion (`Affects ≤ 3 files`), the confirmation text (`1-3 files`), and worked Example 2 are rewritten for the new model.
* The `ANY criterion fails → standard analysis` branch gains the same warn-plus-decide treatment where the failing criterion is scope-only.

### R7 — Cross-repository handling

* Reachable cross-repo targets: warn with the explicit repo/path list, a note that changes outside this workspace leave no git trace or artifact here (session summary is the only trail), and the commit-coordination requirement (one commit per repo, consistency window exists); menu Proceed (waive) / Split per repo / Cancel.
* Verification runs per repository where tooling exists; otherwise explicitly marked unverified for that repo.
* True cross-repository edits have no knowledge-loading path (unlike in-workspace multi-project), so the warning notes unknown conventions in the other repo.
* Unreachable targets: surface the limitation; the user decides (provide path, narrow scope, or stop).

### R8 — Hard constraints on the solution

* Zero new CLI parameters; all decisions happen through in-skill confirmation menus.
* Zero new configuration keys; no per-project thresholds.
* Zero artifacts from quick-dev runs; the waiver trail lives in session history only.
* Change surface: `sources/skills/mvt-quick-dev/business.md`, `sources/skills/mvt-quick-dev/manifest.yaml`, `sources/skills/mvt-analyze/business.md`, root plus workspace `registry.yaml` descriptions, regenerated `SKILL.md` outputs via assemble/materialize. No test assertions cover the gated logic, so no test updates are expected beyond keeping the suite green.

## Domain Concepts

| Term | Meaning |
|------|---------|
| Blast Radius | Scope axis: how many files or modules a change touches; drives preview and verification depth, never a refusal. |
| Architectural Impact | Risk axis: whether module responsibilities, contracts, dependencies, or layer rules change; the only source of warnings. |
| Mechanical Sweep | Multi-file change applying one identical 1:1 transform with no logic change; inherently low-risk when the pattern is declared and residue is verified at zero. |
| Wide Tier | New band for changes wider than 3 files but architecturally neutral; confirmed, not refused. |
| Structural Signal | Any of: new module, interface change, new dependency, cross-layer edit, cross-repo edit, external contract change. |
| Hard STOP | Refusal with a redirect and no in-skill override; removed by this change except where action is physically impossible. |
| Transfer | Forced handoff to the standard workflow; replaced by an offered option. |
| Waiver | Explicit user approval to proceed despite a named structural signal. |
| Waiver Trail | One-line record of granted waivers in the session-update summary. |
| Informed Consent | Decision quality bar: specific warning plus quoted risk plus recorded waiver. |
| Verification Ladder | Scope-scaled verification: suggested, required, or batch-proven checks. |
| Single-Concept Principle | One invocation, one intent; mixed intents split or decline. |
| Quick Path Detection | mvt-analyze Step 4 router deciding whether a requirement is offered the quick-dev path. |
| Provisional vs Decisive Classification | Description-based guess (Step 2) versus plan-based verdict (Step 5). |

## Business Rules

* File count is a signal, never a gate.
* Only structural signals may trigger warnings; scope alone never blocks or forces anything.
* Every structural warning must name the contract, affected surface, consequence, and countermeasure.
* Every waiver must quote the waived risk and be recorded in the session summary.
* Step 2 output is provisional and labeled as such; Step 5 is decisive.
* Mechanical sweeps must declare the single transform pattern and prove zero residue; symbols reachable via reflection, dynamic dispatch, or string lookup are excluded from sweep treatment.
* Cross-repo verification is per repository; missing tooling is marked unverified, never assumed.
* Frontmatter and registry descriptions drop the file count but keep tight routing keywords (clearly specified, reversible, single-concept) to avoid misrouting complex work into the quick path.
* Ambiguous scope always asks; physically unreachable targets always surface the limitation; neither is a policy gate.

## Ambiguities & Questions

None blocking. The following details are deferred to `/mvt-design` by agreement and do not block this analysis:

* Exact per-signal warning schema field wording.
* Exact confirmation menu labels and default selections.
* Compact multi-waiver summary format within the one-line session summary constraint.
* Edge-case handling for half-failed cross-repo commits (one repo committed, another failed).

## Change Tracking

Change `20260911-quick-dev-flexibility`: analysis complete, artifact written; pending `/mvt-design`.
