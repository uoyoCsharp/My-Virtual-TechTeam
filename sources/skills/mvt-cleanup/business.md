## Execution Flow

### Step 1: Load Inputs
- **Fallback**: if `session.yaml` is missing, refuse to clean -- without state we can't tell what is in-progress vs completed; recommend `/mvt-init` and stop.

### Step 2: Inventory Artifacts
- **What**: produce a per-change-id inventory with size and last-modified data.
- **How**:
  1. Walk `.ai-agents/workspace/artifacts/` and group files by their parent change-id directory.
  2. For each file: characters, estimated tokens (`chars / 4`), last-modified (mtime).
  3. For each change-id directory, sum tokens and file count.
  4. Mark each change-id as `active | in-recent-changes | unindexed | legacy-pattern`:
     - `active` if it matches `session.active_change.id`.
     - `in-recent-changes` if it appears in `session.changes[]` (any status).
     - `unindexed` if neither condition holds and it sits under `artifacts/`.
     - `legacy-pattern` if the directory is `knowledge/patterns/` or matches other legacy markers.

### Step 3: Apply Cleanup Rules
- **What**: compute Cleanup Candidates from the inventory.
- **How**: run the rules table (defined in the shared section above) plus the additions below. A single change-id may match multiple rows; collect all proposed actions.

  | Source | Rule | Proposed action |
  |--------|------|-----------------|
  | `changes[]` entry with `status: done` AND any task in plan is older than the active change's start | Summarize: collapse multi-file artifacts into a single `summary.md`, keep the plan.yaml verbatim, archive the rest under `artifacts/{id}/_archive/` |
  | Change-id directory marked `unindexed` | List for user review (do NOT auto-archive -- could be in-flight work the user just hasn't registered) |
  | `history` entries beyond the most recent N (from `config.yaml > preferences.history_limits.history`, default 20) | Truncate via `session-update.cjs --truncate-history <N>` |
  | Directory `knowledge/patterns/` exists | Flag for deletion (legacy pattern data; no replacement) |
  | Empty change-id directories (zero files inside) | Propose deletion of the directory itself |

- For each candidate, compute: `current size (tokens)` -> `projected size (tokens)`, expected savings.

### Step 4: Present Cleanup Plan
- Render the plan as a table:

  | Item | Category | Current Size | Action | Result |
  |------|----------|-------------|--------|--------|
  | {change-id or path} | {completed | unindexed | stale-history | legacy} | ~{tokens} | {summarize | archive | review-only | delete} | ~{reduced tokens} |
  | **Total** | | **{total}** | | **{new_total} ({savings} saved)** |

- Below the table, list any items marked `review-only` (unindexed) with a one-line note: user must decide manually.
- If `--dry-run` is set, STOP here. Print "(dry run -- no changes applied)" and exit cleanly.

### Step 5: Confirm Before Destructive Steps
- **Always require confirmation** if the plan includes any of:
  - File deletion (legacy patterns, empty dirs).
  - `summarize` action (collapses multi-file content).
  - `archive` action (moves files into `_archive/`).
- Confirmation format: a single prompt `Apply cleanup plan? (y / n / show-details)`. `show-details` prints the per-file actions, then re-asks.
- Do NOT silently delete. Do NOT skip confirmation when `--dry-run` is absent.

### Step 6: Execute the Plan
- **What**: apply the confirmed actions.
- **How**:
  1. **Summarize action**: read the full set of files in the change-id directory; produce a `summary.md` with: title, change-id, status, key decisions (list each ADR/decision title), final outcomes, list of original files. Then move originals to `_archive/`.
  2. **Archive action**: move files into `_archive/` under the same change-id directory, preserving relative paths.
  3. **Delete action**: remove only the items explicitly marked for deletion in the confirmed plan; never recurse beyond what was listed.
  4. **Stale history truncation**: call `session-update.cjs --truncate-history <N>` where N is from `config.yaml > preferences.history_limits.history` (default 20).
  5. All file mutations atomic where possible (write-temp + rename, copy-then-delete for moves).
  6. If any single action fails, STOP further actions; report what completed, what failed, and leave a recoverable state (do not partially overwrite a file with truncated content).

### Step 7: Report Result
- Print the actually-applied actions (may differ from the plan if Step 6 stopped early).
- Show new totals: files cleaned, tokens saved.
- Recommend `/mvt-check-context` to validate the post-cleanup state if savings exceed ~5k tokens.

### Step 8: (session update handled by shared section)

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| `active_change.id` directory matches a "stale completed" rule | Skip cleanup of the active change; never archive in-progress work |
| `--dry-run` set | Stop after Step 4; do not request confirmation; do not modify any file |
| Plan would archive ALL artifacts (workspace becomes empty) | Require an extra confirmation: `This will archive every artifact. Continue? (y/n)` |
| User aborts at Step 5 confirmation | Report "no changes applied" |
| `_archive/` already exists with content from a prior run | Preserve existing `_archive/` content; new archives are added alongside |
| File targeted for action no longer exists (concurrent removal) | Skip with a note; do not error out the whole run |
| Unindexed change-id directory contains only `plan.yaml` | List as review-only; suggest user runs `/mvt-update-plan` or registers it via `/mvt-plan-dev` instead of cleaning |
| `session.yaml.bak` present from a previous failed run | Overwrite during Step 6 collapse (only the most recent backup is useful) |
