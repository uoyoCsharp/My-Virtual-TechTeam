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
  - One existing skill manifest under `sources/skills/<existing>/manifest.yaml` (or `.ai-agents/skills/<existing>/`) as a structural reference.
  - `sources/sections/` -- the catalog of shared sections this new skill can reuse (role-header, activation-load-context, activation-load-config, output-language-constraint, activation-preflight, session-update, footer-next-steps).

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
| Dependencies | List of skill names that must run first, OR `none` | Becomes `depends_on` in registry |
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

- **Reuse vs new**: before declaring a new shared resource, grep `sources/sections/` and existing knowledge entries -- prefer reusing what is already there.
- **Output of this step**: a checklist `(name | category | purpose | path)` shown to user.

### Step 5: Design the Skill
- **What**: produce a one-page outline before generating any file.
- **How**: load an existing skill (e.g., `sources/skills/mvt-analyze/manifest.yaml`) as a structural reference, then fill in:

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
1. Create source directory: `sources/skills/{name}/` (or `.claude/skills/{name}/` if working directly in an installed workspace).
2. Generate `manifest.yaml` using the standard structure (see Generated Manifest Structure below). The manifest MUST reuse shared sections wherever applicable; do not inline content that already exists as a shared section.
3. Generate `business.md` containing the Execution Flow. Follow the **standard skeleton** used across all MVTT skills:
   - `## Execution Flow`
   - `### Step 1: Load Inputs` -- list required and recommended files, plus fallback rules.
   - Skill-specific main steps (1-5 of them), each with **What / How / Branches** sub-structure when there is real branching.
   - `### Step N: User Confirmation` -- only when destructive or non-obvious; describe trigger conditions.
   - `### Step N+1: Write Artifacts` -- only when the skill persists files; specify path, template, required content.
   - Final session update step (delegated to shared section).
   - `## Edge Cases & Errors` table with at least 3 rows.
4. If an output template was decided in Step 4, create `_templates/{name}-output.md` with **headings only** (this is a document structure, not a conversation reply template).
5. If scripts / references / assets are needed, create them in the skill directory.
6. SKILL.md word budget: aim for the assembled body to be under ~5k words. Push reference material to `references/`.

### Step 7: Register in Registry (MANDATORY)
Append the skill entry to `.ai-agents/registry.yaml` > `skills` section:

```yaml
  {name}:
    agent: {agent}
    description: "{third-person description with trigger keywords}"
    path: .claude/skills/{name}/SKILL.md
    template: {template_path_or_null}
    category: {category}
    depends_on: {dependencies_or_omitted}
    custom: true
    knowledge:
      {entries_or_empty_list}
    next_suggestions:
      primary: {suggested_next_skill}
      primary_desc: "{when to use the next skill}"
```

- The `custom: true` field is **required** for user-created skills; without it, framework updates will overwrite the entry.
- If the skill has no specific knowledge needs, set `knowledge: []` or omit the key entirely.
- Validate the YAML still parses after the append; if not, abort and surface the parse error.

### Step 8: Validation
Walk this checklist; any failed item must be fixed before declaring success.

| Check | Pass criterion |
|-------|----------------|
| Frontmatter present | `name` and `description` exist in the manifest's `frontmatter:` block |
| Description quality | Third-person, includes what + when, distinguishes from neighbors |
| Writing style | Imperative/infinitive throughout; no "you" / "your" |
| Naming uniqueness | No collision with another entry in `registry.yaml` |
| `custom: true` | Set in registry entry |
| Knowledge files exist | Every file referenced in `knowledge:` resolves on disk |
| Template path correct | If `template:` set, file exists at that path; the template is headings-only |
| Word budget | Assembled SKILL.md body under ~5k words (run a quick `wc` if available) |
| Standard skeleton | business.md contains Load Inputs, main steps with branches, Edge Cases & Errors |
| Build green | If running inside the framework repo, `npm run build` succeeds |

Show the user how to invoke: `/{name}`.

### Step 9: Iteration Guidance
Tell the user the iteration loop:
1. Use `/{name}` on real tasks.
2. Notice struggles or inefficiencies.
3. Decide whether to update SKILL.md, add a `references/` file, add a knowledge entry, or split into a new skill.
4. Re-run `/mvt-create-skill` to refine, or edit the source files directly and rebuild.

### Step 10: (session update handled by shared section)

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| Skill name collides with an existing registry entry | STOP at Step 3; ask user to rename; do not generate any file |
| User wants the skill to mutate `session.yaml` fields beyond `skill_history` | Surface that ownership rules forbid this (e.g., `recent_changes` is owned by `/mvt-plan-dev`/`/mvt-update-plan`); recommend redesign |
| Output template is requested but the skill is conversation-only (no persisted file) | Refuse to create a template; explain that templates are for document structure, not conversation replies |
| User asks to skip the registry registration step | Refuse; an unregistered skill is invisible to `/mvt-help`, `/mvt-status`, and the assembler. Registration is non-negotiable |
| Skill duplicates an existing skill's responsibility | Surface the overlap (cite the existing skill's description); propose merging or sub-classing as a variant rather than creating a duplicate |
| User provides a non-third-person description ("Use this skill when you need...") | Rewrite to third-person before saving; show the rewrite for confirmation |
| Generated manifest references a shared section that does not exist | Abort with the missing section path; do NOT invent a new section silently -- recommend creating it via a separate change |
| `registry.yaml` parse fails after append | Restore from a pre-append backup; surface the error; do not leave the registry corrupt |

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
    source: sections/output-language-constraint.md

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

  - type: shared
    source: sections/session-update.md

  - type: shared
    source: sections/footer-next-steps.md
    params:
      current_skill: {name}
```

Note: State Update and Suggested Next Steps are handled by shared sections (`sections/session-update.md` and `sections/footer-next-steps.md`) and must be referenced from the manifest, not duplicated as inline content.
