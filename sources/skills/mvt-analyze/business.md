## Execution Flow

### Step 1: Load Requirements
- If file path provided as argument -> Read that file
- Otherwise -> Use requirements text from user message

### Step 2: Extract Information
- Identify features and functionality
- Identify actors and stakeholders
- Extract business rules and constraints
- Note assumptions made

### Step 3: Assess Complexity (Quick Path Detection)
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
    → Proceed with standard analysis flow (Steps 4-6).

- **Branches**:

  | Condition | Action |
  |-----------|--------|
  | ALL criteria pass | Ask user: "This appears to be a simple change (1-3 files, no architectural impact). Use /mvt-quick-dev for faster execution? (y / n / show-criteria)" |
  | ANY criterion fails | Proceed with standard analysis flow (Steps 4-6) |
  | Ambiguous (2-3 criteria unclear) | Proceed with standard analysis; do NOT offer quick path |

- **On user choice**:
  - "y" -- Do NOT write an analysis artifact. Summarize the requirement understanding in conversation and recommend `/mvt-quick-dev` directly. Set `active_change` if one doesn't exist, so `/mvt-quick-dev` can reference the current work context.
  - "n" -- Continue with full analysis flow (Steps 4-6).
  - "show-criteria" -- Display the assessment results (pass/fail per criterion), then re-prompt with y/n.

### Step 4: Detect Ambiguities
- Check for unclear requirements
- Check for missing information
- Check for conflicting requirements

### Step 5: Generate Clarification Questions
- If ambiguities found -> List each with specific question, prioritized by impact
- If no ambiguities -> Skip this step

### Step 6: Update Workspace
1. Generate change-id: `{YYYYMMDD}-{slug}` format (e.g., `20260425-user-authentication`)
2. Write artifact: `.ai-agents/workspace/artifacts/{change-id}/analysis.md`
