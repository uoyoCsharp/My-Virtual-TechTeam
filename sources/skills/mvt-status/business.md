## Execution Flow

### Step 1: Load State
- Read `session.yaml` for skill_history, active_change, recent_actions
- Read `project-context.yaml` for project info, tech stack, architecture

### Step 2: Build Activity Timeline
- Parse `skill_history` into chronological timeline
- Group by change-id if multiple skills relate to the same change
- Identify the most recent activity focus

### Step 3: Build Status Report
- Project info summary (name, type, tech stack, pattern)
- Active change details (if any)
- Skill history timeline (recent 5 entries)
- Recent actions summary
- Context completeness indicator

### Step 4: Suggest Next Step
- Based on skill_history and active_change, suggest relevant next skill
- Use registry.yaml to find available skills matching current context
