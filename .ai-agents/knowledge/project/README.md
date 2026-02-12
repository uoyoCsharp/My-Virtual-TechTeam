# Project Knowledge

This directory contains project-specific knowledge that extends the framework's built-in knowledge base.

## Purpose

Use this directory to document:

- Team-specific coding conventions
- Project-specific patterns and decisions
- Business domain glossary
- API conventions
- Naming standards beyond defaults
- Architectural decisions specific to this project

## How to Use

### Adding Knowledge

Create markdown files in this directory following the standard format:

```markdown
# Title

## Section 1
Content...

## Section 2
Content...
```

### Files Suggestions

| File | Purpose |
|------|---------|
| `team-conventions.md` | Team-specific coding standards |
| `domain-glossary.md` | Business domain terminology |
| `api-standards.md` | API design conventions |
| `architecture-decisions.md` | Project ADRs |
| `naming-conventions.md` | Project-specific naming rules |

### Integration

Reference this knowledge in `config/preferences.yaml`:

```yaml
custom_practices:
  file_path: "knowledge/project/team-conventions.md"
  override_defaults: false  # set to true to prioritize over defaults
```

## Example: team-conventions.md

```markdown
# Team Conventions

## Git Commit Messages

- Format: `type(scope): description`
- Types: feat, fix, docs, refactor, test
- Scope: module or component name
- Description: imperative mood, lowercase

Example: `feat(auth): add password reset functionality`

## Code Comments

- Use English for all code comments
- Document "why", not "what"
- Required for complex algorithms
- Required for public APIs

## Error Handling

- Use custom exception types
- Include correlation IDs in logs
- Never swallow exceptions without logging
- Use structured logging format
```

## Loading Behavior

1. Core knowledge is always loaded
2. Pattern knowledge loaded based on active pattern
3. Project knowledge loaded if files exist
4. `custom_practices.file_path` explicitly included in prompts
