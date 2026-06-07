## Execution Flow

### Step 1: Per-Project Routing (4-Level Fallback Chain)

Before processing any change, determine which project(s) the sync targets. Use this 4-level fallback chain:

1. **`task.project` exists** (when syncing within a plan-driven context): route to that project's `_generated/{name}/project-context.md`. If the task has multiple projects, route to each independently.
2. **Artifact file paths match** a unique project's `source_paths` or `path` from `project-context.yaml`: route to that project.
3. **Current operation's file path reverse-lookup**: match the file path against `projects[].path` and `projects[].source_paths` -> route to that project.
4. **List candidate projects for user selection**: if none of the above resolved a unique project, list the project names and ask the user.

**Cross-project changes** (task spanning multiple projects): split write per project -- each project's `project-context.md` receives only its relevant knowledge entries.

### Step 2: Identify Completed Changes
- **What**: produce a candidate list of change-ids whose artifacts will be aggregated.
- **How**:
  1. Read `session.yaml`. Collect `changes[]` entries with `status: done`.
  2. For each candidate, verify `.ai-agents/workspace/artifacts/{change-id}/` exists AND contains at least one of `analysis.md` or `implementation.md`. Drop entries with only `plan.yaml`, or with only `design.md` (design artifacts are not aggregated -- see Step 3).
  3. (Fallback) If `changes[]` is empty, scan `.ai-agents/workspace/artifacts/*/` directly; offer those with `analysis.md` or `implementation.md`, marked `unindexed`.
  4. Exclude already-archived or irrelevant changes:
     - **Indexed changes**: exclude any `changes[]` entry with `status: abandoned`. For `status: done` entries, Step 1.2's directory existence check already filters out those whose artifacts have been moved to `artifacts/_archived/` by `/mvt-cleanup`.
     - **Fallback scan**: when scanning `artifacts/*/` directly, skip any path under `artifacts/_archived/` (the unified archive directory managed by `/mvt-cleanup`).
  5. Exclude `active_change.id` (work in flight).

- **Present** the list:

  | # | change-id | title | status | analysis.md | design.md | implementation.md |
  |---|-----------|-------|--------|-------------|-----------|-------------------|

- **Always print before user confirmation**:
  > Run `/mvt-sync-context` BEFORE `/mvt-cleanup`. Once cleanup archives a change-id, this skill will skip it.

- **Prompt**: "Select changes to aggregate. Indices (e.g. 1,3,5), `a` for all, `n` to cancel."

- Cancel / empty selection -> stop with "no changes applied".

### Step 3: Read Current Project Context (Adaptive Structure Discovery)

This step establishes the **target structure** that aggregated content must fit into. The structure is NOT assumed -- it is derived from the current document.

1. Read `.ai-agents/knowledge/project/_generated/project-context.md`.
   - Already required by preflight; if discovered missing here, STOP and recommend `/mvt-analyze-code`.
2. Parse the current `.md` into a section map:
   - Each top-level `##` heading -> one section anchor.
   - Record: section title (verbatim), byte range, and a 1-line semantic summary derived from the section's content (e.g., "lists domain terms with definitions" or "describes module dependencies").
   - The summary is what enables matching in Step 5 -- section titles may be in any language and may not match conventional names (Terms / Modules / etc.).
3. If the document has zero `##` sections (single block) -> STOP. Recommend `/mvt-analyze-code` to establish a sectioned baseline first.
4. Read `.ai-agents/workspace/project-context.yaml`. Record current `projects[].source_paths`, `modules`, and `tech_stack` for diff comparison in Step 5d.

### Step 4: Extract Artifact Content

- **What**: from each selected change-id, extract atomic knowledge items (do not classify yet).
- **How**:
  1. For each selected change-id, read available artifacts (`analysis.md`, `implementation.md`). Do NOT read `design.md` -- design artifacts are not aggregated by this skill.
  2. Extract atomic items. Typical sources:
     - `analysis.md` -> domain terms, actors, business rules, constraints
     - `implementation.md` -> files added/changed (informs `.yaml` source_paths), realized vs deviated design points

### Step 5: Normalize Extracted Content

Before classifying extracted items against the section map, normalize each item per the **Document Profile: project-context.md** section loaded above. This step strips intra-artifact cross-references -- meaningful in their source document but noise in project-context.md -- before they enter the merge pipeline.

1. For each extracted item, apply the normalization rules below (the governing principle lives in the Document Profile; this table lists concrete patterns, non-exhaustive):

   | Pattern | Example | Normalization |
   |---------|---------|---------------|
   | ADR reference with section number | `(ADR-06, §12.4)` | Remove the reference; keep the substantive content it annotates |
   | Bare ADR reference | `per ADR-06`, `(ADR-06)` | Remove entirely |
   | Section number reference | `§12.4`, `§3.2.1` | Remove entirely |
   | Design rule label prefix | `B-1:`, `D-7:`, `C-3:` | Remove the prefix; keep the rule text |
   | Parenthesized design label | `(D-7)`, `(B-4)` | Remove entirely |
   | Cross-artifact link phrase | `see §X`, `refer to ADR-N` | Remove the link phrase |
   | Other reference pointing outside project-context.md | Any pattern not listed above | Apply the governing principle: if understanding requires an external document, strip the reference marker |

   **Critical**: strip only the *reference marker*, never the *substantive content* it annotates.

2. After normalization, re-evaluate each item:
   - Still contains substantive content -> keep for classification in Step 5.
   - Was entirely a cross-reference with no independent semantic value -> drop it (it is a pointer, not knowledge).
3. Any normalization that removes content from a `modify` item (where the item modifies an existing entry) must be flagged in the update plan (Step 6, Table 6b) so the user can verify the substantive meaning was preserved.

### Step 6: Classify Artifact Content

- **What**: classify each normalized item against the section map from Step 2.
- **How**:
  1. For each item, match to a section from the Step 2 map:
     - Match by semantic similarity to **section title + 1-line summary**, not by exact string.
     - Confidence levels:
       - **mapped**: exactly one section matches with high confidence
       - **ambiguous**: 2+ sections plausibly match
       - **orphan**: no section matches; propose a new section name
  2. For each item, also detect change type relative to current section content:
     - `new` -- target section does not contain this entity
     - `modify` -- target section mentions the entity but artifact provides a different value
     - `redundant` -- already present, no change (will be filtered out, not shown to user)

### Step 7: Render the Update Plan (Four Tables)

#### 6a. Section-mapped items
| # | change-id | item | type | target section | classification |
|---|-----------|------|------|----------------|----------------|

#### 6b. Conflicts requiring resolution (every `modify` item)
| # | item | section | current value | proposed value (from {change-id}) |
|---|------|---------|---------------|-----------------------------------|

#### 6c. Ambiguous and orphan items
| # | item | reason | candidate sections (or proposed new section) |
|---|------|--------|----------------------------------------------|

#### 6d. Implied yaml changes
| # | yaml field | current | proposed |
|---|------------|---------|----------|

### Step 8: User Confirmation (Per-Table)

- **6a**: default = accept all. User input: indices to drop, or `e <n>` to edit a single item's target section.
- **6b**: **explicit per-row decision required**. Format `<index>:<keep|replace|edit>`. Example: `1:replace,2:keep,3:edit`. No default.
- **6c**: per row, user picks an existing section, types a new section name, or `skip`.
- **6d**: default = accept; user can drop indices.

Then ask: **"Run optional read-only code verification before applying? (y/n)"**

### Step 9: (Optional) Read-only Code Verification

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

If user skips verification: proceed directly to Step 9 with Step 7 selections.

### Step 10: Apply Updates (Merge Mode)

- **Pre-write**:
  1. Backup: `project-context.md` -> `project-context.md.bak`; `project-context.yaml` -> `project-context.yaml.bak`. Overwrite any prior `.bak`.
  2. Backup write failure -> STOP, do not modify originals.

- **Update `project-context.md`** (merge, never rewrite):
  1. Each `new` item: append to target section, matching the section's existing style (bullet vs paragraph).
  2. Each `modify` item with `replace`: replace the matching line in place. Smallest possible diff.
  3. Each `orphan` item with new-section choice: append a new `##` section at end of file.
  4. **Never delete** any existing line. **Never reorder** existing sections.
  5. All merged content must already be normalized per Step 4 rules. Do not re-introduce stripped references during inline replacement or append operations.

- **Update `project-context.yaml`** (structured merge):
  1. Apply accepted entries from Table 6d.
  2. Add new `source_paths` to matching project entry; add new modules to `modules[]`.
  3. **Never delete** an existing yaml entry in this skill.

- **Atomicity**: temp + rename per file. If `.md` write succeeds but `.yaml` fails (or vice versa) -> restore the failed one from `.bak`, keep the other; report partial success.

### Step 11: Report

1. **Applied summary** -- counts: items added / modified / skipped / orphaned-into-new-section
2. **Files changed** -- paths + byte deltas
3. **Backup paths** -- so user can manually revert
4. **Synced changes** -- list all change-ids whose knowledge was aggregated in this run:
   > The following changes have been synced and can be safely archived: {change-id-1}, {change-id-2}, ...
   > Last synced at: {last_synced_at} (updated by this run)
5. **Out-of-scope reminder** (always print):
   > This skill processes additions and modifications only. Module deletions, renames, and large refactors are NOT detected here. Run `/mvt-analyze-code` periodically to rebuild from ground truth.
6. **Suggested next**:
   - Aggregated >= 1 change -> "Run `/mvt-cleanup` to archive these completed changes."
   - Verification flagged code-only entities -> "Run `/mvt-analyze-code` to capture missing entities."

### Step 12: State Update
Apply the State Update rules defined in the **State Update** section below.
- The `--set-synced` parameter updates `session.last_synced_at`.
- Pass `--projects` to plan-update.cjs when updating a plan that has project attribution.

## Edge Cases & Errors

| Case | Handling |
|------|----------|
| `project-context.md` does not exist | Caught at preflight; recommend `/mvt-analyze-code` |
| `.md` has zero `##` sections | STOP at Step 2; recommend `/mvt-analyze-code` |
| Selected change-id has only `plan.yaml` | Filtered in Step 1; will not appear |
| `modify` with `replace` but the existing line cannot be located deterministically | Fall back to append + flag as duplicate-needs-manual-edit; do NOT silently overwrite the wrong line |
| `.md.bak` already exists | Overwrite (only the most recent backup matters) |
| User aborts at Step 7 | Do not write; report "no changes applied" |
| Step 8 verification finds zero matches for everything | Strong warning; require explicit confirm before proceeding (artifacts likely describe planned, not delivered, work) |
| Two artifacts contradict each other (analysis claims rule X, implementation realizes rule Y) | Surface in Table 6b as cross-artifact conflict; user picks |
| change-id was archived between Step 1 and Step 9 | Skip with note; do not error the run |
