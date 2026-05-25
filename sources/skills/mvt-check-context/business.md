## Execution Flow

### Step 1: Scan Context Files

Scope: only files that the **user** can reduce or relocate. Framework-fixed overhead (skill definitions, framework knowledge under `core/_framework/`, `config.yaml`, `session.yaml`) is **excluded** -- those are not actionable from this skill.

**Index** (always loaded):
- `.ai-agents/workspace/project-context.yaml`

**Semantic context** (loaded by all skills when present):
- `.ai-agents/knowledge/project/_generated/project-context.md`

**Shared knowledge files** (loaded by all skills):
- Read `registry.yaml` > `knowledge.shared` for the list
- For each entry, resolve and scan the referenced files
- For the `core` entry: read `.ai-agents/knowledge/core/manifest.yaml` and scan only files under `core/user/` (i.e., entries whose `path` starts with `user/` or whose `origin` is `user`). Skip `core/_framework/` files -- those are framework-fixed.

**Per-skill knowledge files** (loaded by specific skills):
- Read `registry.yaml` > `skills.*.knowledge` for all entries
- Group by skill, list referenced files per skill

**Artifact files**:
- `.ai-agents/workspace/artifacts/` (all subdirectories)

**Do NOT scan:**
- `.claude/skills/mvt-*/SKILL.md` -- framework-shipped, not user-editable
- `.ai-agents/knowledge/core/_framework/**` -- framework-shipped
- `.ai-agents/config.yaml` -- small and required
- `.ai-agents/workspace/session.yaml` -- small and required
- `.ai-agents/registry.yaml` -- required, addressed via `/mvt-manage-context` not here

### Step 2: Estimate Token Consumption
- Calculate approximate tokens for each file: `characters / 4`
- Group by category:
  - Index (project-context.yaml)
  - Semantic Context (project-context.md)
  - Shared Knowledge (registry.yaml > knowledge.shared, including only `core/user/` for the core entry)
  - Per-Skill Knowledge (registry.yaml > skills.*.knowledge)
  - Artifacts (artifacts/)
- Sum totals per category and overall
- Show shared knowledge token cost as "per-skill overhead" (loaded every time)
- Show per-skill knowledge token cost individually by skill

### Step 3: Assess and Recommend
- Determine health status based on total tokens
- Identify Top 5 largest files (within the scanned scope)
- Generate optimization recommendations:
  - Oversized project-context.md -> Suggest `/mvt-analyze-code` regeneration with leaner sections
  - Too many old artifacts -> Suggest `/mvt-cleanup`
  - Shared knowledge too large -> Suggest moving entries to per-skill via `/mvt-manage-context move`
  - Unused knowledge files -> Suggest removal via `/mvt-manage-context remove` or move to per-skill
  - Redundant information -> Suggest consolidation
- Each recommendation should be specific and actionable
- Do **not** recommend changes to framework files (skills, `core/_framework/`)

### Step 4: Generate Report
