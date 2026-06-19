## Epic-Child Mode (Pre-check)

**When**: `active_epic.id` is non-empty AND `active_change.id` is empty.

In this state the user is starting a new sub-change within an existing epic. Read `epic.yaml` via `active_epic.epic_path` and determine the scenario:

| Scenario | User message | Handling |
|----------|-------------|----------|
| A | Empty | Auto-use `current_change` child's scope from `epic.yaml` as the requirement input. Proceed to Step 3. |
| B | Supplements current child | Merge user message with `current_change` child's scope. Proceed to Step 3. |
| C | Points to different child | Locate target in `children[]`. If `depends_on` has unfinished prerequisites → warn and ask to confirm forced reorder (y/n). If deps satisfied → confirm switch (y/n). On confirmed reorder: call the Epic Update Script in `--switch-active` mode (see the **Script Usage Rule** section for the command template, or read `.ai-agents/scripts/epic-update.md` for full flag reference): `node .ai-agents/scripts/epic-update.cjs --epic <epic_path> --switch-active <target_id>`. If target not in `children[]` → offer to treat as independent change (exit epic-child mode) or use `--add-child` mode to append it as a new child. |

## Execution Flow

### Step 1: Load Requirements
- If file path provided as argument -> Read that file
- Otherwise -> Use requirements text from user message

### Step 2: Extract Information
- Identify features and functionality
- Identify actors and stakeholders
- Extract business rules and constraints
- Note assumptions made

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
  | Epic detection hits | Ask: "This looks like an epic-level requirement (multiple independent capability domains). Use `/mvt-decompose` to decompose it first? (y / n / show-signals)" |
  | `y` | Do NOT write `analysis.md`. Guide to `/mvt-decompose`. |
  | `n` | Continue standard analysis (Steps 4-7). Cheap reversal path. |
  | `show-signals` | Display matched signals, re-prompt. |
  | Epic misses | Fall through to Step 4 (Quick Path Detection). |

- **Epic-child mode note**: When operating in epic-child mode (scenarios A or B from the pre-check), Step 3 should treat the selected child scope as the intended change boundary. Do not re-route to `/mvt-decompose` unless the user explicitly expands the request beyond that child or the scope is clearly still epic-scale (e.g., the child scope itself contains multiple independent capability domains that were not part of the original decomposition rationale).

### Step 4: Assess Complexity (Quick Path Detection)
- **What**: evaluate whether this requirement qualifies as a simple change suitable for the quick development path via `/mvt-quick-dev`.
- **How**: check each criterion in the table below. ALL criteria must pass for the quick path to be offered.

  | Criterion | Pass condition |
  |-----------|----------------|
  | Scope | Affects ≤ 3 files (estimate from the requirement's mention of modules/features) |
  | No new concepts | No new domain entities, no new API contracts, no new module boundaries |
  | No architectural impact | No ADR needed; fits existing module/layer structure |
  | Clear specification | No ambiguities detected in Step 2 (or all ambiguities resolved by user confirmation) |
  | No integration concerns | No new external dependencies, no cross-service changes, no async/event flows |
  | Single actor | Only one user role or system actor involved |

- **Worked Examples**:

  - **Example 1 (PASS — offer quick path)**
    > "Increase the password reset email expiration from 30 minutes to 2 hours."
    - Scope: 1 config file ✓
    - No new concepts ✓ (existing flow)
    - No architectural impact ✓
    - Clear specification ✓
    - No integration concerns ✓
    - Single actor ✓
    → Offer `/mvt-quick-dev`.

  - **Example 2 (FAIL — proceed with standard analysis)**
    > "Add SSO login via Google for our user portal."
    - Scope: ✗ touches auth middleware, user model, login UI, OAuth callback handler, config (5+ files)
    - No new concepts: ✗ introduces external IdP and OAuth callback contract
    - No integration concerns: ✗ new external dependency (Google IdP)
    → Proceed with standard analysis flow (Steps 5-7).

- **Branches**:

  | Condition | Action |
  |-----------|--------|
  | ALL criteria pass | Ask user: "This appears to be a simple change (1-3 files, no architectural impact). Use /mvt-quick-dev for faster execution? (y / n / show-criteria)" |
  | ANY criterion fails | Proceed with standard analysis flow (Steps 5-7) |
  | Ambiguous (2-3 criteria unclear) | Proceed with standard analysis; do NOT offer quick path |

- **On user choice**:
  - "y" -- Do NOT write an analysis artifact. Summarize the requirement understanding in conversation and recommend `/mvt-quick-dev` directly. Set `active_change` if one doesn't exist, so `/mvt-quick-dev` can reference the current work context.
  - "n" -- Continue with full analysis flow (Steps 5-7).
  - "show-criteria" -- Display the assessment results (pass/fail per criterion), then re-prompt with y/n.

### Step 5: Detect Ambiguities
- Check for unclear requirements
- Check for missing information
- Check for conflicting requirements

### Step 6: Generate Clarification Questions
- If ambiguities found -> List each with specific question, prioritized by impact
- If no ambiguities -> Skip this step

### Step 7: Update Workspace
1. Generate change-id: `{YYYYMMDD}-{slug}` format (e.g., `20260425-user-authentication`). Slug constraints: lowercase ASCII, kebab-case, `[a-z0-9-]+`, 1-4 words.
2. Write artifact: `.ai-agents/workspace/artifacts/{change-id}/analysis.md`
