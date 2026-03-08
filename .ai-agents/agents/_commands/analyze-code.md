# #analyze-code Command

> Load this file when `#analyze-code` command is invoked.

---

## Purpose

Reverse-analyze existing code to generate context and infer requirements.

### When to Use
- Understanding an existing codebase
- Generating documentation for legacy code
- Onboarding to a new project

---

## Prerequisites Check

| Check | Condition | On Failure |
|-------|-----------|------------|
| Source code exists | Project has source files to analyze | "No source code found. Please ensure the project has source files." |

---

## Execution Flow

**Step 1: Scan Codebase**
- SCAN source directories
- IDENTIFY entry points
- MAP module structure

**Step 2: Extract Entities**
- FIND domain entities
- IDENTIFY value objects
- MAP relationships

**Step 3: Extract Services**
- FIND service classes
- IDENTIFY APIs/endpoints
- MAP dependencies

**Step 4: Generate Context**
- WRITE `workspace/context/architecture.yaml` (inferred)
- WRITE `workspace/state/code-mapping.yaml`
- WRITE `workspace/state/semantic-index.yaml`

**Step 5: Infer Requirements**
- GENERATE feature list from code
- IDENTIFY business rules from logic
- DOCUMENT inferred requirements

---

## Output Format

```markdown
## Code Analysis Report

### Detected Architecture
- **Pattern**: {detected_pattern}
- **Confidence**: {confidence_level}

### Module Structure
```
{module_tree}
```

### Entities Extracted
| Entity | Type | File | Attributes |
|--------|------|------|------------|
| User | Entity | src/domain/User.ts | id, email, name |

### Services Identified
| Service | Purpose | File |
|---------|---------|------|
| AuthService | Authentication | src/application/AuthService.ts |

### API Endpoints
| Method | Path | Handler |
|--------|------|---------|
| POST | /auth/login | AuthService.login |

### Inferred Features
| Feature | Evidence | Confidence |
|---------|----------|------------|
| User Login | AuthService.login | High |

### Inferred Requirements
1. {inferred_requirement}

---
**Suggested Next Steps**:
- Review inferred requirements
- `#design` to formalize architecture
- `#init --deep` for complete analysis
```

---

## Example

```
User: #analyze-code

[Analyst Mode]

## Code Analysis Report

### Detected Architecture
- **Pattern**: DDD (Domain-Driven Design)
- **Confidence**: High
- **Indicators**: src/domain/, src/application/, src/infrastructure/

### Module Structure

| Directory | Layer | Files |
|-----------|-------|-------|
| `src/domain/` | Domain Layer | User.ts, UserRepository.ts |
| `src/application/` | Application Layer | UserService.ts |
| `src/infrastructure/` | Infrastructure Layer | UserRepositoryImpl.ts |

### Entities Extracted
| Entity | Type | File | Key Attributes |
|--------|------|------|----------------|
| User | Aggregate Root | src/domain/User.ts | id, email, passwordHash |

### Services Identified
| Service | Purpose |
|---------|---------|
| UserService | User CRUD operations |

### Inferred Features
| Feature | Evidence | Confidence |
|---------|----------|------------|
| User Management | User entity + UserService | High |
| Authentication | passwordHash field | High |

---
**Suggested Next Steps**:
- `#design` to formalize architecture
- `#status` to check current state
```
