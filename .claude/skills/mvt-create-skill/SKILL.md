---
name: 'mvt-create-skill'
description: 'Create custom MVTT skills through interactive guided workflow. This skill should be used when user wants to create a new skill, extend the framework with custom functionality, or build project-specific automation.'
---

# MVT Create Skill

## Purpose

Guide users through designing and creating custom MVTT-compliant skills. Follows a structured process: understand use cases, plan reusable resources, design the skill, generate files, and validate. Generates properly structured SKILL.md files with optional bundled resources (scripts, references, assets), manifest.yaml, and registry entries -- ensuring compatibility with the MVTT framework.

## Role

You are the **Conductor** -- a Workflow Coordinator.

### Decision Rules
- User provides skill name -> Validate and proceed with design
- Name conflicts with existing skill -> Warn and ask for alternative
- Skill needs output template -> Create template in `_templates/` and update manifest
- Skill needs state updates -> Include session.yaml update rules
- Skill needs bundled resources -> Plan scripts/references/assets in Step 3
- Usage patterns unclear -> Ask for concrete examples before proceeding

### Boundaries
- Do NOT generate skills that deviate from MVTT SKILL.md standard structure (use `the standard structure as documented` instead)
- Do NOT use arbitrary prefixes without validating naming conventions (use ``mvt-` or a project-specific prefix like `app-`, `proj-`` instead)
- Do NOT create skills without registering in registry.yaml (use ``custom: true` in registry.yaml` instead)
- Do NOT write vague or first-person descriptions (use `third-person with effective trigger keywords` instead)
- Do NOT exceed ~5k words in SKILL.md body (use `references/ for detailed content` instead)

## Activation Protocol

### Step 1: Load Context
Load these files as foundational context:
- `.ai-agents/workspace/project-context.yaml` -- Project index (structural info)
- `.ai-agents/registry.yaml` -- Available skills registry and knowledge declarations

Extended context for this skill:
- Load one existing SKILL.md as structural reference (e.g., `.claude/skills/mvt-status/SKILL.md`)

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

## Design Principles

### Progressive Disclosure
Skills use a three-level loading system to manage context efficiently:
1. **Metadata (name + description)** -- Always in context (~100 words). Determines when Claude triggers the skill.
2. **SKILL.md body** -- Loaded when skill triggers. Target <5k words. Keep only essential procedural instructions and workflow guidance.
3. **Bundled resources** -- Loaded on demand by Claude. Unlimited size.

**Avoid duplication**: information should live in either SKILL.md, `references/`, or knowledge entries -- not in multiple places.

### Writing Style
Write the entire skill using **imperative/infinitive form** (verb-first instructions), not second person. Use objective, instructional language ("To accomplish X, do Y" rather than "You should do X"). This maintains consistency and clarity for AI consumption.

### Description Quality
The `name` and `description` in YAML frontmatter determine when Claude will use the skill. Guidelines:
- Be specific about what the skill does and when to use it.
- Use third-person ("This skill should be used when...").
- Include: what it does + when to trigger + how it differs from similar skills.

| Good | Bad |
|------|-----|
| "Create custom MVTT skills through interactive guided workflow. Use when user wants to create a new skill, extend the framework with custom functionality, or build project-specific automation." | "Skill creator" |
| "Analyze requirements documents and extract domain concepts. Use when user provides requirements text or asks to understand project scope." | "Analyze stuff" |

## Execution Flow

### Step 1: Load Inputs
- **Recommended**:
  - One existing skill's SKILL.md under `.claude/skills/<existing>/SKILL.md` as a structural reference (to extract shared section patterns like Activation Protocol, State Update, Next Steps).
  - `.ai-agents/registry.yaml` -- to check for name collisions and understand skill categories.

### Step 2: Understand Usage with Concrete Examples
Skip only when usage patterns are already crystal clear.

Ask up to 3 of the following (do not ask all at once):
- "Can you give 1-2 concrete examples of how this skill would be used?"
- "What would a user say or do that should trigger this skill?"
- "Are there edge cases or variations in how this skill gets invoked?"
- "What does success look like? What does the AI produce / write?"

Conclude this step with a short paragraph stating the skill's purpose in one sentence and listing 1-3 representative invocations.

### Step 3: Gather Requirements
Collect core metadata. Each field has an explicit constraint -- do not accept vague answers.

| Field | Constraint | Notes |
|-------|------------|-------|
| Name | Lowercase, kebab-case, no spaces. Prefix `mvt-` for framework skills; project-specific prefixes (e.g., `app-`, `proj-`) are also acceptable | Reject if conflicts with an existing entry in `registry.yaml` |
| Agent role | One of: `conductor`, `analyst`, `architect`, `developer`, `reviewer`, `tester` | Maps the skill to an existing role family |
| Purpose | One sentence | Will become the SKILL.md `## Purpose` section |
| Category | One of: `workflow`, `shortcut`, `project`, `utility` | Drives how `/mvt-help` groups it |
| Description | Third-person, includes what + when + how it differs | Will become the frontmatter `description` |
| Variants (optional) | List of flag/sub-mode entries | Becomes the Variants table |

If the user is unsure on any field, propose a default and ask for confirmation rather than leaving it blank.

### Step 4: Plan Reusable Contents
- **What**: decide which resources (beyond the SKILL.md body) the new skill needs.
- **How**: for each example from Step 2, ask: "If we executed this from scratch, what reusable resource would have helped?" Map each answer to one of the categories below.

  | Resource | Directory | Use when | Example |
  |----------|-----------|----------|---------|
  | Scripts | `scripts/` | Same code rewritten repeatedly OR deterministic reliability needed | `scripts/validate_schema.py` |
  | References | `references/` | Documentation Claude should read while working (schemas, API docs, policies) | `references/api_spec.md` |
  | Assets | `assets/` | Files used in the output, not in context (templates, icons, fonts) | `assets/report_template.md` |
  | Knowledge | (declared in registry) | Loaded via Activation Protocol; share across skills or manage via `/mvt-manage-context` | `knowledge/principle/coding-standards/` |
  | Output template | `_templates/` | Persisted document that needs a stable structure | `_templates/{name}-output.md` |

- **Reuse vs new**: before declaring a new shared resource, check existing skills' SKILL.md files and knowledge entries -- prefer reusing patterns that already exist.
- **Output of this step**: a checklist `(name | purpose | path)` shown to user.

### Step 5: Design the Skill
- **What**: produce a one-page outline before generating any file.
- **How**: load an existing skill's SKILL.md (e.g., `.claude/skills/mvt-fix/SKILL.md`) as a structural reference, then fill in:

  | Aspect | Decision |
  |--------|----------|
  | Input parameters | What does the skill need from the user / workspace? |
  | Execution mode | Interactive / automated / hybrid |
  | Pre-flight checks | List, with severity (BLOCK / WARN); defer to `activation-preflight.md` shared section |
  | Decision rules (in role-header) | 3-7 imperative rules covering the major branches |
  | Boundaries | What is in-scope vs delegated to other skills |
  | Execution Flow steps | Bulleted titles only (full content comes in Step 6) |
  | Output | What gets written to disk (artifact path + template) OR pure conversation output |

### Step 6: Generate Skill Files
1. Create skill directory: `.claude/skills/{name}/`.
2. Generate a complete `SKILL.md` file (see Generated SKILL.md Structure below). This file must be fully self-contained — there is no assembler or build step to resolve shared section references. All content must be inlined directly into the SKILL.md.
3. For standard sections (Activation Protocol, Load Config, Language Constraint, Pre-flight, State Update, Next Steps), copy them verbatim from this document's own SKILL.md and substitute only the skill-specific values (role, decision rules, boundaries, pre-flight checks, next-skill suggestions). Do NOT paraphrase standard sections — copy character-for-character to ensure consistency.
4. For skill-specific sections (frontmatter, Purpose, Execution Flow, Edge Cases & Errors), generate fresh content following the skeleton below.
   - `## Execution Flow`
   - `### Step 1: Load Inputs` -- list required and recommended files, plus fallback rules.
   - Skill-specific main steps (1-5 of them), each with **What / How / Branches** sub-structure when there is real branching.
   - `### Step N: User Confirmation` -- only when destructive or non-obvious; describe trigger conditions.
   - `### Step N+1: Write Artifacts` -- only when the skill persists files; specify path, template, required content.
   - Final session update step.
   - `## Edge Cases & Errors` table with at least 3 rows.
5. If an output template was decided in Step 4, create `.ai-agents/skills/_templates/{name}-output.md` with **headings only** (this is a document structure, not a conversation reply template). If a custom version directory exists at `_templates/custom/`, note that users can override there.
6. If scripts / references / assets are needed, create them under the skill directory.
7. SKILL.md word budget: aim for the body to be under ~5k words. Push reference material to `references/`.

### Step 7: Register in Registry (MANDATORY)
Append the skill entry to `.ai-agents/registry.yaml` > `skills` section:

```yaml
  {name}:
    description: "{third-person description with trigger keywords}"
    custom: true
```

- The `custom: true` field is **required** for user-created skills; without it, framework updates will overwrite the entry.
- Validate the YAML still parses after the append; if not, abort and surface the parse error.

### Step 8: Validation
Walk this checklist; any failed item must be fixed before declaring success.

| Check | Pass criterion |
|-------|----------------|
| Frontmatter present | `name` and `description` exist in SKILL.md YAML frontmatter |
| Description quality | Third-person, includes what + when, distinguishes from neighbors |
| Writing style | Imperative/infinitive throughout; no "you" / "your" |
| Naming uniqueness | No collision with another entry in `registry.yaml` |
| `custom: true` | Set in registry entry |
| Standard sections present | SKILL.md contains Role, Activation Protocol, Execution Flow, Edge Cases & Errors, State Update, Suggested Next Steps |
| Knowledge files exist | Every file referenced in `knowledge:` resolves on disk |
| Template path correct | If `template:` set, file exists at that path; the template is headings-only |
| Word budget | SKILL.md body under ~5k words (use any available word-count method, e.g., editor statistics) |
| Standard skeleton | Execution Flow contains Load Inputs, main steps with branches, Edge Cases & Errors |

Show the user how to invoke: `/{name}`.

### Step 9: Iteration Guidance
Tell the user the iteration loop:
1. Use `/{name}` on real tasks.
2. Notice struggles or inefficiencies.
3. Decide whether to update SKILL.md, add a `references/` file, add a knowledge entry, or split into a new skill.
4. Re-run `/mvt-create-skill` to refine, or edit the source files directly and rebuild.

### Step 10: State Update
Apply the State Update rules defined in the **State Update** section below.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| Skill name collides with an existing registry entry | STOP at Step 3; ask user to rename; do not generate any file |
| User wants the skill to mutate `session.yaml` fields beyond `history` | Surface that ownership rules forbid this (e.g., `changes` is owned by `/mvt-plan-dev`/`/mvt-update-plan`); recommend redesign |
| Output template is requested but the skill is conversation-only (no persisted file) | Refuse to create a template; explain that templates are for document structure, not conversation replies |
| User asks to skip the registry registration step | Refuse; an unregistered skill is invisible to `/mvt-help`, `/mvt-status`, and `/mvt-resume`. Registration is non-negotiable |
| Skill duplicates an existing skill's responsibility | Surface the overlap (cite the existing skill's description); propose merging or sub-classing as a variant rather than creating a duplicate |
| User provides a non-third-person description ("Use this skill when you need...") | Rewrite to third-person before saving; show the rewrite for confirmation |
| Generated SKILL.md is missing a standard section (e.g., State Update, Next Steps) | Abort generation; inform user which section is missing; read an existing SKILL.md for the correct structure |
| `registry.yaml` parse fails after append | Restore from a pre-append backup; surface the error; do not leave the registry corrupt |

## Generated SKILL.md Structure

The generated SKILL.md consists of two parts: **skill-specific sections** (generated fresh) and **standard sections** (copied from this document with skill-specific values replaced).

### Skill-specific sections (generate fresh)

```markdown
---
name: '{name}'
description: '{third-person description with trigger keywords}'
---

# {Title}

## Purpose

{concise purpose statement}

## Role

You are the **{Agent Role}** -- {role description}.

### Decision Rules
{generated rules, one per line, verb-first}

### Boundaries
- Do NOT {scope} (use `/{skill}` instead)
{repeat for each boundary}

## Execution Flow

### Step 1: Load Inputs
{required and recommended inputs, plus fallback rules}

{skill-specific steps 2-N}

### Step N: User Confirmation
{only when destructive or non-obvious; describe trigger conditions}

### Step N+1: Write Artifacts
{only when the skill persists files; specify path, template, required content}
{if shortcut/conversation-only: "No artifact -- results are conversation-only."}

{final session update step if not shortcut, or shortcut operation rules}

## Edge Cases & Errors

| Case | Handling |
|------|----------|
{at least 3 rows}
```

### Standard sections (copy from this document)

Copy the following sections verbatim from this document (the assembled SKILL.md you are currently reading), replacing only the skill-specific values indicated:

| Section | Source in this document | What to replace |
|---------|----------------------|-----------------|
| Activation Protocol | `## Activation Protocol` | Add `extended_context` entries if the skill needs additional context sources; otherwise copy as-is |
| Load Config | Load Config step within Activation Protocol | Copy as-is |
| Output Language Constraint | Output Language Constraint step within Activation Protocol | Copy as-is |
| Pre-flight Checks | Pre-flight Checks step within Activation Protocol | Replace `checks` table with skill-specific checks; if none required, use a single INFO row |
| State Update | `## State Update` | Replace `/{name}` with the new skill's command; include `active_change` conditional block only if the skill creates changes; include `Shortcut Operation Rules` if the user opted for shortcut semantics during Step 5 design |
| Suggested Next Steps | `## Suggested Next Steps` | Replace `current_skill` with the new skill name; replace conditional suggestions with skill-appropriate ones |

**Important**: Do NOT paraphrase or rewrite the standard sections. Copy them character-for-character from this document and only substitute the skill-specific values. This ensures consistency across all MVTT skills.

## Output Format

No external template -- output is the generated skill files plus a creation summary:

```markdown
## Custom Skill Created

- **Skill**: `/{name}`
- **Agent**: {agent role}
- **Location**: `.claude/skills/{name}/SKILL.md`
- **Registry**: `registry.yaml` (custom: true)
- **Template**: {created/none}
- **Resources**: {scripts/references/assets listing, or none}
- **Knowledge**: {per-skill entries / shared only}
- **Context Budget**: SKILL.md body ~{N} words

Use `/{name}` to invoke the new skill.

### Iteration
1. Use `/{name}` on real tasks
2. Notice struggles or inefficiencies
3. Update SKILL.md or bundled resources as needed
4. Use `/mvt-create-skill` to refine, or edit skill files directly
```

## State Update

After completing the skill's main task, run the session update script **exactly once** with the following arguments:

```bash
node .ai-agents/scripts/session-update.cjs --skill <skill_command_name> --summary "<concise one-line summary>"
```

If the script exits with code 0, the state update was applied successfully; there is no need to read or verify the session file.

### Argument values

| Argument | Value source | Example |
|----------|-------------|---------|
| `--skill` | The exact skill command name without the leading `/` | `mvt-create-skill` |
| `--summary` | A concise one-line description of what this invocation accomplished, in the configured `interaction_language` | `"Identified auth requirements and created change chg-001"` |

### Failure handling

If the script fails (non-zero exit), do NOT abort the skill's main task. Continue execution and add a brief note at the end of your response that the session could not be updated.

## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`mvt-create-skill`) and the current project state.
**Candidate set constraint (mandatory)**: Only recommend skills that are declared under `skills` in `.ai-agents/registry.yaml`.

### Conditional Recommendations

Match the current state to one of the conditions below. If none match, use `default`.

- **`skill created successfully`** → `/mvt-help` -- Verify the new skill appears in the catalog
- **`skill needs knowledge entries`** → `/mvt-manage-context` -- Add knowledge files for the new skill
- **`skill needs testing with real tasks`** → `/mvt-status` -- Check project state before testing the skill

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
