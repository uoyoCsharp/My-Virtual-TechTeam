# Code Quality Standards

Universal code quality standards that apply across all technology stacks.

## Readability

### Naming

**Variables:**
- Use descriptive, intention-revealing names
- Avoid single letters (except loop counters)
- Don't encode type in name (Hungarian notation)

```
# Bad
d = 0  # elapsed time in days
userInt = 5

# Good
elapsedTimeInDays = 0
maxRetryCount = 5
```

**Functions/Methods:**
- Use verbs for actions: `calculateTotal()`, `validateInput()`
- Ask questions with booleans: `isValid()`, `hasPermission()`
- Be specific: `getUserById()` not `getUser()`

**Classes:**
- Use nouns: `User`, `OrderProcessor`
- Avoid generic names: `Manager`, `Helper`, `Utils`
- Name based on responsibility

### Functions

**Size:**
- Keep functions small (ideally < 20 lines)
- Do one thing well
- One level of abstraction per function

**Parameters:**
- Minimize parameters (0-3 ideal)
- Group related parameters into objects
- Avoid flag arguments

**Return Values:**
- Return early to avoid nesting
- Be consistent with return types
- Prefer returning objects over null

### Comments

**Good comments:**
- Explain "why," not "what"
- Document public APIs
- Warn about consequences
- TODO markers for future work

**Avoid:**
- Redundant comments that repeat code
- Commented-out code
- Journal comments

### Formatting

- Consistent indentation
- Logical grouping with blank lines
- Related code should be vertically close
- Horizontal alignment if it aids readability

---

## Maintainability

### Code Smells to Avoid

**Bloaters:**
- Long methods
- Large classes
- Long parameter lists
- Data clumps

**Object-Orientation Abusers:**
- Switch statements (consider polymorphism)
- Parallel inheritance hierarchies
- Refused bequest

**Change Preventers:**
- Divergent change (one class changed for multiple reasons)
- Shotgun surgery (one change requires many class modifications)

**Dispensables:**
- Dead code
- Speculative generality
- Duplicate code
- Lazy classes

**Couplers:**
- Feature envy (method uses another class more than its own)
- Inappropriate intimacy (classes too tightly coupled)
- Message chains (long chains of method calls)

### Refactoring Techniques

**Extract:**
- Extract method
- Extract class
- Extract interface

**Move:**
- Move method/field to appropriate class
- Push down/pull up in hierarchy

**Rename:**
- Rename for clarity
- Consistent naming across codebase

**Simplify:**
- Replace conditional with polymorphism
- Remove middle man
- Inline unnecessary indirection

---

## Reliability

### Error Handling

**Principles:**
- Use exceptions for exceptional conditions
- Don't catch generic exceptions
- Provide context in error messages
- Clean up resources properly

**Patterns:**
```
# Good: Specific handling
try:
    process(data)
except ValidationError as e:
    log.warning(f"Invalid data: {e}")
    return bad_request()
except DatabaseError as e:
    log.error(f"Database failed: {e}")
    raise

# Bad: Swallowing exceptions
try:
    process(data)
except:
    pass
```

### Input Validation

- Validate at system boundaries
- Use whitelisting over blacklisting
- Sanitize before use
- Fail fast on invalid input

### Defensive Programming

- Check preconditions
- Validate postconditions
- Use assertions for invariants
- Handle null/undefined explicitly

---

## Performance Considerations

### General Guidelines

- Measure before optimizing
- Optimize hot paths
- Consider algorithmic complexity
- Cache expensive computations

### Common Issues

**N+1 Queries:**
- Fetch related data in batches
- Use eager loading when appropriate

**Memory:**
- Dispose/close resources
- Use streaming for large data
- Be aware of memory allocation

**Async/Parallel:**
- Don't block on async
- Use appropriate parallelization
- Handle cancellation

---

## Security Basics

### Input Handling

- Never trust user input
- Parameterize queries (prevent SQL injection)
- Encode output (prevent XSS)
- Validate file uploads

### Authentication/Authorization

- Use established libraries
- Hash passwords properly
- Implement proper session management
- Apply principle of least privilege

### Data Protection

- Encrypt sensitive data at rest
- Use HTTPS for transmission
- Don't log sensitive data
- Implement proper access controls

---

## Testing Considerations

### Testability

- Design for testability (dependency injection)
- Keep functions pure when possible
- Avoid hidden dependencies
- Minimize global state

### Test Quality

- Test behavior, not implementation
- Use meaningful test names
- Arrange-Act-Assert pattern
- One assertion per test (when practical)

---

## Quality Metrics

### Cyclomatic Complexity

- Measure of code paths
- Lower is better (< 10 recommended)
- High complexity = hard to test

### Code Coverage

- Aim for meaningful coverage (70-80%+)
- Focus on critical paths
- Don't chase 100% blindly

### Technical Debt

- Track and manage actively
- Allocate time for reduction
- Don't let it accumulate
