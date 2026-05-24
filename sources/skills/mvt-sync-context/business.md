## Execution Flow

### Step 1: Detect Changes
- If git available:
  - Run `git diff --name-only` (unstaged changes)
  - Run `git diff --name-only --cached` (staged changes)
  - Run `git diff --name-only HEAD~1` (last commit changes)
  - Merge results and deduplicate
- If git not available:
  - Scan for recently modified files in source directories

### Step 2: Analyze Structural Changes
Focus only on changes that affect the project index (project-context.yaml):

- New or removed source directories -> Update project paths
- New or removed package files (package.json, requirements.txt, etc.) -> Update tech stack
- New or removed projects (in multi-project setup) -> Add/remove project entries
- Changed test framework or build tool -> Update tech stack fields

### Step 3: Update Index
1. Update `.ai-agents/workspace/project-context.yaml`:
   - Update tech_stack fields for affected projects
   - Add new project entries if new sub-projects detected
   - Remove project entries if sub-projects deleted
   - Do NOT modify project-context.md -- it is managed by `/mvt-analyze-code`

### Step 4: Prompt for Semantic Update
If structural changes are detected (new modules, renamed directories, significant refactoring):
- Warn user that `project-context.md` may be outdated
- Suggest running `/mvt-analyze-code` to regenerate semantic context
- Do NOT automatically modify project-context.md
