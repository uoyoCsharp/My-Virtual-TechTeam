## Execution Flow

### Step 1: Load Inputs
- **Recommended**:
  - `.ai-agents/skills/_templates/` -- default templates (read-only from this skill).

### Step 2: Build Template Inventory
- **What**: produce the canonical list of templates with their status.
- **How**:
  1. From `registry.yaml`, collect every `skills.<name>.template` value that is not null.
  2. For each entry, derive the basename (e.g., `analyze-output.md`).
  3. For each basename:
     - `default` exists if the file is present under `.ai-agents/skills/_templates/`.
     - `custom` exists if the file is present under `.ai-agents/skills/_templates/custom/` with the same basename.
  4. Status:
     - `Default` if only default exists.
     - `Customized` if both exist.
     - `Orphan-custom` if custom exists but registry has no skill referencing it (surface as a warning).
     - `Missing` if registry references a basename that has no default file (surface as a warning).

### Step 3: Display Inventory and Wait for Action
- Render the inventory as a numbered table:

  ```markdown
  | # | Template | Skill(s) | Status |
  |---|----------|----------|--------|
  | 1 | analyze-output.md | mvt-analyze | Default |
  | 2 | design-output.md | mvt-design | Customized |
  ```

- Below the table, list available actions: `view {#}`, `customize {#}`, `reset {#}`, `export {#} [path]`.
- If any `Orphan-custom` or `Missing` rows exist, print a one-line warning above the table.
- Wait for user input. The `{#}` may be a number or the basename.

### Step 4: Dispatch Action

#### 4a. View
- **What**: show the active version of the template.
- **How**:
  1. If `Customized`, read the custom file. Otherwise read the default.
  2. Print the file content in a fenced code block, prefixed by a single line: `Showing: <default|custom> -- <path>`.
  3. No write.

#### 4b. Customize
- **What**: create or update the custom override; preserve a structure the assembler can still consume.
- **How** (4-step subflow):
  1. **Show baseline**: print the current active version (custom if exists, otherwise default).
  2. **Collect modifications from the user**: ask for one of these explicit input forms (do not improvise):
     - "replace section `<heading>` with: ..."
     - "add section `<heading>` after `<existing-heading>`: ..."
     - "remove section `<heading>`"
     - "edit frontmatter field `<key>` to `<value>`"
     - "free-form patch: <unified diff>"
  3. **Preview**: render the resulting file (full content) and a diff against the baseline. Do NOT write yet.
  4. **Validate** (mandatory before write):
     - Frontmatter block (`---\n...\n---`) must be present and parseable.
     - Required frontmatter keys (`id`, `version`, `skill` if originally present) must be retained.
     - All Mustache placeholders that were present in the default and that the assembler relies on (`{{...}}`, `{{#...}}`, `{{?...}}`, `{{^...}}`) must still be present unless the user explicitly removed them; warn if removed.
     - Validation failures -> abort write, surface the failed checks, return to step 2 of this subflow.
  5. **Confirm and write**: prompt `Save customized template to .ai-agents/skills/_templates/custom/<name>? (y/n)`. On `y`, write atomically (temp + rename). Backup any existing custom file as `<name>.bak` first.

#### 4c. Reset
- **What**: revert to the default template.
- **How**:
  1. If no custom file exists, report "Already default, nothing to reset" and stop.
  2. Show a one-line summary of what will be deleted (`<path>`, last modified date).
  3. Require explicit confirmation: `Delete custom override <name>? (y/n)`.
  4. On `y`, delete the file. Do NOT keep a backup -- user must use git for recovery.
  5. Report success and the new status (`Default`).

#### 4d. Export
- **What**: emit the template content to a destination chosen by the user.
- **How**:
  1. Determine source: custom version if exists, otherwise default. Print which one is being exported.
  2. Determine destination using the table:

     | User input | Destination |
     |------------|-------------|
     | No path given | Print the content as a fenced code block in chat |
     | Relative or absolute file path | Write to that path; if file exists, ask for confirmation before overwriting |
     | Literal string `custom` | Copy default to `.ai-agents/skills/_templates/custom/<name>` (use as starting point for customization) |

  3. Never write outside the project root unless an absolute path was explicitly provided by the user.

### Step 5: (session update handled by shared section)

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| User selects a `#` that doesn't exist in inventory | Re-display the table, ask again |
| `customize` validation fails repeatedly | After two failed attempts, suggest user export to a file and edit manually, then re-import via `customize` with `free-form patch` |
| Custom file exists but registry no longer references the template (`Orphan-custom`) | Allow `view` and `reset`; refuse `customize` (stale target); recommend running `/mvt-init --refresh` or removing the file manually |
| Default file is missing (`Missing`) | Refuse all actions for that row; suggest reinstall (`mvtt install`) |
| User aborts at any confirmation prompt | Do not modify any file; report "no changes" |
| External process modified the file between preview and write | Detect via mtime check just before write; abort and re-run preview |
