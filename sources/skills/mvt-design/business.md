## Execution Flow

### Step 1: Load Inputs
- **Required**:
  - `.ai-agents/workspace/artifacts/{active_change.id}/analysis.md` -- output of `/mvt-analyze` for the current change.
  - `.ai-agents/workspace/project-context.yaml` -- tech stack and project layout.
- **Recommended**:
  - `.ai-agents/knowledge/project/_generated/project-context.md` -- existing module map, layer rules, business rules.
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
- **Path**: `.ai-agents/workspace/artifacts/{active_change.id}/design.md`.
- **Template**: `.ai-agents/skills/_templates/design-output.md`; if `_templates/custom/design-output.md` exists, use the custom version.
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

### Step 10: (session update handled by shared section)

## Variants
- `/mvt-design --plan` flag: skip Step 5 (data flow detail) and Step 6 (full ADR fields). In `--plan` mode, ADRs collapse to a one-line `decision: <text>`. Step 8 still writes `design.md` but with the abbreviated content. The output is a high-level plan, not an implementation-ready blueprint -- mark the artifact with a top-line `Mode: plan` indicator.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| `analysis.md` missing entirely | Proceed with user's free-text intent; mark artifact with "Source: conversation only"; recommend `/mvt-analyze` as a follow-up |
| Requirements are mutually contradictory | STOP at Step 2; surface contradictions; do not invent a resolution |
| User wants to skip ADRs ("just write the design") | Refuse silently-skipping; produce minimal one-line ADRs (Step 6 abbreviated form) but never zero |
| Design directly contradicts an existing accepted ADR | Treat as superseding; new ADR must reference and `supersedes:` the old one |
| `--plan` mode but request is actually small (1 file) | Downgrade to a 5-line summary in chat, do NOT write `design.md` |
| User aborts at Step 7 confirmation | Do not write artifact; keep a conversation-only summary |
