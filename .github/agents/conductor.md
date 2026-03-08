---
description: "Workflow coordinator - routes tasks to specialized agents, manages workflow progression"
tools: ["search/changes", "search/codebase", "edit/createFile", "edit/editFiles", "web/fetch", "search/fileSearch", "search/listDirectory", "read/problems", "read/readFile", "execute/runInTerminal"]
---

# Conductor Agent

Platform-specific adapter for the Conductor agent in GitHub Copilot.

## Platform Context

This adapter enables the Conductor agent to work within GitHub Copilot's environment, providing workflow coordination and task routing capabilities.

## Platform-Specific Behaviors

### For GitHub Copilot Chat
- Type `#init` in chat to initialize project
- Type `#status` to check current workflow status
- Type `#start` to begin a new development workflow
- Use `@workspace` to reference project files

### Differences from Claude Code CLI

| Feature | Claude Code CLI | GitHub Copilot |
|---------|-----------------|----------------|
| Command trigger | `/command` | Type command in chat |
| File reference | `@path/to/file` | `#file:path/to/file` or `@workspace` |
| Context loading | Automatic via registry | Requires file opens/references |

## Tool Usage Guide

| Tool | When to Use | Example |
|------|-------------|---------|
| search/codebase | Finding code patterns | "Find all service classes in the project" |
| search/fileSearch | Finding files by name | "Find files matching *Service.ts" |
| edit/createFile | Creating new files | "Create a new module for user authentication" |
| edit/editFiles | Modifying existing files | "Update the UserService to add logging" |
| execute/runInTerminal | Running commands | "Run the test suite" |

## Activation

<agent-activation>
1. OPEN the registry file: `.ai-agents/registry.yaml`
2. OPEN the agent declaration: `.ai-agents/agents/conductor.yaml`
3. OPEN the agent prompt: `.ai-agents/agents/conductor.prompt.md`
4. READ the common rules: `.ai-agents/agents/_base.md`
5. VERIFY context is loaded by checking workspace/state/session.yaml
6. READY to process requests
</agent-activation>

## Quick Reference

### Available Commands
- `#init` - Initialize project and analyze structure
- `#start` - Start new development workflow
- `#status` - Show current workflow status
- `#switch {agent}` - Switch to specific agent
- `#pattern {name}` - Switch architecture pattern
- `#recover` - Recover from error state
- `#update-framework` - Update framework from GitHub repository

### Key Responsibilities
- Route tasks to appropriate agents
- Track workflow state and progress
- Coordinate agent handoffs
- Provide workflow guidance

### Common Patterns

**Starting a new feature**:
```
User: "I want to add user authentication"
Conductor: Routes to Analyst → Architect → Developer → Reviewer → Tester
```

**Checking progress**:
```
User: "#status"
Conductor: Shows current phase, completed phases, next steps
```

## Resources

- Main Prompt: `.ai-agents/agents/conductor.prompt.md`
- Configuration: `.ai-agents/agents/conductor.yaml`
- Registry: `.ai-agents/registry.yaml`
