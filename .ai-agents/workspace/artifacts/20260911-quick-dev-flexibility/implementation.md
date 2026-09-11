# Implementation: Relax mvt-quick-dev admission model

## Task: t1-quick-dev-rewrite — Rewrite quick-dev gating: tiers, menus, ladder

### Implementation Summary

Rewrote the gating model in `sources/skills/mvt-quick-dev/business.md` (five-tier QD-1 table, QD-1b signal mapping, QD-2 decision branches, WS-1 warning schema, QD-3 verification ladder, QD-5 waiver instruction in Step 8, reworded plus two new edge rows) and in `manifest.yaml` (RT-1 frontmatter and Purpose wording, tier decision rules, QD-4 boundaries with waiver guidance). No file-count STOP rows and no Complex tier references remain. Assembler suite passes 71/71.

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `sources/skills/mvt-quick-dev/business.md` | modify | Five-tier classification, provisional/decisive split, warn-plus-waiver branches, warning schema, verification ladder, edge rows |
| `sources/skills/mvt-quick-dev/manifest.yaml` | modify | Routing-safe description, tier decision rules, waiver-aware boundaries via guidance params |

### Design Compliance

* Files touched == t1 hint (2 files): passed.
* Key Interfaces QD-1 through QD-5 implemented verbatim: passed (mechanical compare against design.md).
* Module/layer placement (content-only under `sources/`): passed; no `src/` changes.
* Forbidden imports, error handling, external deps: not applicable (Markdown/YAML prose).

### Deviations from Design

None.

### Self-Check Results

* Type-checker: not applicable (Markdown/YAML files, no compiled code touched).
* Assembler validation: `npx vitest run test/assembler.test.ts` → 71/71 passed (validates both edited manifests assemble, including the new `guidance` params).
* Stale-gate grep over quick-dev sources: zero `Complex` / `STOP` remnants.
* Full suite: deferred to t3 per plan. Not claiming tested beyond the assembler file.

### Open TODOs

* t3: materialize regenerated outputs and run the full suite.
* t4: prompt-level review of regenerated SKILL.md files.

## Task: t2-router-routing-rewrite — Align analyze router and registry descriptions

### Implementation Summary

Rewrote analyze Step 4 per AN-1 (band-selecting scope criterion, structural-concern offers, exact Simple/Wide/structural confirm strings, both worked examples) and set the root `registry.yaml` quick-dev description to the RT-1 string verbatim. Only the repo-root registry was edited; the workspace copy refreshes via update merge in t3.

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `sources/skills/mvt-analyze/business.md` | modify | Quick Path Detection without file-count gates, band vocabulary, waiver offer path |
| `registry.yaml` | modify | Quick-dev routing description per RT-1 |

### Design Compliance

* Files touched == t2 hint (2 files): passed.
* Key Interfaces AN-1 and RT-1 implemented verbatim: passed (mechanical compare against design.md).
* Module/layer placement (content-only under `sources/` plus repo-root registry): passed; no `src/` changes.
* Workspace `.ai-agents/registry.yaml` deliberately untouched (refreshes in t3): passed per design.

### Deviations from Design

None.

### Self-Check Results

* Type-checker: not applicable (Markdown/YAML files).
* Assembler validation: `npx vitest run test/assembler.test.ts` → 71/71 passed (covers the analyze manifest and all skills).
* Stale-gate grep over analyze sources: zero `1-3 files` / `≤ 3 files` / `ANY criterion fails` remnants.
* Full suite: deferred to t3 per plan. Not claiming tested beyond the assembler file.

### Open TODOs

* t3: materialize regenerated outputs and run the full suite.
* t4: prompt-level review of regenerated SKILL.md files.

## Task: t3-materialize-verify — Materialize outputs and run full verification

### Implementation Summary

Ran `npm run build` (`dist/` was absent) then `node dist/index.js update`: 49 files processed on the claude-only platform. Both SKILL.md files regenerated with the new gating model and the workspace registry copy refreshed via merge. Full vitest suite green; `git diff --check` clean; the diff is content-only with no `src/` or `test/` changes.

### Files Touched

| Path | Action | Intent |
|------|--------|--------|
| `.claude/skills/mvt-quick-dev/SKILL.md` | regenerate (via update) | Five-tier gating, warn-plus-waiver menus, ladder, waiver rules |
| `.claude/skills/mvt-analyze/SKILL.md` | regenerate (via update) | Band-based Quick Path, waiver offer path, rewritten examples |
| `.ai-agents/registry.yaml` | refresh (via update merge) | RT-1 quick-dev description |
| `.ai-agents/.mvtt-manifest.json` | refresh (via update) | Hash bookkeeping for regenerated files |

### Design Compliance

* Files touched == t3 hint (3 files, plus tool-owned manifest bookkeeping): passed.
* Regenerated content matches QD/AN/RT contracts: passed (grep-verified: new tiers present; the only remaining "STOP" is "never a STOP"; no stale gates).
* No `src/` or `test/` changes: passed (`git diff --stat`).
* Forbidden imports, error handling, external deps: not applicable.

### Deviations from Design

None. Note: `sources/defaults/config.yaml` (granularity medium → coarse) was already modified in the tree before t3 and was left untouched; `.ai-agents/.backup/` (registry backup from update) is standard tool output.

### Self-Check Results

* Full vitest suite: 391/391 passed across 15 files, as required by t3 acceptance.
* `git diff --check`: clean (CRLF notices are pre-existing line-ending warnings, not errors).
* UI verification: not applicable (no UI changes).

### Open TODOs

* t4: prompt-level review of regenerated SKILL.md files.

## Change Tracking

Tasks t1, t2, and t3 executed (t3 after t1/t2, honoring dependencies); status advancement belongs to `/mvt-update-plan`.
