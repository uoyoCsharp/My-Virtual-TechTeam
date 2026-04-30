## Execution Flow

### Step 1: Load Context
- Read implementation files
- Read project-context for tech stack and test framework
- Identify test framework conventions

### Step 2: Analyze Test Scenarios
- Identify happy path scenarios
- Identify edge cases and boundary conditions
- Identify error scenarios
- Identify security test cases (if applicable)

### Step 3: Design Test Cases
- Create test case table with IDs, scenarios, inputs, expected outputs
- Define preconditions for each test
- Prioritize by type (happy path and edge cases first)

### Step 4: Write Test Code
- Follow project's test framework conventions
- Write clear, descriptive test names
- Include setup, action, and assertion sections
- Use mocks/stubs for external dependencies

### Step 5: Coverage Analysis (with --coverage)
- Map test cases to requirements
- Identify coverage gaps
- Recommend additional tests for missing coverage

### Step 6: Update Workspace
1. Update `.ai-agents/workspace/session.yaml`:
   - Set `progress.test: done`
   - Set `session.last_command: "/mvt-test"`
   - Append one-line summary to `recent_actions` (keep max 3)
2. Write test files to the project
3. Write artifact: `.ai-agents/workspace/artifacts/{change-id}/tests/`
