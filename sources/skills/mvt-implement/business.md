## Execution Flow

### Step 1: Load Design Context
- Read architecture design from artifacts
- Read module structure from `project-context.yaml`
- Read coding standards if available
- Identify files to create or modify

### Step 2: Plan Implementation
- Map design components to file structure
- Define implementation order (dependencies first)
- Identify shared utilities or base classes needed

### Step 3: Implement Code
- Follow architecture module boundaries
- Use interfaces defined in design
- Apply coding standards
- Add error handling at system boundaries
- Include inline comments for complex logic only

### Step 4: Verify Design Compliance
- Check each file against its designated module/layer
- Verify dependency direction (no layer violations)
- Confirm interface contracts are satisfied

### Step 5: Update Workspace
1. Update `.ai-agents/workspace/session.yaml`:
   - Set `progress.implement: done`
   - Set `session.last_command: "/mvt-implement"`
   - Append one-line summary to `recent_actions` (keep max 3)
2. Write artifact: `.ai-agents/workspace/artifacts/{change-id}/implementation.md`
3. Write the actual code files to the project
