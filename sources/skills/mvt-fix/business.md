## Execution Flow

### Step 1: Understand the Issue
- Parse user description of the bug
- Identify affected files and modules
- Reproduce or confirm the issue

### Step 2: Root Cause Analysis
- Generate hypotheses for the bug cause
- Examine relevant code for each hypothesis
- Test each hypothesis against the evidence
- Identify the confirmed root cause

### Step 3: Plan the Fix
- Determine the minimal change required
- Check for side effects on related code
- Verify the fix won't break existing behavior

### Step 4: Apply the Fix
- Make the targeted code change
- Verify fix addresses the root cause
- Document what was changed and why

### Step 5: Update Workspace
1. Update `.ai-agents/workspace/session.yaml`:
   - Set `session.last_command: "/mvt-fix"`
   - Append one-line summary to `recent_actions` (keep max 3)
   - Do NOT update `progress` (shortcut operation)
