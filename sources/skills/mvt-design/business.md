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
- **Path and template**: as defined in the **Artifact Structure** section below.
- **Required sections** (filled per template headings, but content must include):
  - `Overview` -- the problem statement (Step 2).
  - `Architecture Decision Records` -- every ADR from Step 5.
  - `Module Design` -- table of modules from Step 3.
  - `Key Interfaces` -- explicit signatures/endpoints.
  - `Data Flow` -- sequences from Step 4, including error paths.
  - `File Structure` -- mapping of modules to file/directory paths in this repo.
  - `Implementation Guidelines` -- ordering hints for `/mvt-implement` and `/mvt-plan-dev`.
  - `Change Tracking` -- list of files expected to be created/modified/deleted.
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
