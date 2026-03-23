# #test Command

> Load this file when `#test` command is invoked.

---

## Purpose

Generate and run tests to validate implementations.

### Constraints
- Do NOT modify the code being tested — if bugs are found, report and suggest `#fix`
- Do NOT make architecture decisions — test against the existing design
- Do NOT skip edge cases or negative tests — these are equally important

### Knowledge Dependencies

Before executing tests, load the following (if they exist):

| Path | Description |
|------|-------------|
| `.ai-agents/knowledge/core/review-principles.md` | Code quality principles |
| `.ai-agents/knowledge/patterns/{active}/**` | Active architecture pattern knowledge |
| `.ai-agents/knowledge/principle/coding-standards.md` | Project coding standards |

> `{active}` refers to `pattern.active` in `config.yaml`

### Usage
- `#test` - Generate tests for recent implementation
- `#test {feature}` - Generate tests for specific feature
- `#test --coverage` - Generate tests with coverage analysis

---

## Prerequisites Check

| Check | Condition | On Failure |
|-------|-----------|------------|
| Implementation exists | Implementation files exist to test | "No implementation found. Run `#implement` first." |

---

## Execution Flow

**Step 1: Load Context**
- READ implementation files
- READ `.ai-agents/workspace/project-context.yaml`
- Identify test framework from `.ai-agents/workspace/project-context.yaml`

**Step 2: Analyze Test Scenarios**
- Identify happy path scenarios
- Identify edge cases
- Identify error scenarios
- Identify security test cases

**Step 3: Design Test Cases**
- Create test case table
- Define inputs and expected outputs
- Define preconditions

**Step 4: Write Test Code**
- Follow project's test framework conventions
- Write clear test names
- Include assertions

**Step 5: Update Workspace**
- WRITE test files
- WRITE `.ai-agents/workspace/artifacts/{change-id}/tests/`
- UPDATE `session.yaml` history

---

## Test Case Types

| Type | Description | Priority |
|------|-------------|----------|
| Happy Path | Normal successful flow | High |
| Edge Case | Boundary conditions | High |
| Negative | Invalid inputs, errors | High |
| Security | Authentication, injection | Medium |
| Performance | Load, stress | Low |

---

## Output Structure

````markdown
## Test Design: {Feature Name}

### Test Cases
| ID | Scenario | Input | Expected Output | Type |
|----|----------|-------|-----------------|------|
| T1 | {scenario} | {input} | {expected} | Happy Path |
| T2 | {scenario} | {input} | {expected} | Edge Case |

### Test Code

#### {test_file}.test.ts
```typescript
describe('{Feature}', () => {
  // Test implementation
});
```

### Coverage Analysis (with --coverage)
| Requirement | Test Coverage | Status |
|-------------|---------------|--------|
| REQ-001 | T1, T2 | Covered |
| REQ-002 | - | Missing |

---
**Suggested Next Steps**:
- Run tests
- `#fix` if tests fail
````

---

## Coverage Analysis Format (with --coverage)

````markdown
## Test Coverage Analysis

### Coverage Matrix
| Requirement | Test Cases | Status |
|-------------|------------|--------|
| REQ-001 | T1, T2, T3 | Covered |
| REQ-002 | T4 | Covered |
| REQ-003 | - | Missing |

### Recommended Additional Tests
| ID | Target | Reason |
|----|--------|--------|
| T-new | REQ-003 | No coverage for this requirement |

### Coverage by Type
| Type | Count | Coverage |
|------|-------|----------|
| Happy Path | 3 | 100% |
| Edge Case | 2 | 80% |
| Negative | 2 | 60% |
| Security | 1 | 40% |
````

---

## Example

```
User: #test User Login Feature

[Tester Mode]

## Test Design: User Login

### Test Cases
| ID | Scenario | Input | Expected Output | Type |
|----|----------|-------|-----------------|------|
| T1 | Valid login | valid email, valid password | Success, token returned | Happy Path |
| T2 | Invalid password | valid email, wrong password | Error: Invalid credentials | Negative |
| T3 | Non-existent user | unknown email | Error: User not found | Negative |
| T4 | Locked account | locked user credentials | Error: Account locked | Edge Case |
| T5 | Empty email | "", password | Error: Email required | Edge Case |
| T6 | Invalid email format | "invalid", password | Error: Invalid email | Edge Case |

### Test Code

#### auth.login.test.ts
```typescript
describe('AuthService.login', () => {
  // T1: Valid login
  it('should return token on valid credentials', async () => {
    // ... setup mocks, call login, assert success + token
  });

  // T2: Invalid password
  it('should throw InvalidCredentialsError for wrong password', async () => {
    // ... setup mocks, assert rejects with InvalidCredentialsError
  });

  // T3-T6: Follow same pattern for remaining scenarios
});
```

### Coverage Analysis (with --coverage)
| Requirement | Test Cases | Status |
|-------------|------------|--------|
| REQ-001: Login | T1-T6 | Covered |
| REQ-002: Register | - | Missing |

---
**Suggested Next Steps**:
- Run: `npm test auth.login.test.ts`
- `#fix` if tests fail
```
