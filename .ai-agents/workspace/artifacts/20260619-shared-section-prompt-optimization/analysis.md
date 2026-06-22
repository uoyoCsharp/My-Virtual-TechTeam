---
id: 'analyze-output'
version: '1.0'
skill: 'mvt-analyze'
---

# Requirements Analysis: Shared Section Prompt Quality Optimization

## Feature Overview

**Problem statement**: MVTT-generated `SKILL.md` files derive 45-68% of their content (measured by non-whitespace character count) from shared template sections (`sources/sections/*.md`). These sections — Activation Protocol, Language Constraint, Output Format Constraint, State Update, Script Usage Rule, Suggested Next Steps — are identical or near-identical across all skills. While this guarantees structural consistency, it dilutes the signal-to-noise ratio: each skill's genuinely unique business logic (Execution Flow, decision tables, worked examples) occupies only 27-55% of the document, with the remainder being repeated boilerplate that the AI must re-read on every skill activation.

**Goal**: Reduce the token cost of shared sections without compromising AI execution strength for time-critical instructions (Activation Protocol, output constraints) and without moving strong-execution content to a global layer where attention attenuation risks instruction forgetting.

**Scope boundary**: This change targets the *shared section source files* (`sources/sections/*.md`) and the *assembly parameters* in skill `manifest.yaml` files. It does **not** alter the section-loader engine (`src/build/section-loader.ts`), the assembler (`src/build/assembler.ts`), or any script behavior. The rendered `SKILL.md` output changes in content volume and phrasing, not in structural section ordering.

**Key constraint (from stakeholder feedback)**: Content that the AI must execute at skill-activation time (Activation Protocol steps, pre-flight checks, output language/format constraints) must remain inline in each `SKILL.md`, close to the business logic. Extracting such content to a global/shared layer is explicitly rejected because (a) token cost is identical whether read from inline or global, and (b) distance from the execution point causes attention attenuation, risking the AI skipping mandatory activation steps. Optimization must therefore proceed via *in-place phrasing compression* for strong-execution content and *reference-on-demand extraction* for reference-only content.

## Actors

| Actor | Role in this feature |
|-------|----------------------|
| **Framework maintainer (skill author)** | Writes and maintains `sources/sections/*.md` shared templates and per-skill `manifest.yaml` params; must balance consistency with token economy. Primary decision-maker for optimization scope. |
| **AI agent (skill executor)** | Consumes rendered `SKILL.md` on every skill activation; directly affected by prompt quality, phrasing density, and instruction proximity. The optimization target beneficiary. |
| **End user** | Indirect beneficiary via faster skill execution (less context to process) and lower token consumption; no direct interaction with shared sections. |

## Requirements

### R1 — Quantify shared-section token cost across the skill catalog
The optimization must be grounded in measured data, not estimates. A per-skill breakdown of shared-section character/word counts and percentage of total document must be produced, covering at minimum the 7 representative skills (`mvt-analyze`, `mvt-design`, `mvt-implement`, `mvt-review`, `mvt-help`, `mvt-status`, `mvt-quick-dev`), to confirm the problem is systemic (not isolated to one skill) and to prioritize which sections yield the highest savings.

### R2 — Classify shared sections by execution criticality
Each shared section must be classified into one of three categories, determining its optimization strategy:
- **Time-critical execution flow** (Activation Protocol, Pre-flight Checks): AI must execute these steps immediately on skill activation. Strategy: *in-place phrasing compression only*; never extract to global layer.
- **Global output constraints** (Language Constraint, Output Format Constraint): Apply to every output the skill produces. Strategy: *in-place phrasing compression*; merge if redundant; never extract.
- **Reference-only content** (State Update parameter tables, Script Usage Rule flag references): AI consults these only when constructing non-standard commands. Strategy: *extract to on-demand `.md` reference*; keep only the pre-filled command template inline.

### R3 — In-place compression for time-critical and constraint sections
For sections classified as time-critical or constraint, reduce character count by tightening prose without removing any executable instruction. The compression must preserve:
- Every actionable rule (e.g., "use `preferences.interaction_language`").
- Every override assertion (e.g., "NON-NEGOTIABLE", "overrides all other signals").
- The proximity of the instruction to the business logic section that follows.

Compression targets (measured against `mvt-analyze` as baseline):
- Language Constraint: 1,629 chars → target ≤ 600 chars (≈63% reduction).
- Output Format Constraint: 1,821 chars → target ≤ 700 chars (≈62% reduction).
- Activation Protocol (load-context + load-config): 3,107 chars → target ≤ 1,800 chars (≈42% reduction, preserving the worked example and anti-pattern list which carry unique instructional value).

### R4 — Reference-on-demand extraction for State Update parameter tables
The "Argument values" and "Parameter semantics" tables in `session-update.md` (and the equivalent tables in the new `plan-update.md` / `epic-update.md` shared sections) are reference documentation: the AI needs them only when constructing a command with non-standard flags. These tables must be moved to the corresponding standalone script documentation `.md` files (e.g., `.ai-agents/scripts/session-update.md`), and the shared section must retain only:
- The pre-filled, skill-specific command template (already rendered via Mustache params).
- A one-line pointer: "For full parameter semantics, read `.ai-agents/scripts/<script>.md`."

This aligns with the existing `script-usage-rule.md` principle ("Never read `.cjs` or `.js` source; read the `.md` instead") — it extends that principle to move reference tables out of the always-loaded shared section into the on-demand `.md`.

### R5 — No reduction in execution strength
The optimization must not degrade AI adherence to mandatory instructions. Specifically:
- No time-critical instruction may be moved more than one section away from the business logic it governs.
- No override assertion ("NON-NEGOTIABLE", "overrides all other signals") may be removed.
- No conditional rendering flag (`{{#flag}}`) may be silently dropped; if a flag's rendered content is compressed, the flag must still gate the compressed content.
- The `{{?read_only}}` exemption for read-only skills must be preserved.

### R6 — Preserve cross-skill structural consistency
All skills must continue to share the same section ordering and the same set of section headings (after compression). A reader who knows one `SKILL.md` must still navigate any other `SKILL.md` by the same heading sequence. Compression changes phrasing and volume, not structure.

### R7 — Documentation-only change with measurable output
This change alters only `sources/sections/*.md` source files and (optionally) `manifest.yaml` params. No change to `src/build/*.ts` engine, no change to `*.cjs` scripts, no change to YAML schemas. The build output (`SKILL.md` files) must remain valid Markdown with correct Mustache rendering. A before/after character-count comparison per skill must be produced to verify savings.

## Domain Concepts

| Concept | Definition |
|---------|------------|
| **Shared section** | A markdown file under `sources/sections/` containing a Mustache template, referenced by skills via `type: shared` + `source: sections/<name>.md` in `manifest.yaml`. Rendered with per-skill `params`. Currently 10 files: `role-header.md`, `activation-load-context.md`, `activation-load-config.md`, `activation-preflight.md`, `language-constraint.md`, `output-format-constraint.md`, `session-update.md`, `script-usage-rule.md`, `footer-next-steps.md`, `project-context-profile.md`. |
| **Execution criticality** | A classification of shared-section content by how urgently the AI must act on it at activation time. Determines whether content may be extracted (reference-only) or must be compressed in-place (time-critical / constraint). |
| **In-place phrasing compression** | Reducing the character count of a section by tightening prose (removing redundant emphasis, collapsing multi-sentence rules into single sentences, eliminating meta-commentary about the rule itself) while preserving every actionable instruction and override assertion. Does not move content. |
| **Reference-on-demand extraction** | Moving content that the AI consults only when constructing non-standard commands out of the always-loaded shared section into a standalone `.md` file that the AI reads only when needed. Distinct from global-layer extraction (rejected) because the content is not strong-execution and reading is truly optional. |
| **Attention attenuation** | The empirically observed phenomenon where LLMs assign lower attention weight to instructions that are distant from the current execution point (especially content at the start of a long context). The reason time-critical instructions must remain inline and proximate to business logic. |
| **Signal-to-noise ratio (SNR)** | The proportion of a `SKILL.md` document devoted to that skill's unique business logic (Execution Flow, decision tables, worked examples) versus shared boilerplate. Higher SNR means the AI's attention is more focused on skill-specific decisions. |
| **Override assertion** | A phrase in a constraint section that explicitly elevates the constraint above competing signals (e.g., "NON-NEGOTIABLE", "overrides any other language signals"). Must be preserved during compression. |

## Business Rules

### BR1 — Time-critical content stays inline
Content classified as time-critical execution flow (Activation Protocol Steps 1-5, Pre-flight Checks) must remain inline in every `SKILL.md`, positioned immediately before the business logic section. It may be compressed in phrasing but must not be moved to a global layer, a separate file, or a later section. Rationale: token cost is identical whether inline or global, but attention attenuation makes distant instructions less likely to be executed.

### BR2 — Constraint content stays inline and merged if redundant
Language Constraint and Output Format Constraint must remain inline. If compression reveals that the two constraints share structural patterns (both declare scope, rules, fallback, override), they may be merged into a single "Output Constraints" section to eliminate duplicated framing prose, provided every rule from both is preserved.

### BR3 — Reference tables move to on-demand `.md`
The "Argument values" and "Parameter semantics" tables in `session-update.md`, `plan-update.md`, and `epic-update.md` shared sections must be relocated to the corresponding `sources/scripts/<name>.md` standalone documentation files. The shared section retains only the pre-filled command template and a one-line pointer. This is the only extraction permitted; it applies exclusively to reference-only content.

### BR4 — Compression preserves all executable instructions
For every compressed section, a verification pass must confirm that no actionable rule, no override assertion, and no conditional rendering flag has been removed. The compressed version must be functionally equivalent to the original in terms of what the AI is instructed to do; only the phrasing volume changes.

### BR5 — Measured savings per skill
After optimization, a per-skill character-count comparison (before vs. after) must be produced. The target is ≥ 30% reduction in shared-section character count per skill, with business-logic content proportion rising correspondingly. Skills with already-low shared ratios (e.g., `mvt-implement` at 45.4%) may see smaller absolute savings but must still show improvement.

### BR6 — No engine or script changes
This change must not modify `src/build/section-loader.ts`, `src/build/assembler.ts`, any `*.cjs` script, or any YAML schema (`session.yaml`, `plan.yaml`, `epic.yaml`, `config.yaml`, `registry.yaml`). Existing tests (`test/section-loader.test.ts`, `test/assembler.test.ts`) must remain green. New tests may be added to verify compressed sections still render correctly.

### BR7 — `project-context-profile.md` is out of scope
The `project-context-profile.md` shared section (1,950 chars) is loaded only by skills that write `project-context.md` (`mvt-analyze-code`, `mvt-sync-context`). It is not universally loaded and its content is domain-specific guidance, not boilerplate. It is excluded from this optimization to keep scope focused.

## Ambiguities & Questions

### A1 — Compression aggressiveness vs. instruction clarity trade-off
**Ambiguity**: How aggressively should prose be compressed? A 3-line Language Constraint may be token-optimal but could lose the "re-assert every turn" emphasis that combats mid-conversation language drift. There is a tension between token economy and emphasis redundancy.

**Question**: Should the compressed Language Constraint retain the "re-assert every turn" explicit instruction, or is "use `preferences.interaction_language` for all interactive output" sufficient? The former costs ~15 extra chars but directly addresses a previously observed bug (interaction language intermittently outputting English, fixed in change `20260608-regular`).

**Priority**: High — this determines the compression floor for the most safety-critical constraint.

### A2 — Whether to merge Language + Output Format into one section
**Ambiguity**: Merging the two constraint sections into a single "Output Constraints" section would save the duplicated framing prose (both currently declare "Mandatory", "NON-NEGOTIABLE", "overrides all other signals" separately). But it changes the heading structure that all 17+ skill manifests reference.

**Question**: Should the merge be done (saving ~200 chars of duplicated framing), or should the two sections remain separate to preserve the existing heading contract?

**Priority**: Medium — structural change with cross-skill impact.

### A3 — Activation Protocol worked example and anti-pattern list retention
**Ambiguity**: The Activation Protocol's "Worked example" (registry entry → resolved path) and "Anti-pattern -- DO NOT" list (guessing base directories, assuming default paths) together account for ~600 chars. They carry unique instructional value (preventing a specific class of AI errors) but are verbose.

**Question**: Should these be retained verbatim, compressed to one-line summaries, or moved to a knowledge file loaded on demand? Given BR1 (time-critical stays inline), moving is disallowed, but compression vs. verbatim is open.

**Priority**: Medium — affects the largest single section's compression target.

### A4 — Scope of `footer-next-steps.md` optimization
**Ambiguity**: The Suggested Next Steps section (855 chars in `mvt-analyze`) contains both a mandatory constraint ("Candidate set constraint: only recommend skills declared in registry.yaml") and conditional recommendation logic. The constraint is time-critical (governs output); the conditional logic is structural.

**Question**: Should the conditional recommendation tables be compressed, or are they already lean enough to leave untouched?

**Priority**: Low — smallest absolute savings potential.

## Change Tracking

| Item | Value |
|------|-------|
| Change ID | `20260619-shared-section-prompt-optimization` |
| Affected files (estimated) | `sources/sections/language-constraint.md`, `sources/sections/output-format-constraint.md`, `sources/sections/activation-load-context.md`, `sources/sections/activation-load-config.md`, `sources/sections/session-update.md`, `sources/sections/script-usage-rule.md`, `sources/sections/footer-next-steps.md`, `sources/scripts/session-update.md` (reference tables target), `sources/scripts/plan-update.md` (reference tables target), `sources/scripts/epic-update.md` (reference tables target), plus regenerated `.claude/skills/*/SKILL.md` and `.qoder/skills/*/SKILL.md` outputs |
| New modules | None |
| ADRs anticipated | 1-2 (compression strategy, reference-extraction boundary) |
| Breaking changes | None (output content changes only; no schema, engine, or script changes) |
