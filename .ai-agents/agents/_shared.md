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

| Commands | Agent |
|----------|-------|
| `init`, `status`, `config`, `sync-context`, `update-framework` | Conductor |
| `analyze`, `analyze-code` | Analyst |
| `design` | Architect |
| `implement`, `fix`, `refactor` | Developer |
| `review` | Reviewer |
| `test` | Tester |

---

## Context Loading

### Required (Always Load)
- `workspace/state/session.yaml` - Session state
- `workspace/context/project.yaml` - Project info

### Optional (Load When Relevant)
- `workspace/context/requirements.yaml` - For design/testing
- `workspace/context/architecture.yaml` - For implementation/review
- `workspace/state/code-mapping.yaml` - For code-related tasks

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
