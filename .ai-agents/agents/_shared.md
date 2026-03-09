---
id: shared-rules
type: shared
applies_to: all_agents
---

# Shared Agent Rules

All agents MUST follow these rules.

---

## Mode Switching

When user input starts with `#{command}`:

1. **Announce**: Output `[{Agent} Mode]`
2. **Load**: READ `agents/{agent}.md`
3. **Execute**: Follow agent's rules
4. **Stay**: Maintain role until another `#{command}`

---

## Command-to-Agent Mapping

> Authority: `registry.yaml` > `commands` section

---

## Context Loading

> Authority: `skills/_system/context-loader.md`
> Context loading strategy, tiered levels, and keyword inference rules are defined in the context-loader system skill.

Always load before any operation:
- `workspace/state/session.yaml`
- `workspace/context/project.yaml`

---

## State Updates

When completing a task, UPDATE `session.yaml`:

```yaml
# Phase completion
workflow.phases.{phase}.status: completed
workflow.phases.{phase}.completed_at: "{timestamp}"
workflow.phases.{phase}.confirmed: true

# Phase start
workflow.phases.{phase}.status: in_progress
workflow.phases.{phase}.started_at: "{timestamp}"
session.current.agent: {agent_id}
```

## Change ID Convention

When creating a new change (triggered by `#analyze`):

### Format
```
{YYYYMMDD}-{NNN}-{slug}
```

| Part | Description | Example |
|------|-------------|---------|
| `YYYYMMDD` | Date of creation | `20260308` |
| `NNN` | Sequential number within the day | `001` |
| `slug` | Kebab-case short description (max 30 chars) | `user-authentication` |

### Example
```
20260308-001-user-authentication
```

### Workflow
1. `#analyze` creates the change-id and writes to `workspace/state/active-change.yaml`
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

## Post-Task Maintenance

After completing any major phase (analyze, design, implement, review, test):
1. Update `workspace/state/session.yaml` with phase status
2. Update `workspace/state/semantic-index.yaml` if new concepts were introduced
3. If `workspace/artifacts/changes/` contains more than 5 items, suggest `#cleanup`

---

## Boundary Rules

When request is outside current role:

1. State what you CAN do
2. Suggest correct agent/command
3. DO NOT attempt out-of-scope task

**Boundary Matrix**:

| Current Agent | Cannot Do | Redirect To |
|---------------|-----------|-------------|
| Analyst | Architecture decisions | `#design` |
| Architect | Write implementation code | `#implement` |
| Developer | Requirements analysis | `#analyze` |
| Developer | Architecture evaluation | `#design` |
| Reviewer | Fix code issues | `#fix` |
| Tester | Fix implementation bugs | `#fix` |

---

## Response Quality

- Be concise and direct
- Use tables for structured data
- Use code blocks for code/commands
- Avoid unnecessary explanations
