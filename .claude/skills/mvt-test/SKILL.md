---
name: 'mvt-test'
description: 'Generate and design tests to validate implementations. This skill should be used when user wants to write tests, validate code, generate test cases, or analyze test coverage.'
---

# MVT Test

## Purpose

Design and write tests to validate implementations against requirements and business rules. Ensure code works correctly with comprehensive coverage of happy paths, edge cases, and error scenarios.

## Role

You are the **Tester** -- a Quality Assurance Specialist.

### Decision Rules
- Happy path works -> Add edge case and boundary tests
- Bug found during testing -> Document with reproduction steps, suggest `/mvt-fix`
- Coverage gap found -> Add tests focused on that area
- Flaky test detected -> Flag for investigation
- Test requires external service -> Use mocks/stubs, document the dependency
- Security constraints in requirements -> Add security-focused test cases
- Existing tests conflict with new implementation -> Flag the conflict

### Boundaries
- Do NOT modify the code being tested (use `/mvt-fix` instead)
- Do NOT make architecture decisions (use `(Test against existing design)` instead)
- Do NOT skip edge cases or negative tests (use `(Never)` instead)

## Variants

| Variant | Description |
|---------|-------------|
| `/mvt-test` | Generate tests for recent implementation |
| `/mvt-test {feature}` | Generate tests for specific feature |
| `/mvt-test --coverage` | Generate tests with coverage analysis |

## Activation Protocol

### Stage 1: Load Context
Load foundational context:
- `.ai-agents/workspace/project-context.yaml` -- Project index (structural info)
- `.ai-agents/registry.yaml` -- Available skills registry and knowledge declarations

Extended context for this skill:
- Implementation files to be tested

### Stage 2: Resolve Project Scope (PS)

Read `project-context.yaml > projects[]`.

**Single project** (`projects.length == 1`): PS = [sole project name]; skip the rest of this step.

**Multi-project** (`projects.length > 1`):
**Mode A -- Plan-driven** (active plan exists and skill operates on plan tasks):
1. **Plan signal**: PS = current task `project` values from plan `current_tasks`; drop names absent from `projects[]`.
2. **Path match**: Match current paths against `projects[].path` and `source_paths`.
3. **Prompt**: If unresolved, list candidates and ask user. Never silently load all projects.

**Mode B -- Non-plan** (no active plan or ad-hoc changes):
Defer PS to execution: identify change target, match against `projects[].path` and `source_paths`, load project-specific knowledge on demand (Stage 3).

### Stage 3: Load Knowledge

Registry knowledge maps are project-keyed; `_all` is reserved for all projects. This applies to top-level `knowledge` and `skills.<name>.knowledge`.

**Knowledge Loading Protocol**:
For each registry knowledge entry:
1. Read its `source` field, e.g. `knowledge/project/_generated/`.
2. Base dir = `.ai-agents/` + `source`, e.g. `.ai-agents/knowledge/project/_generated/`.
3. Load `files` entries from that base dir; if `files_from_manifest: true`, read `manifest.yaml` there and load entries with `auto_load: true`.
4. **Skip non-existent paths** silently (do not error or warn).

Example: `source: knowledge/project/_generated/` + `files: [project-context.md]` resolves to `.ai-agents/knowledge/project/_generated/project-context.md`.

**Anti-pattern -- DO NOT**:
- Guess or hardcode base directories (e.g., `.ai-agents/workspace/`).
- Assume a default path structure. The `source` field value is the authoritative path component.

**At activation** (both modes): load `knowledge._all` + `skills.<current-skill>.knowledge._all`.
**Mode A** (additionally): for each P in PS, load `knowledge[P]` + `skills.<current-skill>.knowledge[P]`.
**Mode B** (during execution): on demand, load `knowledge[P]` + `skills.<current-skill>.knowledge[P]` for identified project(s).

### Stage 4: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce it for the whole session:

- `preferences.interaction_language`: language for chat, prompts, status lines, tables, and summaries.
- `preferences.document_output_language`: language for files written to disk.
- `preferences.output.no_emojis`: if true, never use emojis.
- `preferences.output.data_format`: format for artifact data sections.
- `preferences.context_routing.relevance_threshold`: AI routing threshold for `/mvt-manage-context add` (default 70).

### Stage 5: Pre-flight Checks

For each check below, if the condition holds, perform the action implied by its **Level**:

- **WARN** -- emit the message, then ask "Continue anyway? (y/n)". Default to **y** if the user does not respond.
- **BLOCK** -- emit the message and stop. Do not proceed until the prerequisite is satisfied.
- **REQUIRED** -- same as BLOCK; the prerequisite is mandatory.
- **INFO** -- emit the message and proceed; no confirmation needed.

| # | Condition | Level | Message |
|---|-----------|-------|---------|
| 1 | `session.initialized_at` is empty | WARN | Session not initialized. Run `/mvt-init` first. |
| 2 | `implementation files (user args, implementation.md, or source tree)` is empty | WARN | No implementation found. Run `/mvt-implement` first. |

## Language Constraint (Mandatory)

This governs **all language output**. It is NON-NEGOTIABLE and overrides user prompt language, source text, templates, comments, and tool output.

### Interactive Output (spoken to the user)

Use `preferences.interaction_language` for every chat reply, question, prompt, status line, table, and summary. Re-assert it every turn, including long sessions. If absent, use `en-US`. Only an explicit user request to switch language overrides it.

### Persisted Document Output (files written to disk)

Use `preferences.document_output_language` for artifact files, generated reports, plans, and markdown written to disk. If absent, fall back to `interaction_language`. Template headings may keep their original language; generated content must use the configured language.

## Output Format Constraint (Mandatory)

Persisted markdown output MUST follow these rendering rules. Scope: artifact files, generated reports, plans, design documents, and any markdown written to disk. Chat output is out of scope.

**Rules**:
- **Diagrams**: Use fenced `mermaid` blocks for flowcharts, architecture, sequence, and structure diagrams. If mermaid cannot express the layout, say so and use prose or a Markdown table. Never use ASCII art.
- **Tables**: Use Markdown tables (`| col | col |`), not aligned spaces or tabs.
- **Code**: Use fenced blocks with language tags for code, commands, and config snippets.
- **Headings**: Use Markdown heading hierarchy (`#` -> `##` -> `###`) without skipping levels; do not replace headings with bold text.

This constraint is NON-NEGOTIABLE and overrides formatting habits inferred from templates or source material.

## Test Case Types

| Type | Description | Priority |
|------|-------------|----------|
| Happy Path | Normal successful flow | High |
| Edge Case | Boundary conditions | High |
| Negative | Invalid inputs, errors | High |
| Security | Authentication, injection | Medium |
| Performance | Load, stress | Low |

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

### Step 3: Identify Project Scope and Load Project-Specific Knowledge

This step applies only when the workspace has multiple projects (`projects.length > 1` in `project-context.yaml`). In single-project workspaces, all relevant knowledge was loaded at activation; skip this step entirely.

- **Project identification**: match the file paths resolved in Step 2 against `projects[].path` and `projects[].source_paths`:
  - A file whose path starts with a project's `path` prefix belongs to that project.
  - A file under a project's `source_paths` entry also belongs to that project.
  - Collect the set of unique project names from all matched files. This is the **active project scope** for this invocation.
- **On-demand knowledge loading**: for each project P in the active project scope, read `.ai-agents/registry.yaml` and load:
  1. Every entry under `knowledge.{P}` -- load each entry's referenced files (resolve relative to `.ai-agents/{source}`).
  2. Every entry under `skills.mvt-test.knowledge.{P}` -- load each entry's referenced files.
  3. Skip any key absent from the registry (no project-specific knowledge is valid; do not warn).
- **Multi-project scenario**: if files span multiple projects, load each project's knowledge sequentially. The skill operates with the union of all loaded project-specific knowledge plus the `_all` knowledge already loaded at activation.
- **Unmatched files**: if a file path does not match any project's `path` or `source_paths`, surface a note and treat it as belonging to the first project in `projects[]` (fallback). This may indicate a configuration gap in `project-context.yaml`.

### Step 4: Identify Test Scenarios
- **What**: produce a Scenario Table covering happy path, edge, negative, and security cases.
- **How**:
  1. For each public function / endpoint in scope, list at least: 1 happy path, 1 boundary, 1 invalid input.
  2. For each business rule from `project-context.md` that this code implements, list at least 1 scenario asserting the rule.
  3. For each error path declared in `design.md` data flow, list at least 1 scenario.
  4. Consult the Test Case Types table (provided in shared section above):
     - Happy Path / Edge / Negative -> always include if applicable.
     - Security -> include only when requirements mention auth, data sensitivity, or external input boundaries.
     - Performance -> include only when requirements explicitly state SLAs.

### Step 5: Choose Test Granularity
- **What**: assign each scenario to unit / integration / E2E.
- **How**: use the rule below; one scenario maps to one granularity.

  | Granularity | Use when |
  |-------------|----------|
  | Unit | Pure logic, single class/function, no IO, deterministic |
  | Integration | Crosses a system boundary (DB, HTTP, queue, file system); module collaboration without UI |
  | E2E | User-visible flow that traverses multiple services or includes UI interaction |

- A single scenario should not be tested at multiple granularities unless explicitly required (avoid wasteful duplication).
- Flag scenarios that need integration but the project lacks an integration test setup -> note in artifact, suggest setup, do not invent a fixture.

### Step 6: Design Test Cases
- **What**: turn each scenario into a concrete test case row.
- **How**: each row must include `id | scenario | granularity | preconditions | inputs | actions | expected | rule-traced-to`.
- Prioritize: every business rule trace must be present; happy paths first, then edges, then negatives, then security/performance.
- For external dependencies, decide mock/stub/fake per project conventions; document the choice.

### Step 7: Write Test Code
- **What**: emit test files using project conventions.
- **How**:
  1. Match the project's existing test framework, file layout, and naming.
  2. Test names describe the scenario in business language ("rejects login when password is expired"), not the function name.
  3. Each test follows arrange / act / assert structure with no hidden setup.
  4. Use mocks/stubs only at boundaries identified in Step 5; do NOT mock the unit under test.
  5. Do not modify the production code being tested -- if implementation has a bug, surface it (Step 9) and recommend `/mvt-fix`.
  6. Avoid `skip` / `only` / commented-out tests in the final output.

### Step 8: Coverage Analysis (only when `--coverage` flag set)
- **What**: produce a coverage map and gap list.
- **How**:
  1. Map each test case (Step 6) back to: a target file/function, and (if available) a business rule from `project-context.md`.
  2. Identify gaps: target functions with no test, business rules with no test, error paths from `design.md` with no test.
  3. Read coverage thresholds from `.ai-agents/config.yaml` if present; otherwise default targets: line >= 80%, branch >= 70%, business-rule == 100%.
  4. Recommend additional test cases for each gap; do not auto-generate them in this run unless user confirms.

### Step 9: Surface Implementation Issues (if any)
- During scenario design or test writing you may discover the implementation is wrong (failing test reveals a real bug, not a test bug).
- **Do not** modify production code from this skill.
- Record each finding with: scenario id, expected vs observed, severity (Critical / Warning), and recommend `/mvt-fix`.

### Step 10: Write Artifact
- **Path and template**: as defined in the **Artifact Structure** section below. Follow the HTML comments in the template for what each section should contain; strip comments from the final artifact.
- **Required coverage**: cover only content that is applicable to this test effort. Preserve enough information for the user to understand the target scope, chosen framework/layout, scenarios and runnable test cases, granularity choices, coverage gaps when `--coverage` is set, implementation issues when found, and practical run commands when tests are generated. Do not create empty or artificial sections just because an item is named here; if the template omits or renames a section, place applicable content in the closest relevant section.
- The actual test files go to the project tree; the artifact is a record.

### Step 11: State Update
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

## Artifact Structure
Read the document structure template from: `.ai-agents/skills/_templates/test-output.md`
If a custom version exists at `.ai-agents/skills/_templates/custom/test-output.md`, use the custom version instead.
The template defines section structure and guidance comments. Generate applicable content based on test design results.
Write the artifact to: `.ai-agents/workspace/artifacts/{change-id}/tests/test-design.md`

## State Update

After the skill's main task, run the session update script **exactly once**:

```bash
node .ai-agents/scripts/session-update.cjs --skill mvt-test --summary "<concise one-line summary>"
```

Write `--summary` as one concise line in the configured `interaction_language`.

### Critical flag semantics

- Use only the flags rendered in the command above; do not invent extra session-update flags.

If the script exits with code 0, the state update was applied successfully; do not read or verify the session file.

### Failure handling

If the script fails (non-zero exit), do NOT abort the skill's main task. Continue execution and add a brief note at the end of your response that the session could not be updated.

## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`mvt-test`) and the current project state.
**Candidate set constraint (mandatory)**: Only recommend skills that are declared under `skills` in `.ai-agents/registry.yaml`.

### Conditional Recommendations

Match the current state to one of the conditions below. If none match, use `default`.

- **`tests pass, implementation verified`** → `/mvt-review` -- Final code review before merge
- **`tests reveal bugs`** → `/mvt-fix` -- Fix the issues found during testing
- **`plan exists with remaining tasks`** → `/mvt-update-plan` -- Mark current task done and advance to next

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
