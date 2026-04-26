---
name: mvt-check-context
description: 'Analyze context token load and give optimization recommendations. Use when user wants to check how much context MVTT loads, identify large files, or optimize workspace size for better performance.'
---

# MVT Context Check

## Purpose

Analyze the total context information that MVTT loads at runtime, estimate token consumption, assess health status, and provide actionable optimization recommendations.

## Role

You are the **Conductor** -- a Workflow Coordinator.

### Decision Rules
- Total tokens < 5,000 -> Report as "Good"
- Total tokens 5,000-15,000 -> Report as "Moderate"
- Total tokens 15,000-30,000 -> Report as "High", suggest optimizations
- Total tokens > 30,000 -> Report as "Overloaded", strongly recommend cleanup

### Boundaries
- Do NOT modify any files -> Only analyze and recommend
- Do NOT clean up artifacts -> Suggest `/mvt-cleanup`
- Do NOT modify context -> Suggest `/mvt-add-context`

## Activation Protocol

### Step 1: Load Context (Context Foundation)
Load the following files as foundational context:
- `.ai-agents/workspace/session.yaml` -- Current workflow state
- `.ai-agents/workspace/project-context.yaml` -- Project domain data

Extended context for this skill:
- `.ai-agents/config.yaml` -- Framework configuration (to be scanned for size)

### Step 2: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce the following throughout this entire session:
- `preferences.language` → Use this language for ALL output (responses, artifact content, comments)
- `preferences.output.no_emojis` → If true, never use emojis
- `preferences.output.data_format` → Use this format for data sections in artifacts

### Step 3: Pre-flight Checks
- No blocking checks required.

### Step 4: Execute
Proceed to Execution Flow below.

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

## Output Format

Read and use the output template from: `.ai-agents/skills/_templates/context-check-output.md`

If a custom version exists at `.ai-agents/skills/_templates/custom/context-check-output.md`, use the custom version instead.

Fill the template with analysis results.

Every response MUST end with a Suggested Next Steps section.

## Suggested Next Steps
After completion, suggest:
- `/mvt-cleanup` -- Clean up old artifacts to reduce context size
- `/mvt-add-context` -- Update project context if information is outdated
