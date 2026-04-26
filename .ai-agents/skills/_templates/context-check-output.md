---
id: context-check-output
version: "1.0"
skill: mvt-context-check
---

## Context Load Analysis Report

### Overall Assessment
- **Total Context Size**: ~{total_tokens} tokens
- **Health Status**: {Good / Moderate / High / Overloaded}

### Breakdown by Category
| Category | Files | Est. Tokens | Percentage |
|----------|-------|-------------|------------|
| Core (session + context) | {n} | {tokens} | {pct}% |
| Knowledge | {n} | {tokens} | {pct}% |
| Artifacts | {n} | {tokens} | {pct}% |
| Skills | {n} | {tokens} | {pct}% |
| **Total** | **{n}** | **{tokens}** | **100%** |

### Top 5 Largest Files
| Rank | File | Est. Tokens | Suggestion |
|------|------|-------------|------------|
| 1 | {file} | {tokens} | {suggestion} |
| 2 | {file} | {tokens} | {suggestion} |
| 3 | {file} | {tokens} | {suggestion} |
| 4 | {file} | {tokens} | {suggestion} |
| 5 | {file} | {tokens} | {suggestion} |

### Optimization Recommendations
1. {recommendation_1}
2. {recommendation_2}

---
**Suggested Next Steps**:
- `/mvt-cleanup` - Clean up old artifacts to reduce context size
- `/mvt-context-add` - Update project context if information is outdated
