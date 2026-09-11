## Execution Flow

### Step 1: Load Inputs
- **Required**:
  - User's change description (free text or file path).
- **Fallback**: if no project context exists (no `project-context.md`), proceed as "context-light" (skip layer compliance checks).

### Step 2: Classify Complexity
- **What**: determine the change tier based on scope signals in the user's description. This classification is provisional; Step 5 re-derives the verdict from the resolved file list and is decisive.
- **How**: apply the classification table below. Walk signals top-to-bottom; the first match wins.

  | Tier | Criteria | Behavior |
  |------|----------|----------|
  | **Trivial** | 1 file, no new concepts, no interface change, ≤10 lines affected | Implement directly, conversation-only |
  | **Simple** | 1-3 files, no new module, no interface break, existing patterns sufficient | Implement after showing plan, conversation-only |
  | **Mechanical Sweep** | Any file count, one declared 1:1 transform, no logic change; symbols resolved via reflection, dynamic dispatch, or string lookup are excluded | Declare pattern, implement, prove zero residue |
  | **Wide** | More than 3 files, architecturally neutral, single concept | Mandatory plan preview plus confirmation; never a STOP |
  | **Structural** | New module, interface change, new dependency, cross-layer or cross-repo edit, or external contract change | Specific warning plus decision menu |

  Scope signals (heuristic — provisional, Step 5 re-derives from the resolved file list):

  | Signal | Suggests |
  |--------|----------|
  | Mentions specific file/symbol | Trivial/Simple |
  | "add a field/property/column" | Simple |
  | "change label/text/color" | Trivial |
  | "new API/endpoint/module" | Structural |
  | "refactor/redesign/migrate" | Mechanical Sweep if a single 1:1 transform is declared, else Structural |
  | "integration with X" | Structural |
  | Affects >1 module (per `project-context.md`) | Wide if architecturally neutral, else Structural |
  | Introduces new dependency | Structural |

- **Branches**:

  | Condition | Action |
  |-----------|--------|
  | Classified as Trivial, Simple, Mechanical Sweep, or Wide | Proceed to Step 3 |
  | Classified as Structural | Proceed to Step 3 with the signal flagged; the warning menu applies at Step 5 |
  | Ambiguous (could be Simple, Wide, or Structural) | Ask user to confirm scope before proceeding |

### Step 3: Locate Target
- **What**: resolve the exact file(s) and symbol(s) to change.
- **How**:
  1. Parse the change description for file paths, class/function/variable names, or module references.
  2. Resolve each reference using Glob/Grep against the project tree.
  3. Verify each target: exists on disk (for modifications) or parent path exists (for new files).
  4. If a target cannot be uniquely resolved, ask the user for clarification before continuing.
  5. Cross-reference `project-context.md` layer rules (if available) -- flag any change that would violate layer constraints.
- **Output of this step**: a target list (`path | action | one-line intent`).

### Step 4: Identify Project Scope and Load Project-Specific Knowledge

This step applies only when the workspace has multiple projects (`projects.length > 1` in `project-context.yaml`). In single-project workspaces, all relevant knowledge was loaded at activation; skip this step entirely.

- **Project identification**: match the file paths resolved in Step 3 against `projects[].path` and `projects[].source_paths`:
  - A file whose path starts with a project's `path` prefix belongs to that project.
  - A file under a project's `source_paths` entry also belongs to that project.
  - Collect the set of unique project names from all matched files. This is the **active project scope** for this invocation.
- **On-demand knowledge loading**: for each project P in the active project scope, read `.ai-agents/registry.yaml` and load:
  1. Every entry under `knowledge.{P}` -- load each entry's referenced files (resolve relative to `.ai-agents/{source}`).
  2. Every entry under `skills.mvt-quick-dev.knowledge.{P}` -- load each entry's referenced files.
  3. Skip any key absent from the registry (no project-specific knowledge is valid; do not warn).
- **Multi-project scenario**: if files span multiple projects, load each project's knowledge sequentially. The skill operates with the union of all loaded project-specific knowledge plus the `_all` knowledge already loaded at activation.
- **Unmatched files**: if a file path does not match any project's `path` or `source_paths`, surface a note and ask the user to choose the project scope. Do not silently fall back to the first project.

### Step 5: Plan the Change
- **What**: produce an ordered file list before writing any code.
- **How**:
  1. For each target from Step 3, decide: `create | modify | delete`, and write a one-line intent.
  2. Topologically order by dependency if multiple files are involved.
- **Branches**:

  | Condition | Action |
  |-----------|--------|
  | Trivial tier | Proceed silently (change is small and reversible) |
  | Simple tier | Show the plan to the user as a preview; wait for confirmation before proceeding |
  | Mechanical Sweep tier | Show the declared pattern plus the residue-proof command; wait for confirmation before proceeding |
  | Wide tier | Show an expanded preview (file list with one-line intent, risk note, rollback story); confirm — choices `Proceed` / `Split into batches` / `Cancel`; default `Proceed` |
  | Structural tier | Show a warning per the Warning Schema below plus the mandated countermeasure; confirm — choices `Proceed (waive: <risk>)` / `Split into batches` / `Switch to standard workflow` / `Cancel`; no default, explicit choice required |
  | Mixed unrelated intents | Decline as one invocation; offer to split into separate invocations |
  | Ambiguous scope | Ask for specifics; not a gate |
  | Target physically unreachable | Surface the limitation; user decides (provide path / narrow scope / stop) |

### Warning Schema (WS-1)

One block per structural signal, fields in order:

| Field | Content |
|-------|---------|
| `signal` | Which structural fact fired |
| `affected_surface` | Contracts, call sites, repos touched |
| `consequence` | What breaks or drifts if wrong |
| `countermeasure` | What to do before editing: enumerate call sites, locate module placement, record rationale, or record exemption |
| `waiver_text` | The exact `waive: <risk>` token the user approves (canonical tokens: `new-module`, `interface-change`, `new-dependency`, `cross-layer-edit`, `cross-repo-edit`, `external-contract-change`) |

### Step 6: Implement
- **What**: write/modify the planned files.
- **How**:
  1. Apply changes one file at a time, in the order determined by Step 5.
  2. Follow the coding standards loaded by activation (if any); match surrounding code style otherwise.
  3. Respect module/layer rules from `project-context.md`. Forbidden imports must NOT appear.
  4. Add error handling at system boundaries only (HTTP, DB, external API, file IO, message bus). Do NOT add try/catch around internal calls.
  5. Inline comments only for non-obvious algorithmic choices or deliberate workarounds with a reason.
  6. Do NOT introduce abstractions, helpers, or feature flags beyond what the task requires.

### Step 7: Quick Verify
- **What**: verification scaled to the change band before reporting completion.
- **How**: apply the band for this change:

  | Band | Verification |
  |------|--------------|
  | 1-3 files, neutral | Type-check suggested; suggest the test command but do not auto-run unless user explicitly approved |
  | Wide (4+ files) | Type-check required; relevant tests suggested or run on approval; one commit per concept |
  | Mechanical sweep | Mandatory batch command proving zero residue of the old pattern; single commit |
  | Structural | Countermeasure from the Step 5 warning executed; type-check required; small reversible steps |
  | Cross-repo | Per-repo verification where tooling exists, otherwise explicitly mark `unverified in <repo>`; one commit per repo |

  1. If a type-checker is configured for the project (`tsc`, `mypy`, `cargo check`, etc.), run it as required by the band above. Surface failures.
  2. For frontend/UI changes, note that user should verify in browser; do NOT claim "tested" based on type-check alone.

### Step 8: Summarize in Conversation
- **What**: present the result without writing any artifact file.
- **How**: output a brief summary containing:
  - Files touched: `path | action`
  - Verification status: type-check result, test suggestion
  - Waivers granted: append the approved `waive: <risk>` token(s) to the session-update `--summary`; omit when none were granted
- **No artifact is written. No document is generated.** This is a conversation-only skill.

### Step 9: State Update
Apply the State Update rules defined in the **State Update** section below.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| Change description is vague ("improve performance") | Ask for specifics; cannot classify without concrete scope |
| Target file doesn't exist | Ask whether it is a new file or a wrong path; do not silently create |
| Implementation reveals unplanned structural scope | Pause, reclassify the new scope, and re-confirm before touching it; do not silently absorb it |
| Active change is in the middle of `/mvt-implement` | Warn about potential conflicts; ask user to confirm before proceeding |
| No `active_change` and change is Simple | Proceed without creating an `active_change`; conversation-only result |
| Change touches a file also being modified in an active plan | Surface the conflict; user must resolve outside this skill |
| User wants to save progress notes | Direct them to the standard workflow (`/mvt-analyze` -> `/mvt-design` -> `/mvt-implement`) which produces artifacts |
| Sweep target discovered mid-implementation to use dynamic lookup | Stop sweep treatment for that symbol, reclassify the affected file as Structural, re-confirm before touching it |
| Half-failed cross-repo commit | Report per-repo committed vs pending state; never auto-roll back a foreign repo; mark partially applied; user decides next |
