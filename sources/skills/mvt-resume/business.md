## Execution Flow

### Step 1: Read Session State

Load `.ai-agents/workspace/session.yaml` and extract:
- `active_change` -- the current change-id (if any), its phase, and its scope
- `skill_history` -- last 10 entries (skill name, timestamp, status)
- `recent_actions` -- last 5 entries (what was done, when, outcome)
- `last_command` and `last_skill` -- most recent invocation

If session.yaml is missing or empty, jump to Step 5 with the "no session" branch.

### Step 2: Inspect Recent Artifacts

If `active_change.id` is set:
- List files under `.ai-agents/workspace/artifacts/{active_change.id}/`, sorted by mtime descending
- Take the top 5

Otherwise:
- List all files under `.ai-agents/workspace/artifacts/` (recursive), sorted by mtime descending
- Take the top 5

For each artifact, capture: file path, mtime, size (in tokens estimate = chars / 4), and the change-id it belongs to.

### Step 3: Determine Resume Point

Pick the **resume point** by precedence:

| Condition | Resume point | Phase label |
|-----------|--------------|-------------|
| `active_change` is set with non-empty `phase` | `{active_change.phase}` | from session |
| `active_change` is set without phase | inferred from last skill in history | inferred |
| `skill_history[0]` exists | last skill | last skill |
| Nothing | `none` | new project |

Map skill -> next-step recommendation (used by Step 4):

| Last skill | Suggested next |
|-----------|----------------|
| mvt-init | mvt-analyze-code (if has code) or mvt-analyze (if requirements available) |
| mvt-analyze | mvt-design |
| mvt-analyze-code | mvt-analyze (if requirements pending) or mvt-design |
| mvt-design | mvt-implement |
| mvt-implement | mvt-review |
| mvt-review | mvt-fix (if findings) or mvt-test |
| mvt-fix | mvt-review (re-review) or mvt-test |
| mvt-test | mvt-cleanup or next change |
| mvt-cleanup | new change via mvt-analyze |
| (other) | mvt-status |

### Step 4: Generate Resume Report

Render via the `resume-output.md` template. Sections to fill:

1. **Active Task** -- name, change-id, phase, started_at (from active_change)
2. **Recent Skill History** -- last 5 entries from skill_history with timestamp + status
3. **Recent Artifacts** -- the top 5 artifacts collected in Step 2 (path, mtime, size)
4. **Resume Point** -- a one-paragraph natural-language summary of "where we are"
5. **Recommended Next Step** -- the mapped next skill from Step 3, with justification

### Step 5: Edge Cases

- **No session**: report "No session found. Run `/mvt-init` to start a project."
- **No active_change AND no history**: report "No active task. Suggested entry points: `/mvt-init`, `/mvt-analyze`, `/mvt-status`."
- **active_change set but referenced artifacts missing**: warn "Artifact directory `{path}` not found -- task state may be stale. Verify with `/mvt-status` or run `/mvt-cleanup`."
- **Last skill ended in failure** (skill_history entry status=failed): surface the failure summary first, suggest retry of that skill rather than advancing.
