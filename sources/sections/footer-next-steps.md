## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`{{current_skill}}`) and the current project state.
**Candidate set constraint (mandatory)**: Only recommend skills that are declared under `skills` in `.ai-agents/registry.yaml`.
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

Infer 2-3 suggestions, choosing **only** from the skills declared under `skills` in `registry.yaml`:
- `history` in `session.yaml`
- `category` and `description` of each skill in `registry.yaml`
- The current `active_change` state (if in progress)
- The standard workflow order (analyze → design → implement → review → test)
{{/conditional_suggestions}}

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
