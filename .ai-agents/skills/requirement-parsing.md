# Requirement Parsing Skill

Parse and structure requirements from PRD, user stories, and feature requests.

## Usage

This skill is invoked by: **Analyst**

## Capabilities

### Document Parsing
- Parse PRD documents
- Extract user stories
- Identify acceptance criteria

### Concept Extraction
- Extract domain concepts
- Identify actors and roles
- Map business rules

### Requirement Structuring
- Categorize requirements by type
- Prioritize by importance
- Link related requirements

## Execution

When invoked, perform these steps:

1. **Receive Input**: Get requirements document or text
2. **Parse Structure**: Identify sections and components
3. **Extract Features**: List distinct features and functionalities
4. **Identify Actors**: Map users/roles and their interactions
5. **Extract Rules**: Capture business rules and constraints
6. **Identify Gaps**: Note ambiguities or missing information
7. **Structure Output**: Organize findings systematically

## Pattern-Specific Extraction

### For DDD Pattern
- Entities and Value Objects
- Aggregates and Aggregate Roots
- Domain Events
- Domain Services
- Bounded Contexts

### For Clean Architecture
- Use Cases
- Entities
- Interface Boundaries
- External Dependencies

### For General
- Components
- Services
- Data Models
- Business Rules

## Output Format

```markdown
## 需求解析结果

### 功能需求
| ID | 功能 | 描述 | 优先级 |
|----|------|------|--------|
| F1 | [Feature] | [Description] | [High/Medium/Low] |

### 参与者
- [Actor 1]: [Role description]

### 业务规则
- BR1: [Business rule]

### 领域概念
- [Concept]: [Description]

### 待澄清项
- [ ] [Unclear item]
```
