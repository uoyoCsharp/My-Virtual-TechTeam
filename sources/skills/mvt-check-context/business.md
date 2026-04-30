## Execution Flow

### Step 1: Scan Context Files
Scan all files that MVTT may load during operation:

**Core files** (always loaded):
- `.ai-agents/workspace/session.yaml`
- `.ai-agents/workspace/project-context.yaml`
- `.ai-agents/config.yaml`

**Knowledge files** (loaded per config):
- `.ai-agents/knowledge/core/`
- `.ai-agents/knowledge/patterns/{active}/`
- `.ai-agents/knowledge/principle/`
- `.ai-agents/knowledge/project/`

**Artifact files**:
- `.ai-agents/workspace/artifacts/` (all subdirectories)

**Skill files**:
- `.claude/skills/mvt-*/SKILL.md` (all skill definitions)

### Step 2: Estimate Token Consumption
- Calculate approximate tokens for each file: `characters / 4`
- Group by category:
  - Core (session + context + config)
  - Knowledge (knowledge/)
  - Artifacts (artifacts/)
  - Skills (skills/)
- Sum totals per category and overall

### Step 3: Assess and Recommend
- Determine health status based on total tokens
- Identify Top 5 largest files
- Generate optimization recommendations:
  - Oversized project-context.yaml -> Suggest trimming
  - Too many old artifacts -> Suggest `/mvt-cleanup`
  - Unused knowledge files -> Suggest removal or lazy_load
  - Redundant information -> Suggest consolidation
- Each recommendation should be specific and actionable

### Step 4: Generate Report
