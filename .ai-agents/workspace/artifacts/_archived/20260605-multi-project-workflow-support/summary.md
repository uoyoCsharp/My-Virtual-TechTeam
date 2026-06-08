# Change Summary: Multi-Project Workflow Support (OPT-2026-002)

- **Change ID:** `20260605-multi-project-workflow-support`
- **Status:** done (8/8 tasks completed)
- **Completed:** 2026-06-06T15:04:26.128Z

## Scope

Made the MVTT workflow layer project-aware so a single workspace can drive a multi-project (monorepo) repository, while preserving single-project behavior with zero new prompts.

## Architecture Decisions

| ADR | Title |
|-----|-------|
| ADR-1 | Single-project collapse keys on `projects.length == 1`, not on name |
| ADR-2 | Registry knowledge becomes a project-keyed map with reserved `_all` key |
| ADR-3 | Breaking registry migration -- old lists move under `_all` |
| ADR-4 | `task.project` is an array, validated in `plan-update.js` via `--projects` |
| ADR-5 | Deliverables content in `implementation.md`, freshness pointer in `plan.yaml` |
| ADR-6 | Expand scope to `src/fs/registry-merge.ts` (override proposal section 8) |
| ADR-7 | `mvt-analyze-code` writes per-project semantic files only in multi-project mode |
| ADR-8 | Per-project independent `in_progress` advancement (overrides global-unique constraint) |

## Tasks

| Task | Title | Status |
|------|-------|--------|
| t1 | Registry restructure + merge rewrite (ADR-2/3/6) | done |
| t2 | Plan attribution + DAG restructuring (ADR-4/8) | done |
| t3 | Activation section rewrite (PS resolution + Mode A/B knowledge loading) | done |
| t4 | Plan-related skill instruction updates | done |
| t5 | Context management + sync routing + hardcoded path removal | done |
| t6 | Init + analyze-code + check-context skill updates | done |
| t7 | Mode B instructions for non-plan skills | done |
| t8 | Deliverables handoff implementation (ADR-5) | done |

## Key Outcomes

- Registry knowledge schema restructured from flat lists to project-keyed maps (`_all` key)
- `plan-update.js` extended with `--projects`, `current_tasks`, per-project DAG, deliverables pointer, stale marking
- Activation section rewritten with 3-priority PS resolution and Mode A/B knowledge loading
- All 18 skill business.md files updated for project-awareness
- 5 non-plan skills gained Mode B on-demand project identification
- 164/164 tests passing across full suite

## Original Files

- `analysis.md` -- Requirements analysis (16,302 chars)
- `design.md` -- Architecture design with 8 ADRs (37,178 chars)
- `implementation.md` -- Per-task implementation details (34,975 chars)
- `plan.yaml` -- Task plan with project attribution (11,722 chars)
