## Execution Flow

### Step 1: Load Inputs
- **Required**:
  - The set of files to review (see Step 2 for resolution).
- **Fallback**:
  - If `design.md`/`implementation.md` are missing, downgrade to "code-only review": skip the design-compliance checks (Step 5 row group A) and note the limitation in the artifact.
  - If `project-context.md` is missing, skip layer-compliance checks and note the limitation.

### Step 2: Resolve Review Target
- **What**: produce a definitive file list to review.
- **How**: pick the FIRST source that yields a non-empty list.

  | Source | Condition |
  |--------|-----------|
  | User-provided file paths | User passed paths/globs as arguments |
  | `--aspect` filter | User specified an aspect; intersect aspect-relevant files with the active change's `Change Tracking` |
  | `implementation.md` -> `Files Touched` | Active change has implementation artifact |
  | `git diff --name-only main...HEAD` | Inside a feature branch |
  | `git diff --name-only HEAD~1` | Last-commit fallback |

- If the resolved list is empty, STOP and ask the user to specify the target.
- If the list exceeds ~30 files, ask the user to scope down OR confirm a high-level (per-module) review depth.

### Step 3: Identify Project Scope and Load Project-Specific Knowledge

This step applies only when the workspace has multiple projects (`projects.length > 1` in `project-context.yaml`). In single-project workspaces, all relevant knowledge was loaded at activation; skip this step entirely.

- **Project identification**: match the file paths resolved in Step 2 against `projects[].path` and `projects[].source_paths`:
  - A file whose path starts with a project's `path` prefix belongs to that project.
  - A file under a project's `source_paths` entry also belongs to that project.
  - Collect the set of unique project names from all matched files. This is the **active project scope** for this invocation.
- **On-demand knowledge loading**: for each project P in the active project scope, read `.ai-agents/registry.yaml` and load:
  1. Every entry under `knowledge.{P}` -- load each entry's referenced files (resolve relative to `.ai-agents/{source}`).
  2. Every entry under `skills.mvt-review.knowledge.{P}` -- load each entry's referenced files.
  3. Skip any key absent from the registry (no project-specific knowledge is valid; do not warn).
- **Multi-project scenario**: if files span multiple projects, load each project's knowledge sequentially. The skill operates with the union of all loaded project-specific knowledge plus the `_all` knowledge already loaded at activation.
- **Unmatched files**: if a file path does not match any project's `path` or `source_paths`, surface a note and treat it as belonging to the first project in `projects[]` (fallback). This may indicate a configuration gap in `project-context.yaml`.

### Step 4: Determine Review Depth
- **Default**: full review across all axes (Step 5).
- `--aspect <name>`: narrow to a single axis. Supported aspects: `architecture`, `quality`, `errors`, `edge-cases`, `security`, `naming`, `tests`. Other aspects -> ask user to clarify.
- For files >300 lines, do a structural pass first (interfaces, exports, key paths) before line-level review; do not attempt line-by-line on huge files.

### Step 5: Run Review Checks
- **What**: produce findings, each tagged with severity, location, and a concrete remedy.
- **How**: walk the checklist below. Skip any group whose inputs were missing per Step 1 fallback notes.

  **Group A -- Design / Layer Compliance** (requires design.md OR project-context.md)
  - If `implementation.md > Design Compliance` exists, use it as the implementer's self-check claim set. Independently verify claimed passes and investigate any skipped, deviated, or undocumented item; do not repeat every mechanical self-check when the claim is already supported.
  - Each file is in the module/layer assigned by design or project-context.
  - Dependency direction respects layer rules (no upward imports, no forbidden cross-module reaches).
  - Public interfaces match `Key Interfaces` from design.
  - Implementation `Deviations from Design` are documented; undocumented deviations are findings.

  **Group B -- Code Quality**
  - Functions are small and focused; flag functions > ~50 lines or with > ~3 nested control levels.
  - Naming is clear, consistent with the naming conventions loaded by activation (if any), and matches surrounding code.
  - No duplication: same logic appearing >= 3 times warrants extraction.
  - No premature abstraction: a single-use helper / interface / wrapper is a finding.
  - No dead code, unused imports, commented-out blocks left behind.

  **Group C -- Error Handling**
  - Error handling appears only at system boundaries (HTTP, DB, external API, file IO, queue).
  - Interior try/catch must have an explicit reason in a one-line comment, otherwise findable.
  - No swallowed errors (catch without rethrow / log / explicit recovery).
  - Error types are specific where the language supports it (no bare `catch Exception` without rethrow).

  **Group D -- Edge Cases**
  - Boundary inputs handled: empty / null / max length / negative / zero / unicode.
  - Concurrency: shared state, async ordering, idempotency where required by design.
  - Resource lifecycle: opened resources are closed on all paths.
  - Off-by-one: loop bounds, slice indices, pagination cursors.

  **Group E -- Tests** (if test files are in scope)
  - Each business rule from `project-context.md` has at least one test case.
  - Tests assert behavior, not implementation details.
  - No `skip` / `only` / commented-out tests left in.
  - Test names describe the scenario, not the function name.

  **Group F -- Security** (if user requirements mention auth/data sensitivity OR `--aspect security`)
  - No secrets in code or test fixtures.
  - Input validation at every external boundary.
  - Auth/authz checks present on every protected endpoint or operation.
  - SQL/NoSQL/HTML rendered through parameterized / escaped APIs.

### Step 6: Categorize and De-duplicate Findings
- **Severity**: assign each finding using the table below.

  | Level | Definition | Examples |
  |-------|------------|----------|
  | **Critical** | Bug, security flaw, broken contract, data loss risk, layer violation that breaks isolation | Swallowed exception in payment path; missing auth on protected endpoint; forbidden cross-layer import |
  | **Warning** | Likely problem or significant quality issue: not a bug today, but high-risk or maintainability hazard | Function 200 lines; duplicated logic 3x; missing tests for a documented business rule |
  | **Suggestion** | Improvement, polish, taste preference | Variable name could be clearer; could split a small helper; minor docstring gap |

- Merge duplicate findings (same root cause appearing in multiple files) into one entry with a list of locations.
- Each finding must include: file, line range, severity, observation, recommendation.

### Step 7: Write Artifact
- **Confirm before writing**: when an `active_change` exists (so an artifact would be written), present the review result in the conversation first (verdict + Critical/Warning/Suggestion counts), then ask the user whether to persist it: `Write the review artifact to {path}? (y/n)`.
  - If the user declines (n), do NOT write any file under `artifacts/`. Keep the full review in the conversation only, and note that no artifact was persisted. Then continue to Step 8.
  - If the user confirms (y), write the artifact as described below.
  - When no `active_change` exists, there is no artifact to write — skip the prompt and keep the full review in the conversation only (no artifact).
- **Path and template**: as defined in the **Artifact Structure** section below; this applies only when an `active_change` exists. Follow the HTML comments in the template for what each section should contain; strip comments from the final artifact.
- **Required coverage**: cover only content that is applicable to this review. Preserve enough information for the user to understand what was reviewed, the verdict, material findings, skipped checks, and the recommended next step. Do not create empty or artificial sections just because an item is named here; if the template omits or renames a section, place applicable content in the closest relevant section.

### Step 8: Verdict Rule
- Critical > 0 -> verdict is `Request changes`. Suggest `/mvt-fix`.
- Critical = 0, Warnings > 5 -> verdict is `Approve with comments`.
- Critical = 0, Warnings <= 5, Suggestions only -> verdict is `Approve`.
- Code-only review (design.md missing) -> verdict cannot be higher than `Approve with comments` (call it out explicitly).

### Step 9: State Update
Apply the State Update rules defined in the **State Update** section below.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| Review target is generated code (build output, lockfile, vendored dep) | Skip with a one-line note in artifact; do not flag findings |
| All Group A inputs missing | Run as code-only review; cap verdict at `Approve with comments` |
| User asked for review but there are zero changes | STOP, report "no diff to review", do not write artifact |
| Findings in the same file conflict (e.g., quality says "extract", architecture says "do not introduce a new module") | Defer to architecture; record the tension in `Suggestions` |
| Implementation explicitly documents a deviation from design (in `Deviations from Design`) | Treat as accepted -- flag only if the deviation is itself problematic |
| Reviewer finds bugs requiring discussion before fix | Mark Critical, but do NOT auto-invoke `/mvt-fix`; leave the call to the user |
| User declines to write the artifact at Step 7 | Do not write any file under `artifacts/`; keep the review in the conversation only and note that no artifact was persisted |
| `active_change` is missing entirely | Run the review and keep the result in the conversation only; do not write any artifact (no ad-hoc artifact path) |
