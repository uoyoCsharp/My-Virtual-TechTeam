# #refactor Command

> Load this file when `#refactor` command is invoked.

---

## Purpose

Refactor existing code while preserving behavior.

### Prerequisites
- Code exists to refactor
- Understanding of current behavior

---

## Execution Flow

**Step 1: Analyze Current Code**
- READ target files
- Understand current behavior
- Identify refactoring opportunities

**Step 2: Plan Refactoring**
- Define refactoring goals
- Identify steps
- Ensure behavior preservation

**Step 3: Execute Refactoring**
- Apply changes incrementally
- Verify behavior at each step

---

## Output Structure

```markdown
## Refactoring: {Target}

### Goals
- {goal_1}
- {goal_2}

### Changes
| File | Before | After |
|------|--------|-------|
| {file} | {description} | {description} |

### Behavior Verification
- {how behavior is preserved}

---
**Suggested Next Steps**:
- `#review` to verify changes
- `#test` to run tests
```

---

## Example

```
User: #refactor AuthService - Extract validation logic to separate class

[Developer Mode]

## Refactoring: AuthService Validation Extraction

### Goals
- Extract validation logic from AuthService
- Improve testability
- Follow Single Responsibility Principle

### Changes
| File | Before | After |
|------|--------|-------|
| src/application/AuthService.ts | Contains validation logic | Uses ValidationService |
| src/application/ValidationService.ts | N/A | New file with validation |

### Implementation

#### src/application/ValidationService.ts (New)
```typescript
export class ValidationService {
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidPassword(password: string): boolean {
    return password.length >= 8;
  }
}
```

#### src/application/AuthService.ts (Modified)
```typescript
export class AuthService {
  constructor(
    private userRepo: IUserRepository,
    private hasher: IPasswordHasher,
    private tokenService: ITokenService,
    private validation: ValidationService  // New dependency
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    if (!this.validation.isValidEmail(email)) {
      throw new InvalidEmailError(email);
    }
    // ... rest of method
  }
}
```

### Behavior Verification
- Login flow remains unchanged
- Same validation rules apply
- Same errors thrown

---
**Suggested Next Steps**:
- `#review` to verify changes
- `#test` to run existing tests
```
