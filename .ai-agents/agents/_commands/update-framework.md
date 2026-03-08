# #update-framework Command

> Load this file when `#update-framework` command is invoked.

---

## Purpose

Check for and install framework updates from GitHub.

### Repository
https://github.com/uoyoCsharp/My-Virtual-TechTeam

### Variants

| Variant | Description |
|---------|-------------|
| `#update-framework check` | Only check for updates |
| `#update-framework` | Check and install if available |
| `#update-framework rollback` | Restore from backup |

---

## Protected Files (Never Overwritten)
- `workspace/**/*` - Working state
- `knowledge/principle/**/*` - Project coding standards
- `knowledge/project/**/*` - Custom project knowledge

---

## Output Format

```markdown
## Framework Update

### Current Version: {local_version}
### Latest Version: {remote_version}

### Changes
| File | Action |
|------|--------|
| agents/conductor.md | Update |
| skills/context-loader.md | Update |

### Preserved
- workspace/** (your working state)
- knowledge/principle/** (your standards)

---
Proceed with update? [Y/n]
```

---

## Execution Steps

1. **Check Remote Version**
   - Fetch latest version info from GitHub

2. **Compare Versions**
   - If up-to-date: Report and exit
   - If update available: Show changelog

3. **Backup Current** (before update)
   - Create backup of files to be updated

4. **Apply Update**
   - Download new files
   - Preserve protected directories

5. **Verify**
   - Check file integrity
   - Report success/failure
