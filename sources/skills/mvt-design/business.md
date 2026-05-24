## Execution Flow

### Step 1: Review Requirements
- Load requirements from `project-context.md` (Requirements Analysis section)
- Load analysis artifact if exists
- Identify key architectural concerns (scalability, security, performance, etc.)

### Step 2: Review Project Context
- Read module structure from `project-context.md` (Module Structure, Layer Structure sections)
- Read business rules from `project-context.md` (Key Business Rules section)
- Understand existing module boundaries and dependency directions
- If `--plan` flag -> Skip to high-level plan, omit detailed interfaces

### Step 3: Design Module Structure
- Define modules with responsibilities and layers
- Define interfaces between modules
- Establish dependency direction rules
- Respect existing layer constraints from project-context.md

### Step 4: Create Data Flow Design
- Design request/response flows
- Define service interactions
- Create sequence diagrams (Mermaid)

### Step 5: Document Decisions
- Record Architecture Decision Records (ADRs)
- Include rationale, alternatives considered, and trade-offs

### Step 6: Write Artifacts
1. Write artifact: `.ai-agents/workspace/artifacts/{change-id}/design.md`
2. Do NOT update `project-context.yaml` or `project-context.md` -- design artifacts are stored separately
