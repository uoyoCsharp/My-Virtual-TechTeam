## Execution Flow

### Step 1: Identify Completed Changes
- **What**: produce a candidate list of change-ids whose artifacts will be aggregated.
- **How**:
  1. Read `session.yaml`. Collect `recent_changes[]` entries with `status: completed`.
  2. For each candidate, verify `.ai-agents/workspace/artifacts/{change-id}/` exists AND contains at least one of `analysis.md` or `design.md`. Drop entries with only `plan.yaml`.
  3. (Fallback) If `recent_changes[]` is empty, scan `.ai-agents/workspace/artifacts/*/` directly; offer those with `analysis.md` or `design.md`, marked `unindexed`.
  4. Exclude any change-id whose directory contains an `_archive/` subfolder (already archived).
  5. Exclude `active_change.id` (work in flight).

- **Present** the list:

  | # | change-id | title | status | analysis.md | design.md | implementation.md |
  |---|-----------|-------|--------|-------------|-----------|-------------------|

- **Always print before user confirmation**:
  > Run `/mvt-sync-context` BEFORE `/mvt-cleanup`. Once cleanup archives a change-id, this skill will skip it.

- **Prompt**: "Select changes to aggregate. Indices (e.g. 1,3,5), `a` for all, `n` to cancel."

- Cancel / empty selection -> stop with "no changes applied".

### Step 2: Read Current Project Context (Adaptive Structure Discovery)

This step establishes the **target structure** that aggregated content must fit into. The structure is NOT assumed -- it is derived from the current document.

1. Read `.ai-agents/knowledge/project/_generated/project-context.md`.
   - Already required by preflight; if discovered missing here, STOP and recommend `/mvt-analyze-code`.
2. Parse the current `.md` into a section map:
   - Each top-level `##` heading -> one section anchor.
   - Record: section title (verbatim), byte range, and a 1-line semantic summary derived from the section's content (e.g., "lists domain terms with definitions" or "describes module dependencies").
   - The summary is what enables matching in Step 3 -- section titles may be in any language and may not match conventional names (Terms / Modules / etc.).
3. If the document has zero `##` sections (single block) -> STOP. Recommend `/mvt-analyze-code` to establish a sectioned baseline first.
4. Read `.ai-agents/workspace/project-context.yaml`. Record current `projects[].source_paths`, `modules`, and `tech_stack` for diff comparison in Step 4d.

### Step 3: Extract and Classify Artifact Content

- **What**: from each selected change-id, extract atomic knowledge items and classify them against the section map from Step 2.
- **How**:
  1. For each selected change-id, read available artifacts (`analysis.md`, `design.md`, `implementation.md`).
  2. Extract atomic items. Typical sources:
     - `analysis.md` -> domain terms, actors, business rules, constraints
     - `design.md` -> modules, layers, dependency rules, key interfaces, ADRs
     - `implementation.md` -> files added/changed (informs `.yaml` source_paths), realized vs deviated design points
  3. For each item, match to a section from the Step 2 map:
     - Match by semantic similarity to **section title + 1-line summary**, not by exact string.
     - Confidence levels:
       - **mapped**: exactly one section matches with high confidence
       - **ambiguous**: 2+ sections plausibly match
       - **orphan**: no section matches; propose a new section name
  4. For each item, also detect change type relative to current section content:
     - `new` -- target section does not contain this entity
     - `modify` -- target section mentions the entity but artifact provides a different value
     - `redundant` -- already present, no change (will be filtered out, not shown to user)

### Step 4: Render the Update Plan (Four Tables)

#### 4a. Section-mapped items
| # | change-id | item | type | target section | classification |
|---|-----------|------|------|----------------|----------------|

#### 4b. Conflicts requiring resolution (every `modify` item)
| # | item | section | current value | proposed value (from {change-id}) |
|---|------|---------|---------------|-----------------------------------|

#### 4c. Ambiguous and orphan items
| # | item | reason | candidate sections (or proposed new section) |
|---|------|--------|----------------------------------------------|

#### 4d. Implied yaml changes
| # | yaml field | current | proposed |
|---|------------|---------|----------|

### Step 5: User Confirmation (Per-Table)

- **4a**: default = accept all. User input: indices to drop, or `e <n>` to edit a single item's target section.
- **4b**: **explicit per-row decision required**. Format `<index>:<keep|replace|edit>`. Example: `1:replace,2:keep,3:edit`. No default.
- **4c**: per row, user picks an existing section, types a new section name, or `skip`.
- **4d**: default = accept; user can drop indices.

Then ask: **"Run optional read-only code verification before applying? (y/n)"**

### Step 6: (Optional) Read-only Code Verification

This step catches artifacts claiming entities never actually delivered. It is **read-only** -- it never writes anything to `.md` or `.yaml`.

If user opts in:
1. For each accepted item naming a code entity (module path, file, class, function), search the codebase under registered `source_paths`:
   - Module path -> directory exists?
   - File -> file exists?
   - Symbol -> grep within source_paths
2. Classify findings:

   | Finding | Action |
   |---------|--------|
   | Artifact item matches code | Mark `verified`; keep in apply list |
   | Artifact item NOT found in code | Flag `unverified`; ask user: drop or proceed (likely reverted / un-merged) |
   | Code contains module / file / symbol that NO artifact item references | **Do NOT add to apply list.** Print: `Code-only entity detected: {path}. Run /mvt-analyze-code for ground-truth rebuild.` |

3. Re-render the apply list with `verified` / `unverified` markers; final confirmation.

If user skips verification: proceed directly to Step 7 with Step 5 selections.

### Step 7: Apply Updates (Merge Mode)

- **Pre-write**:
  1. Backup: `project-context.md` -> `project-context.md.bak`; `project-context.yaml` -> `project-context.yaml.bak`. Overwrite any prior `.bak`.
  2. Backup write failure -> STOP, do not modify originals.

- **Update `project-context.md`** (merge, never rewrite):
  1. Each `new` item: append to target section, matching the section's existing style (bullet vs paragraph).
  2. Each `modify` item with `replace`: replace the matching line in place. Smallest possible diff.
  3. Each `orphan` item with new-section choice: append a new `##` section at end of file.
  4. **Never delete** any existing line. **Never reorder** existing sections.

- **Update `project-context.yaml`** (structured merge):
  1. Apply accepted entries from Table 4d.
  2. Add new `source_paths` to matching project entry; add new modules to `modules[]`.
  3. **Never delete** an existing yaml entry in this skill.

- **Atomicity**: temp + rename per file. If `.md` write succeeds but `.yaml` fails (or vice versa) -> restore the failed one from `.bak`, keep the other; report partial success.

### Step 8: Report

1. **Applied summary** -- counts: items added / modified / skipped / orphaned-into-new-section
2. **Files changed** -- paths + byte deltas
3. **Backup paths** -- so user can manually revert
4. **Out-of-scope reminder** (always print):
   > This skill processes additions and modifications only. Module deletions, renames, and large refactors are NOT detected here. Run `/mvt-analyze-code` periodically to rebuild from ground truth.
5. **Suggested next**:
   - Aggregated >= 1 change -> "Run `/mvt-cleanup` to archive these completed changes."
   - Verification flagged code-only entities -> "Run `/mvt-analyze-code` to capture missing entities."

### Step 9: (session update handled by shared section)
- Refresh `session.last_synced_at` to current ISO timestamp.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| `project-context.md` does not exist | Caught at preflight; recommend `/mvt-analyze-code` |
| `.md` has zero `##` sections | STOP at Step 2; recommend `/mvt-analyze-code` |
| Selected change-id has only `plan.yaml` | Filtered in Step 1; will not appear |
| `modify` with `replace` but the existing line cannot be located deterministically | Fall back to append + flag as duplicate-needs-manual-edit; do NOT silently overwrite the wrong line |
| `.md.bak` already exists | Overwrite (only the most recent backup matters) |
| User aborts at Step 5 | Do not write; report "no changes applied" |
| Step 6 verification finds zero matches for everything | Strong warning; require explicit confirm before proceeding (artifacts likely describe planned, not delivered, work) |
| Two artifacts contradict each other (design says layer A, implementation says layer B) | Surface in Table 4b as cross-artifact conflict; user picks |
| change-id was archived between Step 1 and Step 7 | Skip with note; do not error the run |
