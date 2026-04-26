---
id: refactor-output
version: "1.0"
skill: mvt-refactor
---

## Refactoring: {Target}

### Refactoring Type
{type from: Extract Method/Class, Rename, Move, Decompose Conditional, Replace Inheritance with Composition, Change Interface/API}

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
| `{file}` | {Create/Modify/Delete} | {description} | {description} |

### Implementation
```{language}
{refactored_code}
```

### Behavior Verification
- {how_behavior_is_preserved}
- {test_commands_or_manual_verification_steps}

---
**Suggested Next Steps**:
- `/mvt-review` to verify changes
- `/mvt-test` to run tests
