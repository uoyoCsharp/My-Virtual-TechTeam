# #init Command

> Load this file when `#init` command is invoked.

---

## Purpose

Build complete project context for AI-assisted development.

### Variants

| Variant | Behavior | Use Case |
|---------|----------|----------|
| `#init` | Full initialization | First time setup |
| `#init --light` | Quick scan only | Quick context check |
| `#init --deep` | Deep code analysis | Extract entities/APIs |
| `#init --refresh` | Refresh existing context | After major changes |

---

## Execution Flow

### Phase 1: Project Discovery

1. READ `.ai-agents/workspace/session.yaml` — check current state
2. SCAN project root — detect config files:
   - `package.json` → Node.js/TypeScript
   - `pom.xml` / `build.gradle` → Java/Kotlin
   - `Cargo.toml` → Rust, `go.mod` → Go
   - `requirements.txt` / `pyproject.toml` → Python
   - `*.csproj` → .NET/C#, `Gemfile` → Ruby
3. Detect framework indicators: `next.config.*`, `angular.json`, `vue.config.*`, `vite.config.*`, etc.
4. EXTRACT tech stack: language, framework, build tool, test framework, database, ORM

### Phase 2: Architecture Detection

1. SCAN directory structure
2. IDENTIFY architecture pattern indicators:
   - **DDD**: `domain/`, `application/`, `infrastructure/`, `*Repository*`, `*Aggregate*`
   - **Clean Architecture**: `entities/`, `usecases/`, `interface/`, dependency inversion
   - **MVC**: `models/`, `views/`, `controllers/`
   - **Frontend React**: `package.json` with react/next, `components/`, `pages/`
3. MAP module organization (name, path, purpose, layer, key files)

### Phase 3: Pattern Selection (User Confirmation Required)

Present detected pattern with options:

```markdown
### Architecture Pattern Selection

| Detected Pattern | Confidence |
|------------------|------------|
| {pattern_name} | {high/medium/low} |

**Available Patterns**:
1. `ddd` - Domain-Driven Design
2. `clean-architecture` - Layer separation with dependency inversion
3. `frontend-react` - React/Next.js frontend
4. `generic` - Simple projects without specific architecture

**Recommended**: `{suggested_pattern}`

- Reply `yes` to accept
- Reply with pattern name to select different
- Reply `analyze` to create a custom pattern from project analysis
- Reply `none` to proceed without a pattern
```

| User Reply | Action |
|------------|--------|
| `yes` | Accept recommended pattern |
| `{pattern_id}` | Select specific pattern |
| `analyze` | Deep-analyze project structure and generate custom pattern definition |
| `none` | Proceed without architecture pattern |

### Phase 4: Code Analysis (--deep mode, or lightweight for standard)

Extract from source code:
- **Entities**: classes, interfaces, types with properties and relationships
- **Services**: service classes/functions with methods and dependencies
- **API endpoints**: routes, controllers, handlers (if applicable)

### Phase 5: Workspace Population

WRITE the following files with actual content:
- `.ai-agents/workspace/project-context.yaml` — project info, tech stack, architecture, modules, requirements
- `.ai-agents/workspace/session.yaml` — session state

### Phase 6: Knowledge Generation (skip if --light)
- `.ai-agents/knowledge/project/tech-stack.md` — stack documentation
- `.ai-agents/knowledge/principle/coding-standards.md` — coding standards extracted from codebase

---

## Custom Pattern Analysis (when user replies `analyze`)

1. Deep scan directory structure for layer/module patterns
2. Extract file naming conventions and organization
3. Identify module boundaries and dependency flow
4. Present analysis results for user confirmation
5. If confirmed: write `.ai-agents/knowledge/patterns/{pattern_id}/manifest.yaml` and `overview.md`
6. Set as active pattern in `config.yaml`

---

## Success Output

```markdown
## Project Initialization Complete

### Project: {name}
- **Type**: {type}
- **Pattern**: {pattern}
- **Tech Stack**: {language} / {framework}

### Workspace Updated
- [x] project-context.yaml
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
| Pattern mismatch | No clear match | Offer: select existing, `analyze` for custom, or `generic` |

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
