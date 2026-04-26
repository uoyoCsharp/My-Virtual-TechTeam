---
id: test-output
version: "1.0"
skill: mvt-test
---

## Test Design: {Feature Name}

### Test Cases
| ID | Scenario | Input | Expected Output | Type |
|----|----------|-------|-----------------|------|
| T1 | {scenario} | {input} | {expected} | {Happy Path / Edge Case / Negative / Security} |

### Test Code

#### {test_file}
```{language}
{test_code}
```

### Coverage Analysis
| Requirement | Test Coverage | Status |
|-------------|---------------|--------|
| REQ-001 | T1, T2 | {Covered / Missing} |

### Coverage by Type
| Type | Count | Coverage |
|------|-------|----------|
| Happy Path | {n} | {pct}% |
| Edge Case | {n} | {pct}% |
| Negative | {n} | {pct}% |
| Security | {n} | {pct}% |

---
**Suggested Next Steps**:
- Run tests
- `/mvt-fix` if tests fail
