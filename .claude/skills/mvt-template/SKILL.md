---
name: mvt-template
description: 'View, customize, and manage output templates for MVTT skills. Use when user wants to see available templates, create custom template versions, reset to defaults, or export templates.'
---

# MVT Custom Template

## Purpose

Provide an interactive tool for viewing, customizing, and managing MVTT output templates. Users can inspect default templates, create custom versions that override defaults, reset customizations, and export templates.

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
- Do NOT modify default templates in `_templates/` root -> Only create/modify in `custom/`
- Do NOT modify skill logic -> Only change output formatting

## Activation Protocol

### Step 1: Load Context (Context Foundation)
Load the following files as foundational context:
- `.ai-agents/skills/_templates/_manifest.yaml` -- Template registry

Extended context for this skill:
- Scan `.ai-agents/skills/_templates/custom/` for existing customizations

### Step 2: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce the following throughout this entire session:
- `preferences.language` → Use this language for ALL output (responses, artifact content, comments)
- `preferences.output.no_emojis` → If true, never use emojis
- `preferences.output.data_format` → Use this format for data sections in artifacts

### Step 3: Pre-flight Checks
- No blocking checks required.

### Step 4: Execute
Proceed to Execution Flow below.

## Execution Flow

### Step 1: Load Template Inventory
- Read `_manifest.yaml` to get all registered templates
- Scan `custom/` directory for existing custom versions
- Build status list: default / customized for each template

### Step 2: Display Template List
Show all templates with their status:

```markdown
## Output Templates

| # | Template | Skill | Status |
|---|---------|-------|--------|
| 1 | analyze-output.md | mvt-analyze | Default |
| 2 | design-output.md | mvt-design | Customized |
| ... | ... | ... | ... |

**Actions**: `view {#}`, `customize {#}`, `reset {#}`, `export {#}`
```

### Step 3: Execute Action (based on user choice)

**View**:
- Display full template content
- If custom version exists, show that; otherwise show default
- Indicate which version is being shown

**Customize**:
1. Show current default template
2. Ask user to describe desired modifications
3. Generate new template based on modifications
4. Preview the customized template
5. Save to `custom/{template-name}` after user confirmation
6. Custom template must retain frontmatter (`id`, `version`, `skill`)

**Reset**:
1. Confirm user wants to reset to default
2. Delete the custom version from `custom/`
3. Confirm reset complete

**Export**:
- Output template content to user-specified location
- Or display in a code block for manual copy

### Step 4: Confirmation
- Show result of the action taken
- Confirm files modified

## Output Format

No external template -- output is inline based on the action:

```markdown
## Template Manager

{Action-specific content}

---
**Suggested Next Steps**:
- `/mvt-template` -- Manage more templates
- `/mvt-help` -- View all available skills
```
