## Design Principles

### Progressive Disclosure

Skills use a three-level loading system to manage context efficiently:

1. **Metadata (name + description)** -- Always in context (~100 words). Determines when Claude triggers the skill.
2. **SKILL.md body** -- Loaded when skill triggers. Target <5k words. Keep only essential procedural instructions and workflow guidance.
3. **Bundled resources** -- Loaded on demand by Claude. Unlimited size.

**Avoid duplication**: Information should live in either SKILL.md or `references/` files, not both. Move detailed reference material, schemas, and examples to `references/`; keep SKILL.md lean.

### Writing Style

Write the entire skill using **imperative/infinitive form** (verb-first instructions), not second person. Use objective, instructional language (e.g., "To accomplish X, do Y" rather than "You should do X" or "If you need to do X"). This maintains consistency and clarity for AI consumption.

### Description Quality

The `name` and `description` in YAML frontmatter determine when Claude will use the skill. Guidelines:

- Be specific about what the skill does and when to use it
- Use the third-person (e.g., "This skill should be used when..." instead of "Use this skill when...")
- Include: what it does + when to trigger + how it differs from similar skills

| Good | Bad |
|------|-----|
| "Create custom MVTT skills through interactive guided workflow. Use when user wants to create a new skill, extend the framework with custom functionality, or build project-specific automation." | "Skill creator" |
| "Analyze requirements documents and extract domain concepts. Use when user provides requirements text or asks to understand project scope." | "Analyze stuff" |

## Execution Flow

### Step 1: Understanding with Concrete Examples

Skip this step only when the skill's usage patterns are already clearly understood.

To create an effective skill, first understand concrete examples of how the skill will be used. This understanding can come from either direct user examples or generated examples validated with user feedback.

Ask questions such as:
- "Can you give 1-2 examples of how this skill would be used?"
- "What would a user say that should trigger this skill?"
- "Are there edge cases or variations in how this skill gets invoked?"

Avoid overwhelming the user -- start with the most important questions and follow up as needed.

Conclude this step when there is a clear sense of the functionality the skill should support.

### Step 2: Requirements Gathering

Collect core metadata for the skill:

- **Skill name**: Suggest `mvt-` prefix for consistency, but also accept project-specific prefixes (e.g., `app-`, `proj-`)
- **Agent role**: Which MVTT agent should own this skill? (conductor / analyst / architect / developer / reviewer / tester)
- **Purpose**: What does this skill do?
- **Category**: workflow / utility / project-specific / shortcut
- **Trigger keywords**: What phrases should invoke this skill? (used for `description` field -- write following Description Quality guidelines above)
- **Dependencies**: Does this skill depend on other skills being run first?

### Step 3: Planning Reusable Skill Contents

For each concrete example from Step 1, analyze:

1. How to execute the example from scratch
2. What reusable resources would help when executing these workflows repeatedly

Resource categories:

| Resource | Directory | When to include | Example |
|----------|-----------|-----------------|---------|
| Scripts | `scripts/` | Same code is rewritten repeatedly, or deterministic reliability is needed | `scripts/validate_schema.py` |
| References | `references/` | Documentation Claude should reference while working (schemas, API docs, policies) | `references/api_spec.md` |
| Assets | `assets/` | Files used in the output, not loaded into context (templates, icons, fonts) | `assets/report_template.md` |
| Knowledge | (MVTT-specific) | Per-skill knowledge entries beyond shared knowledge (see registry.yaml > knowledge) | `knowledge/principle/coding-standards/` |
| Template | `_templates/` | Structured output format template | `_templates/{name}-output.md` |

**Knowledge vs References mapping**:
- `knowledge` (MVTT concept): Entries declared in registry.yaml, loaded via Activation Protocol. Use for knowledge that applies across multiple skills or is managed by `/mvt-manage-context`.
- `references/` (per-skill concept): Files bundled inside the skill directory, loaded on demand. Use for documentation specific to this skill only.

To avoid duplication, information should live in either SKILL.md, references files, or knowledge entries -- not in multiple places.

Conclude this step with a resource checklist listing all scripts, references, assets, knowledge entries, and templates to create.

### Step 4: Skill Design

Load an existing skill file as structural reference and config.yaml for project context. Then determine:

- **Input parameters**: What does the skill need from the user or workspace?
- **Execution mode**: interactive / automated / hybrid
- **Context loading**: Standard (shared sections only) or extended (additional files via `activation-load-context.md` params)
- **Output format**: Inline format specification or reference to a template file
- **Decision rules**: Key branching logic for the skill
- **Boundaries**: What is in-scope vs out-of-scope (delegate out-of-scope to other skills)
- **Variants**: Any flags or modes (e.g., `--light`, `--deep`)

### Step 5: Generate Skill Files

1. Create skill directory: `.claude/skills/{name}/`
2. Create optional resource directories: `scripts/`, `references/`, `assets/`
3. Create `SKILL.md` with standard structure (see Generated Skill Structure below)
4. Create manifest sections content if the skill uses inline or file-based sections
5. If output template needed -> Create `.ai-agents/skills/_templates/{name}-output.md`
6. If scripts/references/assets needed -> Create those files in the skill directory
7. Generate `manifest.yaml` for the skill (see Generated Manifest Structure below)

**SKILL.md word budget**: Target <5k words for the body. Move detailed reference material to `references/` files.

### Step 6: Register in Registry (MANDATORY)

Append the new skill entry to `.ai-agents/registry.yaml` > `skills` section:

```yaml
  {name}:
    agent: {agent}
    description: "{trigger keyword description in third-person}"
    path: .claude/skills/{name}/SKILL.md
    template: {template_path_or_null}
    category: {category}
    depends_on: {dependencies}
    custom: true
    knowledge:
      {knowledge_entries_or_empty_list}
    next_suggestions:
      primary: {suggested_next_skill}
      primary_desc: "{description of next step}"
```

The `custom: true` field is **required** for all user-created skills. It protects the skill from being overwritten during framework updates.

The `knowledge` field declares per-skill knowledge this skill needs beyond shared knowledge.
If the skill has no specific knowledge needs, set `knowledge: []` or omit it.

### Step 7: Validation

- Verify SKILL.md format compliance (frontmatter has `name` + `description`)
- Verify description quality (follows Description Quality guidelines, uses third-person)
- Verify writing style (imperative/infinitive form throughout)
- Confirm no naming conflicts with existing skills
- Verify `registry.yaml` entry includes `custom: true`
- If `knowledge` entries reference existing files, verify those files exist
- Estimate context budget: SKILL.md body <5k words, detailed content in references/
- If output template was created, verify it exists and path in registry is correct
- Show the user how to invoke: `/{name}`

### Step 8: Iteration Guidance

Inform the user about the iteration workflow:

1. Use `/{name}` on real tasks
2. Notice struggles or inefficiencies
3. Identify how SKILL.md or bundled resources should be updated
4. Use `/mvt-create-skill` to refine, or edit the skill files directly

## Generated Skill Structure

```markdown
---
name: {name}
description: '{third-person description with trigger keywords}'
---

# {Title}

## Purpose
{concise purpose statement}

## Role
Act as the **{Agent Role}** -- {role description}.

### Decision Rules
{generated based on skill purpose, using imperative form}

### Boundaries
{in-scope and out-of-scope boundaries}

## Activation Protocol
(Loaded via shared sections: activation-load-context.md + activation-load-config.md)
Knowledge is loaded based on registry.yaml > skills.{name}.knowledge entries.
If extended context is needed, define in manifest params.

## Execution Flow
{generated steps using imperative form}

## Output Format
{template reference or inline format}
```

Note: State Update and Suggested Next Steps are handled by shared sections
(`sections/session-update.md` and `sections/footer-next-steps.md`) and should
be included in the generated manifest.yaml, not as inline content in SKILL.md.

## Generated Manifest Structure

```yaml
name: {name}
output: .claude/skills/{name}/SKILL.md

frontmatter:
  name: {name}
  description: "{third-person description with trigger keywords}"

sections:
  - type: inline
    content: |
      # {Title}

      ## Purpose

      {concise purpose statement}

  - type: shared
    source: sections/role-header.md
    params:
      role: {Agent Role}
      role_desc: "{role description}"
      decision_rules:
        {generated rules}
      boundaries:
        {generated boundaries}

  - type: shared
    source: sections/activation-load-context.md
    params:
      extended_context:
        {if needed, list additional context sources}

  - type: shared
    source: sections/activation-load-config.md

  - type: shared
    source: sections/activation-preflight.md
    params:
      checks:
        {if needed, list preflight checks}

  - type: inline
    content: |
      ### Step 4: Execute
      Proceed to Execution Flow below.

  - type: file
    source: ./business.md

  - type: inline
    content: |
      ## Output Format

      {output format specification or template reference}

  - type: shared
    source: sections/session-update.md

  - type: shared
    source: sections/footer-next-steps.md
    params:
      current_skill: {name}
```
