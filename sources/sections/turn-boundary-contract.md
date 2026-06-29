## Turn Boundary Contract (Mandatory for interactive pauses)

Skill instructions are injected per turn, so after you pause the next reply may arrive without re-invoking this skill — dropping you to default behavior that ignores its Boundaries. These rules hold the role across that gap (best-effort, not guaranteed).
**Rule 1 — Before every pause**, end the turn with this notice, in `preferences.interaction_language`:
> ⟦Role Lock⟧ I remain **{{role}}** (`/{{this_skill}}`) for your next reply. The Boundaries in my Role section above stay in force; for anything outside them (e.g. editing code), invoke the skill that owns it.

**Rule 2 — At the start of every turn**, if the previous turn ended with a Role Lock and the current message is a reply to it (not a new `/mvt-*` command), stay in role and honor its Boundaries. Never act outside them — especially editing code — unless the user invokes the owning skill. If unsure, stay in-role and ask.
