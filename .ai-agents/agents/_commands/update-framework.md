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
- `workspace/**/*` — Working state
- `knowledge/principle/**/*` — Project coding standards
- `knowledge/project/**/*` — Custom project knowledge

---

## Execution Steps

### Step 1: Detect Platform

Check for platform-specific indicators:

| Platform | Indicators |
|----------|------------|
| Claude Code | `CLAUDE.md` exists, `.claude/` directory |
| GitHub Copilot | `.github/copilot-instructions.md`, `.github/agents/` directory |

### Step 2: Fetch Remote Version

Fetch `registry.yaml` from GitHub and extract the `version` field:
```
https://raw.githubusercontent.com/uoyoCsharp/My-Virtual-TechTeam/main/.ai-agents/registry.yaml
```

Compare with local version from `.ai-agents/registry.yaml`:
- Remote > Local → update available
- Remote == Local → already up to date
- Remote < Local → development mode, skip

### Step 3: Show Update Preview

```markdown
## Framework Update Available

### Version Information
- **Current Version**: {local_version}
- **Available Version**: {remote_version}

### Files to Update
| Category | Files |
|----------|-------|
| Core Framework | .ai-agents/agents/*, .ai-agents/skills/* |
| Platform Adapter | .claude/ or .github/agents/ (based on detected platform) |

### What Will Be Preserved
- workspace/ (your working state)
- knowledge/principle/ (project-specific standards)
- knowledge/project/ (custom project knowledge)

---
Proceed with update? [Y/n]
```

### Step 4: Backup & Apply

1. Create timestamped backup at `.ai-agents/.backup/{timestamp}/`
2. Download latest files from GitHub
3. Apply updates, preserving protected directories
4. Update platform-specific adapter files if needed
5. Verify file integrity and report success/failure

---

## Example

```
User: #update-framework

[Conductor Mode]

## Framework Update Available

### Version Information
- **Current Version**: 0.3.0
- **Available Version**: 0.4.0

### Files to Update
| Category | Files |
|----------|-------|
| Core Framework | .ai-agents/agents/*, .ai-agents/skills/* |
| Platform Adapter | .github/agents/ (GitHub Copilot detected) |

### What Will Be Preserved
- workspace/ (your working state)
- knowledge/principle/ (project-specific standards)
- knowledge/project/ (custom project knowledge)

Proceed with update? [Y/n]

User: Y

Update applied successfully.
- Backup created: .ai-agents/.backup/20260309-143022/
- 12 files updated
- All protected files preserved

---
**Suggested Next Steps**:
- `#status` to verify project state
- `#update-framework check` next time for preview only
```
