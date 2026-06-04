## Document Profile: project-context.md

Before writing to `project-context.md`, understand what this document IS and IS NOT.

### Identity
`project-context.md` is the project's **long-term semantic ground truth** -- a self-contained knowledge base consumed by AI skills to make decisions. It is NOT a copy of design documents, NOT a changelog, NOT an ADR index.

### Audience
The readers are AI skill instances (implementer, designer, tester, reviewer), NOT humans reading for reference. They use this document to make **binary decisions** (is this import legal? does this test cover this rule?) -- not to trace design rationale.

### Content Quality Standards
Every piece of content written into `project-context.md` must satisfy ALL of the following:

1. **Self-contained**: understandable without consulting any external document, artifact, or ADR.
2. **Actionable**: usable by an AI skill to make a yes/no decision or produce a concrete output (e.g., a test case).
3. **Atomic**: each item is independently meaningful -- not a fragment of a larger argument that only makes sense in its source document.
4. **Lean**: the token budget for this document is <= 4000 (healthy threshold). Content that does not directly serve a decision should be excluded.
5. **Stable**: only persist knowledge with long-term reference value. Transient state (change metadata, in-progress decisions, temporary workarounds) belongs in session.yaml or artifacts.

### Governing Principle (What Does NOT Belong)
**If a reader must consult an external document to understand an entry, that entry -- or its reference marker -- does not belong here.**

Strip any cross-reference marker (pointers to ADRs, design-document section numbers, internal rule labels, etc.). Remove only the *reference marker*, NEVER the *substantive content* it annotates.

- ✅ `idempotency key or exists-or-skip semantics (ADR-06, §12.4)` → `idempotency key or exists-or-skip semantics`
- ✅ `B-1: resume() degrades to rebuild on protocol error` → `resume() degrades to rebuild on protocol error`
- ❌ `Subscriber Idempotency Contract` -- this is the term itself, keep it.

> This profile applies ONLY when the target document is `project-context.md`. Other knowledge files (principle/, project/, core/user/, etc.) are not governed by it.
