## Active Change Conflict Preflight

Run this before generating a change id, loading epic-child scope, or writing `analysis.md`. If `active_change.id` is empty, continue normally. If the request continues the active work, reuse that id. If it is a different request, offer `Continue current change` / `Finalize current change` / `Abandon current change` / `Cancel`.

`Continue current change` reuses the active id. `Finalize current change` and `Abandon current change` write no artifact and direct the user to `/mvt-update-plan`; after that lifecycle transition, the user reruns `/mvt-analyze`. `Cancel` writes no artifact.

## Epic-Child Mode (Pre-check)

**When**: `active_epic.id` is non-empty AND `active_change.id` is empty.

In this state the user is starting a new sub-change within an existing epic. Read `epic.yaml` via `active_epic.epic_path` and determine the scenario:

| Scenario | User message | Handling |
|----------|-------------|----------|
| A | Empty | Select the `current_change` child. |
| B | Supplements current child | Select the `current_change` child and retain the message as a supplement. |
| C | Points to different child | Locate target in `children[]`. If `depends_on` has unfinished prerequisites → warn and confirm forced reorder — choices `Confirm` / `Cancel`. If deps satisfied → confirm switch with the same `Confirm` / `Cancel` choices. On confirmed reorder: call the Epic Update Script in `--switch-active` mode with `node .ai-agents/scripts/epic-update.cjs --epic <epic_path> --switch-active <target_id>`. If target not in `children[]` → offer to treat as independent change (exit epic-child mode) or use `--add-child` mode to append it as a new child. Read `.ai-agents/scripts/epic-update.md` only if a required mode or flag is not rendered here. Do NOT hand-edit `epic.yaml`, advance `current_change`, or read `.cjs`/`.js` source. |

After selecting a child, restore its requirement baseline with exactly:

```bash
node .ai-agents/scripts/requirement-source.cjs --effective-context <epic_path> --child <change_id>
```

Consume only the returned `child`, `context`, `sources`, and `warnings`; do not traverse requirement references independently.

- Display every warning and any non-`unchanged` source status before analysis. Source drift does not replace the captured baseline.
- Use ordered `context` as the baseline, or `child.scope` when `context` is empty; `child.scope` remains the delivery boundary.
- Treat the user's message as a conversation supplement. Append non-conflicting content after the baseline in `analysis.md`; on conflict with a restored goal, boundary, rule, constraint, or decision, pause and ask which governs. Never mutate the epic snapshot.
- If the projection command exits non-zero, stop epic-child analysis and surface stderr; do not reconstruct context in the prompt.

## Execution Flow

### Step 1: Load Requirements
- If file path provided as argument -> Read that file
- Otherwise -> Use requirements text from user message

### Step 2: Extract Information
- Identify features and functionality
- Identify actors and stakeholders
- Extract business rules and constraints
- Note assumptions made
- Preserve source warnings, restored context item IDs, and conversation supplements in the analysis so downstream phases can distinguish the established baseline from later additions.

### Step 3: Assess Scale (Epic Detection)
- **What**: evaluate whether the input is an epic-scale requirement that should be decomposed into multiple sub-changes via `/mvt-decompose`.
- **Signals**:

  | Signal type | Signal | Example |
  |-------------|--------|---------|
  | Strong | Whole system / platform scope | "Build an e-commerce system" |
  | Strong | Input is a multi-feature design manual | "Implement based on this design manual" |
  | Strong | Multiple independent deliverable capability domains | Auth + Catalog + Cart + Payment |
  | Weak (corroboration only) | Multiple actors with multiple independent main flows | -- |
  | Weak (corroboration only) | No single cohesive acceptance criterion | -- |

- **Trigger**: any strong signal, OR (strong + 2+ weak). Weak signals alone never trigger.

- **Branches**:

  | Condition | Action |
  |-----------|--------|
  | Epic detection hits | Confirm — choices `Yes` / `No` / `Show signals`: "This looks like an epic-level requirement (multiple independent capability domains). Use `/mvt-decompose` to decompose it first?" |
  | `Yes` | Do NOT write `analysis.md`. Guide to `/mvt-decompose`. |
  | `No` | Continue standard analysis (Steps 4-7). Cheap reversal path. |
  | `Show signals` | Display matched signals, re-prompt. |
  | Epic misses | Fall through to Step 4 (Quick Path Detection). |

- **Epic-child mode note**: When operating in epic-child mode (scenarios A or B from the pre-check), Step 3 should treat the selected child scope as the intended change boundary. Do not re-route to `/mvt-decompose` unless the user explicitly expands the request beyond that child or the scope is clearly still epic-scale (e.g., the child scope itself contains multiple independent capability domains that were not part of the original decomposition rationale).

### Step 4: Assess Complexity (Quick Path Detection)
- **What**: evaluate whether this requirement qualifies for the quick development path via `/mvt-quick-dev`, and if so, for which band.
- **How**: check each criterion in the table below. Breadth selects the preview band; breadth alone never fails the quick path.

  | Criterion | Assessment |
  |-----------|------------|
  | Scope | Estimate breadth only to select the preview band (Simple / Wide) |
  | No new concepts | A concern (new entity, contract, or module boundary) is structural: offer with a warning, do not refuse |
  | No architectural impact | A concern (ADR needed, layer misfit) is structural: offer with a warning, do not refuse |
  | Clear specification | Unresolved ambiguities route to standard analysis; resolved ones proceed |
  | No integration concerns | A concern (new dependency, cross-service change, async/event flow) is structural: offer with a warning, do not refuse |
  | Single actor | Multiple actors alone never fail the path; assess breadth and structural concerns as usual |

- **Worked Examples**:

  - **Example 1 (PASS — offer quick path, Simple band)**
    > "Increase the password reset email expiration from 30 minutes to 2 hours."
    - Scope: 1 config file ✓ (Simple band)
    - No new concepts ✓ (existing flow)
    - No architectural impact ✓
    - Clear specification ✓
    - No integration concerns ✓
    - Single actor ✓
    → Offer `/mvt-quick-dev` (Simple band).

  - **Example 2 (STRUCTURAL — offer quick path with waiver, or standard analysis)**
    > "Add SSO login via Google for our user portal."
    - Scope: ✓ breadth only selects the band (Wide: auth middleware, user model, login UI, OAuth callback handler, config)
    - No new concepts: structural concern — introduces external IdP and OAuth callback contract
    - No integration concerns: structural concern — new external dependency (Google IdP)
    → Offer `/mvt-quick-dev` with the structural warning, or proceed with standard analysis flow (Steps 5-7) per user choice.

- **Branches**:

  | Condition | Action |
  |-----------|--------|
  | No structural concerns | Confirm with the band text — choices `Yes` / `No` / `Show criteria` |
  | Structural concern | Offer the quick path with the structural warning, or continue standard analysis per user choice — choices `Quick-dev with waiver` / `Continue standard analysis` / `Show criteria` |
  | Ambiguous (2-3 criteria unclear) | Proceed with standard analysis; do NOT offer quick path |

  Band texts (no file counts except the Wide-band note, no bare "simple change" label for non-Simple bands):
  - Simple band: "This appears to be a clearly specified, reversible change (Simple band). Use /mvt-quick-dev for faster execution?"
  - Wide band: "This is a clearly specified, reversible change, but wider than 3 files (Wide band: plan preview plus confirmation). Use /mvt-quick-dev for faster execution?"
  - Structural concern: "This change touches <signal>. You may still use /mvt-quick-dev with an explicit waiver, or continue standard analysis."

- **On user choice**:
  - `Yes` -- Do NOT write an analysis artifact. Summarize the requirement understanding in conversation and recommend `/mvt-quick-dev` directly. Set `active_change` if one doesn't exist, so `/mvt-quick-dev` can reference the current work context.
  - `No` -- Continue with full analysis flow (Steps 5-7).
  - `Show criteria` -- Display the assessment results (pass/concern per criterion), then re-prompt with the same choices.
  - `Quick-dev with waiver` -- Same as `Yes`, noting the waived structural concern for the waiver trail.
  - `Continue standard analysis` -- Continue with full analysis flow (Steps 5-7).

### Step 5: Detect Ambiguities
- Check for unclear requirements
- Check for missing information
- Check for conflicting requirements

### Step 6: Generate Clarification Questions
- If ambiguities found -> List each with specific question, prioritized by impact
- If no ambiguities -> Skip this step

### Step 7: Update Workspace
1. Reuse `active_change.id` when Active Change Conflict Preflight selected `Continue current change`; otherwise generate change-id: `{YYYYMMDD}-{slug}` format (e.g., `20260425-user-authentication`). Slug constraints: lowercase ASCII, kebab-case, `[a-z0-9-]+`, 1-4 words.
2. Write artifact: `.ai-agents/workspace/artifacts/{change-id}/analysis.md`
