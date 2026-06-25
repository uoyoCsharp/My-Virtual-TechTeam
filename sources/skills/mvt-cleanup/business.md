## Execution Flow

### Step 1: Load Inputs
- **Fallback**: if `session.yaml` is missing, refuse to clean -- without state we can't tell what is in-progress vs completed; recommend `/mvt-init` and stop.

### Step 2: Pre-Archive Sync Check

For each `changes[]` entry with `status: done`:
1. Compare `session.last_synced_at` with the change's `updated_at`.
2. If `last_synced_at` is empty OR `last_synced_at` < `updated_at`, mark the change as **WARNING: unsynced**.
3. Collect all unsynced change-ids into a warning list for display in Step 6.

This check ensures `/mvt-sync-context` has processed a change's knowledge before cleanup archives it. Once archived, the original artifact files (`analysis.md`, `design.md`, `implementation.md`) are no longer accessible to sync-context.

### Step 3: Inventory Artifacts
- **What**: produce a per-change-id inventory with size and last-modified data.
- **How**:
  1. Walk `.ai-agents/workspace/artifacts/` and group files by their parent change-id directory. **Exclude the `_archived/` subdirectory** from the walk — it contains previously archived changes and is not subject to re-inventory.
  2. For each file: characters, estimated tokens (`ceil(characters / 4)`), last-modified (mtime).
  3. For each change-id directory, sum tokens and file count.
  4. Mark each change-id as `active | in-recent-changes | unindexed | legacy-pattern`:
     - `active` if it matches `session.active_change.id`.
     - `in-recent-changes` if it appears in `session.changes[]` (any status).
     - `unindexed` if neither condition holds and it sits under `artifacts/`.
     - `legacy-pattern` if the directory is `knowledge/patterns/` or matches other legacy markers.

### Step 4: Apply Cleanup Rules
- **What**: compute Cleanup Candidates from the inventory.
- **How**: run the rules table below. A single change-id may match multiple rows; collect all proposed actions.

  | Source | Rule | Proposed action |
  |--------|------|-----------------|
  | `changes[]` entry with `status: done` AND `artifacts/{id}/` exists AND (any task in plan is older than the active change's start **OR** plan metadata is missing, unreadable, or absent for this change) | Summarize: generate a `summary.md` from the change's artifacts, then move the **entire** `artifacts/{id}/` directory (including `summary.md`) to `artifacts/_archived/{id}/` |
  | `changes[]` entry with `status: done` AND `epic_id` non-empty AND parent epic status is NOT `done` | **Epic integrity warning**: mark the candidate as `epic-unsafe` -- archiving a sub-change whose parent epic is still in-progress may leave the epic in an inconsistent state. Default to `n` (skip) in the cleanup plan. User may override to force-archive. |
  | Artifact directory under `artifacts/` whose id starts with `epic-` AND contains `epic.yaml` with `status: done` | **Batch archive candidate**: mark for batch suggestion in Step 7 -- read `epic.yaml.children[]` for child change-ids to offer as batch archive options alongside the epic |
  | Change-id directory marked `unindexed` | List for user review (do NOT auto-archive -- could be in-flight work the user just hasn't registered) |
  | `history` entries beyond the most recent N (from `config.yaml > preferences.history_limits.history`, default 10) | Truncate via `session-update.cjs --truncate-history <N>` |
  | Directory `knowledge/patterns/` exists | Archive to `.ai-agents/knowledge/_archived/legacy-patterns/` after confirmation (legacy pattern data; no replacement) |
  | Empty change-id directories (zero files inside) | Propose deletion of the directory itself |

- For each candidate, compute: `current size (tokens)` -> `projected size (tokens)`, expected savings.

### Step 5: Present Cleanup Plan
- Render the plan as a table:

  | Item | Category | Current Size | Action | Result |
  |------|----------|-------------|--------|--------|
  | {change-id or path} | {completed | unindexed | stale-history | legacy} | ~{tokens} | {summarize | archive | review-only | delete} | ~{reduced tokens} |
  | **Total** | | **{total}** | | **{new_total} ({savings} saved)** |

- Below the table, list any items marked `review-only` (unindexed) with a one-line note: user must decide manually.
- If `--dry-run` is set, STOP here. Print "(dry run -- no changes applied)" and exit cleanly.

### Step 6: Confirm Before Destructive Steps
- **Always require confirmation** if the plan includes any of:
  - File deletion (legacy patterns, empty dirs).
  - `summarize` action (collapses multi-file content).
  - `archive` action (moves entire change-id directory into `artifacts/_archived/`).
- If the Step 2 warning list is non-empty, prepend it to the confirmation prompt:
  > WARNING: The following changes have NOT been synced by `/mvt-sync-context`. Archiving them will permanently lose their knowledge for aggregation:
  > - {change-id}: {title}
  > Options: `y` = archive anyway, `n` = cancel, `sync-first` = abort and run `/mvt-sync-context` first, `show-details` = per-file breakdown.
- If no unsynced warnings, use the standard prompt: `Apply cleanup plan? (y / n / show-details)`. `show-details` prints the per-file actions, then re-asks.
- User chooses `sync-first` → stop cleanup, print "Run `/mvt-sync-context` first, then re-run `/mvt-cleanup`." and exit.
- Do NOT silently delete. Do NOT skip confirmation when `--dry-run` is absent.

### Step 7: Execute the Plan
- **What**: apply the confirmed actions.
- **How**:
  1. **Summarize action**: read the full set of files in the change-id directory; produce a `summary.md` with: title, change-id, status, key decisions (list each ADR/decision title), final outcomes, list of original files. Write `summary.md` into the change-id directory, then move the **entire** `artifacts/{id}/` directory to `artifacts/_archived/{id}/` (summary.md travels with it).
  2. **Archive action** (no summarize): move the **entire** `artifacts/{id}/` directory to `artifacts/_archived/{id}/`. No internal path restructuring needed.
  2a. **Batch archive action** (epic with children): when archiving a completed epic (the change-id is an epic directory containing `epic.yaml` with `status: done`), read `epic.yaml.children` and present the user with three options before proceeding:

       | Option | Description |
       |--------|-------------|
       | Epic only | Archive only the epic directory (leave child change directories in place) |
       | All children | Archive the epic directory AND move all child change directories (`artifacts/{child_id}/`) to `artifacts/_archived/{child_id}/` |
       | Selective | User picks which children to include alongside the epic |

     Per ADR-8: archive = abandon references; no post-archive `epic_id` integrity maintenance. Child changes that are also `status: done` are eligible for batch archiving; in-progress or pending children are excluded with a note.

  3. **Archive legacy-pattern action**: move `knowledge/patterns/` to `.ai-agents/knowledge/_archived/legacy-patterns/`. If that destination exists, preserve existing content and ask for a timestamped suffix. Do not hard-delete this directory.
  4. **Delete action**: remove only the items explicitly marked for deletion in the confirmed plan; never recurse beyond what was listed.
  5. **Stale history truncation**: call `session-update.cjs --truncate-history <N>` where N is from `config.yaml > preferences.history_limits.history` (default 10).
  6. All file mutations atomic where possible (write-temp + rename, copy-then-delete for moves).
  7. If any single action fails, STOP further actions; report what completed, what failed, and leave a recoverable state (do not partially overwrite a file with truncated content).
  8. **Index synchronization**: after all archive moves finish, re-glob `artifacts/_archived/` for the actual moved change-id and epic-id directories from this run. The `--remove-change` id set MUST equal the set of change-id directories actually moved into `_archived/`; the `--remove-epic` id set MUST equal the set of epic directories actually moved. If the sets differ from the planned ids, use the actual moved-dir set and report the mismatch.

### Step 8: Report Result
- Print the actually-applied actions (may differ from the plan if Step 7 stopped early).
- Show new totals: files cleaned, tokens saved.
- Recommend `/mvt-check-context` to validate the post-cleanup state if savings exceed ~5k tokens.

### Step 9: Session Update Parameter Selection

Based on the actual cleanup actions performed, choose the appropriate session-update parameter combination:

| Actual cleanup action | session-update parameters |
|----------------------|---------------------------|
| Closed `active_change` (all plan tasks completed) **+** archived old done changes | `--close-change --remove-change <ids> --truncate-history <N>` |
| Closed `active_change` only (no old changes archived) | `--close-change --truncate-history <N>` |
| Archived old changes only (active_change still in progress) | `--remove-change <ids> --truncate-history <N>` |
| Archived epic + its children (batch archive) | `--remove-epic <epic_id> --remove-change <child1>,<child2> --truncate-history <N>` |
| `--dry-run` mode (no modifications made) | **Do NOT call** session-update script; only record history |

N is read from `config.yaml > preferences.history_limits.history` (default 10). `<ids>` is a comma-separated list from the actual moved-dir set collected in Step 7.8.

### Step 10: State Update
Apply the State Update rules defined in the **State Update** section below.

**Pre-filled examples** (one per Step 9 row):

```bash
# Row 1: closed active_change + archived old done changes
node .ai-agents/scripts/session-update.cjs \
  --skill mvt-cleanup \
  --close-change \
  --remove-change <archived_change_ids> \
  --truncate-history 10

# Row 2: closed active_change only
node .ai-agents/scripts/session-update.cjs \
  --skill mvt-cleanup \
  --close-change \
  --truncate-history 10

# Row 3: archived old changes only
node .ai-agents/scripts/session-update.cjs \
  --skill mvt-cleanup \
  --remove-change <archived_change_ids> \
  --truncate-history 10

# Row 4: batch archive (epic + its children)
node .ai-agents/scripts/session-update.cjs \
  --skill mvt-cleanup \
  --remove-epic <archived_epic_id> \
  --remove-change <archived_child_ids> \
  --truncate-history 10
```

Replace `10` with the actual `config.yaml > preferences.history_limits.history` value, and `<archived_change_ids>` / `<archived_child_ids>` with the comma-separated id list collected in Step 7.8, `<archived_epic_id>` with the batch-archived epic id. Drop any `--remove-*` flag whose id list is empty.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| `active_change.id` directory matches a "stale completed" rule | Skip cleanup of the active change; never archive in-progress work |
| `--dry-run` set | Stop after Step 5; do not request confirmation; do not modify any file |
| Plan would archive ALL artifacts (workspace becomes empty) | Require an extra confirmation: `This will archive every artifact. Continue? (y/n)` |
| User aborts at Step 6 confirmation | Report "no changes applied" |
| `artifacts/_archived/{id}/` already exists from a prior run | Preserve existing content; merge or skip with a note — do not overwrite |
| File targeted for action no longer exists (concurrent removal) | Skip with a note; do not error out the whole run |
| Unindexed change-id directory contains only `plan.yaml` | List as review-only; suggest user runs `/mvt-update-plan` or registers it via `/mvt-plan-dev` instead of cleaning |
| `session.yaml.bak` present from a previous failed run | Overwrite during Step 7 collapse (only the most recent backup is useful) |
| Change with `epic_id` is a cleanup candidate but parent epic is still `in_progress` | Mark as `epic-unsafe`; default to skip. User may override to force-archive. Warn: "This change belongs to in-progress epic '{title}'. Archiving it separately may leave the epic in an inconsistent state." |
| Epic directory marked for batch archive but `epic.yaml` is missing or unreadable | Skip batch suggestion; treat as a regular archive candidate |
| Batch archive includes a child that is still `in_progress` | Exclude that child from the batch with a note: "Child {id} is in_progress and cannot be archived." |
