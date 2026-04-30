# Clean Architecture Review Checklist

Specific review criteria for Clean Architecture implementations.

## The Dependency Rule

### Inward Dependencies

- [ ] Entities have no outward dependencies
- [ ] Use Cases depend only on Entities
- [ ] Interface Adapters depend on Use Cases/Entities
- [ ] Frameworks only depend on Interface Adapters

### No Circular Dependencies

- [ ] Inner layers don't reference outer layers
- [ ] No imports from outer to inner
- [ ] Abstractions defined in inner layer
- [ ] Implementations provided by outer layer

---

## Entities Layer

### Purity

- [ ] No framework dependencies
- [ ] No database annotations
- [ ] No external library imports
- [ ] Pure business objects

### Business Rules

- [ ] Critical business rules in entities
- [ ] Enterprise-wide rules captured
- [ ] Behavior, not just data
- [ ] Reusable across applications

### Independence

- [ ] Would exist without application
- [ ] Not affected by use case changes
- [ ] Not affected by UI changes
- [ ] Not affected by database changes

---

## Use Cases Layer

### Application Logic

- [ ] Application-specific rules here
- [ ] Orchestrates entity behavior
- [ ] Coordinates data flow
- [ ] Single responsibility per use case

### Interface Definitions

- [ ] Input/Output ports defined here
- [ ] Repository interfaces defined here
- [ ] External service interfaces defined here
- [ ] Inner layer controls contracts

### Data Flow

- [ ] Request models for input
- [ ] Response models for output
- [ ] No framework objects cross boundaries
- [ ] Simple data structures at boundaries

---

## Interface Adapters Layer

### Controllers

- [ ] Receives external input
- [ ] Converts to use case format
- [ ] No business logic
- [ ] Thin layer

### Presenters

- [ ] Formats use case output
- [ ] Creates view models
- [ ] No business logic
- [ ] UI-specific formatting only

### Gateways

- [ ] Implements interfaces from use cases
- [ ] Converts external data formats
- [ ] Handles external system details
- [ ] Abstracts infrastructure

### Repository Implementations

- [ ] Implements domain interfaces
- [ ] Handles persistence details
- [ ] Converts between domain and persistence models
- [ ] No business logic

---

## Frameworks Layer

### Framework Isolation

- [ ] Framework code contained here
- [ ] Not leaking into inner layers
- [ ] Configuration in this layer
- [ ] Easy to replace framework

### Database

- [ ] Treated as a detail
- [ ] Repository implementations here
- [ ] ORM configuration here
- [ ] No SQL in inner layers

### UI Framework

- [ ] Treated as a detail
- [ ] Views/components here
- [ ] Routing configuration here
- [ ] No UI logic in inner layers

---

## Boundary Crossing

### Data Transfer

- [ ] Simple data structures cross boundaries
- [ ] No entity leakage to outer layers
- [ ] Request/Response models used
- [ ] Mapping at boundaries

### Dependency Inversion

- [ ] Inner layer defines interfaces
- [ ] Outer layer implements
- [ ] Injection at composition root
- [ ] No new operator for implementations in inner layers

---

## Testability

### Unit Testing

- [ ] Entities testable without mocks
- [ ] Use cases testable with mock gateways
- [ ] No framework needed for core tests
- [ ] Fast execution

### Integration Testing

- [ ] Can test with real implementations
- [ ] Boundaries make integration clear
- [ ] External systems mockable
- [ ] End-to-end scenarios testable

---

## Code Organization

### Package/Namespace Structure

- [ ] Clear separation by layer
- [ ] Consistent naming convention
- [ ] Easy to locate code
- [ ] Dependencies visible in imports

### Module Boundaries

- [ ] Modules respect layer boundaries
- [ ] Inter-module dependencies follow rules
- [ ] Clear public APIs per module
- [ ] Internal details hidden

---

## Anti-Patterns to Watch

### Dependency Violations

- [ ] No direct database access in use cases
- [ ] No framework objects in entities
- [ ] No UI concerns in business logic
- [ ] No outward dependencies from core

### Bloated Layers

- [ ] Controllers are thin
- [ ] Use cases are focused
- [ ] No "god" objects
- [ ] Single responsibility maintained

### Missing Abstraction

- [ ] External services behind interfaces
- [ ] Database behind repositories
- [ ] Third-party libraries wrapped
- [ ] Detail changes don't affect core

---

## Severity Levels

### Critical

- Dependencies point outward (violates core rule)
- Business logic in controllers/presenters
- Framework leakage into entities
- Direct database access in use cases

### Major

- Missing boundary interfaces
- Use case doing too much
- Entity with infrastructure concerns
- Circular dependencies

### Minor

- Inconsistent layer naming
- Missing mapping at boundary
- Test depends on framework
- Response model too complex
