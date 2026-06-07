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

### Step 1: Load Context
Load these files as foundational context:
- `.ai-agents/workspace/project-context.yaml` -- Project index (structural info)
- `.ai-agents/registry.yaml` -- Available skills registry and knowledge declarations

Extended context for this skill:
- .ai-agents/workspace/artifacts/{active_change.id}/analysis.md -- Analysis from previous phase

### Step 2: Resolve Project Scope (PS)

Read `project-context.yaml > projects[]`.

**Single project** (`projects.length == 1`): Set PS = [sole project name]. Skip remaining PS steps.

**Multi-project** (`projects.length > 1`):

**Mode A -- Plan-driven** (active plan exists and skill operates on plan tasks):

1. **Plan signal**: PS = current task's `project` array from plan's `current_tasks`. Drop stale project names (not in `projects[]`), fall through.
2. **Path match**: Match current working paths against `projects[].path` and `source_paths`.
3. **Prompt**: If still unresolved, list candidates and ask user. Never silently load all projects.

**Mode B -- Non-plan** (no active plan or ad-hoc changes):

Defer PS to execution: identify change target, match against `projects[].path` and `source_paths`, load project-specific knowledge on demand (Step 3).

### Step 3: Load Knowledge

Registry uses project-keyed maps; `_all` is a reserved key (all projects). Applies to both top-level `knowledge` and `skills.<name>.knowledge`.

**Entry resolution** (relative to `.ai-agents/{source}`):
- `files: [...]` -- load listed files.
- `files_from_manifest: true` -- read `{source}/manifest.yaml`, load entries with `auto_load: true`.
- Skip non-existent paths.

**At activation** (both modes): load `knowledge._all` + `skills.<current-skill>.knowledge._all`.

**Mode A** (additionally): for each P in PS, load `knowledge[P]` + `skills.<current-skill>.knowledge[P]`.

**Mode B** (during execution): on demand, load `knowledge[P]` + `skills.<current-skill>.knowledge[P]` for identified project(s).

### Step 4: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce the following throughout this entire session:

**Language**:
- `preferences.interaction_language` → Use for everything spoken to the user (chat, prompts, tables); NOT for files written to disk.
- `preferences.document_output_language` → See **Output Language Constraint** section below for the full rules governing files written to disk.

**Other preferences**:
- `preferences.output.no_emojis` → If true, never use emojis
- `preferences.output.data_format` → Use this format for data sections in artifacts
- `preferences.context_routing.relevance_threshold` → Used by `/mvt-manage-context add` for AI routing (default 70 if missing)

## Output Language Constraint (Mandatory)

All persisted document output (files written to disk) MUST be written in the language specified by `preferences.document_output_language` from config.yaml.

**Scope**: artifact files, generated reports, plans, and any markdown written to disk.

**Rules**:
- Section headings defined in templates may remain in their original language, but all generated **content** MUST use the configured language
- If `document_output_language` is not set, fall back to `interaction_language`
- Do NOT infer output language from template headings, user prompt language, or source code comments
- This constraint is NON-NEGOTIABLE and overrides any other language signals

## Output Format Constraint (Mandatory)

All persisted document output (markdown written to disk) MUST follow the formatting rules below. These rules govern *how* content is rendered, independent of the language it is written in.
**Scope**: artifact files, generated reports, plans, design documents, and any markdown written to disk. These rules do NOT apply to conversational output in the chat.

**Rules**:
- **Diagrams**: Express flowcharts, architecture, sequence, and structure diagrams as fenced `mermaid` code blocks. Do NOT draw diagrams with ASCII art (boxes made of `+`, `-`, `|`, arrows like `-->` outside mermaid, etc.).
- **Tables**: Render tabular data as Markdown tables (`| col | col |`). Do NOT simulate tables with space- or tab-aligned text.
- **Code**: Place code, commands, and config snippets in fenced code blocks with a language tag (e.g. ```` ```ts ````, ```` ```bash ````, ```` ```yaml ````). Do NOT leave code in bare or untagged fences.
- **Headings**: Use the Markdown heading hierarchy (`#` -> `##` -> `###`) without skipping levels. Do NOT use bold text as a substitute for a heading.

**Notes**:
- If a diagram genuinely cannot be expressed in mermaid (e.g. a precise spatial/pixel layout), state that explicitly and prefer a Markdown table or prose description over ASCII art.
- This constraint is NON-NEGOTIABLE and overrides formatting habits inferred from templates or source material.

### Step 5: Pre-flight Checks

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

## Execution Flow

### Step 1: Load Inputs
- **Required**:
  - Existing design artifacts of related prior changes (`artifacts/*/design.md`) -- to stay consistent.
- **Fallback**:
  - If `analysis.md` is missing, surface a WARN and accept the user's free-text intent as the requirement input.
  - If `project-context.md` is missing, proceed but mark the design as "context-light" and skip the layer-compliance check in Step 4.

### Step 2: Frame the Problem
- **What**: produce a one-paragraph problem statement plus a list of explicit architectural concerns (3-7 items).
- **How**:
  1. From `analysis.md`, lift the goal, actors, and primary use cases.
  2. Derive concerns by scanning the requirements for: scalability, latency, consistency, security/auth, persistence, observability, deployment, integration with existing modules.
  3. Drop any concern that is not actually exercised by the requirements -- do not invent NFRs.
- **Output of this step**: a Concerns Table with columns `concern | source-of-evidence | priority(must/should/nice)`.

### Step 3: Choose Architecture Style
- **What**: select the smallest viable architecture style for this change. Escalate only when concerns force it.
- **How**: pick the row that matches the dominant concerns; multiple changes within the same project should normally pick the same style unless requirements force otherwise.

  | Style | Use when | Avoid when |
  |-------|----------|------------|
  | Plain CRUD / 3-layer | Single resource flow, no domain rules beyond validation | Complex business invariants, multi-step workflows |
  | Service-oriented within a module | Multiple use cases sharing entities, transactions across them | Cross-team boundaries, independent deployment needs |
  | Domain-driven (aggregates, domain services) | Rich business rules, invariants, multiple actors per workflow | Simple read-mostly resources |
  | Event-driven / async | Long-running flows, decoupled side-effects, retry/back-pressure | Strong synchronous contracts, immediate-consistency reads |
  | Multi-service / boundary split | Independent scaling or deployment, separate teams | Single team, single deployment pipeline -- DEFER |

- If the requirements suggest "multi-service" but project is currently single-service: STOP and ask user to confirm scope expansion before designing across services.

### Step 4: Design Module Structure
- **What**: list modules (new and modified), their responsibilities, owned entities, and interfaces.
- **How**:
  1. Map each Concern (Step 2) to one owning module.
  2. For every module, write: name, responsibility (one sentence), owned entities, public interface (function/class signatures or HTTP endpoints), dependencies on other modules.
  3. Validate dependency direction against `project-context.md` layer rules (e.g., domain -> infra forbidden). If violation found, redesign or flag it as an explicit ADR (Step 6).
  4. Use the existing module names from `project-context.md` whenever possible -- introduce a new module only when no existing one fits.
- **Branches**:

  | Condition | Action |
  |-----------|--------|
  | Layer-compliance check passes | Proceed |
  | Single layer violation, fix is local | Adjust module placement, document in change tracking |
  | Systemic violation (style mismatch with existing project) | STOP, raise ADR (Step 6) and ask user to confirm direction before continuing |

### Step 5: Define Data Flow
- **What**: for each primary use case, produce a sequence of module interactions.
- **How**:
  1. For each use case (from Step 2 / analysis.md), list the trigger, the modules involved, the call order, and the persistence/event boundaries.
  2. Render as a Mermaid `sequenceDiagram` if there are >= 3 participants OR there are async/event hops; otherwise a numbered list is fine.
  3. Mark transactional boundaries explicitly (`-- transaction begin/end`).
  4. Identify error paths for each flow: what happens if step N fails? Document fallback behavior (retry, compensating action, user-visible error).

### Step 6: Document Decisions (ADRs)
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
  - Choice of architecture style (Step 3) when more than one row was viable.
  - Any layer-rule violation accepted as a deliberate exception.
  - Introduction of a new external dependency (DB, queue, library category).
  - Breaking change to an existing public interface.

### Step 7: User Confirmation Before Write
- **When to confirm before writing the artifact**:
  - Step 3 escalated to multi-service.
  - Step 4 raised a systemic layer violation.
  - Step 6 contains any ADR with `status: proposed` for a breaking change.
  - The design adds a new external dependency.
- **When to write silently**:
  - Single-module addition that fits existing layers, no ADR escalations, no breaking change.
- **Confirmation format**: present a one-screen summary -- style chosen, modules added/changed, ADRs requiring review, a single yes/no prompt. Do not dump the full artifact.

### Step 8: Write Artifact
- **Path and template**: as defined in the **Artifact Structure** section below.
- **Required sections** (filled per template headings, but content must include):
  - `Overview` -- the problem statement (Step 2).
  - `Architecture Decision Records` -- every ADR from Step 6.
  - `Module Design` -- table of modules from Step 4.
  - `Key Interfaces` -- explicit signatures/endpoints.
  - `Data Flow` -- sequences from Step 5, including error paths.
  - `File Structure` -- mapping of modules to file/directory paths in this repo.
  - `Implementation Guidelines` -- ordering hints for `/mvt-implement` and `/mvt-plan-dev`.
  - `Change Tracking` -- list of files expected to be created/modified/deleted.
- Do NOT modify `project-context.yaml` or `project-context.md` here.

### Step 9: Suggest Plan Decomposition
- If `Change Tracking` lists more than ~5 files OR Module Design adds more than 1 new module OR ADRs include any breaking change, recommend `/mvt-plan-dev` as the next step.
- Otherwise recommend `/mvt-implement` directly.

### Step 10: State Update
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
The template defines section headings only. Generate content for each section based on design results.
Write the artifact to: `.ai-agents/workspace/artifacts/{change-id}/design.md`

## State Update

After completing the skill's main task, run the session update script **exactly once** with the following arguments:

```bash
node .ai-agents/scripts/session-update.cjs --skill <skill_command_name> --summary "<concise one-line summary>"
```

If the script exits with code 0, the state update was applied successfully; there is no need to read or verify the session file.

### Argument values

| Argument | Value source | Example |
|----------|-------------|---------|
| `--skill` | The exact skill command name without the leading `/` | `mvt-design` |
| `--summary` | A concise one-line description of what this invocation accomplished, in the configured `interaction_language` | `"Identified auth requirements and created change chg-001"` |

### Failure handling

If the script fails (non-zero exit), do NOT abort the skill's main task. Continue execution and add a brief note at the end of your response that the session could not be updated.

## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`mvt-design`) and the current project state.

### Conditional Recommendations

Match the current state to one of the conditions below. If none match, use `default`.

- **`design complete, change tracking lists >5 files or >1 new module`** → `/mvt-plan-dev` -- Create a structured implementation plan
- **`design complete, small scope`** → `/mvt-implement` -- Implement the designed architecture
- **`design has proposed ADRs needing stakeholder review`** → `/mvt-review` -- Review the design decisions

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
