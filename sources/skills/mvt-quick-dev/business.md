## Execution Flow

### Step 1: Load Inputs
- **Required**:
  - User's change description (free text or file path).
- **Fallback**: if no project context exists (no `project-context.md`), proceed as "context-light" (skip layer compliance checks).

### Step 2: Classify Complexity
- **What**: determine the change tier based on scope signals in the user's description.
- **How**: apply the classification table below. Walk signals top-to-bottom; the first match wins.

  | Tier | Criteria | Behavior |
  |------|----------|----------|
  | **Trivial** | 1 file, no new concepts, no interface change, ≤10 lines affected | Implement directly, conversation-only |
  | **Simple** | 1-3 files, no new module, no interface break, existing patterns sufficient | Implement after showing plan, conversation-only |
  | **Complex** | >3 files, new module, interface break, new dependency, or ambiguous scope | STOP -- recommend `/mvt-analyze` or `/mvt-design` |

  Scope signals (heuristic):

  | Signal | Suggests |
  |--------|----------|
  | Mentions specific file/symbol | Trivial/Simple |
  | "add a field/property/column" | Simple |
  | "change label/text/color" | Trivial |
  | "new API/endpoint/module" | Complex |
  | "refactor/redesign/migrate" | Complex |
  | "integration with X" | Complex |
  | Affects >1 module (per `project-context.md`) | Complex |
  | Introduces new dependency | Complex |

- **Branches**:

  | Condition | Action |
  |-----------|--------|
  | Classified as Trivial or Simple | Proceed to Step 3 |
  | Classified as Complex | STOP; recommend `/mvt-analyze` or `/mvt-design` |
  | Ambiguous (could be Simple or Complex) | Ask user to confirm scope before proceeding |

### Step 3: Locate Target
- **What**: resolve the exact file(s) and symbol(s) to change.
- **How**:
  1. Parse the change description for file paths, class/function/variable names, or module references.
  2. Resolve each reference using Glob/Grep against the project tree.
  3. Verify each target: exists on disk (for modifications) or parent path exists (for new files).
  4. If a target cannot be uniquely resolved, ask the user for clarification before continuing.
  5. Cross-reference `project-context.md` layer rules (if available) -- flag any change that would violate layer constraints.
- **Output of this step**: a target list (`path | action | one-line intent`).

### Step 4: Plan the Change
- **What**: produce an ordered file list before writing any code.
- **How**:
  1. For each target from Step 3, decide: `create | modify | delete`, and write a one-line intent.
  2. Topologically order by dependency if multiple files are involved.
- **Branches**:

  | Condition | Action |
  |-----------|--------|
  | Trivial tier | Proceed silently (change is small and reversible) |
  | Simple tier | Show the plan to the user as a preview; wait for confirmation before proceeding |
  | Plan exceeds 3 files | Escalate to Complex -- STOP, recommend standard workflow |
  | Plan introduces an unplanned module | Escalate to Complex -- STOP, recommend standard workflow |

### Step 5: Implement
- **What**: write/modify the planned files.
- **How**:
  1. Apply changes one file at a time, in the order determined by Step 4.
  2. Follow `coding-standards.md` if available; match surrounding code style otherwise.
  3. Respect module/layer rules from `project-context.md`. Forbidden imports must NOT appear.
  4. Add error handling at system boundaries only (HTTP, DB, external API, file IO, message bus). Do NOT add try/catch around internal calls.
  5. Inline comments only for non-obvious algorithmic choices or deliberate workarounds with a reason.
  6. Do NOT introduce abstractions, helpers, or feature flags beyond what the task requires.

### Step 6: Quick Verify
- **What**: light-weight verification before reporting completion.
- **How**:
  1. If a type-checker is configured for the project (`tsc`, `mypy`, `cargo check`, etc.), run it on changed files only. Surface failures.
  2. If existing tests cover the changed code, suggest the test command but do not auto-run unless user explicitly approved.
  3. For frontend/UI changes, note that user should verify in browser; do NOT claim "tested" based on type-check alone.

### Step 7: Summarize in Conversation
- **What**: present the result without writing any artifact file.
- **How**: output a brief summary containing:
  - Files touched: `path | action`
  - Verification status: type-check result, test suggestion
- **No artifact is written. No document is generated.** This is a conversation-only skill.

### Step 8: (session update handled by shared section)

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| Change description is vague ("improve performance") | STOP -- ask for specifics; cannot classify without concrete scope |
| Target file doesn't exist | Ask whether it is a new file or a wrong path; do not silently create |
| Implementation reveals the change is actually Complex | STOP -- revert partial changes, recommend `/mvt-analyze` |
| Active change is in the middle of `/mvt-implement` | Warn about potential conflicts; ask user to confirm before proceeding |
| No `active_change` and change is Simple | Proceed without creating an `active_change`; conversation-only result |
| Change touches a file also being modified in an active plan | Surface the conflict; user must resolve outside this skill |
| User wants to save progress notes | Direct them to the standard workflow (`/mvt-analyze` -> `/mvt-design` -> `/mvt-implement`) which produces artifacts |
