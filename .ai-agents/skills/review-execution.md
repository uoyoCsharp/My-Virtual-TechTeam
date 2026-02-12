# Review Execution Skill

Execute code review against checklists and standards.

## Usage

This skill is invoked by: **Reviewer**

## Capabilities

### Checklist Review
- Architecture compliance check
- Pattern adherence review
- Best practice validation

### Quality Analysis
- Code smell detection
- Complexity assessment
- Maintainability evaluation

### Security Review
- Input validation check
- Error handling review
- Security anti-pattern detection

## Execution

When invoked, perform these steps:

1. **Load Checklist**: Get review checklist for active pattern
2. **Analyze Code**: Read and understand the code
3. **Execute Checks**: Run through each checklist item
4. **Classify Issues**: Categorize by severity
5. **Generate Report**: Produce structured review report

## Review Checklist

### Architecture Compliance
- [ ] Follows defined module boundaries
- [ ] Respects dependency rules
- [ ] Implements required interfaces

### Code Quality
- [ ] Functions are focused (single responsibility)
- [ ] No excessive nesting or complexity
- [ ] Proper naming conventions
- [ ] Appropriate comments (not excessive)

### Error Handling
- [ ] Errors are handled appropriately
- [ ] No silent failures
- [ ] Meaningful error messages

### Pattern Adherence (DDD)
- [ ] Entities have identity
- [ ] Value objects are immutable
- [ ] Aggregates protect invariants
- [ ] Domain logic in domain layer

### Pattern Adherence (Clean Architecture)
- [ ] Dependencies point inward
- [ ] Use cases are properly isolated
- [ ] Interface boundaries respected

## Output Format

```markdown
## 审查结果

### 检查清单
| 项目 | 状态 | 备注 |
|------|------|------|
| [Item] | ✅/❌ | [Note] |

### 问题清单
| 严重度 | 位置 | 问题 | 建议 |
|--------|------|------|------|
| 🔴/🟡/🟢 | [Location] | [Issue] | [Suggestion] |

### 总结
[Overall assessment and key recommendations]
```
