# Code Analysis Skill

Analyze code structure, quality, patterns, and dependencies.

## Usage

This skill is invoked by: **Architect**, **Developer**, **Reviewer**, **Tester**

## Capabilities

### Structure Analysis
- Module/namespace organization
- Class hierarchies and relationships
- File organization patterns

### Pattern Detection
- Design patterns (Repository, Factory, Strategy, etc.)
- Architectural patterns (Layered, DDD, Clean Architecture)
- Anti-patterns and code smells

### Quality Assessment
- Complexity metrics
- Coupling and cohesion analysis
- Best practice adherence
- Error handling patterns

### Dependency Analysis
- Internal module dependencies
- External package dependencies
- Circular dependency detection

## Execution

When invoked, perform these steps:

1. **Identify Target**: Determine files/folders to analyze
2. **Detect Tech Stack**: Identify language and framework
3. **Analyze Structure**: Map code organization
4. **Identify Patterns**: Detect design/architectural patterns
5. **Assess Quality**: Evaluate against best practices
6. **Report Findings**: Present structured analysis

## Output Format

```markdown
## 代码分析结果

### 项目结构
- 语言: [Language]
- 框架: [Framework]
- 架构模式: [Pattern]

### 模块结构
[List of modules and their purposes]

### 发现的模式
[Design patterns detected]

### 质量评估
- 整体评级: [Good/Needs Improvement]
- 主要问题: [List]

### 依赖关系
[Key dependencies]
```
