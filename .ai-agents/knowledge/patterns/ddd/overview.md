# Domain-Driven Design Overview

Domain-Driven Design (DDD) is an approach to software development that centers the design on the core business domain and domain logic.

## Core Concepts

### Ubiquitous Language

A shared language between developers and domain experts used consistently in code, documentation, and conversation.

**Why it matters:**
- Reduces translation errors
- Improves communication
- Code reflects business concepts

**Application:**
- Use domain terms in class names
- Name methods using domain vocabulary
- Align code structure with domain model

### Bounded Context

An explicit boundary within which a domain model is defined and applicable.

**Key points:**
- Each context has its own model
- Same term may mean different things in different contexts
- Contexts communicate through well-defined interfaces

### Domain Model

A representation of the domain that captures business rules and behavior.

**Characteristics:**
- Rich with behavior (not anemic)
- Encapsulates business logic
- Protected by invariants

---

## Strategic Design

### Context Mapping

Understanding relationships between bounded contexts.

**Integration Patterns:**

| Pattern | Description | When to Use |
|---------|-------------|-------------|
| Shared Kernel | Shared code between contexts | Tightly related teams |
| Customer-Supplier | Upstream supplies, downstream consumes | Clear dependency direction |
| Conformist | Downstream conforms to upstream | No control over upstream |
| Anti-Corruption Layer | Translation layer between contexts | Protecting from external models |
| Open Host Service | Well-defined protocol for multiple consumers | Multiple downstream contexts |
| Published Language | Standard communication format | Complex integrations |

### Subdomains

**Types:**
- **Core Domain**: Primary business differentiator - invest most here
- **Supporting Domain**: Necessary but not differentiating
- **Generic Domain**: Common, can often buy or use existing solutions

---

## Tactical Design

### Building Blocks

**Entities:**
- Have identity
- Have lifecycle
- Mutable (with controlled state changes)

**Value Objects:**
- No identity
- Immutable
- Equality by attributes

**Aggregates:**
- Consistency boundary
- Single root entity
- Transactional unit

**Domain Services:**
- Operations that don't belong to entities
- Stateless
- Domain logic that spans entities

**Domain Events:**
- Record significant occurrences
- Enable loose coupling
- Support eventual consistency

**Repositories:**
- Collection-like interface
- Abstract persistence
- One per aggregate

**Factories:**
- Complex object creation
- Encapsulate construction logic
- Ensure valid state

---

## Key Principles

### 1. Focus on Core Domain
Invest effort where it creates business value.

### 2. Protect Domain Integrity
Keep domain layer pure and free from technical concerns.

### 3. Model Real Business Concepts
Code should reflect how the business thinks.

### 4. Embrace Complexity Where Warranted
DDD shines in complex domains; don't over-engineer simple CRUD.

### 5. Collaborate with Domain Experts
Regular communication is essential.

---

## When to Use DDD

**Good fit:**
- Complex business domain
- Long-lived project
- Access to domain experts
- Domain evolves over time

**May be overkill:**
- Simple CRUD applications
- Technical/infrastructure focus
- Short-lived projects
- No domain complexity

---

## Common Pitfalls

1. **Anemic Domain Model**: Entities with only getters/setters
2. **Big Aggregate**: Too many entities in one aggregate
3. **Missing Boundaries**: No clear bounded contexts
4. **Technical Focus**: Domain model driven by database
5. **Ignoring Language**: Not using ubiquitous language
