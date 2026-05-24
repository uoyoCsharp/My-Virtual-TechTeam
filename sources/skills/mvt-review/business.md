## Execution Flow

### Step 1: Identify Review Target
- Latest implementation files from current change
- Files specified by user
- Files in current change artifacts

### Step 2: Load Context
- Read target files
- Read project-context.md for module structure, layer constraints, and business rules
- Load coding standards if available

### Step 3: Analyze Code
- Check layer compliance against project-context.md (layer assignments, dependency direction)
- Check code quality (functions small/focused, naming, duplication)
- Check error handling
- Check edge cases
- Check readability
- If `--aspect` specified -> Focus on that aspect

### Step 4: Categorize Issues
Classify each finding by severity:

| Level | Description | Action Required |
|-------|-------------|-----------------|
| **Critical** | Bugs, security issues, breaks functionality | Must fix before merge |
| **Warning** | Code quality issues, potential bugs | Should fix |
| **Suggestion** | Improvements, best practices | Nice to have |

### Step 5: Write Artifacts
1. Write artifact: `.ai-agents/workspace/artifacts/{change-id}/review.md`

## Review Checklist

### Architecture Compliance
- [ ] Respects existing layer structure from project-context.md
- [ ] Correct layer assignment
- [ ] Proper dependency direction
- [ ] Module boundaries respected

### Code Quality
- [ ] Functions are small and focused
- [ ] Naming is clear and consistent
- [ ] No code duplication
- [ ] Proper error handling
