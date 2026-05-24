## Execution Flow

### Step 1: Assess Current State
- Read project-context.yaml and evaluate completeness:
  - Projects list empty -> Mark as "not initialized"
  - Project type empty -> Mark as "type missing"
  - Tech stack empty -> Mark as "tech stack missing"
- Read project-context.md and evaluate completeness:
  - File does not exist -> Mark as "no semantic context"
  - Core sections empty -> Mark which sections are missing
- Read registry.yaml:
  - Check `knowledge.shared` for current shared knowledge list
- Calculate and display context completeness percentage

### Step 2: Guided Information Collection
Based on what is missing, guide the user through relevant sections:

**If not initialized** (project basics):
- Project name, type, description
- Tech stack (language, framework, build tool, test framework)
- Suggest running `/mvt-init` for automatic detection

**If no semantic context** (project understanding):
- Core terms and domain concepts
- Module structure and layer boundaries
- Key business rules
- Suggest running `/mvt-analyze-code` for automatic code analysis

**If no requirements** (requirements & background):
- Main features and goals
- User roles and use cases
- Known constraints and limitations

**Supplementary information** (always available):
- Project-specific coding standards
- Team conventions
- Third-party integration details

### Step 3: Write Context
Based on information collected, route to the correct file:

**Structural information** -> Write to `project-context.yaml`:
- Project name, type, path -> `projects[]` entry
- Tech stack details -> `projects[].tech_stack`

**Semantic information** -> Write to `project-context.md`:
- Core terms -> `## Core Terms` section
- Module structure -> `## Module Structure` section
- Business rules -> `## Key Business Rules` section
- API overview -> `## API Overview` section
- Requirements analysis -> `## Requirements Analysis` section

**Knowledge files** -> Write to knowledge directories:
1. If coding standards or project knowledge provided:
   a. Write knowledge files to `.ai-agents/knowledge/principle/` or `knowledge/project/`
   b. Create or update `manifest.yaml` in the knowledge directory
   c. Determine how this knowledge should be loaded:
      - **All skills (shared)**: Append entry to `registry.yaml` > `knowledge.shared`
      - **Specific skills only**: Append entry to `registry.yaml` > `skills.{name}.knowledge`
        for each selected skill (with `type: "static"`)
      - **Skip auto-loading**: Available but not auto-loaded by any skill
      - Show estimated token impact before confirming

### Step 4: Verification Report
- Show updated context summary
- Display completeness change (before vs after)
- Show knowledge loading status (shared / per-skill / not loaded)
- If context is large -> Suggest running `/mvt-check-context`
