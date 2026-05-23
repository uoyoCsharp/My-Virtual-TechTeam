## Execution Flow

### Step 1: Scan Workspace State
- Read all files under `.ai-agents/workspace/artifacts/{change-id}/`
- Read `.ai-agents/workspace/session.yaml`
- Count total artifact files
- Estimate token footprint for each file (~characters / 4)

### Step 2: Identify Cleanup Candidates
- Apply cleanup rules to identify candidates
- Calculate current size and projected savings for each

### Step 3: Present Cleanup Plan
Show user what will be cleaned:

| Item | Current Size | Action | Result |
|------|-------------|--------|--------|
| {artifact} | ~{tokens} tokens | {action} | ~{reduced} tokens |
| **Total** | **{total}** | | **{new_total} ({savings} saved)** |

If `--dry-run` flag is set -> Stop here. Do not proceed.

### Step 4: Execute (after user confirmation)
- Summarize identified artifacts (keep key decisions, remove details)
- Update `session.yaml` to reflect cleanup
- Output summary of actions taken

### Step 5: (session update handled by shared section)
