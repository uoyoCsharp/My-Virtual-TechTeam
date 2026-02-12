# Software Engineering Principles

Core principles that apply to all software development regardless of technology or architecture.

## SOLID Principles

### Single Responsibility Principle (SRP)

A class should have only one reason to change.

**What it means:**
- Each class/module should have one specific purpose
- Changes to one concern shouldn't affect unrelated functionality

**Indicators of violation:**
- Class has multiple unrelated methods
- Changes in one area require changes in unrelated areas
- Difficult to name the class without using "and" or "or"

**Example - Before:**
```
class UserService:
    def create_user()
    def send_email()
    def generate_report()
```

**Example - After:**
```
class UserService:
    def create_user()

class EmailService:
    def send_email()

class ReportService:
    def generate_report()
```

### Open/Closed Principle (OCP)

Open for extension, closed for modification.

**What it means:**
- Add new functionality by adding new code
- Avoid modifying existing, working code

**How to achieve:**
- Use interfaces and abstractions
- Apply strategy pattern
- Use composition over inheritance

### Liskov Substitution Principle (LSP)

Subtypes must be substitutable for their base types.

**What it means:**
- Derived classes must honor the contracts of base classes
- Code using a base class should work correctly with any subclass

**Indicators of violation:**
- Subclass throws unexpected exceptions
- Subclass has empty/no-op implementations of base methods
- Type checking before calling methods

### Interface Segregation Principle (ISP)

Clients shouldn't depend on interfaces they don't use.

**What it means:**
- Prefer small, focused interfaces
- Don't force implementations to include unused methods

**Example - Before:**
```
interface Worker:
    work()
    eat()
    sleep()
```

**Example - After:**
```
interface Workable:
    work()

interface Feedable:
    eat()

interface Sleepable:
    sleep()
```

### Dependency Inversion Principle (DIP)

Depend on abstractions, not concretions.

**What it means:**
- High-level modules shouldn't depend on low-level modules
- Both should depend on abstractions

**Implementation:**
- Use interfaces/abstract classes
- Apply dependency injection
- Configure dependencies at composition root

---

## Other Important Principles

### DRY (Don't Repeat Yourself)

Every piece of knowledge should have a single, unambiguous representation.

**Application:**
- Extract common code into shared functions
- Use configuration for magic values
- Create reusable components

**Caution:**
- Don't over-DRY: some duplication is acceptable if concepts are different
- "Duplication is far cheaper than the wrong abstraction" - Sandi Metz

### KISS (Keep It Simple, Stupid)

Simplicity should be a key goal in design.

**Application:**
- Prefer simple solutions over clever ones
- Write code that is easy to read and understand
- Avoid premature optimization

### YAGNI (You Aren't Gonna Need It)

Don't add functionality until it's necessary.

**Application:**
- Implement only what's needed now
- Avoid speculative generalization
- Let requirements drive implementation

### Composition Over Inheritance

Favor composition over class inheritance.

**Why:**
- More flexible: can change behavior at runtime
- Avoids tight coupling
- Supports better encapsulation

**When to use inheritance:**
- True "is-a" relationships
- Sharing behavior across class hierarchies
- Framework extension points

### Separation of Concerns

Divide program into distinct sections handling separate concerns.

**Common separations:**
- Business logic vs. presentation
- Data access vs. business rules
- Configuration vs. implementation

### Fail Fast

Detect and report errors as early as possible.

**Application:**
- Validate inputs at entry points
- Use assertions and guard clauses
- Throw exceptions rather than returning error codes

---

## Code Organization Principles

### High Cohesion

Elements within a module should be related.

**Indicators of high cohesion:**
- Methods operate on the same data
- Methods are called together
- Changes tend to be localized

### Low Coupling

Minimize dependencies between modules.

**Techniques:**
- Use interfaces
- Apply dependency injection
- Communicate through events/messages

### Law of Demeter

Only talk to immediate friends.

**Rule:** A method should only call methods on:
- Its own object (this/self)
- Parameters passed to it
- Objects it creates
- Its direct component objects

**Avoid:** Long chains like `a.getB().getC().doSomething()`

---

## Review Checklist

When reviewing code, verify:

- [ ] Does each class have a single responsibility?
- [ ] Can new features be added without modifying existing code?
- [ ] Are abstractions used appropriately?
- [ ] Is there unnecessary duplication?
- [ ] Is the code as simple as it can be?
- [ ] Are there unused features or speculative implementations?
- [ ] Is composition preferred over inheritance where appropriate?
- [ ] Are concerns properly separated?
- [ ] Are errors detected early?
