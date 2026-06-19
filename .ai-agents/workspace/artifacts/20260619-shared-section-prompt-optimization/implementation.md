---
id: 'implement-output'
version: '1.0'
skill: 'mvt-implement'
---

# Implementation: Shared Section Prompt Quality Optimization

## Implementation Plan

Implemented the design as a documentation/template-layer change. The work compressed shared section source files, kept State Update self-sufficient, updated focused rendering tests, rebuilt generated skill outputs, and validated the full test suite.

## Changes

| Path | Action | Intent |
|------|--------|--------|
| `sources/sections/session-update.md` | modify | Replaced verbose argument/semantics tables with a pre-filled `--skill {{current_skill}}` command and compact critical flag semantics. |
| `sources/sections/language-constraint.md` | modify | Compressed language rules while preserving interaction/document scopes, fallback, anti-mirroring, re-assert-every-turn, and NON-NEGOTIABLE override language. |
| `sources/sections/output-format-constraint.md` | modify | Compressed persisted markdown formatting rules while preserving mermaid/table/code/heading requirements and override assertion. |
| `sources/sections/activation-load-context.md` | modify | Compressed Activation Steps 1-3, knowledge loading, path resolution example, and anti-patterns while preserving project-scope and registry-source semantics. |
| `sources/sections/activation-load-config.md` | modify | Compressed config preference loading into concise bullets. |
| `sources/sections/script-usage-rule.md` | modify | Removed redundant framing while preserving deterministic script usage, plan/epic `.md` references, and source-read prohibition. |
| `test/section-loader.test.ts` | modify | Added a focused test for compressed `session-update.md` rendering and no reference-file pointer. |
| `test/assembler.test.ts` | modify | Updated generated `mvt-implement` expectations from the old skill placeholder/argument table contract to the new self-sufficient State Update contract. |
| `.claude/skills/mvt-*/SKILL.md` | regenerate | Refreshed generated Claude skill outputs from the compressed shared sections. |

## Implementation Details

State Update now renders `--skill {{current_skill}}` directly and keeps only critical operational semantics inline. It does not create or point to `.ai-agents/scripts/session-update.md`, so normal skill execution does not incur an extra file read.

Measured section-source savings for the six modified files:

| Scope | Before words | After words | Delta words | Before chars | After chars | Delta chars |
|-------|-------------:|------------:|------------:|-------------:|------------:|------------:|
| Modified section sources | 2,230 | 1,181 | 1,049 | 19,631 | 10,560 | 9,071 |

Measured generated `.claude` representative skill reductions:

| Skill | Before words | After words | Delta words | Word reduction | Delta chars | Char reduction |
|-------|-------------:|------------:|------------:|---------------:|------------:|---------------:|
| `mvt-analyze` | 2,518 | 2,202 | 316 | 12.5% | 2,582 | 13.8% |
| `mvt-design` | 2,732 | 2,376 | 356 | 13.0% | 2,854 | 14.2% |
| `mvt-implement` | 3,311 | 3,044 | 267 | 8.1% | 2,077 | 8.8% |
| `mvt-review` | 2,914 | 2,558 | 356 | 12.2% | 2,873 | 13.7% |
| `mvt-help` | 1,731 | 1,480 | 251 | 14.5% | 1,975 | 15.4% |
| `mvt-status` | 2,175 | 1,924 | 251 | 11.5% | 2,003 | 12.6% |
| `mvt-quick-dev` | 2,561 | 2,171 | 390 | 15.2% | 3,160 | 16.9% |

The representative table measures the whole rendered `SKILL.md`, not only the shared-section subset, so its percentage is lower than the modified-section reduction.

## Design Compliance

| Check | Result | Notes |
|-------|--------|-------|
| Files touched match design scope | Passed with noted generated output | Source changes match the six designed section files plus test updates. Generated `.claude` outputs were refreshed. |
| Engine/script/schema unchanged | Passed | No changes were made to `src/build/section-loader.ts`, `src/build/assembler.ts`, source `*.js` scripts, or YAML schemas. |
| Mustache contracts preserved | Passed | `session-update.md` retains all designed blocks and now renders `--skill {{current_skill}}` directly. |
| No session-update reference file introduced | Passed | No `sources/scripts/session-update.md` or `.ai-agents/scripts/session-update.md` pointer was added. |
| Formatting/language constraints preserved | Passed | NON-NEGOTIABLE override language, interaction/document scopes, and output formatting rules remain inline. |

## Change Tracking

Validation commands:

```bash
npx vitest run test/section-loader.test.ts
npx vitest run test/assembler.test.ts
npm run build
npm test
```

Results:

| Command | Result |
|---------|--------|
| `npx vitest run test/section-loader.test.ts` | Passed: 25 tests |
| `npx vitest run test/assembler.test.ts` | Passed: 49 tests |
| `npm run build` | Passed |
| `npm test` | Passed: 12 test files, 253 tests |

Open TODOs:

- None for implementation. Recommended next step is `/mvt-review` for design-compliance review of the compressed prompt wording.