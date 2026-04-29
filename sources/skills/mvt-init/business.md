## Execution Flow

### Step 1: Project Discovery
- Scan project root for:
  - Package managers (package.json, requirements.txt, Cargo.toml, go.mod, pom.xml, etc.)
  - Framework config files (.eslintrc, tsconfig.json, vite.config, etc.)
  - Source directories (src/, lib/, app/, etc.)
  - Test directories (tests/, __tests__/, spec/, etc.)

### Step 2: Tech Stack Detection
- Identify primary language
- Identify frameworks and libraries
- Identify build tools
- Identify test framework

### Step 3: Architecture Pattern Suggestion
- Analyze directory structure against known patterns
- Compare with available patterns in `.ai-agents/knowledge/patterns/`
- Rank pattern matches by confidence
- Present recommendation with alternatives

Available patterns:
1. `ddd` -- Domain-Driven Design
2. `clean-architecture` -- Layer separation with dependency inversion
3. `frontend-react` -- React/Next.js frontend
4. `generic` -- Simple projects without specific architecture

### Step 4: User Confirmation
- Present detected info and suggested pattern
- Wait for user to confirm or select alternative
- Options: `yes` (accept), pattern name (select different), `analyze` (create custom), `none` (skip)

### Step 5: Update Workspace
1. Write `.ai-agents/workspace/project-context.yaml`:
   - Set `project.name`, `project.type`, `project.root`
   - Set `tech_stack` (language, framework, build_tool, test_framework)
   - Set `architecture.pattern` if selected
2. Write `.ai-agents/workspace/session.yaml`:
   - Set `session.initialized_at` to current timestamp
   - Set `session.last_command: "/mvt-init"`
   - Append one-line summary to `recent_actions` (keep max 3)
3. Write `.ai-agents/config.yaml`:
   - Set `pattern.active` to selected pattern

### Step 6 (--deep only): Extended Analysis
- Map module structure (directories -> modules)
- Identify key entities and services
- Map dependency relationships
- Generate architecture overview diagram
