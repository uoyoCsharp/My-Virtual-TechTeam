# Knowledge Base

Reference documentation for AI agents across all technology stacks and patterns.

## Structure

```
knowledge/
├── core/                    # Core knowledge (always loaded)
│   ├── software-principles.md
│   ├── code-quality.md
│   └── review-checklist.md
│
├── patterns/                # Architecture pattern packs
│   ├── ddd/                 # Domain-Driven Design
│   ├── clean-architecture/  # Clean Architecture
│   ├── hexagonal/           # Hexagonal Architecture
│   └── ...
│
└── project/                 # Project-specific knowledge
    └── README.md
```

## Knowledge Layers

### Core Knowledge
Universal software engineering principles and practices that apply regardless of technology stack or architecture pattern.

**Files:**
- `software-principles.md` - SOLID, DRY, KISS, YAGNI
- `code-quality.md` - Code quality standards and metrics
- `review-checklist.md` - Universal code review checklist

### Pattern Knowledge
Architecture-specific patterns, terminology, and best practices. Loaded based on `manifest.yaml` active pattern.

**Available Patterns:**
- `ddd/` - Domain-Driven Design patterns
- `clean-architecture/` - Clean Architecture principles
- `hexagonal/` - Ports and Adapters pattern
- `cqrs/` - Command Query Responsibility Segregation
- `layered/` - Traditional layered architecture
- `microservices/` - Microservices patterns

### Project Knowledge
Custom knowledge specific to your project, team conventions, and domain terminology.

**Usage:**
Add your project-specific documentation to `knowledge/project/`:
- Team coding standards
- Project-specific patterns
- Business domain glossary
- API conventions

## Usage by Agents

Agents automatically load knowledge based on:
1. **Always**: Core knowledge
2. **Based on Config**: Active pattern knowledge
3. **If Exists**: Project-specific knowledge

## Adding New Knowledge

### Adding Core Knowledge
Add files to `knowledge/core/` following the markdown format.

### Adding Pattern Packs
1. Create a new directory: `knowledge/patterns/{pattern-name}/`
2. Add a `manifest.yaml` with pattern metadata
3. Add pattern documentation files
4. Register in `manifest.yaml` under `patterns.available`

### Adding Project Knowledge
Add files to `knowledge/project/` - no registration required.

## File Format

All knowledge files should:
- Use Markdown format
- Include clear headings
- Provide code examples where applicable
- Be optimized for AI agent consumption
