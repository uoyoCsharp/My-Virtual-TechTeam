## Execution Flow

### Step 1: Load Design Context
- Read architecture design from artifacts
- Read module structure and layer constraints from `project-context.md`
- Read coding standards if available
- Identify files to create or modify

### Step 2: Plan Implementation
- Map design components to file structure
- Define implementation order (dependencies first)
- Identify shared utilities or base classes needed
- Respect existing layer boundaries from project-context.md

### Step 3: Implement Code
- Follow architecture module boundaries
- Use interfaces defined in design
- Apply coding standards
- Add error handling at system boundaries
- Include inline comments for complex logic only

### Step 4: Verify Design Compliance
- Check each file against its designated module/layer
- Verify dependency direction against project-context.md layer constraints
- Confirm interface contracts are satisfied

### Step 5: Write Artifacts
1. Write artifact: `.ai-agents/workspace/artifacts/{change-id}/implementation.md`
2. Write the actual code files to the project
