## Execution Flow

### Step 1: Scan Codebase
- Scan source directories (src/, lib/, app/, etc.)
- Identify entry points
- Map module/directory structure

### Step 2: Extract Entities
- Find domain entities and models
- Identify value objects
- Map relationships between entities

### Step 3: Extract Services
- Find service classes and modules
- Identify API endpoints
- Map dependency graph between services

### Step 4: Analyze Architecture
- Detect architecture pattern (DDD, Clean Architecture, MVC, etc.)
- Assess confidence level
- Identify layer boundaries

### Step 5: Infer Requirements
- Generate feature list from code functionality
- Identify business rules from logic
- Document inferred requirements with confidence levels

### Step 6: Update Workspace
1. Update `.ai-agents/workspace/project-context.yaml`:
   - Write detected architecture to `architecture` section
   - Write discovered modules, entities, services
2. Write artifact: `.ai-agents/workspace/artifacts/code-analysis/{timestamp}-analysis.md`
3. Update `.ai-agents/workspace/session.yaml`:
   - Set `session.last_command: "/mvt-analyze-code"`
   - Append one-line summary to `recent_actions` (keep max 3)
