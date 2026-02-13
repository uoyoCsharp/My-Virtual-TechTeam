# Test Generation Skill

Generate test cases and test code based on requirements and implementation.

## Usage

This skill is invoked by: **Tester** (via `#test` command)

## Knowledge Dependencies

Before executing this skill, load the following knowledge files:

| Path | Description | Required |
|------|-------------|----------|
| `knowledge/stacks/**` | Project tech stack and testing framework conventions | Yes (if exists) |
| `knowledge/core/code-quality.md` | Code quality standards | Yes |
| `knowledge/patterns/{active}/**` | Active architecture pattern knowledge | Yes |

> Note: `{active}` refers to the active pattern in `config.yaml`

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
## Test Cases

### Test Scenarios
| ID | Scenario | Type | Input | Expected |
|----|---------|------|------|----------|
| T1 | [Scenario] | [Unit/Integration] | [Input] | [Expected] |
