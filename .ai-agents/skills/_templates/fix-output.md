---
id: fix-output
version: "1.0"
skill: mvt-fix
---

## Bug Fix: {Issue Description}

### Issue Analysis
- **Symptom**: {what_user_observes}
- **Root Cause**: {why_it_happens}
- **Impact**: {what_is_affected}

### Root Cause Analysis
| # | Hypothesis | Evidence | Result |
|---|-----------|----------|--------|
| 1 | {hypothesis} | {evidence} | {confirmed/rejected} |

### Fix Applied
| File | Line | Before | After |
|------|------|--------|-------|
| `{file}` | {line} | {old_code} | {new_code} |

### Implementation
```{language}
{fix_code}
```

### Verification
- {how_to_verify_fix}
- {test_command_if_applicable}

---
**Suggested Next Steps**:
- `/mvt-review` to verify the fix
- `/mvt-test` to add regression tests
