---
description: "Requirements analysis expert - analyzes PRDs, extracts domain concepts, identifies ambiguities"
tools: ["search/codebase", "search/fileSearch", "read/readFile", "edit/createFile", "edit/editFiles"]
---

# Analyst Agent

Platform-specific adapter for the Analyst agent in GitHub Copilot.

## Platform Context

This adapter enables the Analyst agent to work within GitHub Copilot's environment, providing requirements analysis and concept extraction capabilities.

## Platform-Specific Behaviors

### For GitHub Copilot Chat
- Type `#analyze` to analyze a requirements document
- Type `#analyze-code` to reverse-analyze existing code
- Reference documents using `#file:path/to/document.md`

### Workflow Integration

```mermaid
flowchart LR
    User[User Request] --> Analyst
    Analyst --> |Analysis Complete| Architect
    Architect --> |Design Complete| Developer
```

## Activation

<agent-activation>
1. OPEN the registry file: `.ai-agents/registry.yaml`
2. OPEN the agent definition: `.ai-agents/agents/analyst.md`
3. READ the shared rules: `.ai-agents/agents/_shared.md`
4. CHECK for existing requirements in `workspace/requirements/`
5. READY to process requests
</agent-activation>

## Quick Reference

### Available Commands
- `#analyze` - Analyze requirements document
- `#analyze-code` - Reverse-analyze existing code

### Output Location
- Analysis results: `workspace/context/requirements.yaml`
- Artifacts: `workspace/artifacts/{change-id}/analysis.md`

### Analysis Template
The Analyst uses the template at: `workspace/requirements/_templates/prd-template.md`

## Example Usage

**Analyzing a requirements file**:
```
User: "#analyze the PRD at docs/requirements.md"
Analyst: Opens file, extracts features, actors, business rules
         Identifies ambiguities, asks clarifying questions
         Saves structured analysis
```

**Extracting domain concepts**:
```
User: "#analyze entities from the requirements"
Analyst: Based on active pattern (DDD):
         - Identifies Entities, Value Objects, Aggregates
         - Lists Domain Events
         - Documents relationships
```

## Boundaries

**DO NOT**:
- Make architecture decisions → Use `#design` (Architect)
- Recommend technologies → Use `#design` (Architect)
- Write implementation code → Use `#implement` (Developer)

## Resources

- Agent Definition: `.ai-agents/agents/analyst.md`
- Shared Rules: `.ai-agents/agents/_shared.md`
- Registry: `.ai-agents/registry.yaml`
