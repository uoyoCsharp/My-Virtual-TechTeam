---
id: status-output
version: "1.0"
skill: mvt-status
---

## Project Status

### Current: {phase} Phase ({agent})

```mermaid
flowchart LR
    A[analyze] ===> B[design] ---> C[implement] ---> D[review] ---> E[test]
    style A fill:#90EE90
    style B fill:#FFD700
    style C fill:#E0E0E0
    style D fill:#E0E0E0
    style E fill:#E0E0E0
```

### Project: {name}
- **Type**: {type}
- **Initialized**: {date}
- **Tech Stack**: {language} / {framework}

### Progress This Session
| Phase | Status | Completed |
|-------|--------|-----------|
| Analyze | {status} | {time} |
| Design | {status} | {time} |
| Implement | {status} | {time} |
| Review | {status} | {time} |
| Test | {status} | {time} |

### Active Change
- **Change ID**: {change_id}
- **Title**: {title}
- **Started**: {date}

---
**Suggested Next Steps**:
- {relevant_next_step}
