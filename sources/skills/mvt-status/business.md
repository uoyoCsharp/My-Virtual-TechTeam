## Execution Flow

### Step 1: Load State
- Read `session.yaml` for skill_history, active_change, recent_actions
- Read `project-context.yaml` for projects list and tech stack
- Read `project-context.md` for semantic context status (exists or not)

### Step 2: Build Activity Timeline
- Parse `skill_history` into chronological timeline
- Group by change-id if multiple skills relate to the same change
- Identify the most recent activity focus

### Step 3: Build Status Report
- Projects summary (list all projects with name, type, tech stack)
- Semantic context status (project-context.md exists or not)
- Active change details (if any)
- Skill history timeline (recent 5 entries)
- Recent actions summary

### Step 4: Suggest Next Step
- Based on skill_history and active_change, suggest relevant next skill
- If project-context.md missing -> suggest `/mvt-analyze-code`
- Use registry.yaml to find available skills matching current context
