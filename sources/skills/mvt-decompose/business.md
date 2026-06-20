## Execution Flow

### Step 1: Load Requirements
- If file path provided as argument -> Read that file
- Otherwise -> Use requirements text from user message

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
  | Clearly too small | Suggest: "This looks like a standard change. Use `/mvt-analyze` instead? (y/n)" |
  | Ambiguous | Offer choice: "Decompose as epic (2-8 children) or analyze as single change?" |

### Step 3: Epic Analysis
- Extract the **vision**: one-sentence summary of the overall goal
- Define **scope and out-of-scope**: what the epic delivers vs. explicitly excludes
- Identify **cross-cutting concerns**: themes spanning multiple children (auth, logging, error handling, data migration)
- Identify **actors and stakeholders**

### Step 4: Decompose into 2-8 Sub-changes
- **What**: break the epic into right-sized children, each suitable for one analyze-design-plan-implement cycle
- **Sizing rule**: each child should produce one deliverable capability slice, implementable in 3-10 plan tasks
- **For each child**, define:
  - `change_id`: `{YYYYMMDD}-{slug}` format. Slug constraints: lowercase ASCII, kebab-case, `[a-z0-9-]+`, 1-4 words (e.g., `user-auth`, `catalog-search`)
  - `title`: concise name
  - `scope`: description of what this child delivers
  - `depends_on`: list of `change_id` values this child depends on (empty for root children)
  - `project`: project hint array. For single-project workspaces: use the sole project name from `project-context.yaml > projects[].name` (e.g., `["mvtt"]` in this workspace; do NOT hardcode `["default"]`). For multi-project workspaces: must match a project name from `project-context.yaml > projects[].name`; if uncertain, ask the user rather than guessing.
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
  3. **Suggested starting child**: "Start with: `{first_child_title}` (`{first_child_id}`)"
- **Wait for user confirmation**: ask "Proceed with this decomposition? (y/n)". Default to **y** if the user does not respond.
- **On decline or revision request**: do NOT write any files. Revise the decomposition based on user feedback and re-present, or abort if the user chooses to cancel.
- **On confirmation**: proceed to Step 6.

### Step 6: Write Artifacts
Write two artifacts using the `decompose-output` template for `epic.md`:

1. **epic.md** (narrative) -- `.ai-agents/workspace/artifacts/{epic_id}/epic.md`
   - Uses the `decompose-output` template.
   - **Child Stories**: Markdown table mirroring `epic.yaml.children[]`

     | # | Child | Scope | Status | Depends On |
     |---|-------|-------|--------|------------|

   - **Dependency Map**: Mermaid flowchart showing child dependencies

2. **epic.yaml** (structured) -- `.ai-agents/workspace/artifacts/{epic_id}/epic.yaml`
   - Follows the schema defined in Artifact Structure
   - Set first child `status: active`, all others `status: pending`
   - Set `current_change` to the first child's `change_id`

**Self-validation checklist** (verify before writing):
- [ ] All `change_id` values are unique
- [ ] All `depends_on` references exist in `children[]`
- [ ] No cycles in the dependency graph
- [ ] Exactly one child has `status: active`
- [ ] `current_change` matches the active child's `change_id`
- [ ] Each child has non-empty `title` and `scope`

**Optional safety net**: after writing, validate the epic using the Epic Update Script command below:
```bash
node .ai-agents/scripts/epic-update.cjs --validate .ai-agents/workspace/artifacts/{epic_id}/epic.yaml
```

If the epic needs children added later (e.g. a missed sub-change discovered during analysis), use `--add-child`:
```bash
node .ai-agents/scripts/epic-update.cjs --epic .ai-agents/workspace/artifacts/{epic_id}/epic.yaml \
  --add-child <new_child_id> --child-title "<title>" --child-scope "<scope>"
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
