# Knowledge Base

Reference documentation for AI agents across all technology stacks and patterns.

## Structure

| Directory | Description | Contents |
|-----------|-------------|----------|
| `knowledge/core/` | Core knowledge (always loaded) | `software-principles.md`,etc |
| `knowledge/patterns/` | Architecture pattern packs | `ddd`, etc |
| `knowledge/principle/` | Code development principles | `coding-standards.md`, etc. |
| `knowledge/project/` | Project-specific knowledge | Custom documentation |

## Knowledge Layers

### Core Knowledge
Universal software engineering principles and practices that apply regardless of technology stack or architecture pattern.

**Files:**
- `software-principles.md` - SOLID, DRY, KISS, YAGNI

### Pattern Knowledge
Architecture-specific patterns, terminology, and best practices. Loaded based on `manifest.yaml` active pattern.

**Available Patterns:**
- `ddd/` - Domain-Driven Design patterns
- `clean-architecture/` - Clean Architecture principles

### Development Principles
Coding standards, conventions, and best practices for code quality and maintainability.

**Usage:**
Add files like `coding-standards.md` and `review-checklist.md` to provide guidelines for code analysis and review execution skills.

### Project Knowledge
Custom knowledge specific to your project.

**Usage:**
Add your project-specific documentation to `knowledge/project/`:
- Project-specific patterns
- Business domain glossary

## Usage by Agents

Agents automatically load knowledge based on:
1. **Always**: Core knowledge
2. **Based on Config**: Active pattern knowledge
3. **Based on Skills**: Stack knowledge if required by skills

## File Format

All knowledge files should:
- Use Markdown format
- Include clear headings
- Provide code examples where applicable
- Be optimized for AI agent consumption
