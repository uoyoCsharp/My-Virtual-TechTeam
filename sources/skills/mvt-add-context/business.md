## Execution Flow

### Step 1: Assess Current State
- Read project-context.yaml and evaluate completeness:
  - Project name empty -> Mark as "not initialized"
  - Requirements empty -> Mark as "no requirements"
  - Architecture empty -> Mark as "no architecture"
- Read config.yaml:
  - Check `pattern.active`
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
2. Update `.ai-agents/workspace/session.yaml` (if initialization changed)
3. If coding standards provided -> Write to `.ai-agents/knowledge/principle/`
4. If project knowledge provided -> Write to `.ai-agents/knowledge/project/`
5. Update `config.yaml` `pattern.active` if user confirmed architecture pattern

### Step 4: Verification Report
- Show updated context summary
- Display completeness change (before vs after)
- If context is large -> Suggest running `/mvt-check-context`
- Suggest next steps
