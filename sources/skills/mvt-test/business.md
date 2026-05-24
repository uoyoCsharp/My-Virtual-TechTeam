## Execution Flow

### Step 1: Load Context
- Read implementation files
- Read project-context.yaml for tech stack and test framework
- Read project-context.md for business rules to design test cases against
- Identify test framework conventions

### Step 2: Analyze Test Scenarios
- Identify happy path scenarios
- Identify edge cases and boundary conditions
- Identify error scenarios
- Identify security test cases (if applicable)
- Map business rules from project-context.md to test scenarios

### Step 3: Design Test Cases
- Create test case table with IDs, scenarios, inputs, expected outputs
- Define preconditions for each test
- Prioritize by type (happy path and edge cases first)
- Ensure each business rule from project-context.md has at least one test

### Step 4: Write Test Code
- Follow project's test framework conventions
- Write clear, descriptive test names
- Include setup, action, and assertion sections
- Use mocks/stubs for external dependencies

### Step 5: Coverage Analysis (with --coverage)
- Map test cases to requirements
- Identify coverage gaps
- Recommend additional tests for missing coverage

### Step 6: Write Artifacts
1. Write test files to the project
2. Write artifact: `.ai-agents/workspace/artifacts/{change-id}/tests/`
