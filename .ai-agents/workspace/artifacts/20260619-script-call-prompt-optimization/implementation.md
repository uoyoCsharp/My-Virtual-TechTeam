# Implementation: Script Call Prompt Optimization

## Implementation Plan

Implemented the design as a documentation/assembly-layer change. The implementation keeps the existing section-loader engine unchanged and adds boolean-driven script guidance modes to the shared `script-usage-rule.md` section. Targeted skills now opt into the smallest guidance block that matches their workflow.

| Group | Files | Intent |
|---|---|---|
| Shared prompt source | `sources/sections/script-usage-rule.md` | Add specialized boolean guidance paths for inline plan commands, project reminders, inline epic modes, and fallback-only epic docs. |
| Skill manifests | `sources/skills/mvt-analyze/manifest.yaml`, `sources/skills/mvt-decompose/manifest.yaml`, `sources/skills/mvt-implement/manifest.yaml`, `sources/skills/mvt-sync-context/manifest.yaml`, `sources/skills/mvt-update-plan/manifest.yaml`, `sources/skills/mvt-cleanup/manifest.yaml` | Switch each script-calling skill to the appropriate guidance mode; remove session-only Script Usage Rule from cleanup. |
| Skill business prose | `sources/skills/mvt-analyze/business.md`, `sources/skills/mvt-decompose/business.md`, `sources/skills/mvt-implement/business.md`, `sources/skills/mvt-sync-context/business.md`, `sources/skills/mvt-update-plan/business.md` | Remove eager script-doc references where inline commands are authoritative; keep explicit fallback wording where needed. |
| Tests | `test/section-loader.test.ts`, `test/assembler.test.ts` | Add focused rendering assertions for specialized script guidance modes and representative assembled skills. |
| Generated outputs | `.claude/skills/*/SKILL.md`, `.ai-agents/.mvtt-manifest.json` | Refreshed through the existing materialization path after build. |

## Changes

### Shared script guidance

`script-usage-rule.md` now supports these additional boolean params without changing `section-loader.ts`:

```yaml
plan_update_inline_command_only: true
plan_update_project_reminder: true
epic_update_inline_modes_only: true
epic_update_fallback_for_unrendered_modes: true
```

Existing generic params still work:

```yaml
uses_plan_update: true
uses_epic_update: true
uses_session_update: true
```

### Skill-specific behavior

| Skill | Result |
|---|---|
| `mvt-implement` | Uses inline-only plan guidance. The generated skill keeps its concrete deliverables command and no longer renders the generic `--status <new_status>` command or `plan-update.md` pointer. |
| `mvt-update-plan` | Keeps generic plan-update guidance and narrows epic-update guidance to the exact inline mode commands already present in the workflow. |
| `mvt-decompose` | Uses epic fallback guidance: inline commands first, script docs only for non-rendered modes or flags. |
| `mvt-analyze` | Uses epic fallback guidance for epic-child mode scenarios. |
| `mvt-sync-context` | Uses compact plan project-reminder guidance instead of a full generic plan command. |
| `mvt-cleanup` | Removes the session-only Script Usage Rule because State Update is already self-contained. |

## Implementation Details

No runtime code, script behavior, YAML schema, or template engine behavior changed. The implementation intentionally avoids string-valued mode branching because the current section loader does not support equality checks. All conditional rendering uses existing truthy block semantics.

Focused generated-output checks confirmed:

| Check | Result |
|---|---|
| `mvt-implement` has no generic `--status <new_status>` plan command | Passed |
| `mvt-implement` has no `.ai-agents/scripts/plan-update.md` pointer | Passed |
| `mvt-update-plan` has inline epic-mode guidance and no `epic-update.md` pointer | Passed |
| `mvt-cleanup` no longer renders `## Script Usage Rule` | Passed |

## Design Compliance

| Design requirement | Status | Notes |
|---|---|---|
| Use boolean guidance flags, not string enum branching | Passed | Implemented via Mustache-like truthy params only. |
| Preserve generic behavior where needed | Passed | `mvt-update-plan` still uses generic plan guidance and `plan-update.md` output semantics. |
| Suppress generic plan guidance for `mvt-implement` | Passed | The generated skill keeps only the concrete workflow command. |
| Treat script docs as fallback behavior | Passed | Fallback wording remains for project-reminder and epic fallback modes only. |
| Keep State Update self-contained | Passed | No `session-update.md` script-doc pointer was introduced. |
| Avoid engine/script/schema changes | Passed | `src/build/*`, `src/types/*`, and `sources/scripts/*` were not modified by source implementation. Generated installed copies may already differ from previous materialization state. |

### Self-Check Results

| Command | Result |
|---|---|
| `npx vitest run test/section-loader.test.ts test/assembler.test.ts` | Passed: 2 files, 78 tests |
| `npm run build` | Passed |
| materialize generated outputs via `materializeProject(...)` | Passed: 65 files materialized |
| `npm test` | Passed: 12 files, 257 tests |

## Change Tracking

| Item | Value |
|---|---|
| Change ID | `20260619-script-call-prompt-optimization` |
| Artifact written | `.ai-agents/workspace/artifacts/20260619-script-call-prompt-optimization/implementation.md` |
| Source files modified | `sources/sections/script-usage-rule.md`; six target skill manifests; five target business.md files; two test files |
| Generated files refreshed | `.claude/skills/*/SKILL.md` and `.ai-agents/.mvtt-manifest.json` through materialization |
| Deviations from design | None for core source implementation. Generated `.ai-agents/*` installed copies show broader pre-existing/materialization drift and should be reviewed separately if the repository tracks those generated copies. |
| Open TODOs | Review whether `.qoder/skills/*` is expected to exist in this workspace before treating absent `.qoder` output as a regeneration gap. |
