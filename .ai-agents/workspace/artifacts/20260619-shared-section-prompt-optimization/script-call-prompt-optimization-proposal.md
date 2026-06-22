# Script Call Prompt Optimization Proposal

## Status

Proposed for review.

## Scope

This proposal reviews generated skills under `.claude/skills` for prompt patterns around deterministic scripts:

- `session-update.cjs`
- `plan-update.cjs`
- `epic-update.cjs`

The goal is to reduce unnecessary prompt tokens and avoid extra script-reference reads while preserving correctness and the rule that agents must not inspect `.js` or `.cjs` implementation files to learn script usage.

## Findings

### 1. Session update is now mostly optimized

The shared State Update section renders exact `session-update.cjs` commands per skill and includes the required flag semantics inline. Most skills only need this self-contained section.

Remaining issue: `mvt-cleanup` still includes `Script Usage Rule` with only `uses_session_update: true`. That renders an additional section that restates the State Update guidance and the generic non-session rule, even though no non-session script is configured for that skill.

Recommendation: remove `sections/script-usage-rule.md` from session-only skills, or teach the section to suppress itself when only `uses_session_update` is true.

### 2. Plan update guidance is too generic for inline command users

Skills using `uses_plan_update: true` currently receive this shared block:

```bash
node .ai-agents/scripts/plan-update.cjs --plan "<active_change.plan_path>" --task <task_id> --status <new_status> --projects "<project_list>"
```

It then says to read `.ai-agents/scripts/plan-update.md` for optional flags.

This is appropriate for `mvt-update-plan`, because that skill is the generic plan mutation interface and must interpret user-provided status, artifacts, notes, and script output.

It is less appropriate for task-specific skills that already render a concrete command or only mention plan update conditionally:

- `mvt-implement` already renders a full deliverables handoff command with `--deliverables-pointer` and `--mark-deliverable-stale`. The shared minimal command adds a second, different `--status <new_status>` pattern and encourages an avoidable `.md` read.
- `mvt-sync-context` only reminds the agent to pass `--projects` when updating a plan. It does not render a concrete plan-update command in the workflow, so the shared block may be broader than needed.

Recommendation: split plan-update guidance into modes instead of a single boolean.

### 3. Epic update guidance mixes common mode and full-mode reference

Skills using `uses_epic_update: true` receive a common `--complete-child` command plus a directive to read `.ai-agents/scripts/epic-update.md` for all modes.

This has mixed fit:

- `mvt-update-plan` genuinely uses two specific modes, `--complete-child` and `--set-child-status`, and already renders both commands inline. It should not need to read the script doc for those two flows.
- `mvt-decompose` renders `--validate`, `--add-child`, and `--complete-child` examples inline. It may still need script docs for less common argument details, but most guidance is already local.
- `mvt-analyze` may need `--switch-active` and possibly `--add-child` in epic-child mode. Its current wording explicitly allows reading the script doc for full flag reference, which is reasonable if those modes remain under-specified inline.

Recommendation: make epic-update guidance mode-aware. Inline exact commands for modes a skill uses normally; allow `.ai-agents/scripts/epic-update.md` only for rare or unresolved modes.

### 4. Placeholder conflicts can confuse agents

The shared `plan-update` block uses `<new_status>`, while `mvt-implement` uses `<current_status>` in its actual deliverables handoff. Both are valid in their own context, but when rendered in the same skill they create two competing command templates.

Recommendation: avoid rendering a generic command when a skill-specific command is already authoritative.

### 5. Script document reads should become explicit fallback behavior

Current language says to read script `.md` files for optional flags or modes. This is correct as a safety rule but too eager for skills where flags/modes are already rendered inline.

Recommendation: change the default policy from "read docs for optional flags/modes" to "use rendered commands first; read script docs only when the workflow asks for a mode or flag not rendered in this skill."

## Skill Inventory

| Skill | Script usage found | Current issue | Recommendation |
|---|---|---|---|
| `mvt-cleanup` | `session-update.cjs` only | Extra Script Usage Rule restates State Update and generic non-session rule | Remove the section or suppress session-only rendering |
| `mvt-analyze` | `session-update.cjs`, `epic-update.cjs` | Epic-child mode may need `--switch-active`; doc fallback is still useful | Keep epic guidance, but narrow doc-read wording to unresolved modes only |
| `mvt-decompose` | `session-update.cjs`, `epic-update.cjs` | Inline examples already cover `--validate`, `--add-child`, `--complete-child`; shared complete-child block duplicates | Use inline-first epic mode; doc fallback only for non-rendered modes |
| `mvt-implement` | `session-update.cjs`, `plan-update.cjs` | Full deliverables command exists; shared minimal command and plan docs pointer add noise and possible placeholder conflict | Use plan-update `inline_command_only` mode |
| `mvt-sync-context` | `session-update.cjs`, `plan-update.cjs` | Only needs a reminder to pass `--projects`; shared command may be too broad | Use a compact `plan_project_reminder` mode or add concrete inline command if actual mutation flow is required |
| `mvt-update-plan` | `session-update.cjs`, `plan-update.cjs`, `epic-update.cjs` | Generic skill needs richer plan output semantics, but epic commands are already inline for used modes | Keep plan docs reference for output interpretation; make epic docs fallback conditional |

## Proposed Design

### A. Replace boolean script params with guidance modes

Current manifest params are booleans:

```yaml
uses_plan_update: true
uses_epic_update: true
uses_session_update: true
```

Proposed optional mode params:

```yaml
plan_update_guidance: none | generic_reference | inline_command_only | project_reminder
epic_update_guidance: none | generic_reference | inline_modes_only | fallback_for_unrendered_modes
session_update_guidance: none | state_update_only
```

Backward compatibility option: keep existing booleans and add optional mode params. If a mode is absent, `script-usage-rule.md` preserves current behavior.

### B. Refactor `sources/sections/script-usage-rule.md`

Proposed behavior:

- `session_update_guidance: state_update_only`: render nothing unless no State Update section is present.
- `plan_update_guidance: generic_reference`: render the current plan mutation rule and doc pointer. Use for `mvt-update-plan`.
- `plan_update_guidance: inline_command_only`: render only the invariant rule: do not hand-edit `plan.yaml`; use the concrete command rendered in this skill; do not read `.cjs`/`.js` source. Do not render the minimal command or `.md` pointer.
- `plan_update_guidance: project_reminder`: render only: when calling `plan-update.cjs` for a project-attributed plan, include `--projects`; read `plan-update.md` only if this skill needs a flag not rendered locally.
- `epic_update_guidance: fallback_for_unrendered_modes`: render the invariant rule and allow `epic-update.md` only for modes not already rendered in the skill.
- `epic_update_guidance: inline_modes_only`: render the invariant rule and say to use the exact mode commands shown in the workflow.

### C. Update selected manifests

Suggested assignments:

```yaml
mvt-cleanup:
  session_update_guidance: state_update_only
  # remove script-usage-rule section, or render nothing for session-only

mvt-implement:
  plan_update_guidance: inline_command_only

mvt-sync-context:
  plan_update_guidance: project_reminder

mvt-update-plan:
  plan_update_guidance: generic_reference
  epic_update_guidance: inline_modes_only

mvt-decompose:
  epic_update_guidance: fallback_for_unrendered_modes

mvt-analyze:
  epic_update_guidance: fallback_for_unrendered_modes
```

## Expected Benefits

### Token reduction

Estimated generated prompt savings are modest but meaningful because the repeated shared section appears in multiple skills:

- `mvt-cleanup`: remove or suppress roughly 35-50 words.
- `mvt-implement`: remove the generic plan command and optional-doc sentence, roughly 45-70 words, plus reduced ambiguity.
- `mvt-sync-context`: replace generic plan block with a targeted reminder, roughly 35-55 words.
- `mvt-update-plan`: reduce duplicate epic docs pointer wording, roughly 15-30 words.
- `mvt-decompose` / `mvt-analyze`: reduce eager doc-read wording, roughly 10-25 words each.

Total likely savings: about 150-250 generated words across `.claude/skills`, plus fewer downstream token costs from avoiding unnecessary `.ai-agents/scripts/*.md` reads during execution.

### Behavioral improvement

- Agents are less likely to read `.ai-agents/scripts/plan-update.md` during `mvt-implement` when the exact deliverables command is already present.
- Agents are less likely to choose the generic `--status <new_status>` command when a skill-specific command is authoritative.
- Script docs remain available as a fallback for genuinely unrendered flags or modes.
- Session update remains self-contained and does not regress into extra file reads.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Over-suppressing script docs where a skill needs output semantics | Agent may misinterpret script results | Keep `generic_reference` for `mvt-update-plan`; only suppress docs where commands are concrete |
| Mode params add assembly complexity | More branches in `script-usage-rule.md` | Keep mode set small; preserve boolean fallback behavior |
| Existing tests assume exact shared section text | Test failures after source changes | Add focused assembler tests for each guidance mode |
| Skills drift from script docs over time | Inline commands may become stale | Treat `.ai-agents/scripts/*.md` as authoritative for generic modes and add tests for rendered command fragments |

## Validation Plan

1. Add focused section-loader tests for:
   - session-only guidance suppresses Script Usage Rule content.
   - plan `inline_command_only` does not render minimal command or `.ai-agents/scripts/plan-update.md`.
   - plan `generic_reference` keeps the minimal command and docs pointer.
   - epic `inline_modes_only` does not render broad docs pointer.
2. Add assembler tests for representative skills:
   - `mvt-cleanup`
   - `mvt-implement`
   - `mvt-update-plan`
   - `mvt-decompose`
3. Run:

```bash
npx vitest run test/section-loader.test.ts test/assembler.test.ts
npm run build
npm test
```

4. Regenerate installed skill files and compare `.claude/skills/*/SKILL.md` for expected prompt reductions.

## Recommendation

Proceed with a small implementation pass that first introduces guidance modes while preserving existing boolean behavior. Then migrate only the six script-related skills listed above. This keeps the change low-risk and lets the generated prompt diff show exactly where token and behavior improvements occur.
