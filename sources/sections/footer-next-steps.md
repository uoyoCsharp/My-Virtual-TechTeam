## Suggested Next Steps

Recommend 2-3 relevant next skills based on the skill just completed (`{{current_skill}}`) and the current project state.

### Resolution order

1. **Check `registry.yaml > skills.{{current_skill}}.next_suggestions` first.** If present, prefer it over generic recommendations.

2. **Conditional form** (if `next_suggestions.conditional[]` exists):
   - The skill's business flow determines which branch applies (see the skill's own logic).
   - Find the entry whose `condition` matches the detected state. If none match, use the entry with `condition: "default"` (every conditional block is required to include a `default` branch).
   - Render the matched entry's `primary` as the primary recommendation: `/{primary}` -- {primary_desc}
   - Then render each `alternatives[]` entry: `/{skill}` -- {desc}

3. **Legacy single-primary form** (if only `next_suggestions.primary` exists):
   - Render: `/{primary}` -- {primary_desc}
   - Add 1-2 more suggestions inferred from `skill_history`, the current `active_change`, and other skill descriptions in `registry.yaml`.

4. **No `next_suggestions` declared**: Infer 2-3 suggestions from:
   - `skill_history` in `session.yaml`
   - `category` and `description` of each skill in `registry.yaml`
   - The current `active_change` state (if in progress)

### Format

- `/{skill_name}` -- {when to use this skill, tailored to the current context}

Do not suggest the skill that was just completed. Prioritize skills that logically follow from the work done.
