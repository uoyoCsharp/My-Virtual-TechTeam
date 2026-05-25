## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`{{current_skill}}`) and the current project state.
{{#conditional_suggestions}}

### Conditional Recommendations (built into this skill)

The skill's business flow determines which branch applies:

{{#conditions}}
- **When `{{condition}}`**: Primary → `/{primary}` -- {primary_desc}
{{/conditions}}

{{#alternatives}}
- `/{skill}` -- {desc}
{{/alternatives}}

Find the entry whose `condition` matches the detected state. If none match, use the entry with `condition: "default"`.
Render the matched `primary` as the primary recommendation, then render each `alternatives[]` entry.
{{/conditional_suggestions}}
{{^conditional_suggestions}}

### Resolution order

Infer 2-3 suggestions from:
- `skill_history` in `session.yaml`
- `category` and `description` of each skill in `registry.yaml`
- The current `active_change` state (if in progress)
- The `depends_on` relationships between skills
{{/conditional_suggestions}}

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
