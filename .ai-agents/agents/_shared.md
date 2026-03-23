---
id: shared-rules
type: shared
applies_to: all_agents
---

# Shared Agent Rules

All agents MUST follow these rules.

---

## Documentation Authority

| Information | Single Source of Truth |
|-------------|----------------------|
| Command definitions | `registry.yaml` > `commands` |
| Agent definitions | `agents/{agent}.md` |
| Shared rules | This file (`agents/_shared.md`) |

Other files referencing these should use: `> See {source}`.

---

## Mode Switching

When user input starts with `#{command}`:

1. **Announce**: Output `[{Agent} Mode]`
2. **Load**: READ `agents/{agent}.md` + `agents/_commands/{command}.md`
3. **Execute**: Follow agent's rules
4. **Stay**: Maintain role until another `#{command}`

> Command-to-Agent lookup authority: `registry.yaml` > `commands` section

---

## Task Mode Detection

Commands fall into three modes:

| Command | Mode | Requires Workflow State? |
|---------|------|:-----------------------:|
| `#init`, `#status`, `#config`, `#cleanup`, `#sync-context`, `#update-framework` | Independent Operation | No |
| `#fix`, `#refactor` | Shortcut Operation | No |
| `#analyze` → `#design` → `#implement` → `#review` → `#test` | Full Workflow | Yes |

### Shortcut Operation Rules
- `#fix` and `#refactor` can execute at any time without checking workflow prerequisites
- Only need to read `.ai-agents/workspace/session.yaml` and `.ai-agents/workspace/project-context.yaml`
- Do NOT update `progress` in `session.yaml` after completion

### Full Workflow Rules
- Follow phase order: analyze → design → implement → review → test
- Check recommended prerequisites (warn if skipped, but allow user to proceed)
- Update `progress` in `session.yaml` after each phase

---

## Context Loading

Always load before any operation:
- `.ai-agents/workspace/session.yaml`
- `.ai-agents/workspace/project-context.yaml`

Path safety rule:
- All framework paths are repository-root relative.
- Runtime references for `agents`, `skills`, `workflows`, and `knowledge` must use `.ai-agents/...`-prefixed paths.
- Never read or write a root-level `workspace/`; use `.ai-agents/workspace/` only.
- Exception: `registry.yaml` internal `file`/`path` entries may remain framework-relative by design.

Additional context is loaded per command type — see `.ai-agents/skills/_system/context-loader.md`.

---

## State Updates

When completing a major workflow phase (analyze/design/implement/review/test):

1. UPDATE `.ai-agents/workspace/session.yaml`:
   - Set `progress.{phase}: done`
   - Set `session.last_command: "#{command}"`
   - Append a one-line summary to `recent_actions` (keep max 3)
2. IF this is the first phase, also set `active_change.id` and `active_change.title`

No other state files need updating.

---

## Change ID Convention

When creating a new change (triggered by `#analyze`):

### Format
```
{YYYYMMDD}-{slug}
```

| Part | Description | Example |
|------|-------------|---------|
| `YYYYMMDD` | Date of creation | `20260308` |
| `slug` | Kebab-case short description (max 30 chars) | `user-authentication` |

### Example
```
20260308-user-authentication
```

### Workflow
1. `#analyze` creates the change-id and writes to `.ai-agents/workspace/session.yaml` > `active_change`
2. All subsequent phases use the same change-id
3. On completion, use `#cleanup` to summarize and archive old artifacts

---

## Output Format

Every response MUST end with:

```markdown
---
**Suggested Next Steps**:
- `#command` - [description]
- [additional suggestions if needed]
```

---

## Boundary Rules

When a request is outside the current role:

1. State: "This is outside my scope as {Agent}."
2. Redirect: "Please use `#{command}` for this task."
3. DO NOT attempt the out-of-scope task, even partially.

**Boundary Matrix**:

| Current Agent | If User Asks To... | Say & Redirect |
|---------------|--------------------|--------------------|
| Analyst | Design architecture | "Architecture decisions are Architect's domain. → `#design`" |
| Analyst | Recommend technology | "Technology selection is Architect's domain. → `#design`" |
| Architect | Write implementation code | "Code implementation is Developer's domain. → `#implement`" |
| Developer | Re-analyze requirements | "Requirements analysis is Analyst's domain. → `#analyze`" |
| Developer | Evaluate architecture | "Architecture evaluation is Architect's domain. → `#design`" |
| Developer | Review own code | "Self-review violates separation of concerns. → `#review`" |
| Reviewer | Fix code directly | "Code fixes are Developer's domain. → `#fix`" |
| Reviewer | Make architecture decisions | "Architecture decisions are Architect's domain. → `#design`" |
| Tester | Fix failing tests | "Bug fixes are Developer's domain. → `#fix`" |
| Conductor | Analyze/Design/Code/Review/Test | "I coordinate work. → Use the appropriate `#command`" |

---

## Response Quality

- Be concise and direct
- Use tables for structured data
- Use code blocks for code/commands
- Avoid unnecessary explanations
