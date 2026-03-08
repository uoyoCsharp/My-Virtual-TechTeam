# #fix Command

> Load this file when `#fix` command is invoked.

---

## Purpose

Fix bugs and issues with smart context loading.

---

## Prerequisites Check

| Check | Condition | On Failure |
|-------|-----------|------------|
| Issue described | User provided a problem description | "Please describe the issue to fix." |

---

## Context Loading

Uses smart context loading. See `skills/_system/context-loader.md` for rules.

---

## Execution Flow

**Step 1: Analyze Issue**
- Understand the problem description
- Identify affected files
- Determine root cause

**Step 2: Load Appropriate Context**
- Based on issue complexity, load minimal/moderate/full context

**Step 3: Propose Fix**
- Present fix with explanation
- Highlight potential side effects

**Step 4: Apply Fix** (after confirmation)
- Modify files
- Test if possible

---

## Output Structure

```markdown
## Bug Fix: {Issue Description}

### Problem Analysis
- **File**: {file}
- **Line**: {line_number}
- **Root Cause**: {root_cause}

### Proposed Fix
{explanation of fix}

### Code Change
```typescript
// Before
{original_code}

// After
{fixed_code}
```

### Potential Side Effects
- {side_effect_1}

---
**Suggested Next Steps**:
- Confirm fix
- `#review` to verify
```

---

## Example

```
User: #fix Invalid email format causes 500 error on login

[Developer Mode]

## Bug Fix: Email Format Validation

### Problem Analysis
- **File**: src/application/AuthService.ts
- **Line**: 25
- **Root Cause**: Invalid email format is passed to database query before validation

### Proposed Fix
Move email format validation before database query.

### Code Change
```typescript
// Before (line 25)
async login(email: string, password: string): Promise<LoginResult> {
  const user = await this.userRepo.findByEmail(email); // Error here
  // ...
}

// After
async login(email: string, password: string): Promise<LoginResult> {
  if (!this.isValidEmail(email)) {
    throw new InvalidEmailError(email);
  }
  const user = await this.userRepo.findByEmail(email);
  // ...
}

private isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
```

### Potential Side Effects
- None - validation is additive

---
**Suggested Next Steps**:
- Confirm fix
- `#test` to add validation tests
```
