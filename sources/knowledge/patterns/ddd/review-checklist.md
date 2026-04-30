# DDD Review Checklist

Specific review criteria for Domain-Driven Design implementations.

## Aggregate Design

### Boundaries

- [ ] Aggregate boundaries align with consistency requirements
- [ ] Aggregates are as small as possible
- [ ] Cross-aggregate references are by ID, not object reference
- [ ] Each aggregate can be persisted independently

### Root Entity

- [ ] Only the root is accessible from outside
- [ ] Root enforces all aggregate invariants
- [ ] Root controls access to internal entities
- [ ] External changes go through root methods

### Invariants

- [ ] All business rules enforced within aggregate
- [ ] Invalid state cannot be created
- [ ] Invariants checked on every state change
- [ ] Constructors/factories ensure valid initial state

---

## Entity Design

### Identity

- [ ] Entity has clear identity
- [ ] ID type is appropriate (Guid, long, etc.)
- [ ] ID generation strategy is defined
- [ ] Equality based on ID

### Encapsulation

- [ ] Private setters for properties
- [ ] State changes through methods
- [ ] No direct collection manipulation
- [ ] Internal state properly protected

### Behavior

- [ ] Rich behavior, not just data
- [ ] Methods named using domain language
- [ ] Business logic in entity, not services
- [ ] Validation in business methods

---

## Value Object Design

### Immutability

- [ ] All properties are readonly
- [ ] No methods that modify state
- [ ] "Modification" returns new instance
- [ ] Thread-safe by design

### Equality

- [ ] Equality based on all attributes
- [ ] GetHashCode implemented correctly
- [ ] Equals handles null properly
- [ ] Consistent with domain semantics

### Validation

- [ ] Validated in constructor
- [ ] Invalid values throw exceptions
- [ ] No partial/invalid instances possible
- [ ] Error messages are meaningful

---

## Domain Event Design

### Structure

- [ ] Named in past tense
- [ ] Contains all relevant context
- [ ] Immutable after creation
- [ ] Includes timestamp

### Usage

- [ ] Events raised when significant things happen
- [ ] Events capture business meaning
- [ ] Handlers don't modify originating aggregate
- [ ] Event naming uses ubiquitous language

---

## Repository Design

### Interface

- [ ] Interface defined in Domain layer
- [ ] One repository per aggregate type
- [ ] Methods use domain language
- [ ] Returns domain objects, not persistence entities

### Implementation

- [ ] Implementation in Infrastructure layer
- [ ] Abstract persistence details
- [ ] Handle concurrency appropriately
- [ ] Efficient queries for use cases

---

## Domain Service Design

### Responsibility

- [ ] Stateless operations only
- [ ] Clear reason why not in an entity
- [ ] Named using domain language
- [ ] Single responsibility

### Dependencies

- [ ] Depends on interfaces, not implementations
- [ ] Can be injected
- [ ] Doesn't hold state between calls
- [ ] Accesses aggregates through repositories

---

## Layer Architecture

### Domain Layer

- [ ] Contains entities, value objects, domain services
- [ ] No dependencies on infrastructure
- [ ] No framework annotations (if possible)
- [ ] Pure business logic only

### Application Layer

- [ ] Orchestrates domain objects
- [ ] Handles transactions
- [ ] No business logic here
- [ ] Coordinates between aggregates

### Infrastructure Layer

- [ ] Repository implementations
- [ ] External service integrations
- [ ] Framework-specific code
- [ ] Depends on domain layer

---

## Ubiquitous Language

### Naming

- [ ] Code uses domain terminology
- [ ] Same terms as domain experts
- [ ] Consistent across codebase
- [ ] Reflects actual business concepts

### Documentation

- [ ] Domain concepts documented
- [ ] Glossary maintained
- [ ] Code comments use domain language
- [ ] Team understands terminology

---

## Anti-Patterns to Watch

### Anemic Domain Model

- [ ] Entities have behavior, not just data
- [ ] Business logic not in services alone
- [ ] Domain objects are more than DTOs

### Big Ball of Mud

- [ ] Clear bounded contexts
- [ ] Explicit boundaries
- [ ] Context relationships defined

### God Aggregate

- [ ] Aggregates are focused
- [ ] Not too many entities
- [ ] Clear consistency needs

### Repository for Non-Aggregates

- [ ] Repositories only for aggregate roots
- [ ] No repositories for entities within aggregates
- [ ] No repositories for value objects

---

## Severity Levels for DDD Issues

### Critical

- Aggregate boundaries don't protect invariants
- Business rules can be bypassed
- Invalid domain state possible
- Security vulnerabilities through domain bypass

### Major

- Anemic domain model
- Repository for non-aggregate
- Business logic in wrong layer
- Missing domain events for important occurrences

### Minor

- Naming doesn't match ubiquitous language
- Aggregate slightly too large
- Value object could be extracted
- Event naming not in past tense
