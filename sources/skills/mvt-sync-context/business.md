## Execution Flow

### Step 1: Detect Changes
- If git available:
  - Run `git diff --name-only` (unstaged changes)
  - Run `git diff --name-only --cached` (staged changes)
  - Run `git diff --name-only HEAD~1` (last commit changes)
  - Merge results and deduplicate
- If git not available:
  - Scan for recently modified files in source directories

### Step 2: Analyze Changed Files
- Read each changed file
- Extract entities (classes, models, types)
- Extract services (service classes, API handlers)
- Extract keywords and topics

### Step 3: Update Workspace
1. Update `.ai-agents/workspace/project-context.yaml`:
   - Add new entities to architecture section
   - Add new services
   - Update module mappings
2. Update `.ai-agents/workspace/session.yaml`:
   - Set `session.last_command: "/mvt-sync-context"`
   - Append one-line summary to `recent_actions` (keep max 3)
