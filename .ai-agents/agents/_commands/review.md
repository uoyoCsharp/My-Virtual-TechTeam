# #review Command

> Load this file when `#review` command is invoked.

---

## Purpose

Perform code review for quality, standards compliance, and best practices.

### Constraints
- Do NOT apply fixes directly — only identify and suggest. Fixes are Developer's domain (`#fix`)
- Do NOT make architecture decisions — escalate to Architect (`#design`)
- Do NOT modify source code — this is a read-only review

### Knowledge Dependencies

Before executing review, load the following (if they exist):

| Path | Description |
|------|-------------|
| `.ai-agents/knowledge/core/review-principles.md` | Universal review principles |
| `.ai-agents/knowledge/principle/coding-standards.md` | Project coding standards |
| `.ai-agents/knowledge/patterns/{active}/review-checklist.md` | Pattern-specific checklist |

> `{active}` refers to `pattern.active` in `config.yaml`

### Usage
- `#review` - General code review
- `#review --aspect {type}` - Focused review on specific aspect

### Aspect Options

| Aspect | Focus Areas |
|--------|-------------|
| `architecture` | Pattern compliance, module boundaries, dependency direction |
| `security` | Input validation, injection prevention, authentication |
| `performance` | N+1 queries, memory leaks, caching |
| `style` | Naming conventions, formatting, documentation |

---

## Prerequisites Check

| Check | Condition | On Failure |
|-------|-----------|------------|
| Code to review | Recent implementation files exist or user specified files | "No code to review. Run `#implement` first or specify files." |

---

## Execution Flow

**Step 1: Identify Review Target**
- Latest implementation files
- Files specified by user
- Files in current change

**Step 2: Load Context**
- READ target files
- READ `.ai-agents/workspace/project-context.yaml`
- READ `.ai-agents/knowledge/patterns/{active}/review-checklist.md` (if exists)

**Step 3: Analyze Code**
- Check architecture compliance
- Check code quality issues
- Check error handling
- Check edge cases
- Check readability

**Step 4: Compile Report**
- Categorize issues by severity
- Provide specific suggestions
- Highlight positive patterns

**Step 5: Update Workspace**
- WRITE `.ai-agents/workspace/artifacts/{change-id}/review.md`
- UPDATE `session.yaml` history

---

## Severity Levels

| Level | Description | Action Required |
|-------|-------------|-----------------|
| **Critical** | Bugs, security issues, breaks functionality | Must fix before merge |
| **Warning** | Code quality issues, potential bugs | Should fix |
| **Suggestion** | Improvements, best practices | Nice to have |

---

## Output Structure

````markdown
## Code Review Report

### Summary
- **Overall Assessment**: Good / Needs Work / Critical Issues
- **Files Reviewed**: {count}
- **Critical Issues**: {count}
- **Warnings**: {count}
- **Suggestions**: {count}

### Critical Issues

#### C{N}: {Issue Title}
**File**: `{file}:{line}`
**Issue**: {description}
**Suggestion**: {fix_suggestion}

```typescript
// Current code
{problematic_code}

// Suggested fix
{suggested_code}
```

### Warnings

#### W{N}: {Issue Title}
**File**: `{file}:{line}`
**Issue**: {description}
**Suggestion**: {fix_suggestion}

### Suggestions

#### S{N}: {Suggestion Title}
**File**: `{file}`
**Suggestion**: {improvement}

### Highlights
- {positive_finding_1}
- {positive_finding_2}

---
**Suggested Next Steps**:
- `#fix` to address critical issues
- `#test` to add missing tests
````

---

## Review Checklist

### Architecture Compliance
- [ ] Follows established architecture pattern
- [ ] Correct layer assignment
- [ ] Proper dependency direction
- [ ] Module boundaries respected

### Code Quality
- [ ] Functions are small and focused
- [ ] Naming is clear and consistent
- [ ] No code duplication
- [ ] Proper error handling

### Security (when --aspect security)
- [ ] Input validation present
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] Authentication/authorization correct

### Performance (when --aspect performance)
- [ ] No N+1 queries
- [ ] Appropriate data structures
- [ ] Caching where needed
- [ ] No memory leaks

---

## Example

```
User: #review

[Reviewer Mode]

## Code Review Report

### Summary
- **Overall Assessment**: Needs Work
- **Files Reviewed**: 3
- **Critical Issues**: 1
- **Warnings**: 2
- **Suggestions**: 1

### Critical Issues

#### C1: Missing Null Check
**File**: `src/application/AuthService.ts:25`
**Issue**: User object can be null, accessing properties without check
**Suggestion**: Add null check before accessing user properties

```typescript
// Current
const user = await this.userRepo.findByEmail(email);
return user.name;  // Potential null reference

// Fix
const user = await this.userRepo.findByEmail(email);
if (!user) throw new UserNotFoundError(email);
return user.name;
```

### Warnings

#### W1: Magic Number
**File**: `src/domain/User.ts:15`
**Issue**: Hard-coded `5` for max attempts
**Suggestion**: Extract to constant `MAX_LOGIN_ATTEMPTS = 5`

### Suggestions

#### S1: Use Early Return
**File**: `src/application/AuthService.ts`
**Suggestion**: Use early returns to reduce nesting

### Highlights
- Good use of dependency injection in AuthService

---
**Suggested Next Steps**:
- `#fix` to address C1
- Re-run `#review` after fixes
```
