## Execution Flow

### Step 1: Load Template Inventory
- Read registry to get all registered templates
- Scan `custom/` directory for existing custom versions
- Build status list: default / customized for each template

### Step 2: Display Template List
Show all templates with their status:

```markdown
## Output Templates

| # | Template | Skill | Type | Status |
|---|---------|-------|------|--------|
| 1 | analyze-output.md | mvt-analyze | Skill output | Default |
| 2 | design-output.md | mvt-design | Skill output | Customized |
| 3 | project-context.md | mvt-analyze-code | Semantic doc | Default |
| ... | ... | ... | ... | ... |

**Actions**: `view {#}`, `customize {#}`, `reset {#}`, `export {#}`
```

### Step 3: Execute Action (based on user choice)

**View**:
- Display full template content
- If custom version exists, show that; otherwise show default
- Indicate which version is being shown

**Customize**:
1. Show current default template
2. Prompt for desired modifications
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
