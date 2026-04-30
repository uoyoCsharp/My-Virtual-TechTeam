## Execution Flow

### Step 1: Analyze Current Code
- Read target files
- Understand current behavior
- Classify refactoring type from the types table
- Identify refactoring opportunities

### Step 2: Risk Assessment
- Assess risk level based on refactoring type
- Identify all callers/dependents of the target code
- Estimate impact scope (files and modules affected)
- Check for existing tests covering the target code

### Step 3: Plan Refactoring
- Define refactoring goals
- Identify incremental steps
- Ensure behavior preservation strategy

### Step 4: Execute Refactoring
- Apply changes incrementally
- Verify behavior at each step

### Step 5: Verify Behavior Preservation
- If tests exist -> Suggest running them
- If no tests -> Describe how to verify behavior is unchanged
- Confirm no regressions in dependent code

### Step 6: Update Workspace
1. Update `.ai-agents/workspace/session.yaml`:
   - Set `session.last_command: "/mvt-refactor"`
   - Append one-line summary to `recent_actions` (keep max 3)
   - Do NOT update `progress` (shortcut operation)
