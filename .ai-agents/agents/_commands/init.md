# #init Command

> Load this file when `#init` command is invoked.

---

## Purpose

Build complete project context for AI-assisted development.

> **Detailed Methodology**: See `skills/project-initialization.md` for deep project analysis phases, detection patterns, and knowledge generation rules.

### Variants

| Variant | Behavior | Use Case |
|---------|----------|----------|
| `#init` | Full initialization | First time setup |
| `#init --light` | Quick scan only | Quick context check |
| `#init --deep` | Deep code analysis | Extract entities/APIs |
| `#init --refresh` | Refresh existing context | After major changes |

---

## Execution Flow

**Phase 1: Project Discovery**
1. READ `workspace/state/session.yaml` - Check current state
2. SCAN project root - Detect config files (package.json, pom.xml, etc.)
3. EXTRACT tech stack - Language, framework, build tool

**Phase 2: Architecture Detection**
1. SCAN directory structure
2. IDENTIFY architecture pattern indicators
3. MAP module organization

**Phase 3: Pattern Selection** (User Confirmation Required)

Present detected pattern with options:
| Option | Action |
|--------|--------|
| `yes` | Accept recommended pattern |
| `{pattern_id}` | Select specific pattern (ddd, clean-architecture, etc.) |
| `analyze` | Trigger custom pattern analysis |
| `none` | No pattern, proceed without architecture guidance |

**Phase 4: Workspace Population**

WRITE the following files with actual content:
- `workspace/context/project.yaml` - Project info and tech stack
- `workspace/context/architecture.yaml` - Module structure
- `workspace/state/code-mapping.yaml` - File-to-entity mapping
- `workspace/state/semantic-index.yaml` - Topic/keyword index
- `workspace/state/session.yaml` - Session state

**Phase 5: Knowledge Generation** (skip if --light)
- `knowledge/project/tech-stack.md` - Stack documentation
- `knowledge/principle/coding-standards.md` - Coding standards

---

## Success Output

```markdown
## Project Initialization Complete

### Project: {name}
- **Type**: {type}
- **Pattern**: {pattern}
- **Tech Stack**: {language} / {framework}

### Workspace Updated
- [x] project.yaml
- [x] architecture.yaml
- [x] code-mapping.yaml
- [x] semantic-index.yaml
- [x] session.yaml

---
**Suggested Next Steps**:
- `#analyze {requirements}` to start development
- `#status` to view project status
```

---

## Exception Handling

| Exception | Detection | Action |
|-----------|-----------|--------|
| Empty directory | No source files | Ask: "What would you like to build?" |
| Multiple projects | Multiple package.json | Ask user to select primary |
| Unrecognized stack | No known config | Ask user to describe tech stack |
| Large codebase | > 500 source files | Default to --light, offer --deep |

---

## Example

```
User: #init

[Conductor Mode]

Scanning project structure...
- Found: package.json
- Language: TypeScript
- Framework: Node.js + Express
- Pattern indicators: src/domain/, src/application/

**Recommended pattern: DDD**

Proceed with DDD pattern?
- `yes` - Accept DDD
- `clean-architecture` - Use Clean Architecture
- `analyze` - Analyze and generate custom pattern
- `generic` - Use generic pattern
- `none` - No pattern
```
