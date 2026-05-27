## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`{{current_skill}}`) and the current project state.
{{#conditional_suggestions}}

### Conditional Recommendations

Match the current state to one of the conditions below. If none match, use `default`.

{{#conditions}}
- **`{{condition}}`** → `/{{primary}}` -- {{primary_desc}}
{{#alternatives}}
  - Or `/{{skill}}` -- {{desc}}
{{/alternatives}}
{{/conditions}}
{{#alternatives}}
- `/{{skill}}` -- {{desc}}
{{/alternatives}}
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
