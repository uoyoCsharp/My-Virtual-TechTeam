## Execution Flow

### Step 1: Load Inputs
- **Required**:
  - The set of files to review (see Step 2 for resolution).
- **Recommended**:
  - `.ai-agents/workspace/artifacts/{active_change.id}/design.md` -- to check design compliance.
  - `.ai-agents/workspace/artifacts/{active_change.id}/implementation.md` -- to know declared scope and deviations.
  - `.ai-agents/knowledge/project/_generated/project-context.md` -- module/layer rules.
  - `.ai-agents/knowledge/principle/coding-standards/rules.md`
  - `.ai-agents/knowledge/principle/coding-standards/naming-conventions.md`
- **Fallback**:
  - If `design.md`/`implementation.md` are missing, downgrade to "code-only review": skip the design-compliance checks (Step 4 row group A) and note the limitation in the artifact.
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

### Step 3: Determine Review Depth
- **Default**: full review across all axes (Step 4).
- `--aspect <name>`: narrow to a single axis. Supported aspects: `architecture`, `quality`, `errors`, `edge-cases`, `security`, `naming`, `tests`. Other aspects -> ask user to clarify.
- For files >300 lines, do a structural pass first (interfaces, exports, key paths) before line-level review; do not attempt line-by-line on huge files.

### Step 4: Run Review Checks
- **What**: produce findings, each tagged with severity, location, and a concrete remedy.
- **How**: walk the checklist below. Skip any group whose inputs were missing per Step 1 fallback notes.

  **Group A -- Design / Layer Compliance** (requires design.md OR project-context.md)
  - Each file is in the module/layer assigned by design or project-context.
  - Dependency direction respects layer rules (no upward imports, no forbidden cross-module reaches).
  - Public interfaces match `Key Interfaces` from design.
  - Implementation `Deviations from Design` are documented; undocumented deviations are findings.

  **Group B -- Code Quality**
  - Functions are small and focused; flag functions > ~50 lines or with > ~3 nested control levels.
  - Naming is clear, consistent with `naming-conventions.md`, and matches surrounding code.
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

### Step 5: Categorize and De-duplicate Findings
- **Severity**: assign each finding using the table below.

  | Level | Definition | Examples |
  |-------|------------|----------|
  | **Critical** | Bug, security flaw, broken contract, data loss risk, layer violation that breaks isolation | Swallowed exception in payment path; missing auth on protected endpoint; forbidden cross-layer import |
  | **Warning** | Likely problem or significant quality issue: not a bug today, but high-risk or maintainability hazard | Function 200 lines; duplicated logic 3x; missing tests for a documented business rule |
  | **Suggestion** | Improvement, polish, taste preference | Variable name could be clearer; could split a small helper; minor docstring gap |

- Merge duplicate findings (same root cause appearing in multiple files) into one entry with a list of locations.
- Each finding must include: file, line range, severity, observation, recommendation.

### Step 6: Write Artifact
- **Path**: `.ai-agents/workspace/artifacts/{active_change.id}/review.md` if `active_change` exists; else `.ai-agents/workspace/artifacts/_ad-hoc-review-{YYYY-MM-DD-HHMM}/review.md`.
- **Template**: `.ai-agents/skills/_templates/review-output.md` (custom override at `_templates/custom/...` takes precedence).
- **Required content** (mapped to template headings):
  - `Review Scope` -- file list, depth, aspect filter, fallbacks applied (e.g., "design.md missing -> Group A skipped").
  - `Summary` -- counts per severity + one-paragraph overall verdict (Approve / Approve with comments / Request changes / Block).
  - `Critical Findings` -- one entry per finding.
  - `Warnings`.
  - `Suggestions`.
  - `Skipped Checks` -- groups skipped because inputs were missing, with reason.
  - `Recommended Next Skill` -- e.g., `/mvt-fix` for Critical, `/mvt-test` if Group E gaps, `/mvt-refactor` if Group B is dominant.

### Step 7: Verdict Rule
- Critical > 0 -> verdict is `Request changes`. Suggest `/mvt-fix`.
- Critical = 0, Warnings > 5 -> verdict is `Approve with comments`.
- Critical = 0, Warnings <= 5, Suggestions only -> verdict is `Approve`.
- Code-only review (design.md missing) -> verdict cannot be higher than `Approve with comments` (call it out explicitly).

### Step 8: (session update handled by shared section)

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| Review target is generated code (build output, lockfile, vendored dep) | Skip with a one-line note in artifact; do not flag findings |
| All Group A inputs missing | Run as code-only review; cap verdict at `Approve with comments` |
| User asked for review but there are zero changes | STOP, report "no diff to review", do not write artifact |
| Findings in the same file conflict (e.g., quality says "extract", architecture says "do not introduce a new module") | Defer to architecture; record the tension in `Suggestions` |
| Implementation explicitly documents a deviation from design (in `Deviations from Design`) | Treat as accepted -- flag only if the deviation is itself problematic |
| Reviewer finds bugs requiring discussion before fix | Mark Critical, but do NOT auto-invoke `/mvt-fix`; leave the call to the user |
