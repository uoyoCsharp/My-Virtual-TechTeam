# AI Agent Framework

Multi-agent collaboration framework for software development.

## Directory Structure

```
.ai-agents/
├── config.yaml           # Unified configuration
├── agents/               # Agent definitions
│   ├── {agent}.yaml      # Declaration (roles, skills, commands)
│   └── {agent}.prompt.md # Behavior prompts
├── skills/               # Modular capabilities
│   └── {skill}.md        # Skill definitions
├── workflows/            # Workflow state machines
│   └── {workflow}.yaml   # Workflow definitions
├── knowledge/            # Domain knowledge
│   ├── core/             # Core principles
│   └── patterns/         # Architecture patterns
└── workspace/            # Project working area
    ├── context.yaml      # Dynamic memory
    ├── requirements/     # Requirements documents
    └── changes/          # Change tracking
```

## Configuration

All configuration is centralized in `config.yaml`:

- **system**: Behavior settings (language, interaction mode, confirmations)
- **output**: Output formatting rules
- **pattern**: Active architecture pattern (DDD, Clean Architecture, etc.)
- **agents**: Registered agents
- **skills**: Available skills
- **workflows**: Defined workflows

## Agents

Each agent has two files:

1. **`{agent}.yaml`**: Declarative definition
   - ID, name, responsibilities
   - Boundaries (what the agent does NOT do)
   - Skills it can use
   - Commands it responds to

2. **`{agent}.prompt.md`**: Behavior prompt
   - Persona and communication style
   - Activation steps
   - Command implementations
   - Output formats

## Skills

Skills are modular capabilities loaded on-demand:
- `review-execution.md` - Execute review checklists
- `test-generation.md` - Generate test cases
- `project-initialization.md` - Initialize project and analyze structure

## Workflows

Workflows define phase transitions:

- **requirement-to-code**: Full development cycle
  - analyze → design → implement → review → test

- **code-review**: Code quality review
  - analyze → review → report

## Dynamic Memory

`workspace/context.yaml` stores:

- Project information
- Current workflow state
- Requirements summary
- Architecture decisions
- Implementation progress

**Rules**:
- Confirm with user before saving
- Keep information concise
- Update incrementally

## Usage

1. Start with `#start` to begin a workflow
2. Follow prompts and confirm transitions
3. Use specific commands (`#analyze`, `#design`, etc.) to invoke agents
4. Check `#status` to see current progress

## Extending

### Add Custom Agent

1. Create `agents/{name}.yaml` with definition
2. Create `agents/{name}.prompt.md` with behavior
3. Register in `config.yaml` under `agents`

### Add Custom Skill

1. Create `skills/{name}.md` with skill definition
2. Register in `config.yaml` under `skills`
3. Add platform adapters in `.github/skills/` and `.claude/skills/`

### Add Architecture Pattern

1. Create `knowledge/patterns/{pattern}/` directory
2. Add pattern documentation (overview.md, checklist.md)
3. Register in `config.yaml` under `pattern.available`
