# Template Generation Skill

Generate code from templates based on architecture design.

## Usage

This skill is invoked by: **Developer**

## Capabilities

### Code Generation
- Generate boilerplate code
- Create class/interface scaffolds
- Generate CRUD operations

### Pattern Implementation
- Apply design patterns
- Implement architectural layers
- Generate pattern-specific code

### Documentation Generation
- Generate code comments
- Create API documentation
- Generate README files

## Execution

When invoked, perform these steps:

1. **Load Design**: Get architecture design from context
2. **Identify Templates**: Determine applicable templates
3. **Customize**: Apply project-specific conventions
4. **Generate**: Produce code following templates
5. **Validate**: Check generated code for correctness

## Template Categories

### Entity Templates
- Domain entity classes
- Value objects
- Aggregate roots

### Repository Templates
- Repository interfaces
- Repository implementations
- Data access patterns

### Service Templates
- Domain services
- Application services
- Use case implementations

### API Templates
- Controller/Handler classes
- Request/Response DTOs
- API documentation

## Output Format

```markdown
## 生成的代码

### 文件: `{path}`

\`\`\`{language}
// Generated code
\`\`\`

### 使用说明
[How to use this generated code]
```
