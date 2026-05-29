## Execution Flow

### Step 1: Load Inputs
- **Recommended**:
  - `.ai-agents/knowledge/core/manifest.yaml` -- only when computing token estimates for shared knowledge view.
- **Fallback**: if `config.yaml` is missing, surface the error and recommend `mvtt install` or `/mvt-init`. Do not silently create a fresh config from this skill.

### Step 2: Dispatch by Mode
- **What**: pick the operating mode from the user's invocation.
- **How**:

  | Invocation | Mode | Go to |
  |------------|------|-------|
  | `/mvt-config` (no args) | Interactive Menu | Step 3 |
  | `/mvt-config show` | Show All | Step 4 |
  | `/mvt-config set {key} {value}` | Direct Set | Step 5 |
  | `/mvt-config wizard` | Guided Wizard | Step 6 |
  | `/mvt-config reset` | Reset | Step 7 |
  | Anything else | Refuse, print Variants table, stop | -- |

### Step 3: Interactive Menu
1. Read current `config.yaml` and render a numbered menu grouped by category (User Preferences, Knowledge Settings, etc.) with current values inline.
2. Wait for user to select a category number (or `q` to quit).
3. Show the category detail view: keys with current values, type, default, allowed values.
4. Let user pick a key to edit; reuse Step 5 (Direct Set) sub-flow for validation, preview, confirmation, write.
5. After write, return to the top-level menu until user quits.
6. No write happens unless the Step 5 sub-flow confirms.

### Step 4: Show All
- Print every key with `current value | type | default`. Mark values that differ from default with a `*`.
- Print the Configuration Keys reference table (provided in shared section above) below the values, for context.
- No write.

### Step 5: Direct Set (`set {key} {value}`)
1. **Validate key exists**:
   - The key must match one of the rows in the Configuration Keys table. If not, print "Unknown key: <name>", list available keys, exit without writing.
2. **Validate value type and constraints**:

   | Type | Validation |
   |------|------------|
   | `enum` | Value MUST be in the allowed list. Reject with the allowed list shown. For `language` enums (`en-US`, `zh-CN`), reject other locale strings -- ask user to pick from the allowed list (do not fuzzy-match) |
   | `bool` | Accept exactly `true` / `false` (case-insensitive). Reject `yes`/`1`/`y` |
   | `int` | Parse as integer; check range when range is documented (e.g., `relevance_threshold` must be 0-100) |
   | `list` | Parse as comma-separated tokens; for `knowledge.shared`, every token must be a registered knowledge id |

3. **Preview**: render `key: <current> -> <new>` on a single line.
4. **Confirm**: prompt `Apply this change? (y/n)`. Skip the prompt only if invocation included an explicit non-interactive flag (none currently exists, so always prompt).
5. **Write atomically**:
   - Read the current file, mutate only the targeted key, preserve all other content and formatting (do NOT rewrite the whole file from a template -- the user may have comments).
   - Write to a temp file in the same directory, then rename. On any error, do not touch the original.
6. Report the new value and a one-line "what this affects" hint (e.g., "applies to subsequent skill invocations").

### Step 6: Guided Wizard
- Walk the user through these stages in order. Each stage uses the Step 5 validation rules. Defer the actual write to the end.

  | Stage | Key | Notes |
  |-------|-----|-------|
  | 1 | `preferences.interaction_language` | Default `en-US`. Show allowed list |
  | 2 | `preferences.document_output_language` | Default = whatever was just set in stage 1; user may override. Reuse stage-1 value when user accepts default |
  | 3 | `preferences.output.no_emojis` | Default `true` |
  | 4 | `preferences.output.data_format` | Default `yaml`; allowed: `yaml`, `json` |
  | 5 | `preferences.context_routing.relevance_threshold` | Default `70`; allowed: 0-100 |
  | 6 | `preferences.history_limits.*` | Show each limit with current value; accept new int or Enter to keep |

- After all stages, render a Summary Preview table: `key | from | to`, then a single confirmation prompt to apply ALL changes atomically.
- If the user aborts at the summary, discard all in-progress values; do not write anything.

### Step 7: Reset
1. Build the diff between current `config.yaml` and framework defaults: list every key that will revert.
2. Render the diff as `key | current | will-become-default`.
3. Require explicit confirmation: `Reset all settings to defaults? (y/n)`.
4. Backup current `config.yaml` to `config.yaml.bak` before writing.
5. Write defaults atomically.
6. Report the keys that changed.
- Do NOT reset `knowledge.shared` to defaults if the user has added entries via `/mvt-manage-context` -- preserve user-added knowledge ids; only reset preferences. Surface this exception in the diff.

### Step 8: (session update handled by shared section)

## Knowledge Inspection (sub-flow used by Interactive Menu and Show All)
- **View**: list shared knowledge ids from `registry.yaml > knowledge.shared`, then per-skill knowledge ids grouped by skill (`registry.yaml > skills.*.knowledge`). Show token estimates from each entry's manifest if available.
- **Modify**: this skill does NOT mutate knowledge settings; defer to `/mvt-manage-context`. Print the suggested command (`/mvt-manage-context move`, `/mvt-manage-context add`, etc.) instead of doing the work here.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| `config.yaml` missing | STOP; recommend `mvtt install` or `/mvt-init` |
| `config.yaml` exists but unparseable YAML | Surface error with line number; refuse to write; recommend manual fix or `mvtt install --refresh` |
| User runs `set` with a deprecated key (`preferences.language`) | Print migration hint: `Run mvtt update --migrate-config` to split into the two language fields. Do not mutate the deprecated key |
| Wizard stage receives an empty value | Treat as "accept default for this stage", continue |
| User aborts mid-wizard | No partial write; the temp values are discarded |
| `.bak` from previous reset already exists | Overwrite (only the most recent backup is useful) |
| Concurrent edit detected (mtime changed during preview->write) | Abort write, surface a message, ask user to re-run |
| `set knowledge.shared <list>` includes unknown id | Reject with the list of valid ids from `registry.yaml` |
| `reset` invoked but `config.yaml` already matches defaults | Report "nothing to reset", do not write |
