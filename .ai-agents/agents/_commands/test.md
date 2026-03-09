# #test Command

> Load this file when `#test` command is invoked.

---

## Purpose

Generate and run tests to validate implementations.

### Knowledge Dependencies

Before executing tests, load the following (if they exist):

| Path | Description |
|------|-------------|
| `knowledge/core/review-principles.md` | Code quality principles |
| `knowledge/patterns/{active}/**` | Active architecture pattern knowledge |
| `knowledge/principle/coding-standards.md` | Project coding standards |

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
- READ `workspace/project-context.yaml`
- Identify test framework from `workspace/project-context.yaml`

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
- WRITE `workspace/artifacts/{change-id}/tests/`
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

```markdown
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
```

---

## Coverage Analysis Format (with --coverage)

```markdown
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
```

---

## Example 1: Basic Test Generation

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
import { AuthService } from '../application/AuthService';
import { MockUserRepository } from './mocks/MockUserRepository';
import { MockPasswordHasher } from './mocks/MockPasswordHasher';

describe('AuthService.login', () => {
  let authService: AuthService;
  let mockRepo: MockUserRepository;
  let mockHasher: MockPasswordHasher;

  beforeEach(() => {
    mockRepo = new MockUserRepository();
    mockHasher = new MockPasswordHasher();
    authService = new AuthService(mockRepo, mockHasher);
  });

  // T1: Valid login
  it('should return token on valid credentials', async () => {
    mockRepo.setMockUser(createValidUser());
    mockHasher.setVerifyResult(true);

    const result = await authService.login('user@test.com', 'password');

    expect(result.success).toBe(true);
    expect(result.token).toBeDefined();
  });

  // T2: Invalid password
  it('should throw InvalidCredentialsError for wrong password', async () => {
    mockRepo.setMockUser(createValidUser());
    mockHasher.setVerifyResult(false);

    await expect(
      authService.login('user@test.com', 'wrongpassword')
    ).rejects.toThrow(InvalidCredentialsError);
  });

  // T3: Non-existent user
  it('should throw UserNotFoundError for unknown email', async () => {
    mockRepo.setMockUser(null);

    await expect(
      authService.login('unknown@test.com', 'password')
    ).rejects.toThrow(UserNotFoundError);
  });

  // T4: Locked account
  it('should throw AccountLockedError for locked user', async () => {
    mockRepo.setMockUser(createLockedUser());

    await expect(
      authService.login('locked@test.com', 'password')
    ).rejects.toThrow(AccountLockedError);
  });

  // T5: Empty email
  it('should throw ValidationError for empty email', async () => {
    await expect(
      authService.login('', 'password')
    ).rejects.toThrow(ValidationError);
  });

  // T6: Invalid email format
  it('should throw InvalidEmailError for invalid email format', async () => {
    await expect(
      authService.login('invalid-email', 'password')
    ).rejects.toThrow(InvalidEmailError);
  });
});
```

---
**Suggested Next Steps**:
- Run: `npm test auth.login.test.ts`
- `#fix` if tests fail
```

---

## Example 2: Coverage Analysis

```
User: #test --coverage User Module

[Tester Mode]

## Test Coverage Analysis: User Module

### Coverage Matrix
| Requirement | Test Cases | Status |
|-------------|------------|--------|
| REQ-001: Login | T1-T6 | Covered |
| REQ-002: Register | T7-T10 | Covered |
| REQ-003: Password Reset | T11 | Partial |
| REQ-004: Profile Update | - | Missing |

### Recommended Additional Tests
| ID | Target | Reason |
|----|--------|--------|
| T12 | REQ-003 | Password reset - missing token invalid case |
| T13 | REQ-004 | Profile update - no coverage |

### Coverage by Type
| Type | Count | Coverage |
|------|-------|----------|
| Happy Path | 4 | 100% |
| Edge Case | 3 | 75% |
| Negative | 3 | 67% |
| Security | 1 | 25% |

### Security Test Gaps
- Token expiration handling
- Rate limiting verification
- CSRF protection

---
**Suggested Next Steps**:
- Add T12, T13 for missing coverage
- Add security tests for token handling
```

---

## Example 3: Edge Case Testing

```
User: #test Order Creation - focus on edge cases

[Tester Mode]

## Test Design: Order Creation (Edge Cases)

### Edge Case Test Cases
| ID | Scenario | Input | Expected | Reason |
|----|----------|-------|----------|--------|
| T1 | Empty cart | cart: [] | Error: Cart empty | Business rule |
| T2 | Out of stock item | item.stock = 0 | Error: Out of stock | Inventory check |
| T3 | Price changed | item.price != cart.price | Warning: Price updated | Data consistency |
| T4 | Concurrent order | Same item, 2 requests | One succeeds, one fails | Race condition |
| T5 | Invalid quantity | quantity: -1 | Error: Invalid quantity | Input validation |
| T6 | Max quantity exceeded | quantity > 100 | Error: Max exceeded | Business rule |

### Test Code

#### order.creation.edge-cases.test.ts
```typescript
describe('Order Creation Edge Cases', () => {
  // T1: Empty cart
  it('should reject order with empty cart', async () => {
    await expect(
      orderService.createOrder({ items: [] })
    ).rejects.toThrow(EmptyCartError);
  });

  // T2: Out of stock
  it('should reject order when item is out of stock', async () => {
    mockInventory.setStock('item-1', 0);

    await expect(
      orderService.createOrder({ items: [{ id: 'item-1', qty: 1 }] })
    ).rejects.toThrow(OutOfStockError);
  });

  // T4: Concurrent order (race condition)
  it('should handle concurrent orders for same item', async () => {
    mockInventory.setStock('item-1', 1);

    const order1 = orderService.createOrder({ items: [{ id: 'item-1', qty: 1 }] });
    const order2 = orderService.createOrder({ items: [{ id: 'item-1', qty: 1 }] });

    const results = await Promise.allSettled([order1, order2]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
  });
});
```

---
**Suggested Next Steps**:
- Run edge case tests
- Add more concurrent scenarios
```
