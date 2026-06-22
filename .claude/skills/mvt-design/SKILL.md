---
name: 'mvt-design'
description: 'Create architecture design based on analyzed requirements. This skill should be used when user wants to design system architecture, define module structure, or create technical blueprints for implementation.'
---

# MVT Design

## Purpose

Design system architecture based on analyzed requirements. Create technical blueprints that guide implementation, respecting existing project structure and constraints.

## Role

You are the **Architect** -- a System Architecture Expert.

### Decision Rules
- Multiple valid approaches exist -> Present top 2-3 options with pros/cons table, recommend one
- Trade-off affects performance vs maintainability -> Document as ADR, state the trade-off
- User asks for technology choice -> Evaluate against: requirements fit, team familiarity, maintenance cost
- Design needs breaking change -> Highlight impact scope, list affected files, propose migration
- Requirements are ambiguous -> Stop and ask clarification before designing
- Layer constraint violation in design -> Flag and suggest alternative that respects existing boundaries

### Boundaries
- Do NOT write implementation code (use `/mvt-implement` instead)
- Do NOT re-analyze requirements (use `/mvt-analyze` instead)
- Do NOT review code (use `/mvt-review` instead)

## Variants

| Variant | Description |
|---------|-------------|
| `/mvt-design` | Full architecture design |
| `/mvt-design --plan` | High-level implementation plan only: skip Step 5 (data flow detail) and Step 6 (full ADR fields). ADRs collapse to one-line `decision: <text>`. Step 8 writes `design.md` with abbreviated content and a top-line `Mode: plan` indicator. If the request is actually small (1 file), downgrade to a 5-line summary in chat and do NOT write `design.md`. |

## Activation Protocol

### Stage 1: Load Context
Load foundational context:
- `.ai-agents/workspace/project-context.yaml` -- Project index (structural info)
- `.ai-agents/registry.yaml` -- Available skills registry and knowledge declarations

Extended context for this skill:
- .ai-agents/workspace/artifacts/{active_change.id}/analysis.md -- Analysis from previous phase

### Stage 2: Resolve Project Scope (PS)

Read `project-context.yaml > projects[]`.

**Single project** (`projects.length == 1`): PS = [sole project name]; skip the rest of this step.

**Multi-project** (`projects.length > 1`):
**Mode A -- Plan-driven** (active plan exists and skill operates on plan tasks):
1. **Plan signal**: PS = current task `project` values from plan `current_tasks`; drop names absent from `projects[]`.
2. **Path match**: Match current paths against `projects[].path` and `source_paths`.
3. **Prompt**: If unresolved, list candidates and ask user. Never silently load all projects.

**Mode B -- Non-plan** (no active plan or ad-hoc changes):
Defer PS to execution: identify change target, match against `projects[].path` and `source_paths`, load project-specific knowledge on demand (Stage 3).

### Stage 3: Load Knowledge

Registry knowledge maps are project-keyed; `_all` is reserved for all projects. This applies to top-level `knowledge` and `skills.<name>.knowledge`.

**Knowledge Loading Protocol**:
For each registry knowledge entry:
1. Read its `source` field, e.g. `knowledge/project/_generated/`.
2. Base dir = `.ai-agents/` + `source`, e.g. `.ai-agents/knowledge/project/_generated/`.
3. Load `files` entries from that base dir; if `files_from_manifest: true`, read `manifest.yaml` there and load entries with `auto_load: true`.
4. **Skip non-existent paths** silently (do not error or warn).

Example: `source: knowledge/project/_generated/` + `files: [project-context.md]` resolves to `.ai-agents/knowledge/project/_generated/project-context.md`.

**Anti-pattern -- DO NOT**:
- Guess or hardcode base directories (e.g., `.ai-agents/workspace/`).
- Assume a default path structure. The `source` field value is the authoritative path component.

**At activation** (both modes): load `knowledge._all` + `skills.<current-skill>.knowledge._all`.
**Mode A** (additionally): for each P in PS, load `knowledge[P]` + `skills.<current-skill>.knowledge[P]`.
**Mode B** (during execution): on demand, load `knowledge[P]` + `skills.<current-skill>.knowledge[P]` for identified project(s).

### Stage 4: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce it for the whole session:

- `preferences.interaction_language`: language for chat, prompts, status lines, tables, and summaries.
- `preferences.document_output_language`: language for files written to disk.
- `preferences.output.no_emojis`: if true, never use emojis.
- `preferences.output.data_format`: format for artifact data sections.
- `preferences.context_routing.relevance_threshold`: AI routing threshold for `/mvt-manage-context add` (default 70).

### Stage 5: Pre-flight Checks

For each check below, if the condition holds, perform the action implied by its **Level**:

- **WARN** -- emit the message, then ask "Continue anyway? (y/n)". Default to **y** if the user does not respond.
- **BLOCK** -- emit the message and stop. Do not proceed until the prerequisite is satisfied.
- **REQUIRED** -- same as BLOCK; the prerequisite is mandatory.
- **INFO** -- emit the message and proceed; no confirmation needed.

| # | Condition | Level | Message |
|---|-----------|-------|---------|
| 1 | `session.initialized_at` is empty | BLOCK | Session not initialized. Run `/mvt-init` first. |
| 2 | `projects[] in project-context.yaml` is empty | BLOCK | Project not initialized. Run `/mvt-init` first. |
| 3 | `project-context.md` is empty | WARN | No project-context.md found. Run `/mvt-analyze-code` for better design context. (allow user to proceed) |
| 4 | `requirements in project-context.md` is empty | WARN | No requirements found. Run `/mvt-analyze` first. (allow user to proceed) |

## Language Constraint (Mandatory)

This governs **all language output**. It is NON-NEGOTIABLE and overrides user prompt language, source text, templates, comments, and tool output.

### Interactive Output (spoken to the user)

Use `preferences.interaction_language` for every chat reply, question, prompt, status line, table, and summary. Re-assert it every turn, including long sessions. If absent, use `en-US`. Only an explicit user request to switch language overrides it.

### Persisted Document Output (files written to disk)

Use `preferences.document_output_language` for artifact files, generated reports, plans, and markdown written to disk. If absent, fall back to `interaction_language`. Template headings may keep their original language; generated content must use the configured language.

## Output Format Constraint (Mandatory)

Persisted markdown output MUST follow these rendering rules. Scope: artifact files, generated reports, plans, design documents, and any markdown written to disk. Chat output is out of scope.

**Rules**:
- **Diagrams**: Use fenced `mermaid` blocks for flowcharts, architecture, sequence, and structure diagrams. If mermaid cannot express the layout, say so and use prose or a Markdown table. Never use ASCII art.
- **Tables**: Use Markdown tables (`| col | col |`), not aligned spaces or tabs.
- **Code**: Use fenced blocks with language tags for code, commands, and config snippets.
- **Headings**: Use Markdown heading hierarchy (`#` -> `##` -> `###`) without skipping levels; do not replace headings with bold text.

This constraint is NON-NEGOTIABLE and overrides formatting habits inferred from templates or source material.

## Execution Flow

### Step 1: Load Inputs
- **Required**:
  - Existing design artifacts of related prior changes (`artifacts/*/design.md`) -- to stay consistent.
- **Fallback**:
  - If `analysis.md` is missing, surface a WARN and accept the user's free-text intent as the requirement input.
  - If `project-context.md` is missing, proceed but mark the design as "context-light" and skip the layer-compliance check in Step 3.

### Step 2: Frame the Problem
- **What**: produce a one-paragraph problem statement plus a list of explicit architectural concerns (3-7 items).
- **How**:
  1. From `analysis.md`, lift the goal, actors, and primary use cases.
  2. Derive concerns by scanning the requirements for: scalability, latency, consistency, security/auth, persistence, observability, deployment, integration with existing modules.
  3. Drop any concern that is not actually exercised by the requirements -- do not invent NFRs.
- **Output of this step**: a Concerns Table with columns `concern | source-of-evidence | priority(must/should/nice)`.

### Step 3: Design Module Structure
- **What**: list modules (new and modified), their responsibilities, owned entities, and interfaces.
- **How**:
  1. Follow existing project architecture first: `project-context.md`, accepted ADRs, framework constraints, and domain rules override the examples below.
  2. Start simple. Add a boundary, abstraction, async flow, dependency, or new module only when a must/should concern requires it.
  3. For each must/should Concern (Step 2), choose the smallest response that satisfies it. Use the table as examples, not a closed list; if no row fits, derive a response from the concern itself.

     | Concern signal (example) | Smallest architectural response | Module consequence |
     |---------------------------|----------------------------------|--------------------|
     | Simple data lifecycle | CRUD-oriented service/repository shape | Resource module with validation and persistence boundary |
     | Rich business invariant | Domain model or aggregate boundary | Entity or aggregate module owns invariant enforcement |
     | Shared multi-step workflow | Application service or use-case coordinator | Workflow module coordinates existing modules |
     | Async side effect or retry need | Event handler or queue boundary | Producer/consumer or handler module; mark event boundary |
     | Independent deployment, scaling, or team ownership | Service boundary candidate | STOP if it implies a new deployable service, runtime, or cross-service contract |

  4. Output the concern mapping as `concern | response | owning module | boundary impact`.
  5. For every module, write: name, responsibility (one sentence), owned entities, public interface (function/class signatures or HTTP endpoints), dependencies on other modules.
  6. Reuse existing module names from `project-context.md` whenever possible. Add a new module only when no existing module fits.
  7. Validate dependency direction against `project-context.md` layer rules (e.g., domain -> infra forbidden). If violation found, redesign or flag it as an explicit ADR (Step 5).
- **Branches**:

  | Condition | Action |
  |-----------|--------|
  | Layer-compliance check passes | Proceed |
  | Single layer violation, fix is local | Adjust module placement, document in change tracking |
  | Architectural response implies a new deployable service, runtime, or cross-service contract | STOP, ask user to confirm scope expansion before designing across boundaries |
  | Systemic violation (mismatch with existing project architecture) | STOP, raise ADR (Step 5) and ask user to confirm direction before continuing |

### Step 4: Define Data Flow
- **What**: for each primary use case, produce a sequence of module interactions.
- **How**:
  1. For each use case (from Step 2 / analysis.md), list the trigger, the modules involved, the call order, and the persistence/event boundaries.
  2. Render as a Mermaid `sequenceDiagram` if there are >= 3 participants OR there are async/event hops; otherwise a numbered list is fine.
  3. Mark transactional boundaries explicitly (`-- transaction begin/end`).
  4. Identify error paths for each flow: what happens if step N fails? Document fallback behavior (retry, compensating action, user-visible error).

### Step 5: Document Decisions (ADRs)
- **What**: capture every non-obvious choice as an Architecture Decision Record.
- **How**: write one ADR per decision with these fields:

  | Field | Required content |
  |-------|------------------|
  | Title | Short imperative ("Use event sourcing for orders") |
  | Status | proposed / accepted / superseded |
  | Context | What concerns + constraints forced this decision (cite Step 2/3) |
  | Decision | The chosen option, stated unambiguously |
  | Alternatives | At least 1 rejected option, with the rejection reason |
  | Consequences | Positive and negative impacts; which downstream skills/modules pay the cost |

- Decisions that MUST be ADRs (do not skip):
  - Any architectural response that changes module boundaries, deployment/runtime boundaries, persistence boundaries, async/event boundaries, or public contracts.
  - Any layer-rule violation accepted as a deliberate exception.
  - Introduction of a new external dependency (DB, queue, library category).
  - Breaking change to an existing public interface.

### Step 6: User Confirmation Before Write
- **When to confirm before writing the artifact**:
  - Step 3 identified a new deployable service, runtime, or cross-service contract.
  - Step 3 raised a systemic layer violation.
  - Step 5 contains any ADR with `status: proposed` for a breaking change.
  - The design adds a new external dependency.
- **When to write silently**:
  - Single-module addition that fits existing layers, no ADR escalations, no breaking change.
- **Confirmation format**: present a one-screen summary -- module boundary changes, deployment/runtime boundary changes, ADRs requiring review, external dependencies, and a single yes/no prompt. Do not dump the full artifact.

### Step 7: Write Artifact
- **Path and template**: as defined in the **Artifact Structure** section below. Follow the HTML comments in the template for what each section should contain; strip comments from the final artifact.
- **Required coverage**: cover only content that is applicable to this design. Preserve enough information for downstream skills to understand the problem, decisions made, module/interface/data-flow impacts, expected file changes, and implementation guidance. Do not create empty or artificial sections just because an item is named here; if the template omits or renames a section, place applicable content in the closest relevant section.
- Do NOT modify `project-context.yaml` or `project-context.md` here.

### Step 8: Suggest Plan Decomposition
- If `Change Tracking` lists more than ~5 files OR Module Design adds more than 1 new module OR ADRs include any breaking change, recommend `/mvt-plan-dev` as the next step.
- Otherwise recommend `/mvt-implement` directly.

### Step 9: State Update
Apply the State Update rules defined in the **State Update** section below.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| `analysis.md` missing entirely | Proceed with user's free-text intent; mark artifact with "Source: conversation only"; recommend `/mvt-analyze` as a follow-up |
| Requirements are mutually contradictory | STOP at Step 2; surface contradictions; do not invent a resolution |
| User wants to skip ADRs ("just write the design") | Refuse silently-skipping; produce minimal one-line ADRs (Step 6 abbreviated form) but never zero |
| Design directly contradicts an existing accepted ADR | Treat as superseding; new ADR must reference and `supersedes:` the old one |
| `--plan` mode but request is actually small (1 file) | Downgrade to a 5-line summary in chat, do NOT write `design.md` |
| User aborts at Step 7 confirmation | Do not write artifact; keep a conversation-only summary |

## Artifact Structure
Read the document structure template from: `.ai-agents/skills/_templates/design-output.md`
If a custom version exists at `.ai-agents/skills/_templates/custom/design-output.md`, use the custom version instead.
The template defines section structure and guidance comments. Generate applicable content based on design results.
Write the artifact to: `.ai-agents/workspace/artifacts/{change-id}/design.md`

## State Update

After the skill's main task, run the session update script **exactly once**:

```bash
node .ai-agents/scripts/session-update.cjs --skill mvt-design --summary "<concise one-line summary>"
```

Write `--summary` as one concise line in the configured `interaction_language`.

### Critical flag semantics

- Use only the flags rendered in the command above; do not invent extra session-update flags.

If the script exits with code 0, the state update was applied successfully; do not read or verify the session file.

### Failure handling

If the script fails (non-zero exit), do NOT abort the skill's main task. Continue execution and add a brief note at the end of your response that the session could not be updated.

## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`mvt-design`) and the current project state.
**Candidate set constraint (mandatory)**: Only recommend skills that are declared under `skills` in `.ai-agents/registry.yaml`.

### Conditional Recommendations

Match the current state to one of the conditions below. If none match, use `default`.

- **`design complete, change tracking lists >5 files or >1 new module`** → `/mvt-plan-dev` -- Create a structured implementation plan
- **`design complete, small scope`** → `/mvt-implement` -- Implement the designed architecture
- **`design has proposed ADRs needing stakeholder review`** → `/mvt-review` -- Review the design decisions

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
