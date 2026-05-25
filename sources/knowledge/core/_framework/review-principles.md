# Code Review Principles

Actionable checklist for reviewing code quality. Use during `#review` and as reference during `#implement`.

## Naming & Readability

- [ ] Classes/functions named by **what they do**, not how they do it
- [ ] No abbreviations unless universally understood (e.g., `id`, `url`, `http`)
- [ ] Boolean variables/methods start with `is`, `has`, `can`, `should`
- [ ] Collections named as plural nouns; single items as singular
- [ ] No "Manager", "Helper", "Utils" god-classes — split by responsibility

## Single Responsibility

- [ ] Each class/module has **one reason to change**
- [ ] Functions do **one thing** and are ≤ 30 lines (guideline, not hard rule)
- [ ] If you need "and" to describe what a function does → split it

## Dependency Direction

- [ ] Business logic does NOT import framework/infrastructure code
- [ ] Dependencies point **inward** (infrastructure → application → domain)
- [ ] External services accessed through **interfaces/abstractions**
- [ ] No circular dependencies between modules

## Error Handling

- [ ] Errors are handled at the **appropriate level** (not swallowed silently)
- [ ] Fail fast: validate inputs at entry points
- [ ] No empty catch blocks
- [ ] Error messages include **context** (what failed, why, what to do)

## Duplication & Abstraction

- [ ] No copy-paste blocks — extract shared logic into functions
- [ ] But: don't merge similar-looking code that changes for **different reasons**
- [ ] Abstractions are justified by **current** requirements, not hypothetical ones
- [ ] No dead code or commented-out blocks

## State & Side Effects

- [ ] Mutable state is **minimized** and localized
- [ ] Functions clearly indicate whether they have side effects
- [ ] No hidden global state mutations
- [ ] Concurrent access to shared state is protected

## Testing Indicators

- [ ] Public API has clear contracts that are testable
- [ ] Dependencies are injectable (not hard-coded `new`)
- [ ] No logic in constructors that makes testing difficult
