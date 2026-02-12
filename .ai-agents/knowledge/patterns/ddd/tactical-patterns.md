# DDD Tactical Patterns

Detailed guidance on implementing DDD building blocks.

## Entity

Objects defined by their identity, not their attributes.

### Characteristics

- **Identity**: Unique identifier that persists through lifecycle
- **Lifecycle**: Created, modified, possibly deleted
- **Mutability**: State changes through controlled methods

### Implementation Guidelines

```
class Entity:
    Properties:
        - id (unique identifier)
        - other attributes with private setters
    
    Constructor:
        - Private/protected for ORM
        - Factory method for creation
    
    Methods:
        - State-changing operations
        - Invariant enforcement
        - Domain event raising
```

### Key Points

- Private setters protect state
- Validate invariants in state-changing methods
- Consider equality based on ID only
- Avoid exposing internal collections directly

---

## Value Object

Objects defined entirely by their attributes.

### Characteristics

- **No Identity**: Defined by attribute values
- **Immutable**: Cannot be changed after creation
- **Replaceable**: Swap entirely rather than modify

### Implementation Guidelines

```
class ValueObject:
    Properties:
        - All readonly/immutable
    
    Constructor:
        - Validate all invariants
        - Set all properties
    
    Equality:
        - Based on all attributes
        - Override equals/hashcode
    
    Methods:
        - Return new instances on "modification"
```

### Examples

- Money (amount + currency)
- Address (street, city, postal code)
- DateRange (start, end)
- Email (validated email address)

### Key Points

- All properties immutable
- Validate in constructor
- Override equality methods
- "Modification" returns new instance

---

## Aggregate

Cluster of entities and value objects treated as a single unit.

### Characteristics

- **Consistency Boundary**: All invariants must be satisfied within transaction
- **Single Root**: External access only through root entity
- **Transactional Unit**: One aggregate per transaction

### Design Rules

1. **Reference by ID**: Aggregates reference each other by ID, not object reference
2. **Small Aggregates**: Include only what must be immediately consistent
3. **Protect Invariants**: Root entity enforces all rules
4. **Single Repository**: One repository per aggregate type

### Implementation Guidelines

```
class AggregateRoot extends Entity:
    Properties:
        - Owned entities (private collection)
        - Value objects
        - References to other aggregates (by ID only)
    
    Methods:
        - All state changes go through root
        - Enforce cross-entity invariants
        - Raise domain events
    
    Access:
        - External code can only access root
        - Internal entities accessed through root methods
```

### Sizing Guidelines

| Include | Exclude |
|---------|---------|
| Must be immediately consistent | Can be eventually consistent |
| Owned exclusively by this aggregate | Shared with other aggregates |
| Part of same transaction | Different transaction boundary |

---

## Domain Event

Record of something significant that happened in the domain.

### Characteristics

- **Immutable**: Once created, cannot be changed
- **Past Tense**: Named for what happened (OrderPlaced, not PlaceOrder)
- **Contains Context**: All information needed to understand what happened

### Implementation Guidelines

```
class DomainEvent:
    Properties:
        - occurredOn (timestamp)
        - relevant data from the occurrence
    
    Naming:
        - Past tense: Created, Updated, Deleted
        - Noun + verb: OrderPlaced, PaymentReceived
```

### Event Patterns

**Internal Events**: Within aggregate
- Provide audit trail
- Trigger side effects

**Integration Events**: Between bounded contexts
- May require transformation
- Usually through message queue

### Key Points

- Events are facts (immutable)
- Include all relevant context
- Consider event versioning
- Handle failures gracefully

---

## Domain Service

Operations that don't naturally belong to an entity.

### When to Use

- Operation involves multiple entities
- Operation is a domain concept itself
- Operation doesn't fit entity responsibility

### Characteristics

- Stateless
- Named after domain concept
- Takes entities as parameters

### Examples

- TransferService (transfers between accounts)
- PricingService (complex pricing rules)
- AvailabilityService (checks across entities)

### Key Points

- Keep stateless
- Name using domain language
- Don't overuse - prefer entity methods first

---

## Repository

Collection-like interface for aggregate persistence.

### Characteristics

- One per aggregate type
- Collection-like interface
- Abstracts persistence details

### Interface Pattern

```
interface Repository<T, ID>:
    Methods:
        - findById(id) → T or null
        - save(entity) → T
        - delete(entity)
        - findAll() → List<T>
        - custom query methods
```

### Implementation Guidelines

- Interface in Domain layer
- Implementation in Infrastructure layer
- Return domain objects, not persistence models
- Hide query complexity

### Key Points

- Only for aggregate roots
- Abstract persistence details
- Domain layer defines interface
- Infrastructure provides implementation

---

## Factory

Encapsulate complex object creation.

### When to Use

- Complex construction logic
- Construction requires domain knowledge
- Need to ensure valid initial state

### Patterns

**Factory Method**: On aggregate root
```
class Order:
    static create(customerId, items) → Order
```

**Factory Class**: Separate factory
```
class OrderFactory:
    createFromQuote(quote) → Order
    createRushOrder(details) → Order
```

### Key Points

- Ensure valid state
- Encapsulate creation complexity
- Use domain language
- Consider validation requirements

---