---
id: review-output
version: "1.0"
skill: mvt-review
---

## Code Review Report

### Summary
- **Overall Assessment**: {Good / Needs Work / Critical Issues}
- **Files Reviewed**: {count}
- **Critical Issues**: {count}
- **Warnings**: {count}
- **Suggestions**: {count}

### Critical Issues

#### C{N}: {Issue Title}
**File**: `{file}:{line}`
**Issue**: {description}
**Suggestion**: {fix_suggestion}

```{language}
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
- `/mvt-fix` to address critical issues
- `/mvt-test` to add missing tests
