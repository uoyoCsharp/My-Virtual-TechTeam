# Test Generation Skill

Generate test cases and test code based on requirements and implementation.

## Usage

This skill is invoked by: **Tester**, **Developer**

## Capabilities

### Test Case Design
- Design test scenarios from requirements
- Identify edge cases
- Plan test coverage

### Test Code Generation
- Generate unit tests
- Generate integration tests
- Create test fixtures

### Coverage Analysis
- Identify untested code paths
- Suggest additional tests
- Map tests to requirements

## Execution

When invoked, perform these steps:

1. **Load Context**: Get requirements and implementation
2. **Identify Testable Units**: Find functions/classes to test
3. **Design Test Cases**: Create test scenarios
4. **Generate Tests**: Write test code
5. **Validate Coverage**: Check test completeness

## Test Case Categories

### Happy Path Tests
- Normal usage scenarios
- Expected inputs and outputs
- Standard workflow validation

### Edge Case Tests
- Boundary conditions
- Empty/null inputs
- Maximum/minimum values

### Error Case Tests
- Invalid inputs
- Exception handling
- Error recovery

### Integration Tests
- Component interactions
- API contract validation
- Data flow verification

## Framework Detection

Automatically detect and use appropriate test framework:

| Language | Framework |
|----------|-----------|
| JavaScript/TypeScript | Jest, Vitest, Mocha |
| Python | pytest, unittest |
| Java | JUnit, TestNG |
| C# | xUnit, NUnit |
| Go | testing, testify |

## Output Format

```markdown
## 测试设计

### 测试用例
| ID | 场景 | 类型 | 输入 | 预期结果 |
|----|------|------|------|----------|
| T1 | [Scenario] | [Unit/Integration] | [Input] | [Expected] |

### 测试代码

\`\`\`{language}
// Test implementation
\`\`\`

### 覆盖率
- 已覆盖: [List]
- 建议补充: [List]
```
