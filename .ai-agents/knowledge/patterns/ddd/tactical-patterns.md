# DDD Tactical Patterns — Key Rules

Quick reference for key rules when applying DDD.

## Key Rules

1. **One repository per aggregate root** — never for child entities
2. **Reference other aggregates by ID** — not by object reference
3. **Keep aggregates small** — only include what must be immediately consistent
4. **Domain layer has zero infrastructure imports** — dependency inversion
5. **Events are immutable facts** — include all context needed to understand what happened
6. **Value Objects validate in constructor** — always valid or not created
