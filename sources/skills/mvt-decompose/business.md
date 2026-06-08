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
  - `change_id`: `{YYYYMMDD}-{slug}` format
  - `title`: concise name
  - `scope`: description of what this child delivers
  - `depends_on`: list of `change_id` values this child depends on (empty for root children)
  - `project`: project hint array. For single-project workspaces: `["default"]`. For multi-project workspaces: must match a project name from `project-context.yaml > projects[].name`; if uncertain, ask the user rather than writing `["default"]`.
- **DAG constraints**:
  - Dependencies must form a DAG (no cycles)
  - Dependencies reference existing `change_id` values only
  - Prefer shallow depth (wide parallelism) over deep chains
- **Validation**: if > 8 children needed, WARN and suggest narrowing the epic scope. If < 2 children, suggest using `/mvt-analyze` directly.

### Step 5: Write Artifacts
Write two artifacts using the `decompose-output` template for `epic.md`:

1. **epic.md** (narrative) -- `.ai-agents/workspace/artifacts/{epic_id}/epic.md`
   - Uses the `decompose-output` template (Vision, Scope & Out of Scope, Cross-cutting Concerns, Child Stories, Dependency Map, Open Questions)
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

**Optional safety net**: after writing, call `epic-update.cjs --validate` to verify:
```bash
node .ai-agents/scripts/epic-update.cjs --validate .ai-agents/workspace/artifacts/{epic_id}/epic.yaml
```

### Step 6: Update Session
Run the session update command (see State Update section) to:
1. Create a new `active_epic` in session.yaml
2. Set the `epic_path` to the written `epic.yaml`

### Step 7: Output
Display to the user:
1. **Child story table** (from epic.md)
2. **Dependency diagram** (mermaid)
3. **Suggested starting child**: "Start with: `{first_child_title}` (`{first_child_id}`). Run `/mvt-analyze` to begin."
