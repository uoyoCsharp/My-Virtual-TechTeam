## Execution Flow

### Step 1: Load Inputs
- **Recommended**:
  - Working tree state: presence of `.git`, current branch, in-progress merge/rebase markers (`.git/MERGE_HEAD`, `.git/REBASE_HEAD`).

### Step 2: Detect Changes
- **What**: produce a deduplicated list of changed paths since the last sync, classified as `added | removed | modified | renamed`.
- **How**:
  1. Determine detection mode using the table below.
  2. Collect raw paths.
  3. Filter to paths that could affect the project index (source roots, package manifests, test/build configs); ignore generated artifacts and `.ai-agents/workspace/`.

  | Condition | Detection commands |
  |-----------|--------------------|
  | Git repo, clean of merge/rebase | `git diff --name-status HEAD`, `git diff --name-status --cached`, `git diff --name-status HEAD~1` -- merge results |
  | Git repo, mid-merge or mid-rebase | STOP and warn user: "Repository is in the middle of a {merge\|rebase}. Resolve and re-run `/mvt-sync-context`." |
  | No git available | Walk source roots from `project-context.yaml`; collect files with mtime newer than `session.last_synced_at` (fallback: last 7 days) |
  | Source roots not yet recorded | Treat as full scan; mark sync as "initial" |

- **Branches**:

  | Result | Action |
  |--------|--------|
  | No relevant changes | Report "context already in sync", skip Steps 3-5 |
  | Only generated/ignored files changed | Same as above |
  | Relevant changes found | Proceed to Step 3 |

### Step 3: Classify Structural Changes
- **What**: map each changed path to one or more index-level effects.
- **How**: use the rules table below. A single path may match multiple rows; collect all effects.

  | Change pattern | Effect on `project-context.yaml` |
  |----------------|----------------------------------|
  | New `package.json` / `pyproject.toml` / `go.mod` / `pom.xml` / `Cargo.toml` etc. at a new directory | Add new project entry; infer language + tech stack |
  | Above file removed | Remove that project entry |
  | Existing manifest content changed (deps / build tool / test runner) | Update tech_stack fields for that project |
  | New top-level source directory under a registered project | Add to that project's `source_paths` |
  | Top-level source directory removed | Remove from `source_paths` |
  | Renamed directory (rename detected) | Rename in `source_paths`; preserve other fields |
  | Pure file content changes inside existing directories | NO index change -- only flag for semantic-regen prompt in Step 5 |

- Output of this step: an in-memory diff plan -- a list of `(field, old, new)` tuples.

### Step 4: Confirm and Apply Index Update
- **What**: present the diff plan to the user, get confirmation, then apply.
- **How**:
  1. Render the diff plan as a compact table (`field | old | new`).
  2. Always require user confirmation if any of the following is true:
     - The diff plan removes a project entry.
     - The diff plan renames a `source_paths` entry.
     - The diff plan modifies > 5 fields total.
     - User has uncommitted manual edits in `.ai-agents/workspace/project-context.yaml` (detect via `git status` if available, or by comparing mtime to `session.last_synced_at`).
  3. Otherwise (small additive / fields-only update), apply silently and surface the resulting diff in conversation.
  4. Backup current `project-context.yaml` to `project-context.yaml.bak` before writing.
  5. Write atomically (write to temp + rename); never modify `project-context.md`.

### Step 5: Suggest Semantic Regeneration (if needed)
- **What**: warn the user when structural changes likely make `project-context.md` stale.
- **Trigger conditions** (any one is enough):
  - A project entry was added or removed.
  - A `source_paths` entry was added, removed, or renamed.
  - >= 10 source files were modified across >= 2 modules.
- **Action**: print a single suggestion: `project-context.md may be stale. Run /mvt-analyze-code to regenerate.` Do NOT auto-run; do NOT modify `project-context.md` directly.

### Step 6: (session update handled by shared section)
- Refresh `session.last_synced_at` to the current ISO timestamp as part of the standard session update.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| Repository is mid-merge / mid-rebase | STOP at Step 2, ask user to finish the operation first (do not attempt detection on inconsistent state) |
| User has uncommitted manual edits in `project-context.yaml` | Always show diff and require confirmation before overwriting; offer to merge field-by-field rather than replace whole file |
| Multiple `source_paths` rename candidates ambiguous | Ask user to resolve each rename individually; do not guess |
| Worktree contains many untracked files (>500) | Cap detection to top-level dirs and registered source roots; do not deep-scan untracked trees |
| `project-context.yaml` is missing | STOP -- recommend `/mvt-init` |
| `.bak` already exists from a prior failed run | Overwrite it (only the most recent backup is useful here) |
| User aborts at Step 4 confirmation | Do not write; report "no changes applied" |
