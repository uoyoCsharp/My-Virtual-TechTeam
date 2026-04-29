## Execution Flow

### Step 1: Load Requirements
- If file path provided as argument -> Read that file
- If requirements exist in `.ai-agents/workspace/requirements/` -> List files, ask user to select
- Otherwise -> Use requirements text from user message

### Step 2: Extract Information
- Identify features and functionality
- Identify actors and stakeholders
- Extract business rules and constraints
- Note assumptions made

### Step 3: Detect Ambiguities
- Check for unclear requirements
- Check for missing information
- Check for conflicting requirements

### Step 4: Generate Clarification Questions
- If ambiguities found -> List each with specific question, prioritized by impact
- If no ambiguities -> Skip this step

### Step 5: Update Workspace
1. Generate change-id: `{YYYYMMDD}-{slug}` format (e.g., `20260425-user-authentication`)
2. Update `.ai-agents/workspace/session.yaml`:
   - Set `active_change.id` and `active_change.title`
   - Set `active_change.created_at`
   - Set `progress.analyze: done`
   - Set `session.last_command: "/mvt-analyze"`
   - Append one-line summary to `recent_actions` (keep max 3)
3. Update `.ai-agents/workspace/project-context.yaml`:
   - Write to `requirements` section (features, actors, business_rules, clarifications)
4. Write artifact: `.ai-agents/workspace/artifacts/{change-id}/analysis.md`
