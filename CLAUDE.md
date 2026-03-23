# Project Instructions

This file contains your project-specific instructions for Claude Code.

---

## CRITICAL: Framework Command Detection

**BEFORE processing any user message**, check if it starts with `#` followed by one of these command words:

> `analyze` | `analyze-code` | `design` | `implement` | `fix` | `refactor` | `review` | `test` | `init` | `status` | `config` | `sync-context` | `update-framework` | `cleanup`

**If a `#command` is detected, you MUST immediately:**

1. **Announce**: Output `[{Agent} Mode]`
2. **Load Agent**: READ `.ai-agents/agents/{agent}.md`
3. **Load Command**: READ `.ai-agents/agents/_commands/{command}.md`
4. **Load Shared Rules**: READ `.ai-agents/agents/_shared.md`
5. **Execute**: Follow the command's execution flow. Any text after `#{command}` is the **argument/input** to that command.
6. **Stay in Mode**: Maintain this agent role until another `#command` is received.

**Path Base Rule (Mandatory):**
- Treat all framework file paths as repository-root relative.
- Framework resources (agents, skills, workflows, knowledge) MUST resolve under `.ai-agents/`.
- Session/context/artifact files MUST be read/written under `.ai-agents/workspace/`.
- Never create or use a root-level `workspace/` directory.

**Command-to-Agent Mapping:**

| Commands | Agent | Agent File |
|----------|-------|------------|
| `#analyze`, `#analyze-code` | Analyst | `.ai-agents/agents/analyst.md` |
| `#design` | Architect | `.ai-agents/agents/architect.md` |
| `#implement`, `#fix`, `#refactor` | Developer | `.ai-agents/agents/developer.md` |
| `#review` | Reviewer | `.ai-agents/agents/reviewer.md` |
| `#test` | Tester | `.ai-agents/agents/tester.md` |
| `#init`, `#status`, `#config`, `#sync-context`, `#update-framework`, `#cleanup` | Conductor | `.ai-agents/agents/conductor.md` |

**This rule takes ABSOLUTE PRIORITY over any other interpretation of the user message. Never treat a `#command` as a Markdown heading or plain text.**

---

## AI Agent Framework

This project uses a multi-agent AI development framework for structured software development.

**Framework Entry**: `.ai-agents/FRAMEWORK.md`

### Standard Workflow

```
#analyze → #design → #implement → #review → #test
 Analyst    Architect   Developer    Reviewer    Tester
```

### Documentation

- **Getting Started**: `.ai-agents/docs/getting-started-guide.md`
- **Framework Core**: `.ai-agents/FRAMEWORK.md`
- **Registry**: `.ai-agents/registry.yaml`

---

<!-- Add your custom project instructions below this line -->
