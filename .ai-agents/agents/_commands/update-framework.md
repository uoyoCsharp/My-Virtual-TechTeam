# #update-framework Command

> Load this file when `#update-framework` command is invoked.

---

## Purpose

Check for and install framework updates from GitHub using the update script.

### Repository
https://github.com/uoyoCsharp/My-Virtual-TechTeam

### Variants

| Variant | Description |
|---------|-------------|
| `#update-framework check` | Only check for updates |
| `#update-framework` | Check and install if available |
| `#update-framework rollback` | Restore from backup |

---

## Prerequisites

- Python 3.7+ must be available in the system PATH

---

## Protected Files (Never Overwritten by Script)
- `.ai-agents/workspace/**/*` — Working state
- `.ai-agents/knowledge/principle/**/*` — Project coding standards
- `.ai-agents/knowledge/project/**/*` — Custom project knowledge

## Smart-Merged Files
- `.ai-agents/config.yaml` — User-owned sections (`system`, `output`, `pattern`, `knowledge`) are preserved from the local file; framework-owned sections (`name`, `version`, `directories`, and any new keys) are updated from remote

---

## Execution Flow

### Step 1: Determine Sub-command

Parse user input to determine the action:

| User Input | Action |
|------------|--------|
| `#update-framework` | Run `check` → if update available, ask user → run `update` |
| `#update-framework check` | Run `check` only |
| `#update-framework rollback` | Run `rollback` |

### Step 2: Verify Python Availability

Before calling the script, verify Python is available. Try `python --version` or `python3 --version`.

If Python is **not** available, display:

```markdown
## Python Required

The update script requires Python 3.7+. Please install Python:
- **Windows**: https://www.python.org/downloads/
- **macOS**: `brew install python3`
- **Linux**: `sudo apt install python3` or `sudo yum install python3`

After installing, run `#update-framework` again.
```

### Step 3: Execute Script

Run the script from the **project root directory** and capture its JSON output from stdout.

```bash
# Check for updates
python .ai-agents/scripts/update_framework.py check

# Execute update (after user confirmation)
python .ai-agents/scripts/update_framework.py update

# Rollback to latest backup
python .ai-agents/scripts/update_framework.py rollback

# Rollback to specific backup
python .ai-agents/scripts/update_framework.py rollback --backup 20260312-143022

# List available backups (useful before rollback)
python .ai-agents/scripts/update_framework.py list-backups
```

> On macOS/Linux, use `python3` if `python` is not available.

### Step 4: Parse JSON Output

The script outputs a JSON object to stdout. Parse it and act based on `status`:

- `"status": "success"` → display results (see display templates below)
- `"status": "error"` → display error message and suggestion from `error` object

### Step 5: Display Results

#### check → update available

```markdown
## Framework Update Available

### Version Information
- **Current Version**: {data.local_version}
- **Available Version**: {data.remote_version}
- **Detected Platforms**: {data.platforms_detected}

### Files to Update
| Category | Files |
|----------|-------|
[Generate from data.remote_file_tree — group by category keys]

### Protected (Will NOT Be Modified)
- .ai-agents/workspace/ (your working state)
- .ai-agents/knowledge/principle/ (project-specific standards)
- .ai-agents/knowledge/project/ (custom project knowledge)

---
Proceed with update? [Y/n]
```

#### check → already up to date

```markdown
## Framework Up to Date
Your framework is at the latest version (**{data.local_version}**).
```

#### check → development mode

```markdown
## Development Mode
Local version (**{data.local_version}**) is newer than remote (**{data.remote_version}**). No update needed.
```

#### update → success

```markdown
## Update Successful

- **Updated**: {data.previous_version} → {data.updated_version}
- **Backup**: {data.backup_path}
- **Files Updated**: {len(data.files_updated)}
- **Files Added**: {len(data.files_added)}
- **Files Merged** (user settings preserved): {data.files_merged}
- **Platform Adapters Updated**: {data.platform_adapters_updated}
- **Integrity Check**: {data.integrity_check}

---
**Suggested Next Steps**:
- `#status` to verify project state
- `#update-framework check` next time for preview only
```

#### rollback → success

```markdown
## Rollback Successful

- **Rolled Back**: {data.rolled_back_from} → {data.rolled_back_to}
- **Backup Used**: {data.backup_used}
- **Files Restored**: {data.files_restored}
```

#### error (any command)

```markdown
## Update Error

**Error**: [{error.code}] {error.message}
**Suggestion**: {error.suggestion}
```

If the error includes `data.rollback_performed: true`, also display:
```markdown
> The update has been automatically rolled back. Your framework remains at version {data.current_version}.
```

---

## Error Code Reference

| Code | Meaning |
|------|---------|
| `NETWORK_ERROR` | Cannot connect to GitHub |
| `GITHUB_RATE_LIMIT` | GitHub API rate limit exceeded |
| `REGISTRY_PARSE_ERROR` | Cannot parse registry.yaml |
| `VERSION_PARSE_ERROR` | Invalid version number format |
| `BACKUP_FAILED` | Cannot create backup |
| `DOWNLOAD_FAILED` | File download failure |
| `APPLY_FAILED` | File replacement failure (auto-rolled back) |
| `ROLLBACK_FAILED` | Rollback failure (manual recovery needed) |
| `NO_BACKUP_FOUND` | No backups available |
| `PYTHON_VERSION_ERROR` | Python version too old |

---

## Fallback: Script Not Found

If `.ai-agents/scripts/update_framework.py` does not exist (e.g., framework version < 1.3):

1. Download the script directly from GitHub:
   ```
   https://raw.githubusercontent.com/uoyoCsharp/My-Virtual-TechTeam/main/.ai-agents/scripts/update_framework.py
   ```
2. Save it to `.ai-agents/scripts/update_framework.py`
3. Then execute the script as described above

---

## Example

```
User: #update-framework

[Conductor Mode]

> Running update check...

$ python .ai-agents/scripts/update_framework.py check
{JSON output captured}

## Framework Update Available

### Version Information
- **Current Version**: 1.2
- **Available Version**: 1.3
- **Detected Platforms**: claude_code, github_copilot

### Files to Update
| Category | Count |
|----------|-------|
| Core Framework | 3 files |
| Agents | 6 files |
| Commands | 14 files |
| Skills | 1 file |
| Platform: Claude Code | 1 file |
| Platform: GitHub Copilot | 6 files |

### Protected (Will NOT Be Modified)
- .ai-agents/workspace/ (your working state)
- .ai-agents/knowledge/principle/ (project-specific standards)
- .ai-agents/knowledge/project/ (custom project knowledge)

---
Proceed with update? [Y/n]

User: Y

> Applying update...

$ python .ai-agents/scripts/update_framework.py update
{JSON output captured}

## Update Successful

- **Updated**: 1.2 → 1.3
- **Backup**: .ai-agents/.backup/20260312-143022
- **Files Updated**: 28
- **Files Added**: 2
- **Platform Adapters Updated**: CLAUDE.md, .github/agents/* (6 files)
- **Integrity Check**: passed

---
**Suggested Next Steps**:
- `#status` to verify project state
- `#update-framework check` next time for preview only
```
