## Execution Flow

### Step 1: Load Inputs
- **Required**:
  - The implementation files to test (see Step 2 for resolution).
- **Recommended**:
  - Existing tests near the target files -- to follow conventions and avoid duplication.
- **Fallback**:
  - If test framework is unspecified in `project-context.yaml`, infer from package manifests (jest/vitest/pytest/junit/...) and ask user to confirm before generating tests.
  - If `project-context.md` business rules are missing, derive scenarios solely from code and design; mark coverage analysis as "rule-mapping unavailable".

### Step 2: Resolve Test Target
- **What**: produce the file list under test.
- **How**: pick the FIRST source that yields a non-empty list.

  | Source | Condition |
  |--------|-----------|
  | User-provided feature/file argument (`/mvt-test {feature}`) | Argument present |
  | `implementation.md` -> `Files Touched` | Active change has implementation artifact |
  | `git diff --name-only main...HEAD` filtered to source dirs | Inside a feature branch |
  | Recently modified source files | Last-resort, last 24h mtime |

- For each target file, locate or plan its corresponding test file path using the project's test layout convention (mirror under `tests/`, sibling `*.test.ts`, etc.).

### Step 3: Identify Test Scenarios
- **What**: produce a Scenario Table covering happy path, edge, negative, and security cases.
- **How**:
  1. For each public function / endpoint in scope, list at least: 1 happy path, 1 boundary, 1 invalid input.
  2. For each business rule from `project-context.md` that this code implements, list at least 1 scenario asserting the rule.
  3. For each error path declared in `design.md` data flow, list at least 1 scenario.
  4. Consult the Test Case Types table (provided in shared section above):
     - Happy Path / Edge / Negative -> always include if applicable.
     - Security -> include only when requirements mention auth, data sensitivity, or external input boundaries.
     - Performance -> include only when requirements explicitly state SLAs.

### Step 4: Choose Test Granularity
- **What**: assign each scenario to unit / integration / E2E.
- **How**: use the rule below; one scenario maps to one granularity.

  | Granularity | Use when |
  |-------------|----------|
  | Unit | Pure logic, single class/function, no IO, deterministic |
  | Integration | Crosses a system boundary (DB, HTTP, queue, file system); module collaboration without UI |
  | E2E | User-visible flow that traverses multiple services or includes UI interaction |

- A single scenario should not be tested at multiple granularities unless explicitly required (avoid wasteful duplication).
- Flag scenarios that need integration but the project lacks an integration test setup -> note in artifact, suggest setup, do not invent a fixture.

### Step 5: Design Test Cases
- **What**: turn each scenario into a concrete test case row.
- **How**: each row must include `id | scenario | granularity | preconditions | inputs | actions | expected | rule-traced-to`.
- Prioritize: every business rule trace must be present; happy paths first, then edges, then negatives, then security/performance.
- For external dependencies, decide mock/stub/fake per project conventions; document the choice.

### Step 6: Write Test Code
- **What**: emit test files using project conventions.
- **How**:
  1. Match the project's existing test framework, file layout, and naming.
  2. Test names describe the scenario in business language ("rejects login when password is expired"), not the function name.
  3. Each test follows arrange / act / assert structure with no hidden setup.
  4. Use mocks/stubs only at boundaries identified in Step 4; do NOT mock the unit under test.
  5. Do not modify the production code being tested -- if implementation has a bug, surface it (Step 8) and recommend `/mvt-fix`.
  6. Avoid `skip` / `only` / commented-out tests in the final output.

### Step 7: Coverage Analysis (only when `--coverage` flag set)
- **What**: produce a coverage map and gap list.
- **How**:
  1. Map each test case (Step 5) back to: a target file/function, and (if available) a business rule from `project-context.md`.
  2. Identify gaps: target functions with no test, business rules with no test, error paths from `design.md` with no test.
  3. Read coverage thresholds from `.ai-agents/config.yaml` if present; otherwise default targets: line >= 80%, branch >= 70%, business-rule == 100%.
  4. Recommend additional test cases for each gap; do not auto-generate them in this run unless user confirms.

### Step 8: Surface Implementation Issues (if any)
- During scenario design or test writing you may discover the implementation is wrong (failing test reveals a real bug, not a test bug).
- **Do not** modify production code from this skill.
- Record each finding with: scenario id, expected vs observed, severity (Critical / Warning), and recommend `/mvt-fix`.

### Step 9: Write Artifact
- **Path and template**: as defined in the **Artifact Structure** section below.
- **Required content** (mapped to template headings):
  - `Scope` -- target files, fallbacks applied.
  - `Test Framework & Layout` -- chosen framework, file layout convention.
  - `Test Scenarios` -- the Scenario Table from Step 3.
  - `Test Cases` -- the row-level table from Step 5.
  - `Granularity Decisions` -- summary from Step 4, including any "needs setup" gaps.
  - `Coverage Analysis` -- only when `--coverage`; otherwise omit the heading.
  - `Implementation Issues Found` -- from Step 8; empty list is fine.
  - `Suggested Run Commands` -- one or two commands the user can copy-paste.
- The actual test files go to the project tree; the artifact is a record.

### Step 10: State Update
Apply the State Update rules defined in the **State Update** section below.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| Test framework unsupported by environment (e.g., language has no widely-used framework) | STOP, report, ask user for guidance; do not improvise a custom harness |
| Implementation files have zero public API (purely internal) | Cap at integration-level scenarios; do not test private symbols |
| Existing tests for the target are present and conflict with new scenarios | Surface the conflict in `Implementation Issues Found`; do not silently delete or rewrite existing tests |
| External services required and not mockable (e.g., real LLM call) | Use recorded fixtures if conventional; otherwise mark scenarios as `requires-live-service` and skip code generation |
| Flaky test detected during writing | Add deterministic seeding/clock; if not possible, mark as `flaky-suspected` and surface in artifact |
| User asks to "skip edge cases" | Refuse: edge cases are a non-negotiable boundary of this skill; explain and continue |
| `--coverage` set but coverage tool not configured in project | Generate the gap list from scenarios alone; suggest tool setup; do not invoke a non-existent coverage runner |
