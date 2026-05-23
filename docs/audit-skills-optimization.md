# MVTT Skills Optimization Audit Report

**Date**: 2026-05-23
**Scope**: All mvt-* skills (excluding mvt-init and mvt-create-skill, which have already been optimized)
**Status**: Pending Review

---

## Global Issues

Issues that apply across all skills.

| # | Issue | Current State | Proposed Fix | Impact |
|---|-------|---------------|-------------|--------|
| G1 | Description not using third-person | Most skill descriptions use second-person or passive voice | Change to "This skill should be used when..." format, consistent with already-optimized mvt-init and mvt-create-skill | All skills' manifest.yaml + registry.yaml |
| G2 | Inconsistent writing style in business.md | Mixed use of second-person and imperative form | Unify to imperative/infinitive form, as defined in mvt-create-skill's Design Principles | All skills' business.md |
| G3 | Missing footer-next-steps in manifest | mvt-add-context manifest lacks the `footer-next-steps` section | Add the shared section to ensure consistent endings | mvt-add-context |

---

## mvt-analyze

| # | Priority | Issue | Current State | Proposed Fix |
|---|----------|-------|---------------|-------------|
| A1 | High | No structured requirements template | Step 2 extracts features/actors/business_rules/assumptions but has no unified format | Add structured output templates: feature list table, actor table, business rules table (ID / description / priority / source) |
| A2 | High | Ambiguity handling not granular enough | Steps 3-4 detect ambiguities and generate questions but do not grade by impact | Add ambiguity grading: Critical (blocks design) / Major (affects feature completeness) / Minor (can assume default). Critical-level must be resolved before proceeding |
| A3 | Medium | No requirement traceability IDs | Features and business_rules lack unique identifiers | Introduce `REQ-001` / `BR-001` format traceability IDs, spanning analyze -> design -> implement -> test full chain |
| A4 | Medium | No linkage with analyze-code | Two skills are complementary but lack transition guidance | Add in Step 1: if user provides code instead of documents, suggest using `/mvt-analyze-code` |
| A5 | Low | change-id generation rules are simplistic | `{YYYYMMDD}-{slug}` format but no guidance on how to generate the slug | Add slug generation rule: kebab-case of core feature name, e.g., `user-authentication`, `payment-integration` |

---

## mvt-design

| # | Priority | Issue | Current State | Proposed Fix |
|---|----------|-------|---------------|-------------|
| D1 | High | No traceability between design decisions and requirements | Step 5 writes ADRs but does not link to specific requirement IDs | Add `addresses: [REQ-001, BR-003]` field to ADR template, ensuring every design decision is traceable to requirements |
| D2 | High | `--plan` variant behavior undefined | Manifest lists `--plan` variant but business.md only says "Skip to high-level plan" | Define concrete behavior: `--plan` outputs only module division + interface definitions + key decisions, omitting detailed data flow design and ADRs |
| D3 | Medium | Module interface definition lacks format specification | Step 3 says "Define interfaces between modules" with no concrete format | Add interface definition format: interface name, input parameters, output type, error types, sync/async |
| D4 | Medium | No guidance on interacting with pattern knowledge | Step 2 says "Load pattern-specific knowledge" but does not explain how to apply it | Add: read pattern's `manifest.yaml`, design according to its layer/module rules; skip if pattern has no manifest |
| D5 | Low | Data flow design missing error flows | Step 4 only mentions "request/response flows" and "service interactions" | Add design guidance for error flows and retry strategies |

---

## mvt-implement

| # | Priority | Issue | Current State | Proposed Fix |
|---|----------|-------|---------------|-------------|
| I1 | High | Implementation ordering strategy is vague | Step 2 says "dependencies first" but does not handle circular dependencies or same-layer ordering | Add ordering algorithm: topological sort by dependency -> same-layer sorted by dependee count -> circular dependencies resolved by splitting interface from implementation |
| I2 | High | No incremental implementation mode | Current approach implements all code at once, risky for large features | Add `--incremental` variant: implement module-by-module/file-by-file, verify each step before continuing |
| I3 | Medium | Step 4 "Verify Design Compliance" is too vague | Only says check layer/dependency/interface without concrete check methods | Add specific checklist: import direction matches dependency rules, public API matches design interfaces, files are in correct module directory |
| I4 | Medium | No strategy for modifying existing code | Step 1 only says "Identify files to create or modify" without distinguishing new vs modify | Distinguish: new files write directly, modified files read-then-edit, deleted files require confirmation. Preserve existing code structure and style when modifying |
| I5 | Low | Artifact format is unclear | What should `implementation.md` record? | Define template: list of changed files, design intent per file, deviations from design with rationale |

---

## mvt-review

| # | Priority | Issue | Current State | Proposed Fix |
|---|----------|-------|---------------|-------------|
| R1 | High | No review scope control | No specification of which files to review by default | Add: default reviews files under current change-id; accept file path or git diff range; `--full` reviews entire project |
| R2 | High | `--aspect` variant behavior is underdefined | Manifest and business.md both mention aspect options but only manifest lists types; business.md only says "Focus on that aspect" | Define specific checklists and weights per aspect: architecture=4 items x weight, security=5 items x weight, etc. |
| R3 | Medium | Review results lack actionability | Step 4 classifies Critical/Warning/Suggestion but does not link to concrete fix actions | Add `suggested_action` field per issue: Critical -> must use `/mvt-fix`, Warning -> suggest `/mvt-fix` or next iteration, Suggestion -> optional |
| R4 | Medium | No suggestion to run tests after review | Review should suggest running related tests | Add after Step 3: if project has test framework and related tests exist, suggest running and checking results |

---

## mvt-test

| # | Priority | Issue | Current State | Proposed Fix |
|---|----------|-------|---------------|-------------|
| T1 | High | No test framework adaptation guidance | Step 4 says "Follow project's test framework conventions" but provides no framework-specific guidance | Add mainstream framework adaptation: Jest (describe/it/expect), Pytest (def test_/fixture), Go (func Test*/t), JUnit (@Test/Assert) -- selected based on test_framework detected by init |
| T2 | High | No mock strategy guidance | Step 4 says "Use mocks/stubs for external dependencies" without distinguishing when to mock vs not | Add strategy: external APIs/databases -> mock, internal cross-module calls -> optional mock or integration, same-module -> no mock. Layer by dependency type |
| T3 | Medium | `--coverage` lacks concrete behavior | Step 5 says "Map test cases to requirements" without specifying coverage standards | Define coverage tiers: statement coverage (basic) -> branch coverage (recommended) -> path coverage (deep). Default target branch coverage 80%+ |
| T4 | Low | Test file location not defined | "Write test files to the project" without specifying where | By convention: co-located with source (Go/Rust), mirror directory in tests/ (Python/Java), __tests__/ co-located (JS/TS) |

---

## mvt-fix

| # | Priority | Issue | Current State | Proposed Fix |
|---|----------|-------|---------------|-------------|
| F1 | High | No regression testing step | Step 4 applies fix but does not verify it introduces no new issues | Add Step 4.5: run related tests (if any); if no tests, describe how to manually verify; if fix affects other modules, suggest `/mvt-review` |
| F2 | Medium | Hypothesis verification lacks systematic approach | Step 2 lists hypotheses and verifies each but does not specify verification methods | Add verification methods: read source code (most common), add temporary logs/breakpoints, construct minimal reproduction case. Order by cost low-to-high |
| F3 | Medium | No fix impact scope assessment | Step 3 says "Check for side effects" without explaining systematic assessment | Add: search all callers of modified functions (grep/IDE references), check if modification affects public API contract, check if related tests need updating |
| F4 | Low | No fix record template | Only says "Document what was changed and why" | Add fix record template: root cause description, fix approach, impact scope, verification method. Write to artifact |

---

## mvt-refactor

| # | Priority | Issue | Current State | Proposed Fix |
|---|----------|-------|---------------|-------------|
| RE1 | High | Behavior verification relies too heavily on tests | Step 5 depends on tests to verify behavior, but many projects have incomplete tests | Add alternative verification strategies when tests are incomplete: manually check critical paths, compare function signatures and return types before/after, check if caller usage patterns remain compatible |
| RE2 | Medium | No atomicity requirement for refactoring steps | Step 4 says "Apply changes incrementally" without defining what constitutes a single step | Define: each step should be an independent, compilable/runnable change. If a step involves multiple files, they should be kept as an atomic commit |
| RE3 | Medium | Risk assessment lacks quantification | Step 2 risk assessment only references the types table's Low/Medium/High | Add quantitative dimensions: number of affected files, number of affected callers, test coverage presence, public API involvement. Composite scoring |

---

## mvt-analyze-code

| # | Priority | Issue | Current State | Proposed Fix |
|---|----------|-------|---------------|-------------|
| AC1 | High | Feature overlap with mvt-init | mvt-init --deep also has module mapping, entity extraction, dependency analysis | Clarify division: mvt-init is initialization scan (fast, overview), mvt-analyze-code is deep reverse analysis (detailed, standalone). Cross-reference in both skills' descriptions |
| AC2 | Medium | No linkage with mvt-analyze after reverse analysis | After reverse-analyzing requirements, how to connect to subsequent design/implement | Add: analysis results can be written to `project-context.yaml` requirements section, making them input for `/mvt-design` |
| AC3 | Low | Architecture detection lacks confidence methodology | Step 4 says "Assess confidence level" without defining how to evaluate | Add evaluation dimensions: directory structure match rate, dependency direction consistency, naming convention match rate. High > 80% match, Medium 50-80%, Low < 50% |

---

## mvt-sync-context

| # | Priority | Issue | Current State | Proposed Fix |
|---|----------|-------|---------------|-------------|
| S1 | High | Sync granularity is too coarse | Only extracts entities/services/keywords, ignoring other context fields | Expand sync scope: tech_stack changes (e.g., new dependencies), directory structure changes (new/removed modules), architecture changes (module relationship changes), environment updates |
| S2 | Medium | No change confirmation step | Step 3 writes directly to project-context.yaml without user preview of changes | Add Step 2.5: show detected changes vs current context comparison table, require user confirmation before writing |
| S3 | Low | Does not update `last_synced_at` | mvt-init added this field but sync-context does not update it | Update `project-context.yaml` > `environment.last_synced_at` in Write Artifacts step |

---

## mvt-cleanup

| # | Priority | Issue | Current State | Proposed Fix |
|---|----------|-------|---------------|-------------|
| C1 | Medium | "5 phases ago" standard is stale | Cleanup Rules says "older than 5 phases ago" but session v2 no longer has phase concept | Change to skill_history-based: when entries exceed max (10), summarize oldest 5 entries into a single entry |
| C2 | Medium | No backup step before cleanup | Directly deletes/summarizes artifacts without backup | Add: before cleanup, copy affected files to `.ai-agents/workspace/.backup/cleanup-{timestamp}/` |

---

## mvt-check-context

| # | Priority | Issue | Current State | Proposed Fix |
|---|----------|-------|---------------|-------------|
| CC1 | Medium | Token thresholds may be too low | Thresholds <5k Good / 5-15k Moderate / 15-30k High / >30k Overloaded, but modern LLM context windows are typically 128k+ | Adjust for modern LLM context windows: Good <10k / Moderate 10-30k / High 30-60k / Overloaded >60k. Or switch to percentage-based system |

---

## mvt-help

| # | Priority | Issue | Current State | Proposed Fix |
|---|----------|-------|---------------|-------------|
| H1 | Medium | Hardcoded skill list | Step 3 skill catalog is hardcoded; new custom skills will not appear automatically | Change to dynamically read skills list from `registry.yaml`, group by category for display |
| H2 | Low | No detailed skill usage | Only shows skill name and description, not variants/parameters | Add optional detail mode: `/mvt-help {skill-name}` shows full usage (variants, parameters, prerequisites) |

---

## mvt-status

| # | Priority | Issue | Current State | Proposed Fix |
|---|----------|-------|---------------|-------------|
| ST1 | Low | No project health indicators | Only displays status data without health assessment | Add: context completeness %, artifact count/size, time since last sync. Link with `/mvt-check-context` |

---

## mvt-add-context

| # | Priority | Issue | Current State | Proposed Fix |
|---|----------|-------|---------------|-------------|
| AD1 | Medium | No token impact preview before writing | Step 3 estimates token impact before writing knowledge, but Step 2 collection phase has no estimation | After Step 2 collection and before writing, show estimated token increment and list of affected skills |
| AD2 | Low | No linkage with mvt-check-context after large additions | Should suggest checking context after adding substantial content | Add in Output Format: if total context exceeds Moderate threshold, suggest running `/mvt-check-context` |

---

## mvt-template

| # | Priority | Issue | Current State | Proposed Fix |
|---|----------|-------|---------------|-------------|
| TP1 | Low | Customize flow lacks diff view | Step 3 customize only shows current default template, no diff | Add: show diff between default vs customized version (highlight changes) |

---

## mvt-config

| # | Priority | Issue | Current State | Proposed Fix |
|---|----------|-------|---------------|-------------|
| CO1 | Low | registry.yaml description not synced with manifest | Multiple descriptions in registry.yaml are shorter versions of manifest descriptions | Ensure registry.yaml description matches manifest.yaml frontmatter.description exactly |

---

## Suggested Implementation Order

| Batch | Items | Skills | Rationale |
|-------|-------|--------|-----------|
| **Batch 1** | G1 + G2 + G3 | All 16 skills | Low cost, high value -- framework consistency |
| **Batch 2** | A1-A2, D1-D2, I1-I2, R1-R2, T1-T2, F1, AC1, S1 | analyze, design, implement, review, test, fix, analyze-code, sync-context | Core workflow skill critical gaps, directly impact output quality |
| **Batch 3** | A3-A5, D3-D5, I3-I5, R3-R4, T3-T4, F2-F4, RE1-RE3, AC2-AC3, S2-S3, C1-C2, CC1, H1, AD1 | All | Medium-low priority, improve experience and robustness |

---

## Summary Statistics

- **Total issues**: 42
- **High priority**: 14
- **Medium priority**: 19
- **Low priority**: 9
- **Global issues**: 3
- **Skills affected**: 16 (all)
