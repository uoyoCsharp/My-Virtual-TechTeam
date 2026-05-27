## Execution Flow

### Step 1: Parse Subcommand

Detect the subcommand from the invocation:

| Invocation | Subcommand |
|------------|-----------|
| `/mvt-manage-context` | interactive menu (prompt user to pick add / remove / move / rename / list) |
| `/mvt-manage-context add` | add |
| `/mvt-manage-context remove [id]` | remove |
| `/mvt-manage-context move [id]` | move |
| `/mvt-manage-context rename [id]` | rename |
| `/mvt-manage-context list` | list |

For interactive menu, present the five options and wait for user choice, then enter that flow.

### Step 2: Subcommand Routing

Switch to the matching section below.

---

## Subcommand: add

### 2.1 Collect content
Prompt user for the knowledge content. Accept either:
- Pasted text -> save to a new file
- Path to an existing file -> import in place

### 2.2 Detect knowledge type
Classify the content into one of:
- `principle` -- coding standards, naming conventions, review rules, team policies
- `project` -- domain knowledge, business rules, API specs, integration notes
- `core/user` -- universal principles the user wants applied to **every** skill (rare; explicit opt-in)

The skill should suggest a type based on content keywords; the user confirms or overrides.

### 2.3 AI Routing -- Score every skill

1. Read `.ai-agents/registry.yaml` > `skills.*` -- collect every skill's `name` and `description`.
2. For each skill, score relevance to the content on a 0-100 scale:
   - 90-100: directly aligned (e.g., review rules + `mvt-review`)
   - 70-89: strongly relevant
   - 50-69: tangentially relevant
   - 0-49: weak match
3. Read `.ai-agents/config.yaml` > `preferences.context_routing.relevance_threshold` (default 70 if missing).
4. Display **all** skills sorted by score descending. Do not truncate -- the user sees the full list with scores.
   - Skills at or above threshold: pre-checked, shown with `[High]` / `[Med]` markers (or stars in emoji mode).
   - Skills below threshold: collapsed under an "expand" prompt; not pre-checked.

### 2.4 Accept user input
Accept any of:
- `Enter` (empty input) -- confirm pre-checked selection
- Comma-separated indices (e.g. `1,3,5`) -- custom skill selection
- `s` -- promote to **shared** (write to `registry.yaml > knowledge.shared`)
- `c` -- promote to **core** (write to `.ai-agents/knowledge/core/user/{filename}` + append entry to `core/manifest.yaml` with `origin: user`)
- `n` -- **none** (file-only; not auto-loaded)
- `m` -- **manual** mode (display the full skill list including below-threshold for direct picking)
- `expand` -- show below-threshold skills inline

### 2.5 Resolve target path

| User choice | File destination | Registry / manifest update |
|------------|-----------------|----------------------------|
| Per-skill (any subset) | `.ai-agents/knowledge/{type}/{filename}` (`type` = `principle` or `project`) | For each chosen skill: append entry to `registry.yaml > skills.{name}.knowledge[]` with `type: static`, `source: knowledge/{type}/`, `files: [{filename}]` |
| `s` (shared) | `.ai-agents/knowledge/{type}/{filename}` | Append to `registry.yaml > knowledge.shared[]` with the same `type: static` shape |
| `c` (core) | `.ai-agents/knowledge/core/user/{filename}` | Append to `core/manifest.yaml > files[]` with `path: user/{filename}`, `origin: user`, `auto_load: true` |
| `n` (none) | `.ai-agents/knowledge/{type}/{filename}` | No registry/manifest change |

If the user chose multiple bindings (e.g., shared + per-skill review), apply each rule.

### 2.6 Write atomically
1. Write the knowledge file.
2. Update `registry.yaml` (and/or `core/manifest.yaml`) with all references.
3. If any write fails, roll back: delete the new file, revert the registry/manifest edits.

### 2.7 Report
Use the `add / move / rename` output format from the manifest. Show:
- The routing decision table (skill, score, bound or not)
- The files modified
- Token impact estimate (sum of file size / 4)

---

## Subcommand: remove

### 3.1 Identify target
- If `[id]` was provided: jump to 3.2
- Otherwise: list all knowledge entries with their IDs and locations (same format as `list`), prompt user to pick one

### 3.2 Confirm deletion
Show the entry's file path, all binding references (shared / per-skill / core), and ask user to confirm.

### 3.3 Drop references
- `registry.yaml > knowledge.shared[]` -- remove entries whose path matches
- `registry.yaml > skills.*.knowledge[]` -- remove every per-skill entry whose path matches
- `core/manifest.yaml > files[]` -- if the file lives under `core/user/`, remove the matching entry

### 3.4 Delete file
Delete the physical file. If multiple entries pointed to the same file, only delete after all references are cleared.

### 3.5 Report
Use the `remove` output format. Show every reference dropped.

---

## Subcommand: move

### 4.1 Identify source
- If `[id]` was provided: jump to 4.2
- Otherwise: prompt user to pick from `list` output

### 4.2 Show current binding
Display where the entry is currently bound (shared / per-skill / core / none).

### 4.3 Prompt for new binding
Use the same UI as `add` step 2.4 (Enter / indices / `s` / `c` / `n`).

### 4.4 Apply changes
- Update registry / manifest references atomically:
  - Remove old references that no longer apply
  - Add new references for newly chosen bindings
- If the new binding requires the file to live in a different directory (e.g., promoting a `principle/` file to `core/user/`):
  - Move the physical file
  - Update the `path` field in every retained reference to match

### 4.5 Report
Use the `add / move / rename` output format. Highlight which references moved.

---

## Subcommand: rename

### 5.1 Identify source
Same as `move` step 4.1.

### 5.2 Prompt for new id
- Validate uniqueness against existing entries (under the same binding scope)
- Validate filename safety (no path separators, no leading dots)

### 5.3 Apply changes
- Rename the physical file (`old/path/old-id.md` -> `old/path/new-id.md`)
- Update every retained reference in `registry.yaml` and `core/manifest.yaml` to point to the new path

### 5.4 Report
Use the `add / move / rename` output format.

---

## Subcommand: list

### 6.1 Read sources
- `.ai-agents/registry.yaml` > `knowledge.shared[]` and `skills.*.knowledge[]`
- `.ai-agents/knowledge/core/manifest.yaml` > `files[]`
- Walk `.ai-agents/knowledge/{principle,project}/` for files not referenced anywhere (Unbound)

### 6.2 Group and render
Use the `list` output format. Each row should answer: where is the file, and which skills load it?

For Per-Skill rows, list every skill that binds to the file (a single file can be bound to multiple skills).

### 6.3 Health hints
At the bottom of the list, optionally surface:
- "N file(s) present but unbound -- consider `/mvt-manage-context move` or `/mvt-manage-context remove`"
- "Total token cost (auto-loaded): ~X tokens" -- approximate

---

## Cross-cutting rules

- **Atomicity**: file system writes and registry/manifest writes must succeed together. On partial failure, restore the previous state.
- **No edits to framework files**: never write to `.ai-agents/knowledge/core/_framework/`. If user content would land there by accident, redirect to `core/user/`.
- **Backups**: before mutating `registry.yaml` or `core/manifest.yaml`, copy them to `.ai-agents/.backup/{filename}-{timestamp}.yaml`.
- **Idempotency**: re-running the same `add` (same content + same bindings) should detect the existing entry and offer "skip / overwrite / cancel" rather than silently duplicating.
