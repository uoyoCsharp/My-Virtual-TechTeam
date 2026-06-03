# Optimization Proposal: project-context.md Content Quality Assurance for mvt-sync-context

> **Proposal ID**: OPT-2026-001
> **Status**: Draft
> **Affected Skills**: mvt-sync-context, mvt-analyze-code, mvt-manage-context
> **Affected Files**: `sources/sections/` (new), `sources/skills/mvt-sync-context/business.md`, `sources/skills/mvt-analyze-code/manifest.yaml`, `sources/skills/mvt-manage-context/manifest.yaml`

---

## 1. Problem Statement

### 1.1 Phenomenon

When `mvt-sync-context` merges completed change artifacts (analysis.md / design.md / implementation.md) into `project-context.md`, it performs **verbatim content extraction** without any normalization. This causes internal cross-references from the source documents to be transplanted into `project-context.md`, where they become unresolvable noise.

### 1.2 Evidence

Using the Capibara project's `project-context.md` as a real-world sample, the following pollution was identified:

| Location | Polluted Content | Source Meaning | Effect in project-context.md |
|----------|-----------------|----------------|------------------------------|
| Core Terms, row "Subscriber Idempotency Contract" | `(ADR-06, §12.4)` | Points to Architecture Decision Record #6, section 12.4 | No target to resolve; pure noise |
| Core Terms, row "IExecutor" | `(D-7)` | Points to design document rule D-7 | Reader cannot interpret |
| Key Business Rules, "ACP session resume" bullet | `B-1:` prefix | Design document internal rule label | Prefix has no context; fragments the rule |
| Key Business Rules, "aggregation-mode all" bullet | `B-2:` prefix | Same as above | Same as above |
| Key Business Rules, "restrictive tool permission" bullet | `B-4:` prefix | Same as above | Same as above |
| Key Business Rules, "Subscriber idempotency" bullet | `per ADR-06/§12.4` | Variant reference to ADR-06 | Same as first row |

### 1.3 Root Cause Analysis

Two independent deficiencies combine to produce this problem:

**Deficiency A — No Content Normalization**: `mvt-sync-context` Step 3 ("Extract and Classify Artifact Content") defines *what* to extract (domain terms, actors, business rules, constraints) but never defines *how to clean* the extracted content. The AI faithfully preserves all markup from source documents.

**Deficiency B — No Document Profile**: Neither `mvt-sync-context` nor `mvt-analyze-code` (the generator) defines *what kind of document* `project-context.md` is, *who reads it*, or *what quality standards* its content must meet. Without this cognitive framework, the AI treats `project-context.md` as a generic markdown file and has no basis for judging whether a piece of content belongs there.

### 1.4 Impact

The impact extends beyond aesthetic noise. `project-context.md` is **shared knowledge loaded by all 18 MVTT skills** at activation time. Its content directly drives AI decision-making:

| Consumer Skill | Decision Driven by project-context.md | Impact of Polluted Content |
|---------------|---------------------------------------|---------------------------|
| mvt-implement | Layer compliance: "Is this import legal?" | Unresolvable references waste context tokens and may confuse rule interpretation |
| mvt-design | Module reuse: "Does an existing module fit?" | Cross-references in module descriptions dilute the signal |
| mvt-test | Business rule coverage: "Does each rule have a test?" | Rules prefixed with `B-1:` labels are harder to match to test cases; ADR references make rules non-atomic |
| mvt-review | Compliance verification against rules | Same as above — rules must be self-contained and independently verifiable |
| mvt-check-context | Token budget: healthy ≤4000, oversized >8000 | Cross-reference noise inflates token count without adding value |

---

## 2. Current Architecture Analysis

### 2.1 The project-context.md Lifecycle

```
                    ┌──────────────────┐
                    │ mvt-analyze-code │  Generator (from-scratch)
                    │  creates .md     │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │ project-context.md│  Long-term semantic ground truth
                    │ (shared knowledge)│  Loaded by ALL 18 skills
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
    ┌─────────▼──────┐ ┌────▼──────┐ ┌────▼───────────┐
    │ mvt-sync-context│ │ mvt-check │ │ mvt-manage-   │
    │  merges .md     │ │  audits   │ │  context (CRUD)│
    └────────────────┘ └───────────┘ └────────────────┘
```

Three skills can **write** to `project-context.md`:

| Skill | Write Mode | Current Quality Awareness |
|-------|-----------|--------------------------|
| `mvt-analyze-code` | Full generation (template-driven) | None — only knows "fill each template section with analysis results" |
| `mvt-sync-context` | Incremental merge (append / inline replace / new section) | None — only knows "extract atomic items" without normalization rules |
| `mvt-manage-context` | Manual CRUD operations | None — no content quality guidance |

### 2.2 Why This Cannot Be Solved at the TypeScript Level

The execution engine for both `mvt-sync-context` and `mvt-analyze-code` is **Claude AI itself**, operating on the prose instructions in their respective `business.md` files. The TypeScript build pipeline (`assembler.ts`, `section-loader.ts`) only handles template expansion (Mustache-style variable substitution, conditional blocks, empty table stripping). It never processes or transforms the *semantic content* of artifacts.

Therefore, content quality rules must be embedded in the **skill instructions** (prose), not in compiled code.

### 2.3 Template Customization Constraint

`mvt-analyze-code` supports custom templates (`.ai-agents/skills/_templates/custom/project-context.md`), meaning the section structure of `project-context.md` is **not fixed**. Any quality rules must be expressed as **structural principles** rather than per-section prescriptions tied to the default 6-section template.

---

## 3. Proposed Solution

### 3.1 Overview

Two complementary changes form the solution:

| Layer | Change | Purpose |
|-------|--------|---------|
| **Cognitive** | New shared section: `sections/project-context-profile.md` | Establish a shared understanding of what `project-context.md` is, who reads it, and what content quality it requires — injected into every skill that writes to it |
| **Procedural** | New step in `mvt-sync-context/business.md`: "Normalize Extracted Content" | Concrete normalization rules that strip cross-references during extraction, as an execution-level safeguard |

The cognitive layer ensures the AI *understands why* certain content doesn't belong; the procedural layer ensures it *actually removes it* even when source-document inertia would otherwise carry it through.

### 3.2 Change 1: Shared Section — `project-context-profile.md`

**New file**: `sources/sections/project-context-profile.md`

This section declares the identity, audience, quality standards, and exclusion principles of `project-context.md`. It is shared across all writing skills to prevent definition drift.

**Full content:**

```markdown
## Document Profile: project-context.md

Before writing to `project-context.md`, understand what this document IS and IS NOT.

### Identity
`project-context.md` is the project's **long-term semantic ground truth**. It is a self-contained knowledge base consumed by AI skills to make decisions. It is NOT a copy of design documents, NOT a changelog, NOT an ADR index.

### Audience
The readers are AI skill instances (implementer, designer, tester, reviewer), NOT humans reading for reference. They use this document to make **binary decisions** (is this import legal? does this test cover this rule?) — not to trace design rationale.

### Content Quality Standards
Every piece of content written into `project-context.md` must satisfy ALL of the following:

1. **Self-contained**: understandable without consulting any external document, artifact, or ADR
2. **Actionable**: can be used by an AI skill to make a yes/no decision or produce a concrete output (e.g., a test case)
3. **Atomic**: each item is independently meaningful — not a fragment of a larger argument that only makes sense in its source document
4. **Lean**: the total token budget for this document is ≤4000 tokens (healthy threshold). Content that does not directly serve a decision should be excluded.
5. **Stable**: only persist knowledge with long-term reference value. Transient state (change metadata, in-progress decisions, temporary workarounds) belongs in session.yaml or artifacts.

### What Does NOT Belong
Strip any content that cannot be understood without consulting an external document. This is the governing principle — if a reader must look elsewhere to understand an entry, that entry or its reference markers do not belong.

Specific patterns to remove (non-exhaustive — apply the principle above to any similar cases):

| Pattern | Example | Normalization |
|---------|---------|---------------|
| ADR reference with section number | `(ADR-06, §12.4)` | Remove the reference entirely; keep the substantive content it annotates |
| Bare ADR reference | `per ADR-06`, `(ADR-06)` | Remove entirely |
| Section number reference | `§12.4`, `§3.2.1` | Remove entirely |
| Design document rule label prefix | `B-1:`, `D-7:`, `C-3:` | Remove the label prefix; keep the rule text |
| Parenthesized design label | `(D-7)`, `(B-4)` | Remove entirely |
| Cross-artifact link phrase | `see §X`, `refer to ADR-N` | Remove the link phrase |
| Other internal references pointing outside project-context.md | Any pattern not listed above | Apply the principle: if understanding requires an external document, strip the reference marker |

**Critical**: Only strip the *reference marker*, never the *substantive content* it annotates.

- ✅ `idempotency key or exists-or-skip semantics (ADR-06, §12.4)` → `idempotency key or exists-or-skip semantics`
- ✅ `B-1: resume() degrades to rebuild on protocol error` → `resume() degrades to rebuild on protocol error`
- ❌ `Subscriber Idempotency Contract` — this is the term itself, keep it
```

**Referenced by** (manifest.yaml section entries):

| Skill | Section Params |
|-------|---------------|
| `mvt-sync-context` | `type: shared`, `source: sections/project-context-profile.md` |
| `mvt-analyze-code` | `type: shared`, `source: sections/project-context-profile.md` |
| `mvt-manage-context` | `type: shared`, `source: sections/project-context-profile.md` |

### 3.3 Change 2: New Step in `mvt-sync-context/business.md`

Insert a new step **"Normalize Extracted Content"** between the current Step 2 ("Read Current Project Context") and Step 3 ("Extract and Classify Artifact Content"), then renumber all subsequent steps.

This step serves as an **execution-level safeguard** — even with the Document Profile establishing cognitive awareness, source-document inertia can cause the AI to carry through references. The explicit normalization step forces a deliberate cleaning pass.

**New step content (to be inserted as Step 3):**

```markdown
### Step 3: Normalize Extracted Content

Before classifying extracted items against the section map, normalize their content per the **Document Profile: project-context.md** section loaded above. This step ensures that intra-artifact cross-references — meaningful in their source document but noise in project-context.md — are stripped before they enter the merge pipeline.

1. For each extracted item, apply the normalization rules defined in the "What Does NOT Belong" subsection of the Document Profile.
2. After normalization, re-evaluate each item:
   - If the item still contains substantive content → keep for classification in Step 4.
   - If the item was entirely a cross-reference with no independent semantic value → drop it (it is not knowledge, it is a pointer).
3. Any normalization that removes content from a `modify` item (where the item modifies an existing entry) must be flagged in the update plan (Step 5, Table 5b) so the user can verify that the substantive meaning was preserved.
```

**Step renumbering** — all subsequent steps shift by +1:

| Original | New | Title |
|----------|-----|-------|
| Step 3 | Step 4 | Extract and Classify Artifact Content |
| Step 4 | Step 5 | Render the Update Plan (Four Tables) |
| Step 5 | Step 6 | User Confirmation (Per-Table) |
| Step 6 | Step 7 | (Optional) Read-only Code Verification |
| Step 7 | Step 8 | Apply Updates (Merge Mode) |
| Step 8 | Step 9 | Report |
| Step 9 | Step 10 | State Update |

**Internal cross-references to update** (within business.md):

| Current Reference | Updated Reference | Context |
|---|---|---|
| `Step 3` (in Step 2 description, line 35) | `Step 4` | "The summary is what enables matching in Step 4" |
| `Step 1.2` (in Step 1 description, line 10) | Unchanged | Still refers to Step 1 sub-step |
| `Step 4d` (in Step 2 description, line 37) | `Step 5d` | YAML diff comparison reference |
| `Step 2 map` (in Step 3 description, lines 41, 47) | `Step 2 map` | Still refers to Step 2; unchanged |
| `Step 5` (in Step 6 description, line 104) | `Step 6` | "proceed directly to Step 8 with Step 6 selections" |
| `Step 2` (in Edge Cases, line 148) | Unchanged | Still refers to Step 2 |
| `Step 1` (in Edge Cases, line 149) | Unchanged | Still refers to Step 1 |
| `Step 5` (in Edge Cases, line 152) | `Step 6` | "User aborts at Step 6" |
| `Step 1 and Step 7` (in Edge Cases, line 155) | `Step 1 and Step 8` | Archive race condition |

**Additional safeguard in Step 8 (Apply Updates):**

Add one rule to the merge section:

```markdown
- All merged content must be already normalized per Step 3 rules. Do not re-introduce stripped references during inline replacement or append operations.
```

### 3.4 Change 3: Section Injection in `mvt-analyze-code`

In `mvt-analyze-code/manifest.yaml`, add the shared section after the inline Purpose section and before the `activation-load-context` section. This ensures the AI understands the Document Profile **before** it begins generating content.

**Insert position** in manifest.yaml sections array (after the first inline section, before `activation-load-context`):

```yaml
  - type: shared
    source: sections/project-context-profile.md
```

No changes to `mvt-analyze-code/business.md` are required — the Document Profile section provides cognitive guidance that naturally influences the AI's content generation decisions during Steps 5-8. The profile's quality standards (self-contained, actionable, atomic, lean) directly address the current gap where the skill only knows to "fill each template section with analysis results" without quality criteria.

### 3.5 Change 4: Section Injection in `mvt-manage-context`

In `mvt-manage-context/manifest.yaml`, add the shared section in the same manner as `mvt-analyze-code`. This ensures that when users manually add or edit entries in `project-context.md` through the CRUD operations of this skill, the AI applies the same quality standards.

---

## 4. Modification Summary

### 4.1 File Changes

| File | Type | Description |
|------|------|-------------|
| `sources/sections/project-context-profile.md` | **New** | Shared section defining the document profile, quality standards, and exclusion principles |
| `sources/skills/mvt-sync-context/manifest.yaml` | **Modify** | Add `type: shared` section referencing `project-context-profile.md`; insert after `activation-preflight`, before `type: file` (business.md) |
| `sources/skills/mvt-sync-context/business.md` | **Modify** | Insert new Step 3 (Normalize Extracted Content); renumber Steps 3-9 → 4-10; update all internal cross-references; add normalization confirmation rule to Step 8 (Apply Updates) |
| `sources/skills/mvt-analyze-code/manifest.yaml` | **Modify** | Add `type: shared` section referencing `project-context-profile.md` |
| `sources/skills/mvt-manage-context/manifest.yaml` | **Modify** | Add `type: shared` section referencing `project-context-profile.md` |

### 4.2 No Changes Required

| Item | Reason |
|------|--------|
| TypeScript source code (`src/`) | Content quality enforcement is a skill-instruction concern, not a build-pipeline concern |
| `sources/templates/project-context/body.md` | Template defines structure only; quality is governed by the new shared section |
| `install-manifest.yaml` | No new files are materialized to the user's project; the shared section is composed into existing SKILL.md files at build time |
| `registry.yaml` | No new skill or knowledge entry; the shared section is a build-time composition unit |
| Test suite (`test/`) | The assembler and section-loader tests already cover shared section composition; no new build-time logic is introduced |

### 4.3 Verification Steps

After implementation, verify with:

```bash
npm run build
node dist/index.js build --out .test-output

# 1. Verify the shared section is composed into all three skills
cat .test-output/.claude/skills/mvt-sync-context/SKILL.md | grep -A 5 "Document Profile"
cat .test-output/.claude/skills/mvt-analyze-code/SKILL.md | grep -A 5 "Document Profile"
cat .test-output/.claude/skills/mvt-manage-context/SKILL.md | grep -A 5 "Document Profile"

# 2. Verify step renumbering in mvt-sync-context
cat .test-output/.claude/skills/mvt-sync-context/SKILL.md | grep "### Step"

# 3. Verify no cross-references remain in the rendered skill
cat .test-output/.claude/skills/mvt-sync-context/SKILL.md

# 4. Run existing test suite
npm test
```

---

## 5. Expected Outcome

### 5.1 Before (Capibara Example)

```markdown
| Subscriber Idempotency Contract | Every `eventBus.on()` handler must be idempotent via idempotency key or exists-or-skip semantics (ADR-06, §12.4) |
| IExecutor | AI abstraction boundary port; Execution touches AI only via this interface (D-7) |
```

```markdown
- B-1: resume() degrades to rebuild on protocol error
- B-2: aggregation-mode `all` has timeout progression
- Subscriber idempotency: every `eventBus.on()` handler must be idempotent (idempotency key or exists-or-skip semantics per ADR-06/§12.4)
```

### 5.2 After (Expected)

```markdown
| Subscriber Idempotency Contract | Every `eventBus.on()` handler must be idempotent via idempotency key or exists-or-skip semantics |
| IExecutor | AI abstraction boundary port; Execution touches AI only via this interface |
```

```markdown
- resume() degrades to rebuild on protocol error
- aggregation-mode `all` has timeout progression
- Subscriber idempotency: every `eventBus.on()` handler must be idempotent (idempotency key or exists-or-skip semantics)
```

### 5.3 Systemic Benefits

| Benefit | Mechanism |
|---------|-----------|
| **All 3 writing skills share the same quality definition** | Shared section prevents definition drift across mvt-analyze-code, mvt-sync-context, and mvt-manage-context |
| **Future noise patterns are handled by principle, not enumeration** | The "governing principle" in the Document Profile ("if understanding requires an external document, strip the reference marker") covers unanticipated cross-reference formats |
| **Token budget pressure reduced** | Stripping references and label prefixes directly reduces the token count of project-context.md, moving it closer to the ≤4000 healthy threshold |
| **Consumer skills get cleaner input** | mvt-test can match business rules to test cases without parsing around `B-1:` prefixes; mvt-implement can validate layer compliance without ADR noise |
| **Custom template support preserved** | Quality standards are expressed as principles (self-contained, actionable, atomic, lean, stable), not as per-section prescriptions — compatible with any user-defined template structure |
