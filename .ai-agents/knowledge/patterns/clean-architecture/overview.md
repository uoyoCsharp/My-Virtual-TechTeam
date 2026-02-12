# Clean Architecture Overview

Clean Architecture is an architectural pattern that organizes code into concentric layers with strict dependency rules, making systems testable, maintainable, and independent of external concerns.

## Core Principle: The Dependency Rule

> Source code dependencies must point only inward, toward higher-level policies.

Nothing in an inner circle can know anything about something in an outer circle.

---

## The Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Frameworks & Drivers                      │
│                  (Web, UI, DB, Devices)                      │
│    ┌─────────────────────────────────────────────────────┐  │
│    │                Interface Adapters                    │  │
│    │          (Controllers, Gateways, Presenters)        │  │
│    │    ┌─────────────────────────────────────────────┐  │  │
│    │    │            Application Business              │  │  │
│    │    │               (Use Cases)                    │  │  │
│    │    │    ┌─────────────────────────────────────┐  │  │  │
│    │    │    │       Enterprise Business            │  │  │  │
│    │    │    │          (Entities)                  │  │  │  │
│    │    │    └─────────────────────────────────────┘  │  │  │
│    │    └─────────────────────────────────────────────┘  │  │
│    └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1. Entities (Enterprise Business Rules)

The innermost circle containing enterprise-wide business rules.

**Contains:**
- Business objects with critical business rules
- Data structures with methods
- Entities that would exist even outside this application

**Characteristics:**
- Most stable code
- Least likely to change
- No dependencies on outer layers

### 2. Use Cases (Application Business Rules)

Application-specific business rules.

**Contains:**
- Use case interactors
- Application-specific logic
- Orchestration of entity behavior

**Characteristics:**
- Defines what the application does
- Coordinates data flow to/from entities
- Implements application-specific rules

### 3. Interface Adapters

Convert data between use cases/entities and external formats.

**Contains:**
- Controllers (receive input)
- Presenters (format output)
- Gateways (abstract external services)
- Repository implementations

**Characteristics:**
- Translates data formats
- No business logic
- Implements interfaces defined by inner layers

### 4. Frameworks & Drivers

The outermost layer with external dependencies.

**Contains:**
- Web frameworks
- Database systems
- UI frameworks
- External libraries

**Characteristics:**
- Most volatile code
- All "details" live here
- Easily replaceable

---

## Key Concepts

### Boundaries

Clear separation points between layers.

**Rules:**
- Cross boundaries with simple data structures
- Inner layers define interfaces
- Outer layers provide implementations

### Dependency Inversion

Inner layers define abstractions; outer layers implement them.

```
┌─────────────┐      ┌─────────────┐
│  Use Case   │ ──── │  Interface  │
│             │      │  (abstract) │
└─────────────┘      └─────────────┘
                           ▲
                           │ implements
                     ┌─────────────┐
                     │   Gateway   │
                     │(outer layer)│
                     └─────────────┘
```

### Input/Output Data

**Request Model (Input):**
- Simple data structure
- Contains input data for use case
- No business logic

**Response Model (Output):**
- Simple data structure
- Contains output data from use case
- Formatted by presenter for display

---

## Benefits

### Testability

- Core business logic tested without frameworks
- Use cases tested without UI/database
- Mocking at boundaries

### Independence

- **Framework Independent**: Use frameworks as tools, not foundations
- **Database Independent**: Change databases without affecting business logic
- **UI Independent**: Swap UIs without changing use cases
- **External Agency Independent**: Business rules don't know about outside world

### Maintainability

- Clear separation of concerns
- Changes localized to appropriate layer
- Easy to understand code organization

---

## Comparison with Other Patterns

| Aspect | Clean Architecture | Hexagonal | Onion |
|--------|-------------------|-----------|-------|
| Core | Entities | Domain Model | Domain Model |
| Business Logic | Use Cases | Application | Application Services |
| Adapters | Interface Adapters | Ports & Adapters | Infrastructure |
| Dependency | Inward | Inward | Inward |

---

## When to Use

**Good fit:**
- Long-lived applications
- Need for testability
- Expected technology changes
- Complex business logic
- Multiple delivery mechanisms (web, mobile, API)

**May be overkill:**
- Simple CRUD applications
- Prototypes
- Short-lived projects
- Very small teams

---

## Common Mistakes

1. **Skipping layers**: Direct calls from UI to database
2. **Business logic in controllers**: Use cases should contain logic
3. **Entity depends on framework**: Entities should be pure
4. **Circular dependencies**: Violating the dependency rule
5. **Over-engineering**: Too many layers for simple functionality
