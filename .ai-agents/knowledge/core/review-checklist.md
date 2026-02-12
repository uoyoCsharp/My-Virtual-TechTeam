# Code Review Checklist

Universal checklist for code review applicable across all technology stacks.

## Pre-Review

Before starting the review, verify:

- [ ] Build passes
- [ ] Tests pass
- [ ] Code compiles without warnings
- [ ] Required documentation is included

---

## Functionality

### Correctness

- [ ] Code does what it's supposed to do
- [ ] All acceptance criteria are met
- [ ] Edge cases are handled
- [ ] Error scenarios are covered

### Completeness

- [ ] No TODO items left unaddressed
- [ ] No placeholder implementations
- [ ] All required validations present
- [ ] Logging/monitoring added if needed

### Business Logic

- [ ] Business rules correctly implemented
- [ ] Calculations are accurate
- [ ] State transitions are valid
- [ ] Authorization checks in place

---

## Code Quality

### Readability

- [ ] Code is easy to understand
- [ ] Variable/function names are descriptive
- [ ] Complex logic has comments explaining "why"
- [ ] Consistent formatting and style

### Design

- [ ] Single Responsibility Principle followed
- [ ] No unnecessary complexity
- [ ] Appropriate abstractions used
- [ ] No code duplication

### Maintainability

- [ ] Code can be easily modified
- [ ] Dependencies are manageable
- [ ] Configuration externalized where appropriate
- [ ] No hardcoded values that should be configurable

---

## Architecture

### Layer Compliance

- [ ] Code is in the correct layer/module
- [ ] Dependencies flow in the right direction
- [ ] No circular dependencies
- [ ] Boundaries are respected

### Pattern Compliance

- [ ] Follows established patterns for the project
- [ ] Consistent with existing codebase
- [ ] Uses appropriate design patterns
- [ ] Anti-patterns avoided

### API Design

- [ ] Interface is intuitive
- [ ] Backward compatibility considered
- [ ] Versioning applied if needed
- [ ] Documentation complete

---

## Error Handling

### Exception Handling

- [ ] Appropriate exceptions used
- [ ] Exceptions not swallowed without reason
- [ ] Error messages are helpful
- [ ] Sensitive info not exposed in errors

### Validation

- [ ] Input validation present
- [ ] Validation messages are clear
- [ ] Null/empty checks where needed
- [ ] Boundary conditions handled

### Recovery

- [ ] Graceful degradation where appropriate
- [ ] Retry logic if needed
- [ ] Cleanup on failure
- [ ] Transaction rollback if applicable

---

## Security

### Input Security

- [ ] All user input validated
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS prevented (output encoding)
- [ ] Path traversal prevented

### Authentication/Authorization

- [ ] Authentication required where needed
- [ ] Authorization checks in place
- [ ] Principle of least privilege followed
- [ ] Session handling secure

### Data Protection

- [ ] Sensitive data encrypted
- [ ] Secrets not hardcoded
- [ ] PII handled appropriately
- [ ] Audit logging if required

---

## Performance

### Efficiency

- [ ] No obvious performance issues
- [ ] Appropriate data structures used
- [ ] Algorithms have reasonable complexity
- [ ] Database queries are efficient

### Resource Management

- [ ] Connections properly closed
- [ ] Memory leaks avoided
- [ ] File handles released
- [ ] Caching used appropriately

### Scalability

- [ ] Code handles load appropriately
- [ ] Stateless where possible
- [ ] Batch operations for bulk data
- [ ] Async used where beneficial

---

## Testing

### Test Coverage

- [ ] Unit tests for new logic
- [ ] Edge cases tested
- [ ] Error paths tested
- [ ] Integration points tested

### Test Quality

- [ ] Tests are readable
- [ ] Tests are maintainable
- [ ] Tests are independent
- [ ] No test code in production

---

## Documentation

### Code Documentation

- [ ] Public APIs documented
- [ ] Complex logic explained
- [ ] Assumptions documented
- [ ] Examples provided where helpful

### External Documentation

- [ ] README updated if needed
- [ ] API docs updated
- [ ] Architecture docs updated
- [ ] Deployment notes added if needed

---

## Review Verdict

Based on the checklist, the review verdict should be:

### APPROVED
- All critical items pass
- No blockers identified
- Minor suggestions can be addressed later

### REQUIRES CHANGES
- One or more critical issues found
- Must be fixed before merge
- Re-review required after fixes

### NEEDS DISCUSSION
- Significant design concerns
- Architecture implications
- Need team input before proceeding

---

## Issue Severity Levels

### Critical (Must Fix)
- Security vulnerabilities
- Data corruption risk
- Crashes/exceptions
- Requirements not met

### Major (Should Fix)
- Performance issues
- Design problems
- Missing error handling
- Code maintainability issues

### Minor (Consider Fixing)
- Style inconsistencies
- Minor optimizations
- Documentation improvements
- Naming suggestions
