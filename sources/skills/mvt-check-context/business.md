## Execution Flow

### Step 1: Scan Context Files
Scan all files that MVTT may load during operation:

**Core files** (always loaded):
- `.ai-agents/workspace/session.yaml`
- `.ai-agents/workspace/project-context.yaml`
- `.ai-agents/config.yaml`
- `.ai-agents/registry.yaml`

**Shared knowledge files** (loaded by all skills):
- Read `registry.yaml` > `knowledge.shared` for the list
- For each entry, scan the referenced files
- For `dynamic` entries, resolve variables and scan resolved files

**Per-skill knowledge files** (loaded by specific skills):
- Read `registry.yaml` > `skills.*.knowledge` for all entries
- Group by skill, list referenced files per skill

**Semantic context** (loaded by all skills when present):
- `.ai-agents/workspace/project-context.md`

**Artifact files**:
- `.ai-agents/workspace/artifacts/` (all subdirectories)

**Skill files**:
- `.claude/skills/mvt-*/SKILL.md` (all skill definitions)

### Step 2: Estimate Token Consumption
- Calculate approximate tokens for each file: `characters / 4`
- Group by category:
  - Core (session + config + registry)
  - Index (project-context.yaml)
  - Semantic Context (project-context.md)
  - Shared Knowledge (registry.yaml > knowledge.shared)
  - Per-Skill Knowledge (registry.yaml > skills.*.knowledge)
  - Artifacts (artifacts/)
  - Skills (skills/)
- Sum totals per category and overall
- Show shared knowledge token cost as "per-skill overhead" (loaded every time)
- Show per-skill knowledge token cost individually by skill

### Step 3: Assess and Recommend
- Determine health status based on total tokens
- Identify Top 5 largest files
- Generate optimization recommendations:
  - Oversized project-context.md -> Suggest `/mvt-analyze-code` regeneration with leaner sections
  - Too many old artifacts -> Suggest `/mvt-cleanup`
  - Shared knowledge too large -> Suggest moving entries to per-skill
  - Unused knowledge files -> Suggest removal or move to per-skill
  - Redundant information -> Suggest consolidation
- Each recommendation should be specific and actionable

### Step 4: Generate Report
