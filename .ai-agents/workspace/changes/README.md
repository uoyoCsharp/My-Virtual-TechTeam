# Changes Directory

This directory tracks all code changes made through the agent system.

## Purpose

The changes directory provides:

1. **Change Tracking**: Record of all modifications
2. **Audit Trail**: Who, what, when, why
3. **Artifact Storage**: Analysis, design, and review documents
4. **Rollback Reference**: Information to undo changes if needed

## Structure

```
changes/
├── README.md           # This file
├── .rule/              # Rules for this directory
│   └── README.md
├── CHANGELOG.md        # Summary of all changes
└── {change-id}/        # One folder per change
    ├── request.md      # Original request
    ├── analysis.md     # Requirement analysis
    ├── design.md       # Technical design
    ├── review.md       # Code review results
    └── summary.md      # Final summary
```

## Change ID Format

Format: `{YYYYMMDD}-{sequence}-{short-description}`

Example: `20240115-001-add-user-registration`

## Lifecycle

1. **Created**: When a new change request is received
2. **In Progress**: During analysis, design, implementation
3. **Completed**: After successful implementation and review
4. **Archived**: Older changes moved to archive (optional)

## Artifacts

| Artifact | Created By | Purpose |
|----------|------------|---------|
| `request.md` | User/Conductor | Original change request |
| `analysis.md` | Analyst | Requirement breakdown |
| `design.md` | Architect | Technical approach |
| `impact-analysis.md` | Analyst/Architect | For change requests |
| `review.md` | Reviewer | Code review findings |
| `summary.md` | Conductor | Final documentation |

## Usage

Agents automatically:
- Create change folders for new requests
- Store artifacts during workflow phases
- Update CHANGELOG.md on completion

## Rules

See `.rule/README.md` for rules governing this directory.
