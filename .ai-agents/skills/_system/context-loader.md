---
id: context-loader
name: Context Loader
type: system
invoked_by: all_agents
auto_invoke: on_activation
---

# Context Loader

Defines what each agent should load on activation. Agents read this file to determine which workspace and knowledge files to load based on the current command.

---

## Basic Loading (All Commands)

Always load these two files first:

| File | Purpose |
|------|---------|
| `workspace/session.yaml` | Current session state, active change, progress |
| `workspace/project-context.yaml` | Project info, tech stack, architecture, requirements |

---

## Extended Loading by Command Type

After basic loading, load additional files based on the command:

| Command | Additional Files |
|---------|-----------------|
| `#init` | Scan project root for config files |
| `#analyze` | `workspace/requirements/` (if exists) |
| `#design` | `knowledge/patterns/{active}/`, `knowledge/core/` |
| `#implement` | `knowledge/patterns/{active}/`, `knowledge/principle/`, `workspace/artifacts/{active-change}/` |
| `#fix` | Related source files only |
| `#refactor` | `knowledge/patterns/{active}/`, related source files |
| `#review` | `knowledge/core/review-principles.md`, `knowledge/principle/`, `knowledge/patterns/{active}/review-checklist.md` |
| `#test` | `knowledge/core/review-principles.md`, `knowledge/patterns/{active}/`, implementation files |
| `#status` | None (basic loading is sufficient) |
| `#config` | `config.yaml` |

> `{active}` refers to `pattern.active` in `config.yaml`.

---

## Empty Content Detection

When loading required files, check for empty/default content and warn the user:

| File | Empty Indicator | Warning |
|------|----------------|---------|
| `workspace/session.yaml` | `session.initialized_at: ""` | "Session not initialized. Run `#init` first." |
| `workspace/project-context.yaml` | `project.name: ""` | "Project not initialized. Run `#init` first." |
| `workspace/project-context.yaml` | No features in requirements | "No requirements found. Run `#analyze` first." |
| `workspace/project-context.yaml` | No modules in architecture | "No architecture defined. Run `#design` first." |

When an empty indicator is found on a required file:
1. Output warning message
2. Suggest the appropriate initialization command
3. Do NOT proceed until prerequisites are met

---

## Code Mapping

Use `workspace/project-context.yaml` architecture section for efficient file location:

```yaml
# workspace/project-context.yaml → architecture.modules
modules:
  - name: domain
    path: src/domain/
    entities: [User, Order]
```

When the user mentions an entity or module name, check `project-context.yaml` to locate related files and load only those — skip unrelated modules.

---

## Topic-Based Loading

Use `workspace/project-context.yaml` decisions section for topic-based lookups:

```yaml
# workspace/project-context.yaml → architecture.decisions
decisions:
  - id: auth
    topic: authentication
    related_files: [src/auth/]
```

Extract keywords from the user's request, match against decisions/modules, and load only matched sections.
