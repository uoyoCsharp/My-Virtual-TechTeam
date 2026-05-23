## Execution Flow

### Step 1: Review Requirements
- Load requirements from `project-context.yaml`
- Load analysis artifact if exists
- Identify key architectural concerns (scalability, security, performance, etc.)

### Step 2: Select Architecture Approach
- Check active pattern in config
- Load pattern-specific knowledge
- If `--plan` flag -> Skip to high-level plan, omit detailed interfaces

### Step 3: Design Module Structure
- Define modules with responsibilities and layers
- Define interfaces between modules
- Establish dependency direction rules

### Step 4: Create Data Flow Design
- Design request/response flows
- Define service interactions
- Create sequence diagrams (Mermaid)

### Step 5: Document Decisions
- Record Architecture Decision Records (ADRs)
- Include rationale, alternatives considered, and trade-offs

### Step 6: Write Artifacts
1. Update `.ai-agents/workspace/project-context.yaml`:
   - Write to `architecture` section (modules, decisions, interfaces)
2. Write artifact: `.ai-agents/workspace/artifacts/{change-id}/design.md`
