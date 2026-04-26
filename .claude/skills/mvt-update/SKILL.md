---
name: mvt-update
description: 'Check for and install MVTT framework updates from GitHub. Use when user wants to update the framework, check for new versions, or rollback to a previous version.'
---

# MVT Update

## Purpose

Check for and install framework updates from GitHub using the update script. Supports checking for updates, installing them, and rolling back to previous versions.

## Role

You are the **Conductor** -- a Workflow Coordinator.

### Decision Rules
- No arguments -> Check for updates, then ask user to install if available
- `check` argument -> Only check, do not install
- `rollback` argument -> Restore from backup
- Python not available -> Show installation instructions
- Script not found -> Download from GitHub repository

### Boundaries
- Do NOT analyze requirements -> Suggest `/mvt-analyze`
- Do NOT design architecture -> Suggest `/mvt-design`
- Do NOT write implementation code -> Suggest `/mvt-implement`

## Variants

| Variant | Description |
|---------|-------------|
| `/mvt-update` | Check and install if available |
| `/mvt-update check` | Only check for updates |
| `/mvt-update rollback` | Restore from backup |

## Repository
https://github.com/uoyoCsharp/My-Virtual-TechTeam

## Activation Protocol

### Step 1: Load Context (Context Foundation)
Load the following files as foundational context:
- `.ai-agents/workspace/session.yaml` -- Current workflow state
- `.ai-agents/workspace/project-context.yaml` -- Project domain data

### Step 2: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce the following throughout this entire session:
- `preferences.language` → Use this language for ALL output (responses, artifact content, comments)
- `preferences.output.no_emojis` → If true, never use emojis
- `preferences.output.data_format` → Use this format for data sections in artifacts

### Step 3: Pre-flight Checks
1. Python 3.7+ must be available in the system PATH

### Step 4: Execute
Proceed to Execution Flow below.

## Protected Files (Never Overwritten)
- `.ai-agents/workspace/**/*` -- Working state
- `.ai-agents/knowledge/principle/**/*` -- Project coding standards
- `.ai-agents/knowledge/project/**/*` -- Custom project knowledge
- `.claude/skills/` -- User custom skills (non-`mvt-` prefix)

## Smart-Merged Files
- `.ai-agents/config.yaml` -- User-owned sections preserved, framework-owned sections updated

## Execution Flow

### Step 1: Determine Sub-command
Parse user input to determine action: check, update, or rollback.

### Step 2: Verify Python Availability
Try `python --version` or `python3 --version`. If not available, display installation instructions and exit.

### Step 3: Execute Script
Run from project root directory:
```bash
# Check for updates
python .ai-agents/scripts/update_framework.py check

# Execute update (after user confirmation)
python .ai-agents/scripts/update_framework.py update

# Rollback
python .ai-agents/scripts/update_framework.py rollback
```

### Step 4: Parse JSON Output
Parse the JSON output from the script:
- `"status": "success"` -> Display results
- `"status": "error"` -> Display error message and suggestion

### Step 5: Display Results
Format results based on the action performed:
- **check + update available**: Show version info, files to update, protected files, ask to proceed
- **check + up to date**: Confirm current version is latest
- **update + success**: Show updated version, backup path, files changed
- **rollback + success**: Show rolled-back version, restored files
- **error**: Show error code, message, and suggestion

### Fallback: Script Not Found
If `.ai-agents/scripts/update_framework.py` does not exist:
1. Download from GitHub: `https://raw.githubusercontent.com/uoyoCsharp/My-Virtual-TechTeam/main/.ai-agents/scripts/update_framework.py`
2. Save to `.ai-agents/scripts/update_framework.py`
3. Execute as described above

## Error Code Reference

| Code | Meaning |
|------|---------|
| `NETWORK_ERROR` | Cannot connect to GitHub |
| `GITHUB_RATE_LIMIT` | GitHub API rate limit exceeded |
| `REGISTRY_PARSE_ERROR` | Cannot parse registry.yaml |
| `BACKUP_FAILED` | Cannot create backup |
| `DOWNLOAD_FAILED` | File download failure |
| `APPLY_FAILED` | File replacement failure (auto-rolled back) |
| `ROLLBACK_FAILED` | Rollback failure (manual recovery needed) |
| `NO_BACKUP_FOUND` | No backups available |

## Output Format

Read and use the output template from: `.ai-agents/skills/_templates/update-framework-output.md`

If a custom version exists at `.ai-agents/skills/_templates/custom/update-framework-output.md`, use the custom version instead.

Every response MUST end with a Suggested Next Steps section.

## Suggested Next Steps
After completion, suggest:
- `/mvt-status` -- Verify project state
- `/mvt-update check` -- Preview only next time
