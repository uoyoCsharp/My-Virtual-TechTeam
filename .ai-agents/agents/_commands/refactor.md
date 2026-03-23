# #refactor Command

> Load this file when `#refactor` command is invoked.

> **This is a Shortcut Operation.** Can execute at any time without workflow prerequisites. Do NOT update `progress` in `session.yaml` after completion.

---

## Purpose

Refactor existing code while preserving behavior.

### Constraints
- Do NOT change observable behavior — refactoring is structure-only
- Do NOT introduce new features during refactoring
- Do NOT modify unrelated code outside the refactoring scope

---

## Knowledge Dependencies

Before executing refactoring, load the following (if they exist):

| Path | Description |
|------|-------------|
| `.ai-agents/knowledge/patterns/{active}/` | Active architecture pattern knowledge |
| `.ai-agents/knowledge/principle/coding-standards.md` | Project coding standards |

> `{active}` refers to `pattern.active` in `config.yaml`

### Prerequisites
- Code exists to refactor
- Understanding of current behavior

## Prerequisites Check

| Check | Condition | On Failure |
|-------|-----------|------------|
| Refactor target specified | User specified what to refactor | "Please specify what to refactor: `#refactor {target}`" |

---

## Refactoring Types

Classify the refactoring to guide execution:

| Type | Description | Risk Level |
|------|-------------|------------|
| Extract Method/Class | Pull logic into new method or class | Low |
| Rename | Rename symbols for clarity | Low |
| Move | Relocate code to appropriate module/layer | Medium |
| Decompose Conditional | Simplify complex if/switch logic | Medium |
| Replace Inheritance with Composition | Change class hierarchy | High |
| Change Interface/API | Modify public contracts | High |

---

## Execution Flow

**Step 1: Analyze Current Code**
- READ target files
- Understand current behavior
- Identify refactoring type (see table above)
- Identify refactoring opportunities

**Step 2: Risk Assessment**
- Assess risk level based on refactoring type
- Identify all callers/dependents of the target code
- Estimate impact scope (files and modules affected)
- Check for existing tests covering the target code

**Step 3: Plan Refactoring**
- Define refactoring goals
- Identify incremental steps
- Ensure behavior preservation strategy

**Step 4: Execute Refactoring**
- Apply changes incrementally
- Verify behavior at each step

**Step 5: Verify Behavior Preservation**
- If tests exist: suggest running them
- If no tests: describe how to verify behavior is unchanged
- Confirm no regressions in dependent code

---

## Output Structure

````markdown
## Refactoring: {Target}

### Refactoring Type
{type from Refactoring Types table}

### Goals
- {goal_1}
- {goal_2}

### Risk Assessment
- **Risk Level**: {Low | Medium | High}
- **Impact Scope**: {number} files in {number} modules
- **Test Coverage**: {Covered | Partial | None}

### Changes
| File | Action | Before | After |
|------|--------|--------|-------|
| {file} | {Create/Modify/Delete} | {description} | {description} |

### Behavior Verification
- {how behavior is preserved}
- {test commands or manual verification steps}

---
**Suggested Next Steps**:
- `#review` to verify changes
- `#test` to run tests
````

---

## Example

```
User: #refactor AuthService - Extract validation logic to separate class

[Developer Mode]

## Refactoring: AuthService Validation Extraction

### Refactoring Type
Extract Method/Class

### Goals
- Extract validation logic from AuthService
- Improve testability, follow SRP

### Risk Assessment
- **Risk Level**: Low
- **Impact Scope**: 2 files in 1 module (application/)
- **Test Coverage**: Partial (AuthService has tests, new class needs tests)

### Changes
| File | Action | Before | After |
|------|--------|--------|-------|
| src/application/AuthService.ts | Modify | Contains validation logic | Delegates to ValidationService |
| src/application/ValidationService.ts | Create | N/A | New file with extracted validation |

### Behavior Verification
- Login flow remains unchanged — same inputs produce same outputs
- Same validation rules and error messages preserved
- Run: `npm test -- --grep AuthService`

---
**Suggested Next Steps**:
- `#review` to verify changes
- `#test` to add tests for ValidationService
```
