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
  - One existing skill's `SKILL.md` as a structural reference. Read any `mvt-*` skill from the skills directory of the platform you are running in (the directory that contains this `SKILL.md`); prefer `mvt-status`.
  - `.mvtt/registry.yaml` -- to check for name collisions and understand skill categories.

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
| Name | Lowercase, kebab-case, no spaces, must match `^[a-z][a-z0-9-]*$`. Prefix `mvt-` for framework skills; project-specific prefixes (e.g., `app-`, `proj-`) are also acceptable | Reject if invalid or if it conflicts with an existing entry in `registry.yaml` |
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
  | Output template | `.mvtt/skills/_templates/` | Persisted document that needs a stable structure | `{name}-output.md` |

- **Reuse vs new**: before declaring a new shared resource, check existing skills' SKILL.md files and knowledge entries -- prefer reusing patterns that already exist.
- **Output of this step**: a checklist `(name | purpose | path)` shown to user.

### Step 5: Design the Skill
- **What**: produce a one-page outline before generating any file.
- **How**: load an existing skill's SKILL.md (for example the `mvt-fix` skill in the same skills directory as this `SKILL.md`) as a structural reference, then fill in:

  | Aspect | Decision |
  |--------|----------|
  | Input parameters | What does the skill need from the user / workspace? |
  | Execution mode | Interactive / automated / hybrid |
  | Pre-flight checks | List, with severity (BLOCK / WARN); these populate the Pre-flight part of the Activation Protocol copied into the generated SKILL.md |
  | Decision rules (in role-header) | 3-7 imperative rules covering the major branches |
  | Boundaries | What is in-scope vs delegated to other skills |
  | Execution Flow steps | Bulleted titles only (full content comes in Step 6) |
  | Output | What gets written to disk (artifact path + template) OR pure conversation output |

### Step 6: Generate Skill Files

File placement and registry mutation are owned by the scaffolder script. Never create platform skill directories or edit `registry.yaml` by hand.

1. Create the staging directory `.mvtt/workspace/.skill-draft/{name}/`.
2. Write the complete `SKILL.md` into that staging directory. It must be fully self-contained -- there is no assembler or build step to resolve shared section references; inline all content.
3. For standard sections (Activation Protocol, Language Constraint, Output Format Constraint, State Update, Next Steps), load the canonical text from an already-installed `mvt-*` skill's `SKILL.md` (the exemplar from Step 1) and substitute only the skill-specific values (role, decision rules, boundaries, pre-flight checks, next-skill suggestions). Do NOT reproduce these sections from memory, and do NOT look for a `.mvtt/sections/` directory -- section sources are not installed into user projects.
4. Write skill-specific sections (frontmatter, Purpose, Execution Flow, Edge Cases & Errors) fresh, following the skeleton below.
   - `## Execution Flow`
   - `### Step 1: Load Inputs` -- list required and recommended files, plus fallback rules.
   - Skill-specific main steps (1-5 of them), each with **What / How / Branches** sub-structure when there is real branching.
   - `### Step N: User Confirmation` -- only when destructive or non-obvious; describe trigger conditions.
   - `### Step N+1: Write Artifacts` -- only when the skill persists files; specify path, template, required content.
   - Final session update step.
   - `## Edge Cases & Errors` table with at least 3 rows.
5. If the skill needs bundled resources, create them under the staging directory: `references/`, `scripts/`, and/or `assets/`. The scaffolder mirrors the whole staging tree to every installed platform.
6. If an output template was decided in Step 4, write it to a staging file such as `.mvtt/workspace/.skill-draft/{name}-output.md` (headings only -- a document structure, not a conversation reply template).
7. SKILL.md word budget: aim for the body to be under ~5k words. Push reference material to `references/`.
8. Run the scaffolder exactly once (see `.mvtt/scripts/skill-scaffold.md` for the authoritative flag semantics):

   ```bash
   node .mvtt/scripts/skill-scaffold.cjs scaffold --name {name} --description "{third-person description}" --from .mvtt/workspace/.skill-draft/{name} [--template {name}-output.md --template-body .mvtt/workspace/.skill-draft/{name}-output.md] [--resource references,scripts,assets]
   ```

   The script writes the skill to every installed platform, adds the `custom: true` registry entry, and returns one JSON line. If it exits non-zero, surface its stderr and stop -- do not fall back to manual writes.

### Step 7: Verify Registration (MANDATORY)

The scaffolder already registered the skill. Verify it -- do not re-edit the registry.

1. The script's JSON output has `"ok": true` and exit code 0.
2. Its `platforms[]` entries cover every platform listed in `platforms` inside `.mvtt/.mvtt-manifest.json`.
3. `.mvtt/registry.yaml` > `skills` contains `{name}` with `custom: true`, and no existing sibling entry changed.
4. If any check fails, restore `.mvtt/.backup/registry-<timestamp>.yaml` (the backup path is in the script's JSON output) and surface the error. Never hand-edit the registry to "fix" a failed scaffold.

The registry entry written by the script has this shape:

```yaml
  {name}:
    description: "{third-person description with trigger keywords}"
    custom: true
    template: ".mvtt/skills/_templates/{name}-output.md"   # only when --template was passed
```

The `custom: true` field is **required** for user-created skills; without it, framework updates drop the entry.

### Step 8: Validation
Walk this checklist; any failed item must be fixed before declaring success.

| Check | Pass criterion |
|-------|----------------|
| Scaffolder succeeded | Exit code 0 and JSON output has `"ok": true` |
| Every platform materialized | The JSON `platforms[]` ids match `platforms` in `.mvtt/.mvtt-manifest.json` |
| Frontmatter present | `name` and `description` exist in SKILL.md YAML frontmatter |
| Description quality | Third-person, includes what + when, distinguishes from neighbors |
| Writing style | Imperative/infinitive throughout; no "you" / "your" |
| Naming uniqueness | No collision with another entry in `registry.yaml` |
| `custom: true` | Set in the registry entry |
| Standard sections present | SKILL.md contains Role, Activation Protocol, Execution Flow, Edge Cases & Errors, State Update, Suggested Next Steps |
| Knowledge files exist | Every file referenced in `knowledge:` resolves on disk |
| Template path correct | If `template:` set, file exists under `.mvtt/skills/_templates/`; the template is headings-only |
| Portability | JSON `warnings` is empty, or every warning was addressed and the skill re-synced |
| Word budget | SKILL.md body under ~5k words (the JSON reports `wordCount`) |
| Standard skeleton | Execution Flow contains Load Inputs, main steps with branches, Edge Cases & Errors |

Show the user how to invoke `/{name}`, and report the `platforms[].files` paths from the script output as the skill locations.

### Step 9: Iteration Guidance
Tell the user the iteration loop:
1. Use `/{name}` on real tasks.
2. Notice struggles or inefficiencies.
3. Decide whether to update SKILL.md, add a `references/` file, add a knowledge entry, or split into a new skill.
4. Edit the staged copy (preferred) or any installed platform copy, then re-materialize every platform:

   ```bash
   node .mvtt/scripts/skill-scaffold.cjs sync --name {name} --from .mvtt/workspace/.skill-draft/{name}
   ```

   Use `--body <edited SKILL.md>` instead of `--from` when the skill has no bundled resources.
5. Alternatively re-run `/mvt-create-skill` to redesign the skill from scratch.

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
| `registry.yaml` parse fails after write | Restore from the pre-write backup; surface the error; do not leave the registry corrupt |
| `.mvtt/.mvtt-manifest.json` missing or unreadable | STOP at Step 6; recommend `mvtt install`; do not create skill directories manually |
| Scaffolder exits non-zero | Surface stderr and stop; do not retry with manual file writes (the script rolls back partial output) |
| Scaffolder reports a portability warning | The SKILL.md references another platform's skills directory; rewrite it to "the skills directory of the platform you are running in", then re-run `sync` |
| Skill name already registered when scaffolding | Use `sync` to update the existing skill, or confirm with the user before passing `--force` |
| Existing custom skill predates the scaffolder | Adopt it with `sync --name {name}`; the source is auto-detected from the first installed platform that has it |

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
| Activation Protocol | `## Activation Protocol` (the whole Load + Resolve block) | Copy the entire block as-is. The block already covers context loading, project scope, knowledge, config preferences, and pre-flight. Adjust only two skill-specific parts: under Load, the Extended Context entries (add the files/directives this skill needs, or drop the Extended Context bullet if none); under Resolve > Pre-flight, the checks table (skill-specific checks, or a single INFO row if none required) |
| Language Constraint | `## Language Constraint` | Copy as-is (separate section, not part of Activation Protocol) |
| Output Format Constraint | `## Output Format Constraint` | Copy as-is (separate section); include only if the skill writes persisted markdown |
| State Update | `## State Update` | Replace `/{name}` with the new skill's command; include `active_change` conditional block only if the skill creates changes; include `Shortcut Operation Rules` if the user opted for shortcut semantics during Step 5 design |
| Suggested Next Steps | `## Suggested Next Steps` | Replace `current_skill` with the new skill name; replace conditional suggestions with skill-appropriate ones |

**Important**: Do NOT paraphrase or rewrite the standard sections. Load them from the checked-in shared section sources or a selected installed exemplar and only substitute the skill-specific values. This ensures consistency across all MVTT skills.
