## Project Initialization Complete

### Detected Projects

| Name | Path | Type | Language | Framework |
|------|------|------|----------|-----------|
| {name} | `{path}` | {type} | {language} | {framework} |

### Workspace Updated
- [x] project-context.yaml -- lean index written
- [x] session.yaml -- initialized_at updated

### Project State

Detected condition: `{condition}` -- one of `has_existing_code`, `empty_project`, `default`

---
**Suggested Next Steps**:

Render from `registry.yaml > skills.mvt-init.next_suggestions`:

1. Find the entry in `conditional[]` whose `condition` matches the detected state above. If none matches, use the entry with `condition: "default"`.
2. Render that entry as the **primary** recommendation:
   - `/{primary}` -- {primary_desc}
3. Render every entry in `alternatives[]` as additional options:
   - `/{skill}` -- {desc}
