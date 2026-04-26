---
id: init-output
version: "1.0"
skill: mvt-init
---

## Project Initialization Complete

### Project: {name}
- **Type**: {type}
- **Pattern**: {pattern}
- **Tech Stack**: {language} / {framework}

### Architecture Pattern Selection

| Detected Pattern | Confidence |
|------------------|------------|
| {pattern_name} | {high/medium/low} |

**Available Patterns**:
1. `ddd` - Domain-Driven Design
2. `clean-architecture` - Layer separation with dependency inversion
3. `frontend-react` - React/Next.js frontend
4. `generic` - Simple projects without specific architecture

**Recommended**: `{suggested_pattern}`

- Reply `yes` to accept
- Reply with pattern name to select different
- Reply `analyze` to create a custom pattern from project analysis
- Reply `none` to proceed without a pattern

### Workspace Updated
- [x] project-context.yaml
- [x] session.yaml

---
**Suggested Next Steps**:
- `/mvt-analyze {requirements}` - Start analyzing requirements
- `/mvt-status` - View project status
