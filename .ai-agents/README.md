# AI Agent Framework 

Multi-agent collaboration framework for software development.

## Quick Start

1. **Resource Discovery**: Read `registry.yaml` for quick access to all resources
2. **Agent Activation**: Each agent's `context_contract` defines required context
3. **Workflow**: Use `#start` to begin, `#status` to check progress

## Directory Structure

| Directory | Purpose |
|-----------|---------|
| `registry.yaml` | Unified resource index (preferred entry point) |
| `config.yaml` | System configuration |
| `agents/` | Agent definitions |
| `agents/_shared.md` | Shared behavior rules |
| `agents/{agent}.md` | Agent core file |
| `skills/` | Modular capabilities |
| `skills/_system/` | System skills (auto-invoked) |
| `workflows/` | Workflow definitions |
| `knowledge/` | Domain knowledge |
| `knowledge/core/` | Core principles (always loaded) |
| `knowledge/patterns/` | Architecture patterns (on-demand) |
| `knowledge/principle/` | Project coding standards (generated) |
| `knowledge/project/` | Project-specific knowledge |
| `workspace/` | Project workspace |
| `workspace/state/` | Hot data: current session |
| `workspace/context/` | Warm data: project context |
| `workspace/history/` | Cold data: historical archive |
| `workspace/requirements/` | Requirements documents |
| `workspace/artifacts/` | Work artifacts (grouped by change) |

## Key Concepts 

### Unified Resource Registry

`registry.yaml` provides unified index for all resources:
- `quick_index`: Quick index preferred for LLM access
- `context_graph`: Context dependencies between Agents
- `discovery_protocol`: Resource discovery protocol

### Context Contract

Each Agent defines its context contract in its yaml file:
```yaml
context_contract:
  required:      # Must load
  conditional:   # Conditional load
  outputs:       # Output targets
```

### Data Tiering

Workspace uses tiered storage strategy:
- **Hot (state/)**: Current session, <50KB
- **Warm (context/)**: Project context, <100KB  
- **Cold (history/)**: Historical archive, read index only

### Knowledge Loading Levels

| Level | When to Use | Tokens |
|-------|-------------|--------|
| 1 | Get overview | ~200 |
| 2 | Specific tasks (via semantic_index) | ~500-1500 |
| 3 | Full knowledge needed | ~3000-5000 |

## Agents

Each agent has two files plus a common base:

1. **`_base.md`**: Common activation steps  and behavior rules
2. **`{agent}.yaml`**: Declarative definition
   - ID, name, responsibilities
   - Boundaries (what the agent does NOT do)
   - Skills it can use
   - Commands it responds to
   - **context_contract**: Required/conditional context

3. **`{agent}.prompt.md`**: Behavior prompt
   - Persona and communication style
   - Activation steps (referencing _base.md)
   - Command implementations
   - Boundary enforcement with examples
   - Output formats

## System Skills

System skills are auto-invoked by the framework:

- **context-loader**: Smart context loading on agent activation
- **archive-manager**: History archiving and compression

## Core Skills

Skills are modular capabilities loaded on-demand:
- `project-initialization.md` - Initialize project and analyze structure
- `review-execution.md` - Execute review checklists
- `test-generation.md` - Generate test cases

## Workflows

Workflows define phase transitions:

- **requirement-to-code**: Full development cycle
  - analyze → design → implement → review → test

- **code-review**: Code quality review
  - analyze → review → report

## Dynamic Memory 

Memory is now split across multiple files in `workspace/`:

### State (Hot Data)
- `state/session.yaml`: Current session and workflow state
- `state/active-change.yaml`: Current change in progress
- `state/knowledge-cache.yaml`: Loaded knowledge cache

### Context (Warm Data)
- `context/project.yaml`: Project information
- `context/architecture.yaml`: Architecture decisions
- `context/requirements.yaml`: Requirements summary
- `context/decisions.yaml`: Key decisions log

### History (Cold Data)
- `history/phases/`: Phase execution history
- `history/changes/`: Completed changes archive

**Rules**:
- Confirm with user before saving
- Keep information concise
- Hot data: <50KB, Warm data: <100KB
- Archive cold data after 7-30 days

## Usage

1. Start with `#init` to initialize project analysis
2. Use `#start` to begin a workflow
3. Follow prompts and confirm transitions
4. Use specific commands (`#analyze`, `#design`, etc.) to invoke agents
5. Check `#status` to see current progress
6. Edit `config.yaml` to change architecture pattern
7. Use `#recover` if workflow enters error state
8. Use `#debug on` for verbose troubleshooting

## Extending

### Add Custom Agent

1. Copy templates from `agents/_templates/`
2. Create `agents/{name}.yaml` with definition
3. Create `agents/{name}.prompt.md` with behavior
4. Register in `config.yaml` under `agents`
5. Create `.github/agents/{name}.md` for GitHub Copilot

See `agents/_templates/README.md` for detailed instructions.

### Add Custom Skill

1. Create `skills/{name}.md` with skill definition
2. Register in `config.yaml` under `skills.core` or `skills.custom`
3. Add platform adapter in `.github/skills/{name}/SKILL.md`

### Add Architecture Pattern

1. Create `knowledge/patterns/{pattern}/` directory
2. Add `manifest.yaml` with pattern metadata
3. Add pattern documentation (overview.md, review-checklist.md)
4. Register in `config.yaml` under `pattern.available`
