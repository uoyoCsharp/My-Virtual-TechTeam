## Execution Flow

### Step 1: Receive & Classify the Question
- Read the user's free-text question.
- Classify it against the table below. Walk top-to-bottom; the first match wins.

  | Question shape | Example | Handling |
  |-----------------|---------|----------|
  | Logic / flow question | "How does the epic-child handoff work?" | Proceed to Step 2 |
  | Detail confirmation | "Does the `createOrder` handler retry on a failed payment call?" | Proceed to Step 2, expect Step 3 (source verification) to trigger |
  | Ambiguous / multiple readings | "How does status work?" (session status? HTTP status? plan status?) | STOP -- list the readings, ask which one |
  | Disguised change request | "Can you make `/mvt-status` also show epic depth?" | Answer any informational part now; then say this is a change request and point to `/mvt-analyze` or `/mvt-quick-dev` per its scope -- do NOT implement |
  | No question, just a topic/keyword | "registry.yaml" | Ask what specifically they want to know about it |

### Step 2: Answer from Loaded Knowledge
- **What**: attempt an answer using only what activation already loaded (`project-context.md` if present, `registry.yaml`, `session.yaml`, this skill's knowledge bindings).
- **How**:
  1. Locate the relevant section(s) in `project-context.md` (terms, modules, layers, business rules) or other loaded knowledge.
  2. Draft an answer, noting which document/section it came from.
  3. Rate confidence: **High** (question is fully covered, no ambiguity), **Medium** (covered but the question asks for something more specific/current than the doc states), **Low** (not covered, or doc looks stale relative to the question).

### Step 3: Verify Against Source When It Matters
- **What**: decide whether to read actual source code before answering.
- **Trigger table** -- read source if ANY apply:

  | Trigger | Why |
  |---------|-----|
  | Confidence from Step 2 is Medium or Low | Knowledge alone isn't a safe basis for this answer |
  | The question asks to confirm a concrete fact ("does X do Y", "is Z the case", "what does this function return") | These need current-state truth, not a paraphrase |
  | `project-context.md` is missing entirely | No cached knowledge exists to answer from |
  | The user explicitly asks to double-check / verify | Respect the explicit ask |

- **How**:
  1. From the question, extract concrete signals: file paths, function/class/skill names, config keys.
  2. Use Grep/Glob to locate the exact code; read only the relevant file(s) or function(s) -- do not read whole directories speculatively.
  3. Re-derive the answer from what the code actually shows.
  4. If source confirms the knowledge-based draft, keep it and add a source citation. If source contradicts it, use the source's answer and flag the discrepancy (see Step 4).
- **Skip condition**: if Step 2 confidence is High and none of the triggers apply, answer directly without reading source -- this keeps simple questions fast.

### Step 4: Present the Answer
- **What**: respond in conversation only. No artifact, no file write.
- **How**: structure the response as:
  1. **Direct answer** -- one to a few sentences, answering exactly what was asked.
  2. **Basis** -- one line citing where the answer came from: `project-context.md § <section>` and/or `path/to/file.ts:12-34`.
  3. **Discrepancy note** (only if Step 3 found one) -- state plainly that cached knowledge said X but the code shows Y, and that a refresh may be warranted.
  4. **Scope note** (only if Step 1 classified this as a disguised change request) -- one line pointing to the workflow skill that owns making the change.
- Keep the answer proportional to the question -- a yes/no detail check gets a short confirmation, not a report.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| Question spans multiple unrelated topics | Answer each part separately, clearly labeled |
| Source code and `project-context.md` disagree | Trust the code; answer from it; flag the discrepancy per Step 4 |
| Question references a file/symbol that doesn't exist | Say so directly; do not guess at a similarly-named alternative without asking |
| Question is about a different project in a multi-project workspace | Resolve project scope the same way other skills do (match against `projects[].path` / `source_paths`); ask if it cannot be resolved |
| User pushes back on the answer ("are you sure?") | Re-verify against source (Step 3) if not already done for this question, then restate with citation; do not just repeat the same claim more firmly |
| `active_change` is missing | Run without change context; this skill never depends on an active change |
