## Execution Flow

`/mvt-config` takes no arguments. Every invocation opens the Interactive Menu (Step 2); all actions -- viewing settings, editing a key, and guided setup -- are reached from there. There is no `set` / `show` / `wizard` / `reset` invocation form.

### Step 1: Load Inputs
- **Required**:
  - `.ai-agents/config.yaml` -- the configuration to inspect and edit.
- **Recommended**:
  - `.ai-agents/knowledge/core/manifest.yaml` -- only when computing token estimates for the shared knowledge view.
- **Fallback**: if `config.yaml` is missing, surface the error and recommend `mvtt install` or `/mvt-init`. Do not silently create a fresh config from this skill.

### Step 2: Interactive Menu (entry point)
1. Read current `config.yaml`.
2. Render the top-level menu with these actions:

   | # | Action | Goes to |
   |---|--------|---------|
   | 1 | View all settings | Step 3 |
   | 2 | Edit a setting | Step 4 |
   | 3 | Guided setup (walk through common settings) | Step 5 |
   | `q` | Quit | -- exit, no write |

3. Wait for the user's selection. Re-render the menu after any action completes, until the user quits.
4. On an unrecognized selection, re-print the menu and prompt again. Do not exit.
5. No write happens unless the user confirms -- either in the Edit sub-flow (Step 4) or at the Guided-setup summary (Step 5).

### Step 3: View All
- Print every key with `current value | type | default`. Mark values that differ from default with a `*`.
- Print the Configuration Keys reference table (provided in the shared section above) below the values, for context.
- No write. Return to the top-level menu (Step 2).

### Step 4: Edit a Setting
1. Render a numbered list of editable keys grouped by category (User Preferences, etc.) with current values inline.
2. Wait for the user to select a key (or `b` to go back to the top-level menu).
3. Show the key detail: current value, type, default, allowed values.
4. Run the **Edit sub-flow** (below) for the selected key.
5. After the sub-flow completes (write or cancel), return to the editable-key list, then to the top-level menu.

#### Edit sub-flow (validate -> preview -> confirm -> write)
Used by Step 4 and by each stage of Step 5.

1. **Validate key exists**: the key must match one of the rows in the Configuration Keys table. If not, report it and return without writing.
2. **Validate value type and constraints**:

   | Type | Validation |
   |------|------------|
   | `enum` | Value MUST be in the allowed list. Reject with the allowed list shown. For `language` enums (`en-US` = English, `zh-CN` = 简体中文), reject other locale strings -- ask the user to pick from the allowed list (do not fuzzy-match) |
   | `bool` | Accept exactly `true` / `false` (case-insensitive). Reject `yes`/`1`/`y` |
   | `int` | Parse as integer; check range when range is documented (e.g., `relevance_threshold` must be 0-100) |

3. **Preview**: render `key: <current> -> <new>` on a single line.
4. **Confirm**: prompt `Apply this change? (y/n)`. On `n`, discard and return.
5. **Write atomically**:
   - Read the current file, mutate only the targeted key, preserve all other content and formatting (do NOT rewrite the whole file from a template -- the user may have comments).
   - Write to a temp file in the same directory, then rename. On any error, do not touch the original.
6. Report the new value and a one-line "what this affects" hint (e.g., "applies to subsequent skill invocations").

### Step 5: Guided Setup
- Selected from the top-level menu. Walk the user through these stages in order. Each stage uses the Edit sub-flow's validation rules. Defer the actual write to the end.

  | Stage | Key | Notes |
  |-------|-----|-------|
  | 1 | `preferences.interaction_language` | Default `en-US`. Show allowed list |
  | 2 | `preferences.document_output_language` | Default = whatever was just set in stage 1; user may override. Reuse stage-1 value when user accepts default |
  | 3 | `preferences.output.no_emojis` | Default `true` |
  | 4 | `preferences.output.data_format` | Default `yaml`; allowed: `yaml`, `json` |
  | 5 | `preferences.context_routing.relevance_threshold` | Default `70`; allowed: 0-100 |
  | 6 | `preferences.history_limits.*` | Show each limit with current value; accept new int or Enter to keep |
  | 7 | `preferences.planning.granularity` | Default `medium`; allowed: `coarse`, `medium`, `fine` |

- After all stages, render a Summary Preview table: `key | from | to`, then a single confirmation prompt to apply ALL changes atomically.
- If the user aborts at the summary, discard all in-progress values; do not write anything.
- After applying (or aborting), return to the top-level menu (Step 2).

## Knowledge Inspection (sub-flow used by View All and Edit a Setting)
- **View**: list global knowledge ids from `registry.yaml > knowledge._all` and project-specific ids from `knowledge.{projectName}`, then per-skill knowledge ids grouped by skill (`registry.yaml > skills.*.knowledge`). Show token estimates from each entry's manifest if available.
- **Modify**: this skill does NOT mutate knowledge settings; defer to `/mvt-manage-context`. Print the suggested command (`/mvt-manage-context move`, `/mvt-manage-context add`, etc.) instead of doing the work here.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| `config.yaml` missing | STOP; recommend `mvtt install` or `/mvt-init` |
| `config.yaml` exists but unparseable YAML | Surface error with line number; refuse to write; recommend manual fix or `mvtt install --refresh` |
| Editing a deprecated key (`preferences.language`) | Print migration hint: `Run mvtt update --migrate-config` to split into the two language fields. Do not mutate the deprecated key |
| Guided-setup stage receives an empty value | Treat as "accept default for this stage", continue |
| User aborts mid guided-setup | No partial write; the temp values are discarded |
| Concurrent edit detected (mtime changed during preview->write) | Abort write, surface a message, ask user to re-run |
| User asks to edit `knowledge._all` or any knowledge map key | Refuse and route to `/mvt-manage-context`; this skill inspects knowledge settings but does not mutate them |
