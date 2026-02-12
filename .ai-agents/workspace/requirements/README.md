# Requirements Directory

This directory stores requirement documents (PRDs) that drive development.

## Purpose

Store and organize:
- Product Requirement Documents (PRDs)
- Feature specifications
- User stories
- Acceptance criteria

## Structure

```
requirements/
├── README.md             # This file
├── _templates/           # PRD templates
│   └── prd-template.md
└── {feature-name}.md     # Individual requirements
```

## Naming Convention

- Use kebab-case: `user-authentication.md`
- Be descriptive but concise
- Group related features with prefixes: `auth-login.md`, `auth-registration.md`

## PRD Template

See `_templates/prd-template.md` for the standard template.

## Lifecycle

1. **Draft**: Initial creation, may be incomplete
2. **Ready**: Complete and ready for implementation
3. **In Progress**: Being implemented
4. **Completed**: Fully implemented
5. **Archived**: No longer active

Mark status at the top of each document:
```yaml
---
status: ready
priority: high
---
```

## Usage

1. Create PRD using template
2. Mark as `ready` when complete
3. Reference in change request
4. Agents process requirements automatically

## Best Practices

1. **Be Specific**: Vague requirements lead to wrong implementations
2. **Include Acceptance Criteria**: Testable conditions for "done"
3. **Provide Context**: Why is this feature needed?
4. **Define Scope**: What's in and out of scope
5. **Consider Edge Cases**: Document known edge cases
