## Execution Flow

### Step 1: Load Requirements
- If one or more file paths are supplied, fingerprint each file before analysis:
  ```bash
  node .ai-agents/scripts/requirement-source.cjs --fingerprint <source_path>
  ```
  Record each normalized `reference` and `fingerprint`, then read the file. If fingerprinting fails, identify the file and stop before preview; never substitute conversation provenance.
- Treat requirement text supplied directly in the user message as a conversation source with `reference: conversation` and no fingerprint.
- Assign first-seen source IDs (`src-001`, `src-002`, ...), preserving every supplied source.

### Step 2: Lightweight Sanity Gate
- **What**: verify the input warrants epic-scale decomposition
- **How**: check whether the input is clearly a single-file or single-module change

  | Signal | Verdict |
  |--------|---------|
  | Input describes 1 feature touching 1-3 files | Too small for epic |
  | Input describes a cohesive system with 2+ independent capability domains | Epic-scale |
  | Ambiguous | Ask user: decompose or redirect to `/mvt-analyze`? |

- **Branches**:

  | Condition | Action |
  |-----------|--------|
  | Clearly epic-scale | Continue to Step 3 |
  | Clearly too small | Confirm — choices `Yes` / `No`: "This looks like a standard change. Use `/mvt-analyze` instead?" |
  | Ambiguous | Offer choice: "Decompose as epic (2-8 children) or analyze as single change?" |

### Step 3: Epic Analysis
- Extract the **vision**: one-sentence summary of the overall goal
- Define **scope and out-of-scope**: what the epic delivers vs. explicitly excludes
- Identify **cross-cutting concerns**: themes spanning multiple children (auth, logging, error handling, data migration)
- Identify **actors and stakeholders**
- Normalize the durable requirement baseline into bounded context items:
  - Assign first-seen IDs (`ctx-001`, `ctx-002`, ...); use one category: `goal`, `in_scope`, `out_of_scope`, `business_rule`, `constraint`, `example`, or `decision`.
  - Keep summaries concise and self-contained, link each item to captured `source_ids`, and do not copy complete documents.
- Select `global_refs` only for items every child must inherit. Child-specific items are mapped in Step 4.

### Step 4: Decompose into 2-8 Sub-changes
- **What**: break the epic into right-sized children, each suitable for one analyze-design-plan-implement cycle
- **Sizing rule**: each child should produce one deliverable capability slice, implementable in 3-10 plan tasks
- **For each child**, define:
  - `change_id`: `{YYYYMMDD}-{slug}` format. Slug constraints: lowercase ASCII, kebab-case, `[a-z0-9-]+`, 1-4 words (e.g., `user-auth`, `catalog-search`)
  - `title`: concise name
  - `scope`: description of what this child delivers
  - `depends_on`: list of `change_id` values this child depends on (empty for root children)
  - `project`: project hint array. For single-project workspaces: use the sole project name from `project-context.yaml > projects[].name` (e.g., `["mvtt"]` in this workspace; do NOT hardcode `["default"]`). For multi-project workspaces: must match a project name from `project-context.yaml > projects[].name`; if uncertain, ask the user rather than guessing.
  - `context_refs`: one or more context item IDs needed to preserve this child's intent, boundaries, rules, examples, and decisions. Do not repeat global-only items unless they are also directly child-specific.
- **DAG constraints**:
  - Dependencies must form a DAG (no cycles)
  - Dependencies reference existing `change_id` values only
  - Prefer shallow depth (wide parallelism) over deep chains
- **Validation**: if > 8 children needed, WARN and suggest narrowing the epic scope. If < 2 children, suggest using `/mvt-analyze` directly.

### Step 5: Preview and Confirm
- **What**: show the decomposition result to the user before writing any files.
- **How**: display the following inline (conversation-only, no disk write yet):
  1. **Child story table**: the same table that will appear in `epic.md`
  2. **Dependency diagram**: Mermaid flowchart of child dependencies
  3. **Requirement sources**: source ID, kind, normalized reference, and fingerprint availability
  4. **Context coverage**: one context catalog (ID and summary), followed by `global_refs` and each child's ordered context IDs
  5. **Suggested starting child**: "Start with: `{first_child_title}` (`{first_child_id}`)"
- **Wait for user confirmation** — choices `Yes` / `No`: "Proceed with this decomposition?". Default to **Yes** if the user does not respond.
- **On decline or revision request**: do NOT write any files. Revise the decomposition based on user feedback and re-present, or abort if the user chooses to cancel.
- **On confirmation**: proceed to Step 6.

### Step 6: Write Artifacts
Write two artifacts:

Before writing, derive `epic_id` and check whether `.ai-agents/workspace/artifacts/{epic_id}/` already exists. If it exists, do NOT overwrite it; warn the user and ask for a disambiguating slug, then re-run the preview from Step 5 with the new id.

1. **epic.md** (narrative) -- `.ai-agents/workspace/artifacts/{epic_id}/epic.md`
  - Render applicable content with the `decompose-output` template and strip its HTML comments.
  - This file is a derived human-readable view. `epic.yaml` is authoritative for requirement provenance, context items, and child mappings.
  - Preserve the epic vision, boundaries, cross-cutting concerns, child stories, dependencies, and unresolved questions; do not create empty sections.

2. **epic.yaml** (structured) -- `.ai-agents/workspace/artifacts/{epic_id}/epic.yaml`
  - Follows the new-epic creation contract defined in Artifact Structure, including `requirement_context` and every child's `context_refs`.
  - Set first child `status: active`, all others `status: pending`
  - Set `current_change` to the first child's `change_id`

**Self-validation checklist** (verify before writing):
- [ ] All `change_id` values are unique
- [ ] `.ai-agents/workspace/artifacts/{epic_id}/` does not already exist
- [ ] All `depends_on` references exist in `children[]`
- [ ] No cycles in the dependency graph
- [ ] Exactly one child has `status: active`
- [ ] `current_change` matches the active child's `change_id`
- [ ] Each child has non-empty `title` and `scope`
- [ ] Source/item IDs are unique; all `source_ids`, `global_refs`, and `context_refs` resolve; every child has non-empty `context_refs`

After writing both artifacts, validate the authoritative epic before session activation:
```bash
node .ai-agents/scripts/epic-update.cjs --validate .ai-agents/workspace/artifacts/{epic_id}/epic.yaml
```

If validation fails, report the structural errors and stop before Step 7. Do not activate an invalid epic or rewrite captured fingerprints to make validation pass.

If the epic needs children added later (e.g. a missed sub-change discovered during analysis), use `--add-child`:
```bash
node .ai-agents/scripts/epic-update.cjs --epic .ai-agents/workspace/artifacts/{epic_id}/epic.yaml \
  --add-child <new_child_id> --child-title "<title>" --child-scope "<scope>" \
  --child-context-refs "<ctx-id-1>,<ctx-id-2>"
```

To advance the epic after a child change completes, use `--complete-child`:
```bash
node .ai-agents/scripts/epic-update.cjs --epic .ai-agents/workspace/artifacts/{epic_id}/epic.yaml \
  --complete-child <completed_child_id>
```

For post-write epic mutations, use the rendered `epic-update.cjs` commands. Do NOT hand-edit `epic.yaml`, advance `current_change`, or read `.cjs`/`.js` source.

### Step 7: Update Session
Run the session update command (see State Update section) to:
1. Create a new `active_epic` in session.yaml
2. Set the `epic_path` to the written `epic.yaml`

### Step 8: Output
Display to the user:
1. **Write confirmation**: "Epic created: `{epic_id}` at `{epic_path}`"
2. **Suggested next step**: "Run `/mvt-analyze` to start the first child: `{first_child_title}` (`{first_child_id}`)"
