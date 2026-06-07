---
name: 'mvt-template'
description: 'View, customize, and manage output templates for MVTT skills. This skill should be used when user wants to inspect available templates, create custom template versions, reset customizations, or export templates.'
---

# MVT Custom Template

## Purpose

View, customize, and manage MVTT output templates. Inspect default templates, create custom versions that override defaults, reset customizations, and export templates.

## Role

You are the **Conductor** -- a Workflow Coordinator.

### Decision Rules
- No arguments -> Show template list with status
- User selects "view" -> Display full template content (custom version if exists)
- User selects "customize" -> Guide through modification process
- User selects "reset" -> Delete custom version, restore default
- User selects "export" -> Output template to specified location
- Custom template must preserve frontmatter format

### Boundaries
- Do NOT modify default templates in `_templates/` root (only create/modify in `custom/`) (use `(constraint)` instead)
- Do NOT modify skill logic (only change output formatting) (use `(constraint)` instead)

## Activation Protocol

### Step 1: Load Context
Load these files as foundational context:
- `.ai-agents/workspace/project-context.yaml` -- Project index (structural info)
- `.ai-agents/registry.yaml` -- Available skills registry and knowledge declarations

Extended context for this skill:
- Scan `.ai-agents/skills/_templates/custom/` for existing customizations

### Step 2: Resolve Project Scope (PS)

Read `project-context.yaml > projects[]`.

**Single project** (`projects.length == 1`): Set PS = [sole project name]. Skip remaining PS steps.

**Multi-project** (`projects.length > 1`):

**Mode A -- Plan-driven** (active plan exists and skill operates on plan tasks):

1. **Plan signal**: PS = current task's `project` array from plan's `current_tasks`. Drop stale project names (not in `projects[]`), fall through.
2. **Path match**: Match current working paths against `projects[].path` and `source_paths`.
3. **Prompt**: If still unresolved, list candidates and ask user. Never silently load all projects.

**Mode B -- Non-plan** (no active plan or ad-hoc changes):

Defer PS to execution: identify change target, match against `projects[].path` and `source_paths`, load project-specific knowledge on demand (Step 3).

### Step 3: Load Knowledge

Registry uses project-keyed maps; `_all` is a reserved key (all projects). Applies to both top-level `knowledge` and `skills.<name>.knowledge`.

**Entry resolution** (relative to `.ai-agents/{source}`):
- `files: [...]` -- load listed files.
- `files_from_manifest: true` -- read `{source}/manifest.yaml`, load entries with `auto_load: true`.
- Skip non-existent paths.

**At activation** (both modes): load `knowledge._all` + `skills.<current-skill>.knowledge._all`.

**Mode A** (additionally): for each P in PS, load `knowledge[P]` + `skills.<current-skill>.knowledge[P]`.

**Mode B** (during execution): on demand, load `knowledge[P]` + `skills.<current-skill>.knowledge[P]` for identified project(s).

### Step 4: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce the following throughout this entire session:

**Language**:
- `preferences.interaction_language` → Use for everything spoken to the user (chat, prompts, tables); NOT for files written to disk.
- `preferences.document_output_language` → See **Output Language Constraint** section below for the full rules governing files written to disk.

**Other preferences**:
- `preferences.output.no_emojis` → If true, never use emojis
- `preferences.output.data_format` → Use this format for data sections in artifacts
- `preferences.context_routing.relevance_threshold` → Used by `/mvt-manage-context add` for AI routing (default 70 if missing)

### Step 4: Pre-flight Checks
- No blocking checks required.

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

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| User selects a `#` that doesn't exist in inventory | Re-display the table, ask again |
| `customize` validation fails repeatedly | After two failed attempts, suggest user export to a file and edit manually, then re-import via `customize` with `free-form patch` |
| Custom file exists but registry no longer references the template (`Orphan-custom`) | Allow `view` and `reset`; refuse `customize` (stale target); recommend running `/mvt-init` (interactive refresh) or removing the file manually |
| Default file is missing (`Missing`) | Refuse all actions for that row; suggest reinstall (`mvtt install`) |
| User aborts at any confirmation prompt | Do not modify any file; report "no changes" |
| External process modified the file between preview and write | Detect via mtime check just before write; abort and re-run preview |

## State Update

This skill is read-only and does NOT modify `.ai-agents/workspace/session.yaml`.

## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`mvt-template`) and the current project state.

### Conditional Recommendations

Match the current state to one of the conditions below. If none match, use `default`.

- **`template customized`** → `/mvt-status` -- Check project status
- **`template reset to default`** → `/mvt-help` -- Review available skills and templates

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
