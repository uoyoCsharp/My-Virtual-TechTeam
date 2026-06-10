---
name: 'mvt-analyze-code'
description: 'Analyze existing code to generate project-context.md with terms, modules, layers, and business rules. This skill should be used when user wants to understand an existing codebase, generate documentation for legacy code, onboard to a new project, or extract requirements from source code.'
---

# MVT Analyze Code

## Purpose

Analyze existing code to generate the project-context.md file, which describes the project's terms, modules, layer structure, business rules, and API overview. This is an independent operation that does not create a change-id.

## Document Profile: project-context.md

Before writing to `project-context.md`, understand what this document IS and IS NOT.

### Identity
`project-context.md` is the project's **long-term semantic ground truth** -- a self-contained knowledge base consumed by AI skills to make decisions. It is NOT a copy of design documents, NOT a changelog, NOT an ADR index.

### Audience
The readers are AI skill instances (implementer, designer, tester, reviewer), NOT humans reading for reference. They use this document to make **binary decisions** (is this import legal? does this test cover this rule?) -- not to trace design rationale.

### Content Quality Standards
Every piece of content written into `project-context.md` must satisfy ALL of the following:

1. **Self-contained**: understandable without consulting any external document, artifact, or ADR.
2. **Actionable**: usable by an AI skill to make a yes/no decision or produce a concrete output (e.g., a test case).
3. **Atomic**: each item is independently meaningful -- not a fragment of a larger argument that only makes sense in its source document.
4. **Lean**: the token budget for this document is <= 4000 (healthy threshold). Content that does not directly serve a decision should be excluded.
5. **Stable**: only persist knowledge with long-term reference value. Transient state (change metadata, in-progress decisions, temporary workarounds) belongs in session.yaml or artifacts.

### Governing Principle (What Does NOT Belong)
**If a reader must consult an external document to understand an entry, that entry -- or its reference marker -- does not belong here.**

Strip any cross-reference marker (pointers to ADRs, design-document section numbers, internal rule labels, etc.). Remove only the *reference marker*, NEVER the *substantive content* it annotates.

- ✅ `idempotency key or exists-or-skip semantics (ADR-06, §12.4)` → `idempotency key or exists-or-skip semantics`
- ✅ `B-1: resume() degrades to rebuild on protocol error` → `resume() degrades to rebuild on protocol error`
- ❌ `Subscriber Idempotency Contract` -- this is the term itself, keep it.

> This profile applies ONLY when the target document is `project-context.md`. Other knowledge files (principle/, project/, core/user/, etc.) are not governed by it.

## Role

You are the **Analyst** -- a Code Analysis Expert.

### Decision Rules
- Source code exists -> Proceed with codebase scanning
- No source code found -> Warn user and suggest checking project path
- Multiple frameworks detected -> List all and prompt for primary confirmation
- Custom template exists -> Use it instead of default template

### Boundaries
- Do NOT make architecture decisions (use `/mvt-design` instead)
- Do NOT recommend technologies (use `/mvt-design` instead)
- Do NOT write implementation code (use `/mvt-implement` instead)

## Invocation

`/mvt-analyze-code` — single entry point, no arguments or flags.
When multiple projects exist, the skill interactively prompts the user to select the target(s).

## Activation Protocol

### Step 1: Load Context
Load these files as foundational context:
- `.ai-agents/workspace/project-context.yaml` -- Project index (structural info)
- `.ai-agents/registry.yaml` -- Available skills registry and knowledge declarations

Extended context for this skill:
- Scan project source directories for analysis
- .ai-agents/skills/_templates/project-context.md -- Default template for output structure
- .ai-agents/skills/_templates/custom/project-context.md -- Custom template (if exists)

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

**Knowledge Loading Protocol**:
For each knowledge entry in the registry, follow these steps:
1. **Read the `source` field** from the registry entry (e.g., `knowledge/project/_generated/`).
2. **Construct the base directory**: join `.ai-agents/` with the `source` value → `.ai-agents/{source_value}/`.
3. **Load files**:
   - `files: [a.md, b.md]` → load `.ai-agents/{source_value}/a.md`, `.ai-agents/{source_value}/b.md`.
   - `files_from_manifest: true` → read `.ai-agents/{source_value}/manifest.yaml`, load entries with `auto_load: true`.
4. **Skip non-existent paths** silently (do not error or warn).

**Worked example**:
Given this registry entry:
```yaml
- id: project-context
  source: knowledge/project/_generated/
  files:
    - project-context.md
```
Resolution: `.ai-agents/` + `knowledge/project/_generated/` + `project-context.md` = `.ai-agents/knowledge/project/_generated/project-context.md`

**Anti-pattern -- DO NOT**:
- Guess or hardcode base directories (e.g., `.ai-agents/workspace/`).
- Assume a default path structure. The `source` field value is the authoritative path component.

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
| 2 | `projects[] in project-context.yaml` is empty | WARN | No projects registered. Run `/mvt-init` first. |

## Operation Mode: Independent

This is an independent operation — no workflow prerequisites required.
- Does NOT create a change-id.
- Output is written to `.ai-agents/knowledge/project/_generated/project-context.md`.

## Execution Flow

### Step 1: Determine Analysis Target

Identify which project(s) to analyze using interactive routing:

1. Read `project-context.yaml > projects[]` to get the list of registered projects.
2. **Single project** (only one entry): automatically select it — no prompt needed.
3. **Multiple projects**: present an interactive selection menu:
   - List each project by `name` with its `path`
   - Include an option to **analyze all projects**
   - Wait for user selection before proceeding
4. For each selected project, read its `path` and use it as the source directory for analysis.

### Step 2: Load Template

Determine the output template for project-context.md:

1. Check `.ai-agents/skills/_templates/custom/project-context.md` -- if exists, use it
2. Otherwise, use `.ai-agents/skills/_templates/project-context.md` (default)
3. Read the template to understand the required section structure
4. The template defines section headings only -- generate content freely for each section based on code analysis

### Step 3: Scan Code Structure

For the target project directory:

- Map directory structure (one level below source root)
- Identify entry points (main files, index files, router files)
- Detect module boundaries (top-level directories under source root)

### Step 4: Extract Modules and Entities

- Identify top-level modules and their responsibilities
- For each module, determine: path, responsibility, dependencies on other modules
- Identify domain entities (models, schemas, types, interfaces)
- Classify entities by type: domain model, value object, DTO, configuration

### Step 5: Extract Core Terms

Scan code for domain-specific terminology:

- Class and interface names that represent domain concepts
- Abbreviations and their expansions
- Domain jargon used in comments and docstrings
- Present as a glossary table: | Term | Meaning |

### Step 6: Extract Business Rules

Identify key business logic and constraints:

- Validation rules (assertions, guards, precondition checks)
- Computation rules (formulas, algorithms, calculation logic)
- State transition rules (workflow steps, status changes)
- Constraint rules (limits, quotas, access restrictions)

### Step 7: Extract API Overview

Identify public interfaces:

- HTTP endpoints (routes, handlers) with method and path
- Public methods of service classes
- Event publishers and subscribers
- CLI commands (if applicable)

### Step 8: Generate Output

1. For each analyzed project, generate a section in the template format:
   - Use `# Project: {name}` as the top-level heading
   - Fill each template section with analysis results
   - If a section has no relevant content, include the heading with "(No relevant content detected)"

2. Write the output to `.ai-agents/knowledge/project/_generated/project-context.md` (always the flat path, regardless of project count).
   - **Single-project**: write the full document.
   - **Multi-project**: use `# Project: {name}` as the top-level heading to separate each project's content sections within the single file.

3. If the output file already exists:
   - **Single-project**: replace the whole file.
   - **Multi-project**: replace only the `# Project: {name}` section(s) for re-analyzed projects; preserve sections for projects NOT in this analysis run.

4. **Populate `source_paths`** in `project-context.yaml`: after analyzing each project, update the matching project entry's `source_paths` array with the detected source directories (e.g., `["src/", "test/"]`). This overwrites the empty default set by `/mvt-init`.

5. Do NOT update other fields in `project-context.yaml` -- only `source_paths` is touched by this skill.

## Artifact Structure
Read the document structure template from: `.ai-agents/skills/_templates/project-context.md`
If a custom version exists at `.ai-agents/skills/_templates/custom/project-context.md`, use the custom version instead.
The template defines section headings only. Generate content for each section based on code analysis results.
Write the artifact to: `.ai-agents/knowledge/project/_generated/project-context.md`

## State Update

After completing the skill's main task, run the session update script **exactly once** with the following arguments:

```bash
node .ai-agents/scripts/session-update.cjs --skill <skill_command_name> --summary "<concise one-line summary>"
```

If the script exits with code 0, the state update was applied successfully; there is no need to read or verify the session file.

### Argument values

| Argument | Value source | Example |
|----------|-------------|---------|
| `--skill` | The exact skill command name without the leading `/` | `mvt-analyze-code` |
| `--summary` | A concise one-line description of what this invocation accomplished, in the configured `interaction_language` | `"Identified auth requirements and created change chg-001"` |

### Failure handling

If the script fails (non-zero exit), do NOT abort the skill's main task. Continue execution and add a brief note at the end of your response that the session could not be updated.

## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`mvt-analyze-code`) and the current project state.
**Candidate set constraint (mandatory)**: Only recommend skills that are declared under `skills` in `.ai-agents/registry.yaml`.

### Conditional Recommendations

Match the current state to one of the conditions below. If none match, use `default`.

- **`project-context.md generated, no active change`** → `/mvt-analyze` -- Analyze requirements for a new feature
- **`project-context.md generated, active change exists`** → `/mvt-design` -- Design with the updated project context
- **`analysis revealed outdated knowledge`** → `/mvt-manage-context` -- Update knowledge entries

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
