## Activation Protocol

### Step 1: Load Context (Context Foundation)
Load the following files as foundational context:
- `.ai-agents/workspace/session.yaml` -- Current workflow state
- `.ai-agents/workspace/project-context.yaml` -- Project index (structural info)
- `.ai-agents/registry.yaml` -- Available skills registry and knowledge declarations
{{?extended_context}}

Extended context for this skill:
{{/extended_context}}
{{#extended_context}}
- {{.}}
{{/extended_context}}

### Step 2: Resolve Project Scope (PS)

Read `project-context.yaml` and extract the `projects[]` array.

**If `projects.length == 1`** (single-project workspace -- ADR-1):
Set PS = [the sole project's name]. Skip all remaining PS resolution steps below. No project-selection prompt should ever fire.

**If `projects.length > 1`** (multi-project workspace):
Determine which mode applies and resolve PS accordingly.

**Mode A -- Plan-driven skills** (use this mode when an active plan exists in `session.yaml.active_change` and your skill operates on plan tasks):

1. **Priority 1 -- Plan signal**: Read the plan's `current_tasks` map (from the plan file referenced by `session.yaml.active_change.plan_path`). For the current task you are about to execute, identify its `project` array. Set PS = that array. If the project name in the plan does not exist in `projects[]` (stale plan), drop it and fall through to the next priority.
2. **Priority 2 -- Path reverse-lookup**: If no plan signal resolved PS, match the file paths or directory you are currently working against each project's `path` and `source_paths` fields. If exactly one project matches, set PS = [that project's name].
3. **Priority 3 -- Prompt user**: If PS is still unresolved or ambiguous, list the candidate project names and ask the user to select. Never silently load all projects' knowledge.

**Mode B -- Non-plan skills** (use this mode when no active plan exists, or when your skill operates on ad-hoc changes without plan tasks):

Do NOT resolve PS at activation. Defer project identification to during execution: when you identify a change target (file paths, change description), match against `projects[].path` and `projects[].source_paths` to determine the relevant project(s), then load project-specific knowledge on demand (Step 3b below).

### Step 3: Load Knowledge

The registry uses project-keyed knowledge maps with a reserved `_all` key. Every knowledge block (top-level `knowledge` and each `skills.<name>.knowledge`) is a map where keys are project names or `_all` (all projects).

For each entry in a knowledge list, resolve files relative to `.ai-agents/{source}`:
- If the entry lists `files: [...]`, load those files.
- If the entry lists `files_from_manifest: true`, read `{source}/manifest.yaml` and load every `files[]` entry where `auto_load: true`.
- Skip any path that does not exist.

**Mode A (plan-driven skills) -- full knowledge union at activation**:

1. Load all entries under `knowledge._all` (global knowledge for all skills, all projects).
2. For each project P in PS: load entries under `knowledge[P]` (skip if key absent).
3. Load all entries under `skills.<current-skill>.knowledge._all` (skill-specific knowledge for all projects).
4. For each project P in PS: load entries under `skills.<current-skill>.knowledge[P]` (skip if key absent).

For cross-project tasks (PS has multiple projects), load the union of all projects' entries from steps 2 and 4.

**Mode B (non-plan skills) -- minimal activation + on-demand loading**:

At activation, load ONLY:
1. All entries under `knowledge._all`.
2. All entries under `skills.<current-skill>.knowledge._all`.

During execution, once you have identified the relevant project(s) for the current change:
3. On demand, read `knowledge[P]` entries from the registry and load the referenced files.
4. On demand, read `skills.<current-skill>.knowledge[P]` entries from the registry and load the referenced files.

If the change spans multiple projects, load each project's knowledge sequentially.

**Error path**: If a plan's `current_tasks` references a project name not in `projects[]`, drop that reference and fall through to the next PS resolution priority. Do not fail or prompt based on stale plan data.

### Archived Artifacts Convention

The directory `.ai-agents/workspace/artifacts/_archived/` contains change-id directories that have been archived by `/mvt-cleanup`. All skills that scan `artifacts/` MUST exclude `_archived/` from their scan scope unless explicitly inspecting archived content.
