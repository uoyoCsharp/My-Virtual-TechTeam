# #cleanup Command

> Load this file when `#cleanup` command is invoked.

---

## Purpose
Clean up workspace artifacts, summarize old changes, and maintain workspace health.

## Usage
- `#cleanup` - Interactive cleanup (review items before action)
- `#cleanup --dry-run` - Show what would be cleaned without taking action

## Prerequisites Check

| Check | Condition | On Failure |
|-------|-----------|------------|
| Project initialized | `workspace/session.yaml` exists | Suggest `#init` |

## Execution Flow

### Step 1: Scan Workspace State
- READ all files under `workspace/artifacts/{change-id}/` (scan all change-id directories)
- READ `workspace/session.yaml`
- COUNT total artifact files and estimate token footprint

### Step 2: Identify Cleanup Candidates
Apply the following rules:

| Category | Rule | Action |
|----------|------|--------|
| Completed changes | Change with `status: completed` and older than current task | Summarize → archive |
| Orphaned artifacts | Files in `artifacts/` not referenced by any active change | List for user review |
| Stale session data | Session history entries older than 5 phases ago | Summarize into single entry |

### Step 3: Present Cleanup Plan
Show user what will be cleaned:

| Item | Current Size | Action | Result |
|------|-------------|--------|--------|
| {artifact} | ~{tokens} tokens | Summarize | ~{reduced} tokens |
| ... | ... | ... | ... |
| **Total** | **{total}** | | **{new_total} ({savings} saved)** |

If `--dry-run` flag is set, stop here. Do not proceed to Step 4.

### Step 4: Execute (after user confirmation)
- Summarize identified artifacts (keep key decisions, remove implementation details)
- Update `session.yaml` to reflect cleanup
- Output summary of actions taken

## Output Format
Cleanup summary with before/after token estimates.

---

## Example

```
User: #cleanup

[Conductor Mode]

## Workspace Cleanup

### Cleanup Candidates
| Item | Current Size | Action | Result |
|------|-------------|--------|--------|
| 20260301-user-auth (completed) | ~2500 tokens | Summarize | ~400 tokens |
| 20260305-order-module (completed) | ~1800 tokens | Summarize | ~300 tokens |
| Orphaned: draft-notes.md | ~600 tokens | Remove | 0 tokens |
| **Total** | **~4900 tokens** | | **~700 tokens (4200 saved)** |

Proceed with cleanup? [Y/n]

User: Y

Cleanup complete:
- 2 changes summarized and archived
- 1 orphaned artifact removed
- Token footprint reduced by ~4200 tokens

---
**Suggested Next Steps**:
- `#status` to verify workspace state
```
