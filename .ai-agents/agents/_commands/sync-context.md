# #sync-context Command

> Load this file when `#sync-context` command is invoked.

---

## Purpose

Synchronize context with code changes after manual modifications.

### When to Use
- After manual code changes outside the workflow
- When context seems out of sync with code
- After git operations (merge, rebase, etc.)

---

## Prerequisites Check

| Check | Condition | On Failure |
|-------|-----------|------------|
| Project initialized | `workspace/context/project.yaml` is non-empty | "Project not initialized. Run `#init` first." |

---

## Execution Flow

1. **Detect Changes**
   - IF git available: RUN `git diff --name-only HEAD~1`
   - ELSE: Scan for recently modified files

2. **Analyze Changed Files**
   - Extract entities
   - Extract services
   - Extract keywords

3. **Update Workspace**
   - UPDATE `workspace/state/code-mapping.yaml`
   - UPDATE `workspace/state/semantic-index.yaml`

---

## Output Format

```markdown
## Context Sync Complete

### Files Analyzed
| File | Change Type | Entities | Services |
|------|-------------|----------|----------|
| src/domain/User.ts | Modified | User | - |
| src/application/UserService.ts | Modified | - | UserService |

### Index Updates
- **Topics added**: 3
- **Entities added**: 2
- **Keywords added**: 5

---
**Suggested Next Steps**:
- Continue with your current task
- `#status` to verify context state
```

---

## Example

```
User: #sync-context

[Conductor Mode]

## Context Sync Complete

### Files Analyzed
| File | Change Type | Entities | Services |
|------|-------------|----------|----------|
| src/domain/User.ts | Modified | User | - |
| src/application/AuthService.ts | Added | - | AuthService |

### Index Updates
- **Topics added**: 3
- **Entities added**: 2
- **Keywords added**: 5

---
**Suggested Next Steps**:
- Continue with your current task
```
