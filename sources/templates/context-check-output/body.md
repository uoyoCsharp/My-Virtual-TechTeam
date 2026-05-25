## Context Load Analysis Report

### Overall Assessment
- **Total Context Size**: ~{total_tokens} tokens
- **Health Status**: {Good / Moderate / High / Overloaded}

### Breakdown by Category
| Category | Files | Est. Tokens | Percentage |
|----------|-------|-------------|------------|
| Index (project-context.yaml) | {n} | {tokens} | {pct}% |
| Semantic Context (project-context.md) | {n} | {tokens} | {pct}% |
| Shared Knowledge | {n} | {tokens} | {pct}% |
| Per-Skill Knowledge | {n} | {tokens} | {pct}% |
| Artifacts | {n} | {tokens} | {pct}% |
| **Total** | **{n}** | **{tokens}** | **100%** |

> Framework-fixed overhead (skill definitions, `core/_framework/`, config, session) is intentionally excluded -- this report shows only what the user can actually optimize.

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
- `/mvt-manage-context` - Add, remove, move, or rename knowledge entries
