# #fix Command

> Load this file when `#fix` command is invoked.

> **This is a Shortcut Operation.** Can execute at any time without workflow prerequisites. Do NOT update `progress` in `session.yaml` after completion.

---

## Purpose

Fix bugs and issues with smart context loading.

### Constraints
- Do NOT modify architecture design or domain model structure — only fix the reported issue
- Do NOT refactor surrounding code — keep changes minimal and focused on the bug
- Do NOT skip user confirmation before applying changes

---

## Knowledge Dependencies

Before executing fix, load the following (if they exist):

| Path | Description |
|------|-------------|
| `knowledge/principle/coding-standards.md` | Project coding standards |
| `knowledge/patterns/{active}/` | Active architecture pattern (for context) |

> `{active}` refers to `pattern.active` in `config.yaml`

---

## Prerequisites Check

| Check | Condition | On Failure |
|-------|-----------|------------|
| Issue described | User provided a problem description | "Please describe the issue to fix." |

---

## Context Loading

Uses smart context loading — load related source files only. See `skills/_system/context-loader.md` for rules.

---

## Bug Classification

Classify the bug to guide analysis and fix strategy:

| Type | Indicators | Fix Strategy |
|------|-----------|--------------|
| Compile Error | Build fails, type errors, syntax errors | Fix syntax/types, check imports |
| Runtime Error | Uncaught exceptions, null references, crashes | Add guards, fix data flow |
| Logic Error | Wrong output, incorrect behavior, failed tests | Trace logic, compare expected vs actual |
| Performance | Slow response, high memory, timeouts | Profile, optimize hot paths |
| Integration | API failures, data format mismatch, timeout | Check contracts, validate I/O |

---

## Execution Flow

**Step 1: Classify & Analyze Issue**
- Classify bug type (see Bug Classification above)
- Understand the problem description
- Identify affected files
- Determine root cause

**Step 2: Load Appropriate Context**
- Based on issue complexity, load minimal/moderate/full context
- Use `workspace/project-context.yaml` to locate related modules

**Step 3: Propose Fix**
- Present fix with explanation
- Highlight potential side effects
- Assess regression risk

**Step 4: Apply Fix** (after confirmation)
- Modify files with minimal changes

**Step 5: Verify Fix**
- Confirm the fix addresses the root cause (not just symptoms)
- If test framework available: suggest or run relevant tests
- If no tests: describe manual verification steps
- Check for regressions in related functionality

---

## Output Structure

````markdown
## Bug Fix: {Issue Description}

### Problem Analysis
- **Type**: {Compile Error | Runtime Error | Logic Error | Performance | Integration}
- **File**: {file}
- **Line**: {line_number}
- **Root Cause**: {root_cause}

### Proposed Fix
{explanation of fix}

### Code Change
```{language}
// Before
{original_code}

// After
{fixed_code}
```

### Potential Side Effects
- {side_effect_1}

### Verification
- {how to confirm fix works}
- {regression check}

---
**Suggested Next Steps**:
- Confirm fix
- `#review` to verify
- `#test` to add regression tests
````

---

## Example

```
User: #fix Invalid email format causes 500 error on login

[Developer Mode]

## Bug Fix: Email Format Validation

### Problem Analysis
- **Type**: Runtime Error
- **File**: src/application/AuthService.ts
- **Line**: 25
- **Root Cause**: Invalid email passed to database query before validation

### Proposed Fix
Add email format validation before database query.

### Code Change (TypeScript)
// Before
const user = await this.userRepo.findByEmail(email);

// After
if (!this.isValidEmail(email)) throw new InvalidEmailError(email);
const user = await this.userRepo.findByEmail(email);

### Potential Side Effects
- None — validation is additive

### Verification
- Send invalid email → expect 400 with "Invalid email" message
- Send valid email → login flow unchanged

---
**Suggested Next Steps**:
- Confirm fix
- `#test` to add validation tests
```
