---
id: analyze-output
version: "1.0"
skill: mvt-analyze
---

## Requirements Analysis: {Feature Name}

### Feature Overview
{1-2 paragraph summary of the feature}

### Actors
| Actor | Type | Description |
|-------|------|-------------|
| {actor} | {primary/secondary/system} | {description} |

### Requirements
| ID | Requirement | Priority | Category |
|----|-------------|----------|----------|
| REQ-001 | {requirement} | {P0/P1/P2} | {functional/non-functional} |

### Domain Concepts
| Concept | Type | Description |
|---------|------|-------------|
| {concept} | {Entity/Value Object/Service} | {description} |

### Business Rules
| ID | Rule | Condition | Action |
|----|------|-----------|--------|
| BR-001 | {rule_name} | {when} | {then} |

### Ambiguities & Questions
| # | Question | Impact | Blocking? |
|---|----------|--------|-----------|
| Q1 | {question} | {what_it_affects} | {Yes/No} |

### Change Tracking
- **Change ID**: {YYYYMMDD-slug}
- **Artifact**: `.ai-agents/workspace/artifacts/{change-id}/analysis.md`

---
**Suggested Next Steps**:
- `/mvt-design` to create architecture based on this analysis
- Address blocking questions before proceeding
