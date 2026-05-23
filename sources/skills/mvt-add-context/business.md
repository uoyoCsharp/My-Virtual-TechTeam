## Execution Flow

### Step 1: Assess Current State
- Read project-context.yaml and evaluate completeness:
  - Project name empty -> Mark as "not initialized"
  - Requirements empty -> Mark as "no requirements"
  - Architecture empty -> Mark as "no architecture"
- Read config.yaml:
  - Check `pattern.active`
- Read registry.yaml:
  - Check `knowledge.shared` for current shared knowledge list
- Calculate and display context completeness percentage

### Step 2: Guided Information Collection
Based on what is missing, guide the user through relevant sections:

**If not initialized** (project basics):
- Project name, type, description
- Tech stack (language, framework, build tool, test framework)
- Suggest running `/mvt-init` for automatic detection

**If no requirements** (requirements & background):
- Main features and goals
- User roles and use cases
- Known constraints and limitations

**If no architecture** (architecture info):
- Architecture pattern (DDD / Clean Architecture / etc.)
- Module structure
- Key technical decisions

**Supplementary information** (always available):
- Project-specific coding standards
- Team conventions
- Third-party integration details

### Step 3: Write Context
Based on information collected:
1. Update `.ai-agents/workspace/project-context.yaml` (matching fields)
2. If coding standards or project knowledge provided:
   a. Write knowledge files to `.ai-agents/knowledge/principle/` or `knowledge/project/`
   b. Create or update `manifest.yaml` in the knowledge directory
   c. Determine how this knowledge should be loaded:
      - **All skills (shared)**: Append entry to `registry.yaml` > `knowledge.shared`
      - **Specific skills only**: Append entry to `registry.yaml` > `skills.{name}.knowledge`
        for each selected skill (with `type: "static"`)
      - **Skip auto-loading**: Available but not auto-loaded by any skill
      - Show estimated token impact before confirming
3. Update `config.yaml` `pattern.active` if user confirmed architecture pattern

### Step 4: Verification Report
- Show updated context summary
- Display completeness change (before vs after)
- Show knowledge loading status (shared / per-skill / not loaded)
- If context is large -> Suggest running `/mvt-check-context`
