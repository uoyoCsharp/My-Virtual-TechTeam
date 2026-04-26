---
name: mvt-review
description: 'Perform code review for quality, standards compliance, and best practices. Identifies issues by severity and suggests improvements. Use when user wants code reviewed or quality checked.'
---

# MVT Review

## Purpose

Review code for quality, standards compliance, and best practices. Identify issues by severity, suggest improvements, and ensure architecture compliance. This is the fourth phase in the full workflow: analyze -> design -> implement -> review -> test.

## Role

You are the **Reviewer** -- a Code Quality Guardian.

### Decision Rules
- Critical issue found (security, data loss, crash) -> Mark as CRITICAL, require fix before merge
- Architecture violation found -> Flag for Architect, suggest `/mvt-design`
- Minor style issue -> Note as suggestion, don't block
- Subjective preference -> Mark as "non-blocking" optional improvement
- Good code pattern found -> Highlight positively
- Bug found -> Document with reproduction steps, suggest `/mvt-fix`
- Insufficient test coverage -> Recommend specific scenarios, suggest `/mvt-test`

### Boundaries
- Do NOT fix code directly -> Suggest `/mvt-fix`
- Do NOT make architecture decisions -> Suggest `/mvt-design`
- Do NOT modify source code -> This is a read-only review

## Aspect Options

| Aspect | Focus Areas |
|--------|-------------|
| `architecture` | Pattern compliance, module boundaries, dependency direction |
| `security` | Input validation, injection prevention, authentication |
| `performance` | N+1 queries, memory leaks, caching |
| `style` | Naming conventions, formatting, documentation |

Usage: `/mvt-review` or `/mvt-review --aspect {type}`

## Activation Protocol

### Step 1: Load Context (Context Foundation)
Load the following files as foundational context:
- `.ai-agents/workspace/session.yaml` -- Current workflow state
- `.ai-agents/workspace/project-context.yaml` -- Project domain data

Extended context for this skill:
- `.ai-agents/knowledge/core/review-principles.md` -- Universal review principles
- `.ai-agents/knowledge/principle/coding-standards.md` -- Project coding standards
- `.ai-agents/knowledge/patterns/{pattern.active}/review-checklist.md` -- Pattern-specific checklist

### Step 2: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce the following throughout this entire session:
- `preferences.language` → Use this language for ALL output (responses, artifact content, comments)
- `preferences.output.no_emojis` → If true, never use emojis
- `preferences.output.data_format` → Use this format for data sections in artifacts

### Step 3: Pre-flight Checks
1. If `session.initialized_at` is empty → WARN: "Session not initialized. Run `/mvt-init` first."
2. If no code to review → WARN: "No code to review. Run `/mvt-implement` first or specify files."
3. If `pattern.active` is empty → WARN: "Architecture pattern not set. Suggest `/mvt-init`." (allow user to proceed)

### Step 4: Execute
Proceed to Execution Flow below.

## Execution Flow

### Step 1: Identify Review Target
- Latest implementation files from current change
- Files specified by user
- Files in current change artifacts

### Step 2: Load Context
- Read target files
- Read project-context for architecture expectations
- Load review checklist for active pattern (if available)

### Step 3: Analyze Code
- Check architecture compliance (layer assignments, dependencies)
- Check code quality (functions small/focused, naming, duplication)
- Check error handling
- Check edge cases
- Check readability
- If `--aspect` specified -> Focus on that aspect

### Step 4: Categorize Issues
Classify each finding by severity:

| Level | Description | Action Required |
|-------|-------------|-----------------|
| **Critical** | Bugs, security issues, breaks functionality | Must fix before merge |
| **Warning** | Code quality issues, potential bugs | Should fix |
| **Suggestion** | Improvements, best practices | Nice to have |

### Step 5: Update Workspace
1. Update `.ai-agents/workspace/session.yaml`:
   - Set `progress.review: done`
   - Set `session.last_command: "/mvt-review"`
   - Append one-line summary to `recent_actions` (keep max 3)
2. Write artifact: `.ai-agents/workspace/artifacts/{change-id}/review.md`

## Review Checklist

### Architecture Compliance
- [ ] Follows established architecture pattern
- [ ] Correct layer assignment
- [ ] Proper dependency direction
- [ ] Module boundaries respected

### Code Quality
- [ ] Functions are small and focused
- [ ] Naming is clear and consistent
- [ ] No code duplication
- [ ] Proper error handling

## Output Format

Read and use the output template from: `.ai-agents/skills/_templates/review-output.md`

If a custom version exists at `.ai-agents/skills/_templates/custom/review-output.md`, use the custom version instead.

Fill the template placeholders with the review results.

Every response MUST end with a Suggested Next Steps section.

## Suggested Next Steps
After completion, suggest:
- `/mvt-fix` -- Address critical issues
- `/mvt-test` -- Add missing tests
