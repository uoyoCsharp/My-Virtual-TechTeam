## Activation Protocol

### Step 1: Load Context (Context Foundation)
Load the following files as foundational context:
- `.ai-agents/workspace/session.yaml` -- Current workflow state
- `.ai-agents/workspace/project-context.yaml` -- Project index (structural info)
- `.ai-agents/registry.yaml` -- Available skills registry and knowledge declarations

### Step 1.5: Load Knowledge

#### A. Shared Knowledge (all skills)
Read `.ai-agents/registry.yaml` > `knowledge.shared`.
For each entry:

- If `type` is absent or `"static"`: Load `.ai-agents/{source or path}{file}` for each file in `files`
- If `type: "dynamic"`:
  1. Resolve variables in `source` (e.g., variable references → read from corresponding config/session files)
  2. If resolved path exists and `files_from_manifest: true`:
     Read `.ai-agents/{resolved_source}manifest.yaml` and load all listed `files`
  3. If resolved path exists and `files` is specified:
     Load `.ai-agents/{resolved_source}/{file}` for each file in `files`
     (Skip individual files that do not exist)
  4. If resolved variable is empty or path does not exist → Skip this entry

Default shared entries (always present):
- `core` → `knowledge/core/manifest.yaml` (resolved via `files_from_manifest: true`; loads every entry where `auto_load: true`, mixing framework + user origin)
- `project-context` → `knowledge/project/_generated/project-context.md` (skipped if file does not exist; legacy path was `workspace/project-context.md` -- run `mvtt update --migrate-paths` to relocate)

#### B. Per-Skill Knowledge (current skill only)
Read `.ai-agents/registry.yaml` > `skills.{{current_skill}}.knowledge`.
For each entry, apply the same `static` / `dynamic` resolution logic as above.

If `knowledge` field is absent or empty → Skip this step (shared knowledge is sufficient).
