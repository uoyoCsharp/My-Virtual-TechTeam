## Execution Flow

### Step 1: Determine Analysis Target

Identify which project(s) to analyze:

| Variant | Target |
|---------|--------|
| `/mvt-analyze-code` | Analyze the first project in `project-context.yaml` (or the only one) |
| `/mvt-analyze-code --all` | Analyze all projects listed in `project-context.yaml` |
| `/mvt-analyze-code {name}` | Analyze the project matching the given name |

For each target project:
1. Read its `path` from `project-context.yaml`
2. Use `path` as the source directory for analysis

### Step 2: Load Template

Determine the output template for project-context.md:

1. Check `.ai-agents/skills/_templates/custom/project-context.md` -- if exists, use it
2. Otherwise, use `.ai-agents/skills/_templates/project-context.md` (default)
3. Read the template to understand the required section structure
4. The template defines section headings only -- generate content freely for each section based on code analysis

### Step 3: Scan Code Structure

For the target project directory:

- Map directory structure (one level below source root)
- Identify entry points (main files, index files, router files)
- Detect module boundaries (top-level directories under source root)

### Step 4: Extract Modules and Entities

- Identify top-level modules and their responsibilities
- For each module, determine: path, responsibility, dependencies on other modules
- Identify domain entities (models, schemas, types, interfaces)
- Classify entities by type: domain model, value object, DTO, configuration

### Step 5: Extract Core Terms

Scan code for domain-specific terminology:

- Class and interface names that represent domain concepts
- Abbreviations and their expansions
- Domain jargon used in comments and docstrings
- Present as a glossary table: | Term | Meaning |

### Step 6: Extract Business Rules

Identify key business logic and constraints:

- Validation rules (assertions, guards, precondition checks)
- Computation rules (formulas, algorithms, calculation logic)
- State transition rules (workflow steps, status changes)
- Constraint rules (limits, quotas, access restrictions)

### Step 7: Extract API Overview

Identify public interfaces:

- HTTP endpoints (routes, handlers) with method and path
- Public methods of service classes
- Event publishers and subscribers
- CLI commands (if applicable)

### Step 8: Generate Output

1. For each analyzed project, generate a section in the template format:
   - Use `# Project: {name}` as the top-level heading
   - Fill each template section with analysis results
   - If a section has no relevant content, include the heading with "(No relevant content detected)"

2. Write the output to `.ai-agents/knowledge/project/_generated/project-context.md`:
   - If analyzing a single project, write that project's section
   - If analyzing multiple projects (`--all`), write all sections separated by `---`
   - If the file already exists, merge with existing content:
     - Replace sections for re-analyzed projects
     - Preserve sections for projects NOT in this analysis run

3. Do NOT update `project-context.yaml` -- it is the lean index, managed by `/mvt-init` and `/mvt-sync-context` only
