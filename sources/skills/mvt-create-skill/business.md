## Execution Flow

### Step 1: Requirements Gathering
Ask the user for:
- **Skill name**: Suggest `mvt-` prefix for consistency, but also accept project-specific prefixes (e.g., `app-`, `proj-`)
- **Purpose**: What does this skill do?
- **Category**: workflow / utility / project-specific
- **Trigger keywords**: What phrases should invoke this skill? (used for `description` field)

### Step 2: Skill Design
- Load an existing skill file as structural reference
- Load config.yaml for project configuration context
- Determine required input parameters
- Determine execution mode: interactive / automated / hybrid
- Determine output format needs

### Step 3: Template Decision
- Does the skill need an output template?
  - Yes -> Choose: adapt existing template or create new one
  - No -> Skip template creation
- Does the skill need context loading beyond session + project-context?
  - Yes -> Define the file list
  - No -> Use only basic loading

### Step 4: Generate Skill Files
1. Create `.claude/skills/{name}/SKILL.md` with standard structure:
   - YAML frontmatter (`name`, `description`)
   - Purpose section
   - Role section (Decision Rules + Boundaries)
   - Context Loading section
   - Execution Flow section
   - State Update section (MANDATORY — see below)
   - Output Format section
   - Suggested Next Steps section
2. If output template needed -> Create `.ai-agents/skills/_templates/{name}-output.md`
3. Update registry if template was created

### Step 4.5: Register in Registry (MANDATORY)
Append the new skill entry to `.ai-agents/registry.yaml` > `skills` section:
```yaml
  {name}:
    agent: {agent}
    path: .claude/skills/{name}/SKILL.md
    template: {template_path_or_null}
    category: {category}
    mode: independent
    custom: true
```
The `custom: true` field is **required** for all user-created skills. It protects the skill from being overwritten during framework updates.

### Step 5: Validation
- Verify SKILL.md format compliance (frontmatter has `name` + `description`)
- Confirm no naming conflicts with existing skills
- Verify `registry.yaml` entry includes `custom: true`
- Show the user how to invoke: `/{name}`

## Generated Skill Structure

```markdown
---
name: mvt-{name}
description: '{trigger keyword description}'
---

# MVT {Name}

## Purpose
{user-defined purpose}

## Role
You are the **Conductor** -- a Workflow Coordinator.

### Decision Rules
{generated based on skill purpose}

### Boundaries
{standard boundaries}

## Activation Protocol

### Step 1: Load Context (Context Foundation)
Load the following files as foundational context:
- `.ai-agents/workspace/session.yaml` -- Current workflow state
- `.ai-agents/workspace/project-context.yaml` -- Project domain data

### Step 2: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce the following throughout this entire session:
- `preferences.language` → Use this language for ALL output
- `preferences.output.no_emojis` → If true, never use emojis
- `preferences.output.data_format` → Use this format for data sections

### Step 3: Pre-flight Checks
{skill-specific checks}

### Step 4: Execute
Proceed to Execution Flow below.

## Execution Flow
{generated based on user requirements}

## State Update (Required)
After execution, update `.ai-agents/workspace/session.yaml`:
- Set `session.last_command: "/{name}"`
- Append one-line summary to `recent_actions` (keep max 3)

## Output Format
{template reference or inline format}

## Suggested Next Steps
{contextual suggestions}
```
