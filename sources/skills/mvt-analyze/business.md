## Execution Flow

### Step 1: Load Requirements
- If file path provided as argument -> Read that file
- If requirements exist in `.ai-agents/workspace/requirements/` -> List files, prompt for selection
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
2. Write artifact: `.ai-agents/workspace/artifacts/{change-id}/analysis.md`
