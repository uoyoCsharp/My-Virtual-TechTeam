## Execution Flow

### Step 1: Load State
- Read `session.yaml` for progress, active change, recent actions
- Read `project-context.yaml` for project info, tech stack, architecture

### Step 2: Determine Current Phase
- Check `progress` fields (analyze, design, implement, review, test)
- Identify which phases are `done`, `pending`, or `in-progress`
- Determine the current active phase

### Step 3: Build Workflow Visualization
- Generate Mermaid flowchart showing phase progression
- Color-code phases: green (done), yellow (current), gray (pending)

### Step 4: Compile Status Report
- Project info summary
- Progress table with phase status
- Active change details (if any)
- Recent actions history

### Step 5: Suggest Next Step
- Based on current progress, recommend the logical next command
- If all phases done -> Suggest `/mvt-cleanup` or starting a new feature
