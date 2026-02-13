# Review Execution Skill

Execute code review against checklists and standards.

## Usage

This skill is invoked by: **Reviewer** (via `#review` command)

## Knowledge Dependencies

Before executing this skill, load the following knowledge files:

| Path | Description | Required |
|------|-------------|----------|
| `knowledge/core/*` | Universal review checklist | Yes |
| `knowledge/principle/review-checklist.md` | Core review checklist | Yes (if exists) |
| `knowledge/principle/coding-standards.md` | Coding standards for review criteria | Yes (if exists) |
| `knowledge/patterns/{active}/review-checklist.md` | Pattern-specific review checklist | Yes |

> Note: `{active}` refers to the active pattern in `config.yaml`

## Capabilities
### Requirement Analysis
- Check code changes against requirements
- Validate implementation of specified features

### Checklist Review
- Architecture compliance check
- Pattern adherence review
- Best practice validation

### Quality Analysis
- Code smell detection
- Complexity assessment
- Maintainability evaluation

### Security Review
- Input validation check
- Error handling review
- Security anti-pattern detection

## Execution

When invoked, perform these steps:

1. **Detect Code Changes**: Identify files and lines changed
2. **Load Checklist**: Get review checklist from knowledge base
3. **Analyze Code**: Read and understand the code
4. **Execute Checks**: Run through each checklist item
5. **Classify Issues**: Categorize by severity
6. **Generate Report**: Produce structured review report

## Review Checklist

### Architecture Compliance
- [ ] Follows defined module boundaries
- [ ] Respects dependency rules
- [ ] Implements required interfaces

### Code Quality
- [ ] Functions are focused (single responsibility)
- [ ] No excessive nesting or complexity
- [ ] Proper naming conventions
- [ ] Appropriate comments (not excessive)

### Error Handling
- [ ] Errors are handled appropriately
- [ ] No silent failures
- [ ] Meaningful error messages


## Output Format

```markdown
## Review Report

### Review Checklist
| Item | Status | Note |
|------|------|------|
| [Item] | ✅/❌ | [Note] |

### Issue List
| Severity | Location | Issue | Suggestion |
|--------|------|------|------|
| 🔴/🟡/🟢 | [Location] | [Issue] | [Suggestion] |

### Summary
[Overall assessment and key recommendations]
```
