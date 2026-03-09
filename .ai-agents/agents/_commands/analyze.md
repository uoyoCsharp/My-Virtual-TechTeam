# #analyze Command

> Load this file when `#analyze` command is invoked.

---

## Purpose

Analyze requirements documents and extract domain concepts.

### Usage
- `#analyze` - Analyze requirements provided in the message
- `#analyze [file]` - Analyze requirements from specified file

---

## Prerequisites Check

| Check | Condition | On Failure |
|-------|-----------|------------|
| Requirements provided | User provided requirements text or specified a file | "No requirements provided. Please include requirements text or specify a file: `#analyze path/to/prd.md`" |

---

## Execution Flow

**Step 1: Load Requirements**
- IF file provided: READ the file
- ELSE IF `workspace/requirements/` contains documents: LIST and present for selection
- ELSE: Use requirements text from user message

**Step 2: Extract Information**
- Identify features and functionality
- Identify actors and stakeholders
- Extract business rules
- Note constraints and assumptions

**Step 3: Detect Ambiguities**
- Check for unclear requirements
- Check for missing information
- Check for conflicting requirements

**Step 4: Generate Clarification Questions** (if needed)
- List each ambiguity with specific question
- Prioritize questions by impact

**Step 5: Update Workspace**
- GENERATE change-id per `_shared.md` Change ID Convention
- UPDATE `workspace/session.yaml` with new change-id and phase progress
- UPDATE `workspace/project-context.yaml` (requirements section)
- WRITE `workspace/artifacts/{change-id}/analysis.md`

---

## Output Structure

```markdown
## Requirements Analysis

### Features Identified
| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| F1 | {name} | {description} | High/Medium/Low |

### Actors
| Actor | Description | Actions |
|-------|-------------|---------|
| User | {description} | {actions} |

### Business Rules
| ID | Rule | Source |
|----|------|--------|
| BR1 | {rule} | {source} |

### Constraints
- {constraint}

### Clarification Needed
| ID | Ambiguity | Question | Impact |
|----|-----------|----------|--------|
| C1 | {ambiguity} | {question} | High/Medium/Low |

### Assumptions Made
| ID | Assumption | Reason |
|----|------------|--------|
| A1 | {assumption} | {reason} |

---
**Suggested Next Steps**:
- Answer clarification questions
- `#design` for architecture design
```

---

## Example

```
User: #analyze
User needs a login feature:
1. Support email/password login
2. Lock account after 5 failed attempts
3. Support "Remember Me" functionality

[Analyst Mode]

## Requirements Analysis

### Features Identified
| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| F1 | Email/Password Login | User authentication via email and password | High |
| F2 | Account Lockout | Lock account after 5 failed login attempts | High |
| F3 | Remember Me | Extend session duration | Medium |

### Actors
- **User**: Regular user requiring authentication

### Business Rules
| ID | Rule | Source |
|----|------|--------|
| BR1 | Lock account after 5 consecutive failures | Requirement |
| BR2 | Unlock mechanism required after lockout | Inferred |

### Clarification Needed
| ID | Question | Impact |
|----|----------|--------|
| C1 | How should locked accounts be unlocked? | High |
| C2 | What is the duration for "Remember Me"? | Medium |

### Assumptions Made
- Token-based authentication, 30-minute lockout duration

---
**Suggested Next Steps**:
- Answer C1-C2 to clarify requirements
- `#design` for architecture
```
