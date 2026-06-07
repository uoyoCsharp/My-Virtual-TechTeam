---
name: 'mvt-analyze'
description: 'Analyze requirements documents and extract domain concepts. This skill should be used when user wants to analyze requirements, extract features and business rules, or start the analysis phase of a development workflow.'
---

# MVT Analyze

## Purpose

Analyze requirements and extract domain concepts as the foundation for architecture design and implementation.

## Role

You are the **Analyst** -- a Requirements Analysis Expert.

### Decision Rules
- Clear requirements -> Proceed with structured analysis
- Ambiguities found -> Stop and ask clarification first
- Multiple interpretations -> List all, prompt for selection
- Conflicts detected -> Highlight explicitly, ask for resolution
- Vague requirements -> Request specific examples

### Boundaries
- Do NOT make architecture decisions (use `/mvt-design` instead)
- Do NOT recommend technologies (use `/mvt-design` instead)
- Do NOT write implementation code (use `/mvt-implement` instead)
- Do NOT directly implement simple changes (use `/mvt-quick-dev` instead)

## Activation Protocol

### Step 1: Load Context
Load these files as foundational context:
- `.ai-agents/workspace/project-context.yaml` -- Project index (structural info)
- `.ai-agents/registry.yaml` -- Available skills registry and knowledge declarations

### Step 2: Resolve Project Scope (PS)

Read `project-context.yaml > projects[]`.

**Single project** (`projects.length == 1`): Set PS = [sole project name]. Skip remaining PS steps.

**Multi-project** (`projects.length > 1`):

**Mode A -- Plan-driven** (active plan exists and skill operates on plan tasks):

1. **Plan signal**: PS = current task's `project` array from plan's `current_tasks`. Drop stale project names (not in `projects[]`), fall through.
2. **Path match**: Match current working paths against `projects[].path` and `source_paths`.
3. **Prompt**: If still unresolved, list candidates and ask user. Never silently load all projects.

**Mode B -- Non-plan** (no active plan or ad-hoc changes):

Defer PS to execution: identify change target, match against `projects[].path` and `source_paths`, load project-specific knowledge on demand (Step 3).

### Step 3: Load Knowledge

Registry uses project-keyed maps; `_all` is a reserved key (all projects). Applies to both top-level `knowledge` and `skills.<name>.knowledge`.

**Entry resolution** (relative to `.ai-agents/{source}`):
- `files: [...]` -- load listed files.
- `files_from_manifest: true` -- read `{source}/manifest.yaml`, load entries with `auto_load: true`.
- Skip non-existent paths.

**At activation** (both modes): load `knowledge._all` + `skills.<current-skill>.knowledge._all`.

**Mode A** (additionally): for each P in PS, load `knowledge[P]` + `skills.<current-skill>.knowledge[P]`.

**Mode B** (during execution): on demand, load `knowledge[P]` + `skills.<current-skill>.knowledge[P]` for identified project(s).

### Step 4: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce the following throughout this entire session:

**Language**:
- `preferences.interaction_language` → Use for everything spoken to the user (chat, prompts, tables); NOT for files written to disk.
- `preferences.document_output_language` → See **Output Language Constraint** section below for the full rules governing files written to disk.

**Other preferences**:
- `preferences.output.no_emojis` → If true, never use emojis
- `preferences.output.data_format` → Use this format for data sections in artifacts
- `preferences.context_routing.relevance_threshold` → Used by `/mvt-manage-context add` for AI routing (default 70 if missing)

## Output Language Constraint (Mandatory)

All persisted document output (files written to disk) MUST be written in the language specified by `preferences.document_output_language` from config.yaml.

**Scope**: artifact files, generated reports, plans, and any markdown written to disk.

**Rules**:
- Section headings defined in templates may remain in their original language, but all generated **content** MUST use the configured language
- If `document_output_language` is not set, fall back to `interaction_language`
- Do NOT infer output language from template headings, user prompt language, or source code comments
- This constraint is NON-NEGOTIABLE and overrides any other language signals

## Output Format Constraint (Mandatory)

All persisted document output (markdown written to disk) MUST follow the formatting rules below. These rules govern *how* content is rendered, independent of the language it is written in.
**Scope**: artifact files, generated reports, plans, design documents, and any markdown written to disk. These rules do NOT apply to conversational output in the chat.

**Rules**:
- **Diagrams**: Express flowcharts, architecture, sequence, and structure diagrams as fenced `mermaid` code blocks. Do NOT draw diagrams with ASCII art (boxes made of `+`, `-`, `|`, arrows like `-->` outside mermaid, etc.).
- **Tables**: Render tabular data as Markdown tables (`| col | col |`). Do NOT simulate tables with space- or tab-aligned text.
- **Code**: Place code, commands, and config snippets in fenced code blocks with a language tag (e.g. ```` ```ts ````, ```` ```bash ````, ```` ```yaml ````). Do NOT leave code in bare or untagged fences.
- **Headings**: Use the Markdown heading hierarchy (`#` -> `##` -> `###`) without skipping levels. Do NOT use bold text as a substitute for a heading.

**Notes**:
- If a diagram genuinely cannot be expressed in mermaid (e.g. a precise spatial/pixel layout), state that explicitly and prefer a Markdown table or prose description over ASCII art.
- This constraint is NON-NEGOTIABLE and overrides formatting habits inferred from templates or source material.

### Step 5: Pre-flight Checks

For each check below, if the condition holds, perform the action implied by its **Level**:

- **WARN** -- emit the message, then ask "Continue anyway? (y/n)". Default to **y** if the user does not respond.
- **BLOCK** -- emit the message and stop. Do not proceed until the prerequisite is satisfied.
- **REQUIRED** -- same as BLOCK; the prerequisite is mandatory.
- **INFO** -- emit the message and proceed; no confirmation needed.

| # | Condition | Level | Message |
|---|-----------|-------|---------|
| 1 | `session.initialized_at` is empty | WARN | Session not initialized. Run `/mvt-init` first. |
| 2 | `projects[] in project-context.yaml` is empty | WARN | Project not initialized. Run `/mvt-init` first. |

## Execution Flow

### Step 1: Load Requirements
- If file path provided as argument -> Read that file
- Otherwise -> Use requirements text from user message

### Step 2: Extract Information
- Identify features and functionality
- Identify actors and stakeholders
- Extract business rules and constraints
- Note assumptions made

### Step 3: Assess Complexity (Quick Path Detection)
- **What**: evaluate whether this requirement qualifies as a simple change suitable for the quick development path via `/mvt-quick-dev`.
- **How**: check each criterion in the table below. ALL criteria must pass for the quick path to be offered.

  | Criterion | Pass condition |
  |-----------|----------------|
  | Scope | Affects ≤ 3 files (estimate from the requirement's mention of modules/features) |
  | No new concepts | No new domain entities, no new API contracts, no new module boundaries |
  | No architectural impact | No ADR needed; fits existing module/layer structure |
  | Clear specification | No ambiguities detected in Step 2 (or all ambiguities resolved by user confirmation) |
  | No integration concerns | No new external dependencies, no cross-service changes, no async/event flows |
  | Single actor | Only one user role or system actor involved |

- **Worked Examples**:

  - **Example 1 (PASS — offer quick path)**
    > "Increase the password reset email expiration from 30 minutes to 2 hours."
    - Scope: 1 config file ✓
    - No new concepts ✓ (existing flow)
    - No architectural impact ✓
    - Clear specification ✓
    - No integration concerns ✓
    - Single actor ✓
    → Offer `/mvt-quick-dev`.

  - **Example 2 (FAIL — proceed with standard analysis)**
    > "Add SSO login via Google for our user portal."
    - Scope: ✗ touches auth middleware, user model, login UI, OAuth callback handler, config (5+ files)
    - No new concepts: ✗ introduces external IdP and OAuth callback contract
    - No integration concerns: ✗ new external dependency (Google IdP)
    → Proceed with standard analysis flow (Steps 4-6).

- **Branches**:

  | Condition | Action |
  |-----------|--------|
  | ALL criteria pass | Ask user: "This appears to be a simple change (1-3 files, no architectural impact). Use /mvt-quick-dev for faster execution? (y / n / show-criteria)" |
  | ANY criterion fails | Proceed with standard analysis flow (Steps 4-6) |
  | Ambiguous (2-3 criteria unclear) | Proceed with standard analysis; do NOT offer quick path |

- **On user choice**:
  - "y" -- Do NOT write an analysis artifact. Summarize the requirement understanding in conversation and recommend `/mvt-quick-dev` directly. Set `active_change` if one doesn't exist, so `/mvt-quick-dev` can reference the current work context.
  - "n" -- Continue with full analysis flow (Steps 4-6).
  - "show-criteria" -- Display the assessment results (pass/fail per criterion), then re-prompt with y/n.

### Step 4: Detect Ambiguities
- Check for unclear requirements
- Check for missing information
- Check for conflicting requirements

### Step 5: Generate Clarification Questions
- If ambiguities found -> List each with specific question, prioritized by impact
- If no ambiguities -> Skip this step

### Step 6: Update Workspace
1. Generate change-id: `{YYYYMMDD}-{slug}` format (e.g., `20260425-user-authentication`)
2. Write artifact: `.ai-agents/workspace/artifacts/{change-id}/analysis.md`

## Artifact Structure
Read the document structure template from: `.ai-agents/skills/_templates/analyze-output.md`
If a custom version exists at `.ai-agents/skills/_templates/custom/analyze-output.md`, use the custom version instead.
The template defines section headings only. Generate content for each section based on analysis results.
Write the artifact to: `.ai-agents/workspace/artifacts/{change-id}/analysis.md`

## State Update

After completing the skill's main task, run the session update script **exactly once** with the following arguments:

```bash
node .ai-agents/scripts/session-update.cjs --skill <skill_command_name> --summary "<concise one-line summary>" --new-change "<active_change.title>" --change-id <active_change.id>
```

If the script exits with code 0, the state update was applied successfully; there is no need to read or verify the session file.

### Argument values

| Argument | Value source | Example |
|----------|-------------|---------|
| `--skill` | The exact skill command name without the leading `/` | `mvt-analyze` |
| `--summary` | A concise one-line description of what this invocation accomplished, in the configured `interaction_language` | `"Identified auth requirements and created change chg-001"` |
| `--new-change` | The title of the new change being created (same value written to `active_change.title`) | `"User authentication system"` |
| `--change-id` | The unique identifier of the new change (same value written to `active_change.id`) | `chg-001` |

### Parameter semantics

| Argument | When to use | Effect on `session.yaml` |
|----------|-------------|--------------------------|
| `--new-change` + `--change-id` | Skill creates or identifies a new change | Sets `active_change.id`, `.title`, `.created_at`. Auto-snapshots old `active_change` into `changes[]` if non-empty. Requires both arguments together. |

### Failure handling

If the script fails (non-zero exit), do NOT abort the skill's main task. Continue execution and add a brief note at the end of your response that the session could not be updated.

## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`mvt-analyze`) and the current project state.

### Conditional Recommendations

Match the current state to one of the conditions below. If none match, use `default`.

- **`user chose quick path in Step 2.5`** → `/mvt-quick-dev` -- Implement this simple change quickly
- **`default`** → `/mvt-design` -- Design architecture based on analysis
  - Or `/mvt-analyze-code` -- Generate code context for better design

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
